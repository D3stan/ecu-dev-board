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

#include "esp_adc/adc_oneshot.h"
#include "esp_adc/adc_cali.h"
#include "esp_adc/adc_cali_scheme.h"
#include "sim_state.h"

static adc_oneshot_unit_handle_t adc1_handle = NULL;
static adc_cali_handle_t adc1_cali_handle = NULL;
static bool adc1_cali_enabled = false;

static const char *TAG = "SIM_IO";

// Non-blocking Quick-Shifter state variables
static bool qs_pulse_active = false;
static uint64_t qs_pulse_start_time = 0;
#define QS_PULSE_DURATION_US (75 * 1000) // 75ms pulse duration (calibrated 50ms - 100ms)

// Physical active-low Quick-Shifter button debounce state.
static int qs_input_last_raw_level = 1;
static int qs_input_debounced_level = 1;
static uint64_t qs_input_last_change_time = 0;
static bool qs_input_press_handled = false;
#define SIM_QS_INPUT_DEBOUNCE_US (20 * 1000)

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

#if CONFIG_IDF_TARGET_ESP32S2
#define SIM_ADC_ATTEN ADC_ATTEN_DB_12
#define SIM_ADC_BITWIDTH ADC_BITWIDTH_DEFAULT
#define SIM_ADC_RAW_MAX 8191.0f
#define SIM_POT_FULL_SCALE_MV 2500
#define SIM_TPS_ADC_CHANNEL ADC_CHANNEL_0
#define SIM_EGT_ADC_CHANNEL ADC_CHANNEL_1
#elif CONFIG_IDF_TARGET_ESP32
#define SIM_ADC_ATTEN ADC_ATTEN_DB_11
#define SIM_ADC_BITWIDTH ADC_BITWIDTH_DEFAULT
#define SIM_ADC_RAW_MAX 4095.0f
#define SIM_POT_FULL_SCALE_MV 3300
#define SIM_TPS_ADC_CHANNEL ADC_CHANNEL_4
#define SIM_EGT_ADC_CHANNEL ADC_CHANNEL_5
#else
#define SIM_ADC_ATTEN ADC_ATTEN_DB_12
#define SIM_ADC_BITWIDTH ADC_BITWIDTH_DEFAULT
#define SIM_ADC_RAW_MAX 4095.0f
#define SIM_POT_FULL_SCALE_MV 3300
#define SIM_TPS_ADC_CHANNEL ADC_CHANNEL_4
#define SIM_EGT_ADC_CHANNEL ADC_CHANNEL_5
#endif

static bool sim_io_adc_calibration_init(void) {
#if ADC_CALI_SCHEME_LINE_FITTING_SUPPORTED
    adc_cali_line_fitting_config_t cali_config = {
        .unit_id = ADC_UNIT_1,
        .atten = SIM_ADC_ATTEN,
        .bitwidth = SIM_ADC_BITWIDTH,
    };
    esp_err_t ret = adc_cali_create_scheme_line_fitting(&cali_config, &adc1_cali_handle);
    if (ret == ESP_OK) {
        ESP_LOGI(TAG, "ADC calibration enabled using line fitting");
        return true;
    }
    ESP_LOGW(TAG, "ADC calibration unavailable (%s); falling back to raw ADC scaling", esp_err_to_name(ret));
#else
    ESP_LOGW(TAG, "ADC calibration scheme is not supported by this target");
#endif
    return false;
}

static float sim_io_adc_raw_to_pot_fraction(float raw_avg) {
    float fraction = raw_avg / SIM_ADC_RAW_MAX;

    if (adc1_cali_enabled && adc1_cali_handle) {
        int voltage_mv = 0;
        int raw = (int)(raw_avg + 0.5f);
        if (adc_cali_raw_to_voltage(adc1_cali_handle, raw, &voltage_mv) == ESP_OK) {
            fraction = (float)voltage_mv / (float)SIM_POT_FULL_SCALE_MV;
        }
    }

    if (fraction < 0.0f) fraction = 0.0f;
    if (fraction > 1.0f) fraction = 1.0f;
    return fraction;
}

static void sim_io_adc_init(void) {
    ESP_LOGI(TAG, "Initializing ADC1 for manual cockpit potentiometer inputs...");

    adc_oneshot_unit_init_cfg_t init_config1 = {
        .unit_id = ADC_UNIT_1,
        .clk_src = 0,
        .ulp_mode = ADC_ULP_MODE_DISABLE,
    };
    if (adc_oneshot_new_unit(&init_config1, &adc1_handle) != ESP_OK) {
        ESP_LOGE(TAG, "Failed to initialize ADC1 unit");
        return;
    }

    adc_oneshot_chan_cfg_t config = {
        .bitwidth = SIM_ADC_BITWIDTH,
        .atten = SIM_ADC_ATTEN,
    };
    
    // Configure target-specific ADC channels for SIM_PIN_TPS_POT and SIM_PIN_EGT_POT.
    if (adc_oneshot_config_channel(adc1_handle, SIM_TPS_ADC_CHANNEL, &config) != ESP_OK) {
        ESP_LOGE(TAG, "Failed to configure TPS ADC channel");
    }

    if (adc_oneshot_config_channel(adc1_handle, SIM_EGT_ADC_CHANNEL, &config) != ESP_OK) {
        ESP_LOGE(TAG, "Failed to configure EGT ADC channel");
    }

    adc1_cali_enabled = sim_io_adc_calibration_init();
}

void sim_io_init(void) {
    ESP_LOGI(TAG, "Initializing Emulator Hardware I/O drivers...");

    // 1. Configure Quick-Shifter digital output pin
    gpio_config_t qs_out_conf = {
        .pin_bit_mask = (1ULL << SIM_PIN_QS_OUT),
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = GPIO_PULLUP_ENABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE
    };
    gpio_config(&qs_out_conf);
    gpio_set_level(SIM_PIN_QS_OUT, 1); // Default HIGH

    // 2. Configure physical active-low Quick-Shifter button input
    gpio_config_t qs_in_conf = {
        .pin_bit_mask = (1ULL << SIM_PIN_QS_IN),
        .mode = GPIO_MODE_INPUT,
        .pull_up_en = GPIO_PULLUP_ENABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE
    };
    gpio_config(&qs_in_conf);
    qs_input_last_raw_level = gpio_get_level(SIM_PIN_QS_IN);
    qs_input_debounced_level = qs_input_last_raw_level;
    qs_input_last_change_time = esp_timer_get_time();
    qs_input_press_handled = (qs_input_debounced_level == 0);

    // 3. Initialize Pick-up coil generator
    sim_io_pickup_init();

    // 4. Initialize dual DAC analog outputs
    sim_io_analog_out_init();

    // 5. Initialize manual cockpit potentiometers ADC inputs
    sim_io_adc_init();
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

static void sim_io_poll_qs_input(void) {
    int raw_level = gpio_get_level(SIM_PIN_QS_IN);
    uint64_t now = esp_timer_get_time();

    if (raw_level != qs_input_last_raw_level) {
        qs_input_last_raw_level = raw_level;
        qs_input_last_change_time = now;
        return;
    }

    if (raw_level == qs_input_debounced_level) {
        return;
    }

    if ((now - qs_input_last_change_time) < SIM_QS_INPUT_DEBOUNCE_US) {
        return;
    }

    qs_input_debounced_level = raw_level;
    if (qs_input_debounced_level == 0 && !qs_input_press_handled) {
        qs_input_press_handled = true;
        sim_io_qs_trigger();
    } else if (qs_input_debounced_level == 1) {
        qs_input_press_handled = false;
    }
}

void sim_io_fast_poll(void) {
    sim_io_poll_qs_input();

    if (qs_pulse_active) {
        uint64_t elapsed = esp_timer_get_time() - qs_pulse_start_time;
        if (elapsed >= QS_PULSE_DURATION_US) {
            gpio_set_level(SIM_PIN_QS_OUT, 1); // Restore HIGH
            qs_pulse_active = false;
            ESP_LOGI(TAG, "Quick-Shifter pulse finished: pin restored HIGH after %d us", (int)elapsed);
        }
    }
}

void sim_io_read_potentiometers(void) {
    if (!adc1_handle) return;

    static int tps_history[4] = {0};
    static int egt_history[4] = {0};
    static int history_idx = 0;
    static bool history_filled = false;

    int raw_tps = 0;
    int raw_egt = 0;

    if (adc_oneshot_read(adc1_handle, SIM_TPS_ADC_CHANNEL, &raw_tps) != ESP_OK) {
        return;
    }
    if (adc_oneshot_read(adc1_handle, SIM_EGT_ADC_CHANNEL, &raw_egt) != ESP_OK) {
        return;
    }

    tps_history[history_idx] = raw_tps;
    egt_history[history_idx] = raw_egt;
    history_idx = (history_idx + 1) % 4;
    if (history_idx == 0) {
        history_filled = true;
    }

    int count = history_filled ? 4 : history_idx;
    if (count == 0) return;

    float sum_tps = 0;
    float sum_egt = 0;
    for (int i = 0; i < count; i++) {
        sum_tps += tps_history[i];
        sum_egt += egt_history[i];
    }
    float avg_tps = sum_tps / count;
    float avg_egt = sum_egt / count;

    // Map calibrated ADC voltage to physical values:
    // TPS: 0.0% to 100.0%
    float tps_fraction = sim_io_adc_raw_to_pot_fraction(avg_tps);
    float phys_tps = tps_fraction * 100.0f;
    if (phys_tps < 0.0f) phys_tps = 0.0f;
    if (phys_tps > 100.0f) phys_tps = 100.0f;

    // EGT: 20.0°C to 1000.0°C (difference is 980.0)
    float egt_fraction = sim_io_adc_raw_to_pot_fraction(avg_egt);
    float phys_egt = 20.0f + egt_fraction * 980.0f;
    if (phys_egt < 20.0f) phys_egt = 20.0f;
    if (phys_egt > 1000.0f) phys_egt = 1000.0f;

    // Access the global volatile state instance
    g_sim_state.tps.physical_val = phys_tps;
    g_sim_state.egt.physical_val = phys_egt;
}
