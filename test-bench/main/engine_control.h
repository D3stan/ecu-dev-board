#pragma once

#include <stdbool.h>
#include <stdint.h>

#include "esp_err.h"

typedef enum {
    ENGINE_STATE_NO_SIGNAL = 0,
    ENGINE_STATE_ACQUISITION,
    ENGINE_STATE_SYNCHRONIZED,
} engine_state_t;

typedef struct {
    engine_state_t state;
    uint32_t rpm;
    uint8_t tps_percent;
    uint16_t advance_tenths;
    uint32_t period_us;
    uint32_t delay_us;
    uint32_t rejected_edge_count;
    uint32_t late_fire_count;
    uint32_t schedule_error_count;
} engine_snapshot_t;

esp_err_t engine_control_init(void);

bool engine_control_request_manual_fire(void);

void engine_control_service(void);

engine_state_t engine_control_get_state(void);

void engine_control_get_snapshot(engine_snapshot_t *snapshot);
