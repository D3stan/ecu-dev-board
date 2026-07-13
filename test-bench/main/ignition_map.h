#pragma once

#include <stdint.h>

#include "esp_err.h"

esp_err_t ignition_map_validate(uint16_t pickup_angle_tenths);

uint16_t ignition_map_lookup(uint32_t rpm, uint8_t tps_percent);
