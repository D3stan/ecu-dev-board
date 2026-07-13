#include "driver/gpio.h"
#include "esp_err.h"

#include "engine_control.h"
#include "status_led.h"
#include "test-bench_config.h"

void status_led_set_state(engine_state_t state)
{
    const uint32_t red_active =
        state == ENGINE_STATE_NO_SIGNAL ||
        state == ENGINE_STATE_ACQUISITION;
    const uint32_t green_active =
        state == ENGINE_STATE_ACQUISITION ||
        state == ENGINE_STATE_SYNCHRONIZED;

    (void)gpio_set_level(RGB_RED_GPIO, red_active);
    (void)gpio_set_level(RGB_GREEN_GPIO, green_active);
    (void)gpio_set_level(RGB_BLUE_GPIO, 0U);
}

esp_err_t status_led_init(void)
{
    const gpio_config_t led_config = {
        .pin_bit_mask = (1ULL << RGB_RED_GPIO) |
                        (1ULL << RGB_GREEN_GPIO) |
                        (1ULL << RGB_BLUE_GPIO),
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    esp_err_t result = gpio_config(&led_config);
    if (result != ESP_OK) {
        return result;
    }

    status_led_set_state(ENGINE_STATE_NO_SIGNAL);
    return ESP_OK;
}
