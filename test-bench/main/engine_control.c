#include <stdbool.h>
#include <stdint.h>

#include "driver/dedic_gpio.h"
#include "driver/gpio.h"
#include "driver/gptimer.h"
#include "esp_attr.h"
#include "esp_err.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/portmacro.h"

#include "engine_control.h"
#include "ignition_map.h"
#include "test-bench_config.h"
#include "tps.h"

#define MICROSECONDS_PER_MINUTE 60000000U
#define MICROSECONDS_PER_MILLISECOND 1000U
#define FULL_REVOLUTION_TENTHS 3600U
#define FIRE_OUTPUT_MASK 0x03U

#define MIN_VALID_PERIOD_US (MICROSECONDS_PER_MINUTE / ENGINE_MAX_RPM)
#define MAX_VALID_PERIOD_US (MICROSECONDS_PER_MINUTE / ENGINE_MIN_RPM)
#define PICKUP_TIMEOUT_US \
    (PICKUP_TIMEOUT_MS * MICROSECONDS_PER_MILLISECOND)
#define MAX_FIRE_DELAY_AT_MAX_RPM_US \
    ((MIN_VALID_PERIOD_US * PICKUP_REFERENCE_ANGLE_TENTHS + \
      FULL_REVOLUTION_TENTHS / 2U) / FULL_REVOLUTION_TENTHS)

_Static_assert(IGNITION_TIMER_RESOLUTION_HZ == 1000000U,
               "engine timing requires one timer tick per microsecond");
_Static_assert(PICKUP_REFERENCE_ANGLE_TENTHS <=
                   FULL_REVOLUTION_TENTHS,
               "pickup reference must fit within one revolution");
_Static_assert(ENGINE_MIN_RPM > 0U && ENGINE_MAX_RPM > ENGINE_MIN_RPM,
               "engine RPM range is invalid");
_Static_assert(MICROSECONDS_PER_MINUTE % ENGINE_MIN_RPM == 0U,
               "minimum RPM must convert to an exact period");
_Static_assert(MICROSECONDS_PER_MINUTE % ENGINE_MAX_RPM == 0U,
               "maximum RPM must convert to an exact period");
_Static_assert(PICKUP_TIMEOUT_US > MAX_VALID_PERIOD_US,
               "pickup timeout must exceed the slowest valid revolution");
_Static_assert(FIRE_DURATION_US + MAX_FIRE_DELAY_AT_MAX_RPM_US <
                   MIN_VALID_PERIOD_US,
               "fire sequence must finish before the next maximum-RPM edge");

typedef enum {
    ALARM_PHASE_IDLE = 0,
    ALARM_PHASE_PULSE_START,
    ALARM_PHASE_PULSE_END,
} alarm_phase_t;

typedef struct {
    engine_state_t state;
    alarm_phase_t alarm_phase;
    bool has_reference;
    uint64_t reference_count;
    uint64_t revolution_id;
    uint64_t last_observed_edge_count;
    uint32_t rpm;
    uint16_t advance_tenths;
    uint32_t period_us;
    uint32_t delay_us;
    uint32_t rejected_edge_count;
    uint32_t late_fire_count;
    uint32_t schedule_error_count;
} controller_context_t;

static portMUX_TYPE s_lock = portMUX_INITIALIZER_UNLOCKED;
static DRAM_ATTR controller_context_t s_context;
static DRAM_ATTR gptimer_alarm_config_t s_alarm_config;
static DRAM_ATTR gptimer_handle_t s_timer;
static uint64_t s_timer_epoch_us;
static DRAM_ATTR dedic_gpio_bundle_handle_t s_fire_bundle;

static void IRAM_ATTR set_fire_outputs(bool active)
{
    dedic_gpio_bundle_write(s_fire_bundle, FIRE_OUTPUT_MASK,
                            active ? FIRE_OUTPUT_MASK : 0U);
}

static bool IRAM_ATTR arm_alarm_locked(uint64_t alarm_count,
                                        alarm_phase_t phase)
{
    s_alarm_config.alarm_count = alarm_count;
    s_alarm_config.reload_count = 0U;
    s_alarm_config.flags.auto_reload_on_alarm = false;
    s_context.alarm_phase = phase;

    if (gptimer_set_alarm_action(s_timer, &s_alarm_config) == ESP_OK) {
        return true;
    }

    s_context.alarm_phase = ALARM_PHASE_IDLE;
    ++s_context.schedule_error_count;
    set_fire_outputs(false);
    return false;
}

static bool IRAM_ATTR start_pulse_locked(void)
{
    uint64_t pulse_start_count = 0U;
    set_fire_outputs(true);
    if (gptimer_get_raw_count(s_timer, &pulse_start_count) != ESP_OK) {
        ++s_context.schedule_error_count;
        s_context.alarm_phase = ALARM_PHASE_IDLE;
        set_fire_outputs(false);
        return false;
    }

    return arm_alarm_locked(pulse_start_count + FIRE_DURATION_US,
                            ALARM_PHASE_PULSE_END);
}

static bool IRAM_ATTR timer_alarm_callback(
    gptimer_handle_t timer,
    const gptimer_alarm_event_data_t *event_data,
    void *user_data)
{
    (void)timer;
    (void)event_data;
    (void)user_data;

    portENTER_CRITICAL_ISR(&s_lock);
    if (s_context.alarm_phase == ALARM_PHASE_PULSE_START) {
        start_pulse_locked();
    } else if (s_context.alarm_phase == ALARM_PHASE_PULSE_END) {
        set_fire_outputs(false);
        s_context.alarm_phase = ALARM_PHASE_IDLE;
    } else {
        set_fire_outputs(false);
    }
    portEXIT_CRITICAL_ISR(&s_lock);

    return false;
}

static void IRAM_ATTR schedule_automatic_fire_locked(uint64_t edge_count)
{
    if (s_context.alarm_phase != ALARM_PHASE_IDLE) {
        ++s_context.schedule_error_count;
        return;
    }

    const uint64_t target_count = edge_count + s_context.delay_us;
    uint64_t current_count = 0U;
    if (gptimer_get_raw_count(s_timer, &current_count) != ESP_OK) {
        ++s_context.schedule_error_count;
        return;
    }

    if (target_count <= current_count + IGNITION_SCHEDULING_GUARD_US) {
        ++s_context.late_fire_count;
        start_pulse_locked();
        return;
    }

    arm_alarm_locked(target_count, ALARM_PHASE_PULSE_START);
}

static void IRAM_ATTR pickup_isr_handler(void *arg)
{
    (void)arg;
    uint64_t edge_count = 0U;
    if (gptimer_get_raw_count(s_timer, &edge_count) != ESP_OK) {
        return;
    }

    portENTER_CRITICAL_ISR(&s_lock);
    s_context.last_observed_edge_count = edge_count;

    if (!s_context.has_reference) {
        s_context.has_reference = true;
        s_context.reference_count = edge_count;
        s_context.state = ENGINE_STATE_ACQUISITION;
        portEXIT_CRITICAL_ISR(&s_lock);
        return;
    }

    const uint64_t period_ticks = edge_count - s_context.reference_count;
    if (period_ticks < MIN_VALID_PERIOD_US) {
        ++s_context.rejected_edge_count;
        portEXIT_CRITICAL_ISR(&s_lock);
        return;
    }

    if (period_ticks > MAX_VALID_PERIOD_US) {
        s_context.reference_count = edge_count;
        s_context.state = ENGINE_STATE_ACQUISITION;
        s_context.rpm = 0U;
        s_context.period_us = 0U;
        s_context.delay_us = 0U;
        s_context.advance_tenths = 0U;
        portEXIT_CRITICAL_ISR(&s_lock);
        return;
    }

    const uint32_t period_us = (uint32_t)period_ticks;
    const uint32_t rpm = MICROSECONDS_PER_MINUTE / period_us;
    const uint8_t tps_percent = tps_get_percent();
    const uint16_t advance_tenths =
        ignition_map_lookup(rpm, tps_percent);
    const uint32_t angle_delta_tenths =
        PICKUP_REFERENCE_ANGLE_TENTHS - advance_tenths;
    const uint32_t delay_us =
        (period_us * angle_delta_tenths +
         FULL_REVOLUTION_TENTHS / 2U) /
        FULL_REVOLUTION_TENTHS;

    s_context.reference_count = edge_count;
    s_context.state = ENGINE_STATE_SYNCHRONIZED;
    s_context.rpm = rpm;
    s_context.period_us = period_us;
    s_context.advance_tenths = advance_tenths;
    s_context.delay_us = delay_us;
    ++s_context.revolution_id;
    schedule_automatic_fire_locked(edge_count);
    portEXIT_CRITICAL_ISR(&s_lock);
}

static void transition_to_no_signal_locked(void)
{
    s_context.state = ENGINE_STATE_NO_SIGNAL;
    s_context.has_reference = false;
    s_context.reference_count = 0U;
    s_context.rpm = 0U;
    s_context.period_us = 0U;
    s_context.delay_us = 0U;
    s_context.advance_tenths = 0U;
    s_context.alarm_phase = ALARM_PHASE_IDLE;
    (void)gptimer_set_alarm_action(s_timer, NULL);
    set_fire_outputs(false);
}

esp_err_t engine_control_init(void)
{
    esp_err_t result = ignition_map_validate(
        PICKUP_REFERENCE_ANGLE_TENTHS);
    if (result != ESP_OK) {
        return result;
    }

    const gpio_config_t fire_output_config = {
        .pin_bit_mask = 1ULL << FIRE_OUTPUT_GPIO,
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_ENABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    result = gpio_config(&fire_output_config);
    if (result != ESP_OK) {
        return result;
    }

    const gpio_config_t fire_led_config = {
        .pin_bit_mask = 1ULL << FIRE_LED_GPIO,
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    result = gpio_config(&fire_led_config);
    if (result != ESP_OK) {
        return result;
    }
    result = gpio_set_level(FIRE_OUTPUT_GPIO, 0U);
    if (result != ESP_OK) {
        return result;
    }
    result = gpio_set_level(FIRE_LED_GPIO, 0U);
    if (result != ESP_OK) {
        return result;
    }

    const int fire_gpios[] = {
        FIRE_OUTPUT_GPIO,
        FIRE_LED_GPIO,
    };
    const dedic_gpio_bundle_config_t bundle_config = {
        .gpio_array = fire_gpios,
        .array_size = sizeof(fire_gpios) / sizeof(fire_gpios[0]),
        .flags.out_en = 1,
    };
    result = dedic_gpio_new_bundle(&bundle_config, &s_fire_bundle);
    if (result != ESP_OK) {
        return result;
    }
    set_fire_outputs(false);

    const gptimer_config_t timer_config = {
        .clk_src = GPTIMER_CLK_SRC_DEFAULT,
        .direction = GPTIMER_COUNT_UP,
        .resolution_hz = IGNITION_TIMER_RESOLUTION_HZ,
        .intr_priority = 1,
    };
    result = gptimer_new_timer(&timer_config, &s_timer);
    if (result != ESP_OK) {
        return result;
    }

    const gptimer_event_callbacks_t callbacks = {
        .on_alarm = timer_alarm_callback,
    };
    result = gptimer_register_event_callbacks(s_timer, &callbacks, NULL);
    if (result != ESP_OK) {
        return result;
    }
    result = gptimer_enable(s_timer);
    if (result != ESP_OK) {
        return result;
    }
    result = gptimer_start(s_timer);
    if (result != ESP_OK) {
        return result;
    }
    uint64_t initial_timer_count = 0U;
    result = gptimer_get_raw_count(s_timer, &initial_timer_count);
    if (result != ESP_OK) {
        return result;
    }
    const uint64_t boot_now_us = (uint64_t)esp_timer_get_time();
    s_timer_epoch_us = boot_now_us >= initial_timer_count
                           ? boot_now_us - initial_timer_count
                           : 0U;

    const gpio_config_t pickup_config = {
        .pin_bit_mask = 1ULL << PICKUP_GPIO,
        .mode = GPIO_MODE_INPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_NEGEDGE,
    };
    result = gpio_config(&pickup_config);
    if (result != ESP_OK) {
        return result;
    }

    s_context.state = ENGINE_STATE_NO_SIGNAL;
    return gpio_isr_handler_add(PICKUP_GPIO, pickup_isr_handler, NULL);
}

bool engine_control_request_manual_fire(void)
{
    uint64_t current_count = 0U;
    bool accepted = false;
    portENTER_CRITICAL(&s_lock);
    if (gptimer_get_raw_count(s_timer, &current_count) != ESP_OK) {
        portEXIT_CRITICAL(&s_lock);
        return false;
    }

    if (s_context.state != ENGINE_STATE_NO_SIGNAL &&
        current_count >= s_context.last_observed_edge_count &&
        current_count - s_context.last_observed_edge_count >=
            PICKUP_TIMEOUT_US) {
        transition_to_no_signal_locked();
    }

    if (s_context.state == ENGINE_STATE_NO_SIGNAL &&
        s_context.alarm_phase == ALARM_PHASE_IDLE) {
        accepted = start_pulse_locked();
    }
    portEXIT_CRITICAL(&s_lock);
    return accepted;
}

void engine_control_service(void)
{
    uint64_t current_count = 0U;
    portENTER_CRITICAL(&s_lock);
    if (gptimer_get_raw_count(s_timer, &current_count) != ESP_OK) {
        portEXIT_CRITICAL(&s_lock);
        return;
    }

    if (s_context.state != ENGINE_STATE_NO_SIGNAL &&
        current_count >= s_context.last_observed_edge_count &&
        current_count - s_context.last_observed_edge_count >=
            PICKUP_TIMEOUT_US) {
        transition_to_no_signal_locked();
    }
    portEXIT_CRITICAL(&s_lock);
}

engine_state_t engine_control_get_state(void)
{
    portENTER_CRITICAL(&s_lock);
    const engine_state_t state = s_context.state;
    portEXIT_CRITICAL(&s_lock);
    return state;
}

void engine_control_get_snapshot(engine_snapshot_t *snapshot)
{
    if (snapshot == NULL) {
        return;
    }

    portENTER_CRITICAL(&s_lock);
    snapshot->reference_at_us = s_context.has_reference
                                    ? s_timer_epoch_us +
                                          s_context.reference_count
                                    : 0U;
    snapshot->revolution_id = s_context.revolution_id;
    snapshot->state = s_context.state;
    snapshot->rpm = s_context.rpm;
    snapshot->advance_tenths = s_context.advance_tenths;
    snapshot->period_us = s_context.period_us;
    snapshot->delay_us = s_context.delay_us;
    snapshot->rejected_edge_count = s_context.rejected_edge_count;
    snapshot->late_fire_count = s_context.late_fire_count;
    snapshot->schedule_error_count = s_context.schedule_error_count;
    portEXIT_CRITICAL(&s_lock);
    snapshot->tps_percent = tps_get_percent();
}
