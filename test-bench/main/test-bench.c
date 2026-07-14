#include <inttypes.h>
#include <stdbool.h>
#include <stdint.h>

#include "driver/gpio.h"
#include "esp_attr.h"
#include "esp_err.h"
#include "esp_intr_alloc.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "engine_control.h"
#include "status_led.h"
#include "test-bench_config.h"
#include "tps.h"

#define MICROSECONDS_PER_MILLISECOND 1000U

static const char *TAG = "test_bench";
static DRAM_ATTR TaskHandle_t s_button_task_handle;

static void IRAM_ATTR button_isr_handler(void *arg)
{
    (void)arg;
    BaseType_t higher_priority_task_woken = pdFALSE;

    vTaskNotifyGiveFromISR(s_button_task_handle, &higher_priority_task_woken);
    if (higher_priority_task_woken == pdTRUE) {
        portYIELD_FROM_ISR();
    }
}

static void wait_for_stable_button_release(void)
{
    const int64_t debounce_us =
        BUTTON_DEBOUNCE_MS * MICROSECONDS_PER_MILLISECOND;

    for (;;) {
        while (gpio_get_level(BUTTON_GPIO) == 0) {
            ulTaskNotifyTake(pdTRUE, portMAX_DELAY);
        }

        int64_t high_since_us = esp_timer_get_time();
        while (gpio_get_level(BUTTON_GPIO) != 0) {
            int64_t remaining_us = debounce_us -
                                   (esp_timer_get_time() - high_since_us);
            if (remaining_us <= 0) {
                if (ulTaskNotifyTake(pdTRUE, 0) != 0) {
                    high_since_us = esp_timer_get_time();
                    continue;
                }
                return;
            }

            TickType_t wait_ticks = pdMS_TO_TICKS(
                (remaining_us + MICROSECONDS_PER_MILLISECOND - 1) /
                MICROSECONDS_PER_MILLISECOND);
            if (wait_ticks == 0) {
                wait_ticks = 1;
            }

            if (ulTaskNotifyTake(pdTRUE, wait_ticks) != 0 &&
                gpio_get_level(BUTTON_GPIO) != 0) {
                high_since_us = esp_timer_get_time();
            }
        }
    }
}

static void button_task(void *arg)
{
    (void)arg;

    for (;;) {
        ulTaskNotifyTake(pdTRUE, portMAX_DELAY);
        if (gpio_get_level(BUTTON_GPIO) != 0) {
            continue;
        }

        (void)engine_control_request_manual_fire();
        wait_for_stable_button_release();
    }
}

static void control_service_task(void *arg)
{
    (void)arg;
    engine_state_t displayed_state = ENGINE_STATE_NO_SIGNAL;
    TickType_t last_wake = xTaskGetTickCount();

    status_led_set_state(displayed_state);
    for (;;) {
        engine_control_service();
        const engine_state_t current_state = engine_control_get_state();
        if (current_state != displayed_state) {
            status_led_set_state(current_state);
            displayed_state = current_state;
        }
        vTaskDelayUntil(&last_wake,
                        pdMS_TO_TICKS(CONTROL_SERVICE_PERIOD_MS));
    }
}

#if TELEMETRY_UART_LOG_ENABLED
static const char *engine_state_name(engine_state_t state)
{
    switch (state) {
    case ENGINE_STATE_NO_SIGNAL:
        return "no_signal";
    case ENGINE_STATE_ACQUISITION:
        return "acquisition";
    case ENGINE_STATE_SYNCHRONIZED:
        return "synchronized";
    default:
        return "unknown";
    }
}

static void telemetry_task(void *arg)
{
    (void)arg;
    TickType_t last_wake = xTaskGetTickCount();

    for (;;) {
        engine_snapshot_t snapshot;
        engine_control_get_snapshot(&snapshot);
        ESP_LOGI(TAG,
                 "state=%s rpm=%" PRIu32 " tps=%u advance=%u.%u "
                 "period_us=%" PRIu32 " delay_us=%" PRIu32 " "
                 "rejected=%" PRIu32 " late=%" PRIu32 " "
                 "schedule_errors=%" PRIu32,
                 engine_state_name(snapshot.state), snapshot.rpm,
                 snapshot.tps_percent, snapshot.advance_tenths / 10U,
                 snapshot.advance_tenths % 10U, snapshot.period_us,
                 snapshot.delay_us, snapshot.rejected_edge_count,
                 snapshot.late_fire_count, snapshot.schedule_error_count);
        vTaskDelayUntil(&last_wake,
                        pdMS_TO_TICKS(TELEMETRY_UART_PERIOD_MS));
    }
}
#endif

static esp_err_t configure_button(void)
{
    const gpio_config_t button_config = {
        .pin_bit_mask = 1ULL << BUTTON_GPIO,
        .mode = GPIO_MODE_INPUT,
        .pull_up_en = GPIO_PULLUP_ENABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_ANYEDGE,
    };

    esp_err_t result = gpio_config(&button_config);
    if (result != ESP_OK) {
        return result;
    }
    return gpio_isr_handler_add(BUTTON_GPIO, button_isr_handler, NULL);
}

static void create_application_tasks(void)
{
    BaseType_t task_created = xTaskCreate(
        button_task, "manual_fire", BUTTON_TASK_STACK_SIZE, NULL,
        BUTTON_TASK_PRIORITY, &s_button_task_handle);
    ESP_ERROR_CHECK(task_created == pdPASS ? ESP_OK : ESP_ERR_NO_MEM);

    task_created = xTaskCreate(
        control_service_task, "engine_service", CONTROL_TASK_STACK_SIZE,
        NULL, CONTROL_TASK_PRIORITY, NULL);
    ESP_ERROR_CHECK(task_created == pdPASS ? ESP_OK : ESP_ERR_NO_MEM);

#if TELEMETRY_UART_LOG_ENABLED
    task_created = xTaskCreate(
        telemetry_task, "telemetry", TELEMETRY_UART_TASK_STACK_SIZE, NULL,
        TELEMETRY_UART_TASK_PRIORITY, NULL);
    ESP_ERROR_CHECK(task_created == pdPASS ? ESP_OK : ESP_ERR_NO_MEM);
#endif
}

void app_main(void)
{
    ESP_ERROR_CHECK(status_led_init());
    ESP_ERROR_CHECK(gpio_install_isr_service(ESP_INTR_FLAG_IRAM |
                                              ESP_INTR_FLAG_LEVEL1));
    ESP_ERROR_CHECK(tps_init());
    ESP_ERROR_CHECK(engine_control_init());

    create_application_tasks();
    ESP_ERROR_CHECK(configure_button());
}
