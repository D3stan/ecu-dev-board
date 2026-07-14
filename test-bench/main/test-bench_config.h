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

#define TELEMETRY_SERVER_ENABLED             1
#define TELEMETRY_UART_LOG_ENABLED           0
#define TELEMETRY_UART_PERIOD_MS             200U
#define TELEMETRY_UART_TASK_STACK_SIZE       3072U
#define TELEMETRY_UART_TASK_PRIORITY         3U
#define TELEMETRY_WIFI_STA_SSID              ""
#define TELEMETRY_WIFI_STA_PASSWORD          ""
#define TELEMETRY_HTTP_PORT                  80U
#define TELEMETRY_WEBSOCKET_PATH             "/ws"
#define TELEMETRY_STATE_HZ                   10U
#define TELEMETRY_MAX_EVENTS_PER_BATCH       8U
#define TELEMETRY_EVENT_BACKLOG_CAPACITY     32U
#define TELEMETRY_MAX_FRAME_BYTES            8192U

#define TELEMETRY_HTTP_TASK_STACK_SIZE       12288U
#define TELEMETRY_HTTP_TASK_PRIORITY         4U
#define TELEMETRY_HTTP_MAX_OPEN_SOCKETS      7U
#define TELEMETRY_HTTP_LRU_PURGE_ENABLED     1
#define TELEMETRY_STATIC_CLOSE_CONNECTION    1
#define TELEMETRY_SERVER_TASK_STACK_SIZE     8192U
#define TELEMETRY_SERVER_TASK_PRIORITY       3U
#define TELEMETRY_RUNTIME_HEAP_CHECKS        0

#define TELEMETRY_SPIFFS_BASE_PATH           "/www"
#define TELEMETRY_SPIFFS_PARTITION_LABEL     "www"
#define TELEMETRY_SPIFFS_MAX_OPEN_FILES      8U

#define TELEMETRY_HARDWARE_REVISION          "ESP32-S2-MINI-TEST-BENCH"
#define TELEMETRY_AUTO_RECORD_RPM_THRESHOLD  300U
#define TELEMETRY_AUTO_RECORD_START_MS       1000U
#define TELEMETRY_AUTO_RECORD_STOP_MS        3000U

#define TELEMETRY_SIM_AMBIENT_C              20.0f
#define TELEMETRY_SIM_EGT_BASE_C             200.0f
#define TELEMETRY_SIM_EGT_RPM_GAIN           0.025f
#define TELEMETRY_SIM_EGT_TPS_GAIN           3.0f
#define TELEMETRY_SIM_EGT_MAX_C              900.0f
#define TELEMETRY_SIM_EGT_HEAT_C_PER_S       80.0f
#define TELEMETRY_SIM_EGT_COOL_C_PER_S       30.0f
#define TELEMETRY_SIM_WATER_BASE_C           45.0f
#define TELEMETRY_SIM_WATER_RPM_GAIN         0.002f
#define TELEMETRY_SIM_WATER_TPS_GAIN         0.25f
#define TELEMETRY_SIM_WATER_MAX_C            115.0f
#define TELEMETRY_SIM_WATER_HEAT_C_PER_S     5.0f
#define TELEMETRY_SIM_WATER_COOL_C_PER_S     2.0f
#define TELEMETRY_SIM_QS_ARM_RPM             1500U
#define TELEMETRY_SIM_QS_PERIOD_MS           8000U
#define TELEMETRY_SIM_QS_ACTIVE_MS           100U
#define TELEMETRY_SIM_MAP_SECONDARY_TPS      70U
#define TELEMETRY_SIM_KNOCK_CANDIDATE_INDEX  4.0f

#define CONTROL_SERVICE_PERIOD_MS            10U
#define BUTTON_TASK_STACK_SIZE               3072U
#define BUTTON_TASK_PRIORITY                 7U
#define TPS_TASK_STACK_SIZE                  3072U
#define TPS_TASK_PRIORITY                    5U
#define CONTROL_TASK_STACK_SIZE              3072U
#define CONTROL_TASK_PRIORITY                6U

_Static_assert(TELEMETRY_SERVER_ENABLED == 0 || TELEMETRY_SERVER_ENABLED == 1,
               "telemetry server enable must be zero or one");
_Static_assert(TELEMETRY_UART_LOG_ENABLED == 0 || TELEMETRY_UART_LOG_ENABLED == 1,
               "telemetry UART enable must be zero or one");
_Static_assert(TELEMETRY_UART_TASK_PRIORITY < CONTROL_TASK_PRIORITY,
               "telemetry UART task must remain below engine control");
_Static_assert(TELEMETRY_STATE_HZ >= 1U && TELEMETRY_STATE_HZ <= 50U,
               "telemetry state rate must be from 1 through 50 Hz");
_Static_assert(TELEMETRY_HTTP_PORT > 0U,
               "telemetry HTTP port must be nonzero");
_Static_assert(TELEMETRY_MAX_EVENTS_PER_BATCH > 0U,
               "event batches must have nonzero capacity");
_Static_assert(TELEMETRY_MAX_EVENTS_PER_BATCH <= 8U,
               "event batches exceed fixed telemetry storage");
_Static_assert(TELEMETRY_MAX_EVENTS_PER_BATCH <= TELEMETRY_EVENT_BACKLOG_CAPACITY,
               "event batch cannot exceed the event backlog");
_Static_assert(TELEMETRY_EVENT_BACKLOG_CAPACITY <= 32U,
               "event backlog exceeds fixed telemetry storage");
_Static_assert(TELEMETRY_HTTP_TASK_PRIORITY < CONTROL_TASK_PRIORITY,
               "HTTP task must remain below engine control");
_Static_assert(TELEMETRY_SERVER_TASK_PRIORITY < CONTROL_TASK_PRIORITY,
               "telemetry pump must remain below engine control");
_Static_assert(TELEMETRY_MAX_FRAME_BYTES >= 4096U,
               "telemetry frame buffer is too small for the V1 contract");
_Static_assert(TELEMETRY_HTTP_TASK_STACK_SIZE >= 8192U,
               "HTTP task stack is below the server minimum");
_Static_assert(TELEMETRY_SERVER_TASK_STACK_SIZE >= 4096U,
               "telemetry pump stack is below the component minimum");
_Static_assert(TELEMETRY_UART_LOG_ENABLED == 0 ||
                   TELEMETRY_UART_TASK_STACK_SIZE >= 2048U,
               "enabled UART telemetry stack is too small");
_Static_assert(TELEMETRY_SIM_QS_ACTIVE_MS < TELEMETRY_SIM_QS_PERIOD_MS,
               "quick-shifter active time must fit its period");
_Static_assert(TELEMETRY_SIM_MAP_SECONDARY_TPS <= 100U,
               "simulated map threshold must be a TPS percentage");
