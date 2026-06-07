#include "sim_io_outputs.h"
#include "pins.h"

#include <stdio.h>
#include "esp_timer.h"
#include "esp_log.h"
#include "driver/gpio.h"
#include "driver/ledc.h"

// Check SoC capability for DAC to avoid compile issues on ESP32-S3 and other non-DAC SoCs
#include "soc/soc_caps.h"
#if SOC_DAC_SUPPORTED
#include "driver/dac_oneshot.h"
static dac_oneshot_handle_t tps_dac_handle = NULL;
static dac_oneshot_handle_t egt_dac_handle = NULL;
#endif

static const char *TAG = "SIM_IO";

// Non-blocking Quick-Shifter state variables
static bool qs_pulse_active = false;
static uint64_t qs_pulse_start_time = 0;
#define QS_PULSE_DURATION_US (75 * 1000) // 75ms pulse duration (calibrated 50ms - 100ms)

/**
 * @brief Helper function to initialize LEDC Pick-up coil generator
 */
static void sim_io_pickup_init(void) {
    ESP_LOGI(TAG, "Initializing Pick-up Coil LEDC generator...");

    ledc_timer_config_t ledc_timer = {
        .speed_mode       = LEDC_LOW_SPEED_MODE, // Standard/low speed mode works on all chips
        .timer_num        = LEDC_TIMER_0,
        .duty_resolution  = LEDC_TIMER_10_BIT,
        .freq_hz          = 10,                 // Dynamic start frequency (10 Hz)
        .clk_cfg          = LEDC_AUTO_CLK
    };
    if (ledc_timer_config(&ledc_timer) != ESP_OK) {
        ESP_LOGE(TAG, "Failed to configure LEDC timer");
        return;
    }

    ledc_channel_config_t ledc_channel = {
        .speed_mode     = LEDC_LOW_SPEED_MODE,
        .channel        = LEDC_CHANNEL_0,
        .timer_sel      = LEDC_TIMER_0,
        .intr_type      = LEDC_INTR_DISABLE,
        .gpio_num       = SIM_PIN_PICKUP,
        .duty           = 512,                 // 50% duty cycle square wave (2^10 / 2 = 512)
        .hpoint         = 0
    };
    if (ledc_channel_config(&ledc_channel) != ESP_OK) {
        ESP_LOGE(TAG, "Failed to configure LEDC channel");
    }
}

/**
 * @brief Helper function to initialize dual DAC channels if supported by the MCU
 */
static void sim_io_analog_out_init(void) {
#if SOC_DAC_SUPPORTED
    ESP_LOGI(TAG, "Initializing on-chip dual DAC channels...");

    dac_oneshot_config_t tps_cfg = {
        .chan_id = DAC_CHAN_1, // Channel 2 -> GPIO26 on ESP32, GPIO18 on ESP32-S2
    };
    if (dac_oneshot_new_channel(&tps_cfg, &tps_dac_handle) != ESP_OK) {
        ESP_LOGE(TAG, "Failed to initialize TPS DAC oneshot channel");
    }

    dac_oneshot_config_t egt_cfg = {
        .chan_id = DAC_CHAN_0, // Channel 1 -> GPIO25 on ESP32, GPIO17 on ESP32-S2
    };
    if (dac_oneshot_new_channel(&egt_cfg, &egt_dac_handle) != ESP_OK) {
        ESP_LOGE(TAG, "Failed to initialize EGT DAC oneshot channel");
    }

    ESP_LOGI(TAG, "Dual DAC channels initialized successfully");
#else
    ESP_LOGW(TAG, "Hardware DAC is not supported on this SoC target. Analog voltage generation is disabled.");
#endif
}

void sim_io_init(void) {
    ESP_LOGI(TAG, "Initializing Emulator Hardware I/O drivers...");

    // 1. Configure Quick-Shifter digital output pin
    gpio_config_t qs_io_conf = {
        .pin_bit_mask = (1ULL << SIM_PIN_QS_OUT),
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = GPIO_PULLUP_EN,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE
    };
    gpio_config(&qs_io_conf);
    gpio_set_level(SIM_PIN_QS_OUT, 1); // Default HIGH

    // 2. Initialize Pick-up coil generator
    sim_io_pickup_init();

    // 3. Initialize dual DAC analog outputs
    sim_io_analog_out_init();
}

void sim_io_pickup_set_frequency(uint32_t freq) {
    if (freq == 0) {
        ledc_set_duty(LEDC_LOW_SPEED_MODE, LEDC_CHANNEL_0, 0); // Stop pulsing
    } else {
        ledc_set_freq(LEDC_LOW_SPEED_MODE, LEDC_TIMER_0, freq);
        ledc_set_duty(LEDC_LOW_SPEED_MODE, LEDC_CHANNEL_0, 512); // Maintain 50% duty (10-bit resolution)
    }
    ledc_update_duty(LEDC_LOW_SPEED_MODE, LEDC_CHANNEL_0);
}

void sim_io_set_tps_voltage(float percent) {
#if SOC_DAC_SUPPORTED
    if (tps_dac_handle) {
        // Scale 0.0 - 100.0% to 0 - 255 DAC value (0V to 3.3V)
        uint8_t dac_val = (uint8_t)((percent / 100.0f) * 255.0f);
        dac_oneshot_output_voltage(tps_dac_handle, dac_val);
    }
#endif
}

void sim_io_set_egt_voltage(float percent) {
#if SOC_DAC_SUPPORTED
    if (egt_dac_handle) {
        // Scale 0.0 - 100.0% to 0 - 255 DAC value (0V to 3.3V)
        uint8_t dac_val = (uint8_t)((percent / 100.0f) * 255.0f);
        dac_oneshot_output_voltage(egt_dac_handle, dac_val);
    }
#endif
}

void sim_io_qs_trigger(void) {
    qs_pulse_active = true;
    qs_pulse_start_time = esp_timer_get_time();
    gpio_set_level(SIM_PIN_QS_OUT, 0); // Active LOW
    ESP_LOGI(TAG, "Quick-Shifter pulse triggered: pulling Pin LOW");
}

void sim_io_fast_poll(void) {
    if (qs_pulse_active) {
        uint64_t elapsed = esp_timer_get_time() - qs_pulse_start_time;
        if (elapsed >= QS_PULSE_DURATION_US) {
            gpio_set_level(SIM_PIN_QS_OUT, 1); // Restore HIGH
            qs_pulse_active = false;
            ESP_LOGI(TAG, "Quick-Shifter pulse finished: pin restored HIGH after %d us", (int)elapsed);
        }
    }
}
