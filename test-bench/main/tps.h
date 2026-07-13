#pragma once

#include <stdint.h>

#include "esp_err.h"

esp_err_t tps_init(void);

uint8_t tps_get_percent(void);
