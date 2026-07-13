#pragma once

#include "sdkconfig.h"
#include "hal/gpio_types.h"

#if CONFIG_IDF_TARGET_ESP32S2
#define BUTTON_GPIO             GPIO_NUM_0
#define TPS_ADC_GPIO            GPIO_NUM_1
#define PICKUP_GPIO             GPIO_NUM_2
#define FIRE_OUTPUT_GPIO        GPIO_NUM_4
#define FIRE_LED_GPIO           GPIO_NUM_15
#define RGB_RED_GPIO            GPIO_NUM_21
#define RGB_GREEN_GPIO          GPIO_NUM_33
#define RGB_BLUE_GPIO           GPIO_NUM_34
#elif CONFIG_IDF_TARGET_ESP32S3
#error "Define the ESP32-S3 test-bench pin assignments before building this target"
#else
#error "The test-bench pin assignments support only ESP32-S2 and ESP32-S3"
#endif

#define FIRE_DURATION_US        500U
#define BUTTON_DEBOUNCE_MS      20U

#define PICKUP_REFERENCE_ANGLE_TENTHS  400U
#define ENGINE_MIN_RPM                  200U
#define ENGINE_MAX_RPM                  20000U
#define PICKUP_TIMEOUT_MS               500U
#define IGNITION_TIMER_RESOLUTION_HZ    1000000U
#define IGNITION_SCHEDULING_GUARD_US    5U

#define TPS_SAMPLE_RATE_HZ       30U
#define TPS_FILTER_WINDOW_SIZE   5U
#define TPS_ADC_MIN_MV           0U
#define TPS_ADC_MAX_MV           3300U

#define TELEMETRY_ENABLED        1
#define TELEMETRY_PERIOD_MS      200U
#define CONTROL_SERVICE_PERIOD_MS 10U

#define BUTTON_TASK_STACK_SIZE    3072U
#define BUTTON_TASK_PRIORITY      7U
#define TPS_TASK_STACK_SIZE       3072U
#define TPS_TASK_PRIORITY         5U
#define CONTROL_TASK_STACK_SIZE   3072U
#define CONTROL_TASK_PRIORITY     6U
#define TELEMETRY_TASK_STACK_SIZE 3072U
#define TELEMETRY_TASK_PRIORITY   3U
