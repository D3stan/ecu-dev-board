#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#include "esp_adc/adc_cali.h"
#include "esp_adc/adc_cali_scheme.h"
#include "esp_adc/adc_oneshot.h"
#include "esp_attr.h"
#include "esp_err.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/portmacro.h"
#include "freertos/task.h"

#include "test-bench_config.h"
#include "tps.h"

_Static_assert(TPS_FILTER_WINDOW_SIZE == 5U,
               "TPS median implementation requires five samples");
_Static_assert(TPS_ADC_MAX_MV > TPS_ADC_MIN_MV,
               "TPS ADC endpoints must define a positive range");
_Static_assert(configTICK_RATE_HZ >= TPS_SAMPLE_RATE_HZ,
               "FreeRTOS tick rate must support TPS sampling");

static adc_oneshot_unit_handle_t s_adc_handle;
static adc_cali_handle_t s_adc_calibration;
static adc_channel_t s_adc_channel;
static bool s_calibration_available;
static DRAM_ATTR volatile uint8_t s_tps_percent;
static portMUX_TYPE s_snapshot_lock = portMUX_INITIALIZER_UNLOCKED;
static tps_snapshot_t s_snapshot;

static uint8_t median_of_five(const uint8_t samples[TPS_FILTER_WINDOW_SIZE])
{
    uint8_t sorted[TPS_FILTER_WINDOW_SIZE];

    for (size_t index = 0; index < TPS_FILTER_WINDOW_SIZE; ++index) {
        sorted[index] = samples[index];
    }

    for (size_t index = 1; index < TPS_FILTER_WINDOW_SIZE; ++index) {
        const uint8_t value = sorted[index];
        size_t position = index;
        while (position > 0U && sorted[position - 1U] > value) {
            sorted[position] = sorted[position - 1U];
            --position;
        }
        sorted[position] = value;
    }

    return sorted[TPS_FILTER_WINDOW_SIZE / 2U];
}

static uint8_t millivolts_to_percent(int millivolts)
{
    if (millivolts <= (int)TPS_ADC_MIN_MV) {
        return 0U;
    }
    if (millivolts >= (int)TPS_ADC_MAX_MV) {
        return 100U;
    }

    const uint32_t span_mv = TPS_ADC_MAX_MV - TPS_ADC_MIN_MV;
    const uint32_t relative_mv =
        (uint32_t)millivolts - TPS_ADC_MIN_MV;
    return (uint8_t)((relative_mv * 100U + span_mv / 2U) / span_mv);
}

static int raw_to_nominal_millivolts(int raw)
{
    const uint32_t adc_full_scale = (1U << SOC_ADC_RTC_MAX_BITWIDTH) - 1U;
    return (int)(((uint32_t)raw * TPS_ADC_MAX_MV +
                  adc_full_scale / 2U) /
                 adc_full_scale);
}

static void tps_task(void *arg)
{
    (void)arg;
    uint8_t samples[TPS_FILTER_WINDOW_SIZE] = {};
    size_t next_sample = 0U;
    bool initialized = false;
    TickType_t last_wake = xTaskGetTickCount();
    uint32_t tick_remainder = 0U;

    for (;;) {
        int raw = 0;
        if (adc_oneshot_read(s_adc_handle, s_adc_channel, &raw) == ESP_OK) {
            int millivolts = raw_to_nominal_millivolts(raw);
            if (s_calibration_available) {
                int calibrated_mv = 0;
                if (adc_cali_raw_to_voltage(s_adc_calibration, raw,
                                            &calibrated_mv) == ESP_OK) {
                    millivolts = calibrated_mv;
                }
            }

            const uint8_t sample = millivolts_to_percent(millivolts);
            if (!initialized) {
                for (size_t index = 0; index < TPS_FILTER_WINDOW_SIZE;
                     ++index) {
                    samples[index] = sample;
                }
                initialized = true;
            } else {
                samples[next_sample] = sample;
            }

            next_sample = (next_sample + 1U) % TPS_FILTER_WINDOW_SIZE;
            const uint8_t filtered = median_of_five(samples);
            s_tps_percent = filtered;
            portENTER_CRITICAL(&s_snapshot_lock);
            s_snapshot.percent = filtered;
            s_snapshot.acquired_at_us = (uint64_t)esp_timer_get_time();
            ++s_snapshot.sequence;
            s_snapshot.valid = true;
            portEXIT_CRITICAL(&s_snapshot_lock);
        }

        TickType_t delay_ticks = configTICK_RATE_HZ / TPS_SAMPLE_RATE_HZ;
        tick_remainder += configTICK_RATE_HZ % TPS_SAMPLE_RATE_HZ;
        if (tick_remainder >= TPS_SAMPLE_RATE_HZ) {
            ++delay_ticks;
            tick_remainder -= TPS_SAMPLE_RATE_HZ;
        }
        vTaskDelayUntil(&last_wake, delay_ticks);
    }
}

static esp_err_t init_adc_calibration(adc_unit_t unit)
{
#if ADC_CALI_SCHEME_CURVE_FITTING_SUPPORTED
    const adc_cali_curve_fitting_config_t calibration_config = {
        .unit_id = unit,
        .chan = s_adc_channel,
        .atten = ADC_ATTEN_DB_12,
        .bitwidth = ADC_BITWIDTH_DEFAULT,
    };
    esp_err_t result = adc_cali_create_scheme_curve_fitting(
        &calibration_config, &s_adc_calibration);
#elif ADC_CALI_SCHEME_LINE_FITTING_SUPPORTED
    const adc_cali_line_fitting_config_t calibration_config = {
        .unit_id = unit,
        .atten = ADC_ATTEN_DB_12,
        .bitwidth = ADC_BITWIDTH_DEFAULT,
    };
    esp_err_t result = adc_cali_create_scheme_line_fitting(
        &calibration_config, &s_adc_calibration);
#else
    esp_err_t result = ESP_ERR_NOT_SUPPORTED;
#endif

    if (result == ESP_OK) {
        s_calibration_available = true;
        return ESP_OK;
    }
    if (result == ESP_ERR_NOT_SUPPORTED) {
        s_calibration_available = false;
        s_adc_calibration = NULL;
        return ESP_OK;
    }
    return result;
}

esp_err_t tps_init(void)
{
    adc_unit_t unit;
    esp_err_t result = adc_oneshot_io_to_channel(TPS_ADC_GPIO, &unit,
                                                  &s_adc_channel);
    if (result != ESP_OK) {
        return result;
    }
    if (unit != ADC_UNIT_1) {
        return ESP_ERR_INVALID_ARG;
    }

    const adc_oneshot_unit_init_cfg_t unit_config = {
        .unit_id = unit,
        .clk_src = ADC_RTC_CLK_SRC_DEFAULT,
        .ulp_mode = ADC_ULP_MODE_DISABLE,
    };
    result = adc_oneshot_new_unit(&unit_config, &s_adc_handle);
    if (result != ESP_OK) {
        return result;
    }

    const adc_oneshot_chan_cfg_t channel_config = {
        .atten = ADC_ATTEN_DB_12,
        .bitwidth = ADC_BITWIDTH_DEFAULT,
    };
    result = adc_oneshot_config_channel(s_adc_handle, s_adc_channel,
                                         &channel_config);
    if (result != ESP_OK) {
        return result;
    }

    result = init_adc_calibration(unit);
    if (result != ESP_OK) {
        return result;
    }

    BaseType_t task_created = xTaskCreate(tps_task, "tps_sample",
                                          TPS_TASK_STACK_SIZE, NULL,
                                          TPS_TASK_PRIORITY, NULL);
    return task_created == pdPASS ? ESP_OK : ESP_ERR_NO_MEM;
}

uint8_t tps_get_percent(void)
{
    return s_tps_percent;
}

void tps_get_snapshot(tps_snapshot_t *snapshot)
{
    if (snapshot == NULL) {
        return;
    }

    portENTER_CRITICAL(&s_snapshot_lock);
    *snapshot = s_snapshot;
    portEXIT_CRITICAL(&s_snapshot_lock);
}
