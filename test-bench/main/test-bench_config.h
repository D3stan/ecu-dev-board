#pragma once

#include "hal/gpio_types.h"

#define BUTTON_GPIO             GPIO_NUM_0
#define FIRE_OUTPUT_GPIO        GPIO_NUM_4
#define FIRE_LED_GPIO           GPIO_NUM_15

#define FIRE_DURATION_US        100U
#define BUTTON_DEBOUNCE_MS      20U

#define RMT_RESOLUTION_HZ       1000000U
#define RMT_MEM_BLOCK_SYMBOLS   64U
#define RMT_QUEUE_DEPTH         1U

#define FIRE_TASK_STACK_SIZE    3072U
#define FIRE_TASK_PRIORITY      10U
