#pragma once

#include "esp_err.h"

#include "engine_control.h"

esp_err_t status_led_init(void);

void status_led_set_state(engine_state_t state);
