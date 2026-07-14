#pragma once

#include <stdbool.h>
#include <stdint.h>

#include "esp_attr.h"
#include "esp_err.h"

typedef struct {
    uint64_t acquired_at_us;
    uint32_t sequence;
    uint8_t percent;
    bool valid;
} tps_snapshot_t;

esp_err_t tps_init(void);
uint8_t IRAM_ATTR tps_get_percent(void);
void tps_get_snapshot(tps_snapshot_t *snapshot);
