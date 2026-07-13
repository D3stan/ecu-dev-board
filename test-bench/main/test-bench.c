#include <stdbool.h>
#include <stdint.h>

#include "driver/gpio.h"
#include "driver/rmt_encoder.h"
#include "driver/rmt_tx.h"
#include "esp_err.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "hal/rmt_types.h"

#include "test-bench_config.h"

#define US_PER_SECOND 1000000U
#define FIRE_DURATION_TICKS \
    ((RMT_RESOLUTION_HZ / US_PER_SECOND) * FIRE_DURATION_US)
#define RMT_DURATION_MAX 32767U

_Static_assert((RMT_RESOLUTION_HZ % US_PER_SECOND) == 0U,
               "RMT resolution must convert microseconds exactly");
_Static_assert(FIRE_DURATION_TICKS > 0U,
               "fire duration must be at least one RMT tick");
_Static_assert(FIRE_DURATION_TICKS <= RMT_DURATION_MAX,
               "fire duration must fit in one RMT symbol phase");

static TaskHandle_t s_fire_task_handle;
static rmt_channel_handle_t s_fire_channel;
static rmt_channel_handle_t s_led_channel;
static rmt_encoder_handle_t s_fire_encoder;
static rmt_encoder_handle_t s_led_encoder;
static rmt_sync_manager_handle_t s_sync_manager;

static const rmt_symbol_word_t s_fire_symbol = {
    .level0 = 1,
    .duration0 = FIRE_DURATION_TICKS,
    .level1 = 0,
    .duration1 = 1,
};

static const rmt_transmit_config_t s_transmit_config = {
    .loop_count = 0,
    .flags.eot_level = 0,
    .flags.queue_nonblocking = 0,
};

static void button_isr_handler(void *arg)
{
    (void)arg;
    BaseType_t higher_priority_task_woken = pdFALSE;

    gpio_intr_disable(BUTTON_GPIO);
    vTaskNotifyGiveFromISR(s_fire_task_handle, &higher_priority_task_woken);
    if (higher_priority_task_woken == pdTRUE) {
        portYIELD_FROM_ISR();
    }
}

static void transmit_fire_pulse(void)
{
    ESP_ERROR_CHECK(rmt_transmit(s_fire_channel, s_fire_encoder,
                                 &s_fire_symbol, sizeof(s_fire_symbol),
                                 &s_transmit_config));
    ESP_ERROR_CHECK(rmt_transmit(s_led_channel, s_led_encoder,
                                 &s_fire_symbol, sizeof(s_fire_symbol),
                                 &s_transmit_config));
    ESP_ERROR_CHECK(rmt_tx_wait_all_done(s_fire_channel, -1));
    ESP_ERROR_CHECK(rmt_tx_wait_all_done(s_led_channel, -1));
    ESP_ERROR_CHECK(rmt_sync_reset(s_sync_manager));
}

static void wait_for_stable_button_release(void)
{
    const TickType_t debounce_ticks = pdMS_TO_TICKS(BUTTON_DEBOUNCE_MS);

    vTaskDelay(debounce_ticks);
    for (;;) {
        while (gpio_get_level(BUTTON_GPIO) == 0) {
            vTaskDelay(debounce_ticks);
        }

        vTaskDelay(debounce_ticks);
        if (gpio_get_level(BUTTON_GPIO) != 0) {
            return;
        }
    }
}

static void fire_task(void *arg)
{
    (void)arg;

    for (;;) {
        ulTaskNotifyTake(pdTRUE, portMAX_DELAY);
        transmit_fire_pulse();
        wait_for_stable_button_release();
        ESP_ERROR_CHECK(gpio_intr_enable(BUTTON_GPIO));
    }
}

static void configure_output_gpio(void)
{
    const gpio_config_t fire_config = {
        .pin_bit_mask = 1ULL << FIRE_OUTPUT_GPIO,
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_ENABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    const gpio_config_t led_config = {
        .pin_bit_mask = 1ULL << FIRE_LED_GPIO,
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };

    ESP_ERROR_CHECK(gpio_config(&fire_config));
    ESP_ERROR_CHECK(gpio_config(&led_config));
    ESP_ERROR_CHECK(gpio_set_level(FIRE_OUTPUT_GPIO, 0));
    ESP_ERROR_CHECK(gpio_set_level(FIRE_LED_GPIO, 0));
}

static void configure_rmt(void)
{
    rmt_tx_channel_config_t channel_config = {
        .gpio_num = FIRE_OUTPUT_GPIO,
        .clk_src = RMT_CLK_SRC_DEFAULT,
        .resolution_hz = RMT_RESOLUTION_HZ,
        .mem_block_symbols = RMT_MEM_BLOCK_SYMBOLS,
        .trans_queue_depth = RMT_QUEUE_DEPTH,
        .flags.init_level = 0,
    };
    const rmt_copy_encoder_config_t encoder_config = {};

    ESP_ERROR_CHECK(rmt_new_tx_channel(&channel_config, &s_fire_channel));
    channel_config.gpio_num = FIRE_LED_GPIO;
    ESP_ERROR_CHECK(rmt_new_tx_channel(&channel_config, &s_led_channel));

    ESP_ERROR_CHECK(rmt_new_copy_encoder(&encoder_config, &s_fire_encoder));
    ESP_ERROR_CHECK(rmt_new_copy_encoder(&encoder_config, &s_led_encoder));

    ESP_ERROR_CHECK(rmt_enable(s_fire_channel));
    ESP_ERROR_CHECK(rmt_enable(s_led_channel));

    const rmt_channel_handle_t channels[] = {
        s_fire_channel,
        s_led_channel,
    };
    const rmt_sync_manager_config_t sync_config = {
        .tx_channel_array = channels,
        .array_size = sizeof(channels) / sizeof(channels[0]),
    };
    ESP_ERROR_CHECK(rmt_new_sync_manager(&sync_config, &s_sync_manager));
}

static void configure_button(void)
{
    const gpio_config_t button_config = {
        .pin_bit_mask = 1ULL << BUTTON_GPIO,
        .mode = GPIO_MODE_INPUT,
        .pull_up_en = GPIO_PULLUP_ENABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_NEGEDGE,
    };

    ESP_ERROR_CHECK(gpio_config(&button_config));
    ESP_ERROR_CHECK(gpio_install_isr_service(0));
    ESP_ERROR_CHECK(gpio_isr_handler_add(BUTTON_GPIO, button_isr_handler, NULL));
}

void app_main(void)
{
    configure_output_gpio();
    configure_rmt();

    BaseType_t task_created = xTaskCreate(fire_task, "fire_pulse",
                                          FIRE_TASK_STACK_SIZE, NULL,
                                          FIRE_TASK_PRIORITY,
                                          &s_fire_task_handle);
    ESP_ERROR_CHECK(task_created == pdPASS ? ESP_OK : ESP_ERR_NO_MEM);

    configure_button();
}
