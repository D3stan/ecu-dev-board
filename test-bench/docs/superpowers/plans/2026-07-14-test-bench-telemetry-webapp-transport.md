# Test-Bench Telemetry and Web Application Transport Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transport the working telemetry server, unchanged hosted WebUI, and browser-side Digital Twin workflow to the ESP32-S2 test bench while publishing real ignition data plus deterministic simulated values for unavailable sensors.

**Architecture:** Keep all timing-critical pickup, TPS, and ignition behavior in the existing C modules. Add a C-compatible snapshot callback feeding a transport-neutral C++17 collector, then adapt the reference JSON pump, WebSocket/HTTP runtime, SPIFFS hosting, recording settings, and device identity around that collector.

**Tech Stack:** C11, C++17, ESP-IDF 5.5.4, ESP32-S2, FreeRTOS, esp_http_server WebSockets, Wi-Fi STA, SPIFFS, NVS, cJSON, Vanilla ES modules, Vite 7.

## Global Constraints

- Use ESP32-S2 with the existing 2 MB flash setting and ESP-IDF 5.5.4.
- Keep `main/test-bench_config.h` as the single source for Wi-Fi, server, telemetry, recording, task, and simulation settings.
- Do not import `../idf/components/sensors`, `sensor_drivers`, or `sensor_harness`.
- Do not change the WebUI interface, navigation, behavior, adapter, Store, pages, or Digital Twin client.
- Copy the approved reference WebUI source from `../idf/webui`; exclude generated `dist/` and legacy `webui/data/` as inputs.
- Keep all existing pickup, GPTimer, CDI output, TPS ISR-read, button, and status-LED ownership in C.
- Do not add allocation, serialization, logging, filesystem, or network calls to GPIO or GPTimer ISR paths.
- Keep the C/C++ ABI limited to fixed-layout C structures, a callback, a context pointer, and a C-callable server API.
- Publish `ecu.telemetry.v1` schema version 1 on `/ws` at 10 Hz by default.
- Publish real RPM, TPS, synchronization, period, ignition advance, fire delay, and diagnostic counters.
- Publish deterministic simulated EGT, water, quick-shifter, physical map request, and knock values; simulated data must never feed engine control.
- Include additive data-origin fields and `state.test_bench`; the unchanged UI may ignore both.
- Keep all firmware queues and serialized frames bounded; default maximum JSON frame size is 8,192 bytes.
- Make telemetry startup non-fatal to ignition control.
- Do not add automated test files or test targets.
- Do not require hardware or browser execution for completion.
- Before every `idf.py` command, load the environment in the same shell with `idf`, for example `zsh -ic 'idf; idf.py build'`.
- Verification consists of production WebUI build, clean ESP-IDF build, partition-size inspection, `git diff --check`, and static subagent review.
- Preserve unrelated user changes and do not copy `../idf/sdkconfig` or stale `../idf/build` artifacts.

## File map

### Project and packaging

- `CMakeLists.txt` — derive `PROJECT_VER` from `git describe`.
- `partitions.csv` — fixed 2 MB NVS/PHY/factory/SPIFFS layout.
- `sdkconfig.defaults` — ESP32-S2, custom partition, WebSocket, SPIFFS, and existing IRAM defaults.
- `data/` — generated production SPIFFS input from Vite.
- `webui/` — unchanged reference frontend source, assets, package lock, Vite config, docs, and existing tests.

### Existing C application

- `main/test-bench_config.h` — all application settings.
- `main/engine_control.h`, `main/engine_control.c` — add task-context revolution identity and reference timestamp to snapshots.
- `main/tps.h`, `main/tps.c` — add a task-context timestamped TPS snapshot while preserving the ISR-safe percent accessor.
- `main/telemetry_bridge.h`, `main/telemetry_bridge.c` — map C domain snapshots into the C telemetry source and start the server.
- `main/test-bench.c` — initialize telemetry last and separate/remove UART-only telemetry.
- `main/CMakeLists.txt` — compile the bridge and require `telemetry_server`.

### Transport-neutral telemetry component

- `components/telemetry/CMakeLists.txt`
- `components/telemetry/include/telemetry/telemetry_source.h`
- `components/telemetry/include/telemetry/telemetry_types.hpp`
- `components/telemetry/include/telemetry/telemetry_collector.hpp`
- `components/telemetry/src/telemetry_collector.cpp`

### Telemetry server component

- `components/telemetry_server/CMakeLists.txt`
- `components/telemetry_server/include/telemetry_server/telemetry_server.h`
- `components/telemetry_server/include/telemetry_server/telemetry_transport.hpp`
- `components/telemetry_server/include/telemetry_server/telemetry_pump.hpp`
- `components/telemetry_server/include/telemetry_server/telemetry_json_serializer.hpp`
- `components/telemetry_server/include/telemetry_server/static_file_resolver.hpp`
- `components/telemetry_server/src/runtime_internal.hpp`
- `components/telemetry_server/src/static_file_resolver.cpp`
- `components/telemetry_server/src/telemetry_json_serializer.cpp`
- `components/telemetry_server/src/telemetry_pump.cpp`
- `components/telemetry_server/src/wifi_station.cpp`
- `components/telemetry_server/src/static_file_server.cpp`
- `components/telemetry_server/src/websocket_transport.cpp`
- `components/telemetry_server/src/recording_settings.cpp`
- `components/telemetry_server/src/device_identity.cpp`
- `components/telemetry_server/src/telemetry_server.cpp`

---

### Task 1: Project configuration, flash layout, and firmware version

**Files:**
- Modify: `CMakeLists.txt`
- Create: `partitions.csv`
- Modify: `sdkconfig.defaults`
- Modify: `main/test-bench_config.h`

**Interfaces:**
- Produces: compile-time macros consumed by Tasks 3, 6, and 8.
- Produces: a `www` partition from `0x187000` through the end of 2 MB flash.
- Produces: `PROJECT_VER` derived from `git describe`.

- [ ] **Step 1: Add git-derived firmware versioning before `project(test-bench)`**

Use `apply_patch` to make `CMakeLists.txt` exactly:

```cmake
# The following five lines of boilerplate have to be in your project's
# CMakeLists in this exact order for cmake to work correctly
cmake_minimum_required(VERSION 3.16)

include($ENV{IDF_PATH}/tools/cmake/project.cmake)

find_package(Git QUIET)
if(GIT_FOUND)
    execute_process(
        COMMAND ${GIT_EXECUTABLE} describe --tags --always --dirty
        WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
        OUTPUT_VARIABLE GIT_DESCRIBE
        OUTPUT_STRIP_TRAILING_WHITESPACE
        ERROR_QUIET
    )
endif()
if(NOT GIT_DESCRIBE OR GIT_DESCRIBE STREQUAL "")
    set(GIT_DESCRIBE "0.0.0-unknown")
endif()
set(PROJECT_VER "${GIT_DESCRIBE}")

project(test-bench)
```

- [ ] **Step 2: Add the fixed 2 MB partition table**

Create `partitions.csv` with:

```csv
# Name,   Type, SubType, Offset,   Size,    Flags
nvs,      data, nvs,     0x9000,   0x6000,
phy_init, data, phy,     0xf000,   0x1000,
factory,  app,  factory, 0x10000,  0x177000,
www,      data, spiffs,  0x187000, 0x79000,
```

- [ ] **Step 3: Select ESP32-S2, the custom partition, WebSocket support, and SPIFFS defaults**

Replace `sdkconfig.defaults` with:

```ini
CONFIG_IDF_TARGET="esp32s2"
CONFIG_ESPTOOLPY_FLASHSIZE_2MB=y
CONFIG_PARTITION_TABLE_CUSTOM=y
CONFIG_PARTITION_TABLE_CUSTOM_FILENAME="partitions.csv"
CONFIG_PARTITION_TABLE_FILENAME="partitions.csv"
CONFIG_HTTPD_WS_SUPPORT=y
CONFIG_SPIFFS_OBJ_NAME_LEN=64
CONFIG_GPIO_CTRL_FUNC_IN_IRAM=y
CONFIG_GPTIMER_ISR_HANDLER_IN_IRAM=y
CONFIG_GPTIMER_CTRL_FUNC_IN_IRAM=y
CONFIG_GPTIMER_ISR_CACHE_SAFE=y
```

- [ ] **Step 4: Replace the old telemetry macros with explicit server and simulation configuration**

In `main/test-bench_config.h`, replace the complete block from
`#define TELEMETRY_ENABLED` through `#define TELEMETRY_TASK_PRIORITY` with the
following block. This deliberately repeats the existing button/TPS/control task
settings so the replacement has one unambiguous start and end:

```c
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
```

Add compile-time checks immediately after the configuration block:

```c
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
```

C11 does not portably permit floating-point comparisons in an integer constant
expression. Validate all floating simulation coefficients, thermal ordering,
positive rates, and the knock threshold in `telemetry_server_start()` as listed
in Task 7 rather than relying on a GCC-only `_Static_assert` extension.

- [ ] **Step 5: Regenerate ignored `sdkconfig` and build against the new defaults**

The repository ignores the generated `sdkconfig`, and its current contents still
select the single-app table with WebSockets disabled. Regenerate it so the new
defaults actually take effect, then build:

```sh
zsh -ic 'idf; idf.py set-target esp32s2; idf.py build'
rg -n "CONFIG_PARTITION_TABLE_CUSTOM=y|CONFIG_HTTPD_WS_SUPPORT=y|CONFIG_SPIFFS_OBJ_NAME_LEN=64" sdkconfig
```

Expected: exit 0; `build/test-bench.bin` exists; the application fits the
`0x177000` factory partition; all three generated settings are present. An empty
telemetry SSID is not exercised during a build. Do not add ignored `sdkconfig` or
`sdkconfig.old` to Git.

- [ ] **Step 6: Commit the configuration checkpoint**

```sh
git add CMakeLists.txt partitions.csv sdkconfig.defaults main/test-bench_config.h
git commit -m "build: prepare telemetry flash and configuration"
```

---

### Task 2: Timestamped real engine and TPS snapshots

**Files:**
- Modify: `main/engine_control.h`
- Modify: `main/engine_control.c`
- Modify: `main/tps.h`
- Modify: `main/tps.c`

**Interfaces:**
- Produces: `engine_snapshot_t.reference_at_us` and
  `engine_snapshot_t.revolution_id`.
- Preserves: `uint8_t IRAM_ATTR tps_get_percent(void)` for pickup-ISR use.
- Produces: `void tps_get_snapshot(tps_snapshot_t *snapshot)` for task context.

- [ ] **Step 1: Extend the public engine snapshot without changing controller commands**

In `main/engine_control.h`, place the two 64-bit fields first in
`engine_snapshot_t` so the mapping is explicit:

```c
typedef struct {
    uint64_t reference_at_us;
    uint64_t revolution_id;
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
```

- [ ] **Step 2: Track a monotonic revolution identity and convert GPTimer counts to boot microseconds**

In `main/engine_control.c`:

1. Include `esp_timer.h`.
2. Add `uint64_t revolution_id;` to `controller_context_t`.
3. Add `static uint64_t s_timer_epoch_us;` next to the timer handle.
4. Immediately after `gptimer_start(s_timer)` succeeds, obtain the raw timer
   count and compute the epoch:

```c
uint64_t initial_timer_count = 0U;
result = gptimer_get_raw_count(s_timer, &initial_timer_count);
if (result != ESP_OK) {
    return result;
}
const uint64_t boot_now_us = (uint64_t)esp_timer_get_time();
s_timer_epoch_us = boot_now_us >= initial_timer_count
                       ? boot_now_us - initial_timer_count
                       : 0U;
```

5. After an accepted period is calculated, increment the identity exactly once
   before scheduling fire:

```c
++s_context.revolution_id;
```

Do not reset `revolution_id` in `transition_to_no_signal_locked()`; it is an
uptime identity, not a per-run counter.

- [ ] **Step 3: Populate the added engine fields in the existing bounded snapshot copy**

At the start of the critical section in `engine_control_get_snapshot()` add:

```c
snapshot->reference_at_us = s_context.has_reference
                                ? s_timer_epoch_us + s_context.reference_count
                                : 0U;
snapshot->revolution_id = s_context.revolution_id;
```

Keep `snapshot->tps_percent = tps_get_percent();` outside the controller lock as
it is now.

- [ ] **Step 4: Add a separate task-context TPS snapshot API**

Replace `main/tps.h` with:

```c
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
```

In `main/tps.c`, include `esp_timer.h` and
`freertos/portmacro.h`, then add:

```c
static portMUX_TYPE s_snapshot_lock = portMUX_INITIALIZER_UNLOCKED;
static tps_snapshot_t s_snapshot;
```

After calculating `const uint8_t filtered = median_of_five(samples);`, replace
the direct publication with:

```c
s_tps_percent = filtered;
portENTER_CRITICAL(&s_snapshot_lock);
s_snapshot.percent = filtered;
s_snapshot.acquired_at_us = (uint64_t)esp_timer_get_time();
++s_snapshot.sequence;
s_snapshot.valid = true;
portEXIT_CRITICAL(&s_snapshot_lock);
```

Keep `tps_get_percent()` as a single lock-free return. Add:

```c
void tps_get_snapshot(tps_snapshot_t *snapshot)
{
    if (snapshot == NULL) {
        return;
    }

    portENTER_CRITICAL(&s_snapshot_lock);
    *snapshot = s_snapshot;
    portEXIT_CRITICAL(&s_snapshot_lock);
}
```

- [ ] **Step 5: Build and inspect the ISR boundary**

Run:

```sh
zsh -ic 'idf; idf.py build'
rg -n "esp_timer_get_time|tps_get_snapshot|portENTER_CRITICAL" main/engine_control.c main/tps.c
```

Expected: build exits 0. `esp_timer_get_time()` appears in initialization or
task context, not in `pickup_isr_handler()` or `timer_alarm_callback()`.
`tps_get_percent()` still contains no lock.

- [ ] **Step 6: Commit the snapshot checkpoint**

```sh
git add main/engine_control.h main/engine_control.c main/tps.h main/tps.c
git commit -m "feat: expose timestamped control telemetry snapshots"
```

---

### Task 3: Transport-neutral telemetry contracts

**Files:**
- Create: `components/telemetry/CMakeLists.txt`
- Create: `components/telemetry/include/telemetry/telemetry_source.h`
- Create: `components/telemetry/include/telemetry/telemetry_types.hpp`
- Create: `components/telemetry/include/telemetry/telemetry_collector.hpp`

**Interfaces:**
- Consumes later: `telemetry_source_t` supplied by Task 8.
- Produces: `ecu::telemetry::TelemetryCollector::collect(TimestampUs now)`.
- Produces: exact C++ record names used by serializer and pump Tasks 6 and 7.

- [ ] **Step 1: Define the C-only source contract**

Create `components/telemetry/include/telemetry/telemetry_source.h`:

```c
#pragma once

#include <stdbool.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef enum {
    TELEMETRY_ENGINE_NO_SIGNAL = 0,
    TELEMETRY_ENGINE_ACQUISITION,
    TELEMETRY_ENGINE_SYNCHRONIZED,
} telemetry_engine_state_t;

typedef struct {
    uint64_t observed_at_us;
    uint64_t rpm_acquired_at_us;
    uint64_t tps_acquired_at_us;
    uint64_t revolution_id;
    uint32_t rpm;
    uint32_t period_us;
    uint32_t fire_delay_us;
    uint32_t rejected_edge_count;
    uint32_t late_fire_count;
    uint32_t schedule_error_count;
    uint32_t tps_sequence;
    uint16_t advance_tenths;
    uint8_t tps_percent;
    telemetry_engine_state_t engine_state;
    bool tps_valid;
} telemetry_real_sample_t;

typedef bool (*telemetry_source_read_fn)(void *context,
                                         telemetry_real_sample_t *sample);

typedef struct {
    telemetry_source_read_fn read;
    void *context;
} telemetry_source_t;

#ifdef __cplusplus
}
#endif
```

- [ ] **Step 2: Define all transport-neutral V1 types without sensor-domain dependencies**

Create `components/telemetry/include/telemetry/telemetry_types.hpp` with these
exact public types; keep default initializers so zero-initialized frames are
valid:

```cpp
#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <optional>
#include <variant>

#include "telemetry/telemetry_source.h"

namespace ecu::telemetry {

using TimestampUs = std::uint64_t;
inline constexpr std::size_t kTelemetryEventBatchCapacity = 8;
inline constexpr std::size_t kTelemetryEventBacklogCapacity = 32;

enum class DataOrigin { Measured, Derived, Simulated };
enum class HealthState { Uninitialized, Stabilizing, Valid, Degraded, Stale, Failed, Disabled };
enum class Quality { Unknown, Good, Suspect, Bad };
enum class ThermalState { Cold, Warming, Normal, High, Critical, SensorInvalid };
enum class ThermalRequest { Normal, Warning, DeratingRequested, CriticalProtectionRequested, SensorInvalid };
enum class MapRequest { Primary, Secondary };
enum class FaultKind { Noise, WindowTiming, DeviceFault };
enum class EventKind { QuickShiftRequest, MapSwitchChange, FaultTransition };

struct TelemetryHealth {
    TimestampUs acquired_at{0};
    std::uint64_t sequence{0};
    bool valid_for_control{false};
    HealthState health{HealthState::Uninitialized};
    Quality quality{Quality::Unknown};
    std::uint64_t fault_bits{0};
    DataOrigin origin{DataOrigin::Derived};
};

struct TelemetryOverflowCounters {
    std::uint32_t quick_shift_events{0};
    std::uint32_t map_switch_events{0};
    std::uint32_t knock_measurements{0};
    std::uint32_t fault_events{0};
};

struct TpsTelemetryState {
    int permille{0};
    int fallback_permille{0};
    bool fallback_used{false};
    TelemetryHealth meta{};
};

struct EngineSpeedTelemetryState {
    float rpm{0.0f};
    float period_us{0.0f};
    float acceleration_rpm_per_s{0.0f};
    bool synchronized{false};
    bool crank_reference_trusted{false};
    std::uint64_t revolution_id{0};
    TimestampUs reference_at{0};
    TelemetryHealth meta{};
};

struct ThermalTelemetryState {
    float celsius{20.0f};
    float rate_c_per_s{0.0f};
    float maximum_celsius{20.0f};
    ThermalState state{ThermalState::Cold};
    ThermalRequest request{ThermalRequest::Normal};
    TelemetryHealth meta{};
};

struct QuickShifterTelemetryState {
    bool active{false};
    bool armed{false};
    TelemetryHealth meta{};
};

struct MapSwitchTelemetryState {
    MapRequest request{MapRequest::Primary};
    TelemetryHealth meta{};
};

struct KnockTelemetryState {
    std::uint64_t revolution_id{0};
    TimestampUs pickup_edge_at{0};
    TimestampUs window_opened_at{0};
    TimestampUs window_closed_at{0};
    TimestampUs read_at{0};
    std::uint32_t raw_integrator_count{0};
    float background_estimate{100.0f};
    float normalized_index{0.5f};
    bool candidate_knock{false};
    bool valid_for_control{false};
    HealthState health{HealthState::Stale};
    Quality quality{Quality::Suspect};
    std::uint64_t fault_bits{0};
    float rpm{0.0f};
    int tps_permille{0};
    float ignition_angle_deg{0.0f};
    std::uint32_t config_generation{1};
    DataOrigin origin{DataOrigin::Simulated};
};

struct TestBenchTelemetryState {
    telemetry_engine_state_t engine_state{TELEMETRY_ENGINE_NO_SIGNAL};
    std::uint16_t advance_tenths{0};
    std::uint32_t fire_delay_us{0};
    std::uint32_t rejected_edges{0};
    std::uint32_t late_fires{0};
    std::uint32_t schedule_errors{0};
    DataOrigin origin{DataOrigin::Derived};
};

struct TelemetryStateFrame {
    std::uint32_t snapshot_generation{0};
    TpsTelemetryState tps{};
    EngineSpeedTelemetryState engine_speed{};
    ThermalTelemetryState egt{};
    ThermalTelemetryState water_temperature{};
    QuickShifterTelemetryState quick_shifter{};
    MapSwitchTelemetryState map_switch{};
    KnockTelemetryState latest_knock{};
    TestBenchTelemetryState test_bench{};
};

struct QuickShiftTelemetryEvent {
    bool active{false};
    TimestampUs activated_at{0};
    TimestampUs released_at{0};
    std::uint32_t duration_us{0};
    TelemetryHealth meta{};
};

struct MapSwitchTelemetryEvent {
    MapRequest request{MapRequest::Primary};
    TelemetryHealth meta{};
};

struct FaultTelemetryEvent {
    FaultKind fault{FaultKind::DeviceFault};
    HealthState health{HealthState::Degraded};
    TimestampUs first_at{0};
    TimestampUs last_at{0};
    std::uint32_t count{0};
};

using TelemetryEventPayload = std::variant<QuickShiftTelemetryEvent,
                                           MapSwitchTelemetryEvent,
                                           FaultTelemetryEvent>;

struct TelemetryEventFrame {
    EventKind kind{EventKind::FaultTransition};
    TimestampUs occurred_at{0};
    TelemetryEventPayload payload{FaultTelemetryEvent{}};
};

struct TelemetryBatch {
    TimestampUs collected_at{0};
    TelemetryStateFrame state{};
    std::array<TelemetryEventFrame, kTelemetryEventBatchCapacity> events{};
    std::size_t event_count{0};
    TelemetryOverflowCounters overflow{};
};

} // namespace ecu::telemetry
```

- [ ] **Step 3: Define the collector configuration and ownership contract**

Create `components/telemetry/include/telemetry/telemetry_collector.hpp`:

```cpp
#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <optional>

#include "telemetry/telemetry_source.h"
#include "telemetry/telemetry_types.hpp"

namespace ecu::telemetry {

struct TelemetryCollectorConfig {
    std::size_t max_events_per_batch{8};
    std::size_t event_backlog_capacity{32};
    float ambient_c{20.0f};
    float egt_base_c{200.0f};
    float egt_rpm_gain{0.025f};
    float egt_tps_gain{3.0f};
    float egt_max_c{900.0f};
    float egt_heat_c_per_s{80.0f};
    float egt_cool_c_per_s{30.0f};
    float water_base_c{45.0f};
    float water_rpm_gain{0.002f};
    float water_tps_gain{0.25f};
    float water_max_c{115.0f};
    float water_heat_c_per_s{5.0f};
    float water_cool_c_per_s{2.0f};
    std::uint32_t quick_shift_arm_rpm{1500};
    std::uint32_t quick_shift_period_ms{8000};
    std::uint32_t quick_shift_active_ms{100};
    std::uint8_t secondary_map_tps_percent{70};
    float knock_candidate_index{4.0f};
};

class TelemetryCollector {
public:
    TelemetryCollector(telemetry_source_t source,
                       TelemetryCollectorConfig config);

    std::optional<TelemetryBatch> collect(TimestampUs now);

private:
    TelemetryStateFrame make_state(const telemetry_real_sample_t &sample,
                                   TimestampUs now);
    void advance_thermal(ThermalTelemetryState &state,
                         float target,
                         float heat_rate,
                         float cool_rate,
                         float elapsed_s,
                         bool egt);
    void detect_events(const telemetry_real_sample_t &sample,
                       const TelemetryStateFrame &state,
                       TimestampUs now);
    void enqueue(TelemetryEventFrame event);

    telemetry_source_t source_{};
    TelemetryCollectorConfig config_{};
    std::uint32_t generation_{0};
    TimestampUs last_collected_at_{0};
    telemetry_real_sample_t previous_real_{};
    bool has_previous_real_{false};
    bool previous_quick_active_{false};
    TimestampUs quick_activated_at_{0};
    MapRequest previous_map_request_{MapRequest::Primary};
    ThermalTelemetryState egt_{};
    ThermalTelemetryState water_{};
    std::array<TelemetryEventFrame, kTelemetryEventBacklogCapacity> pending_events_{};
    std::size_t pending_event_count_{0};
    TelemetryOverflowCounters overflow_{};
};

} // namespace ecu::telemetry
```

- [ ] **Step 4: Register the header-only checkpoint**

Create `components/telemetry/CMakeLists.txt`:

```cmake
idf_component_register(INCLUDE_DIRS "include")
```

Do not set compile features on this header-only checkpoint: ESP-IDF registers it
as an interface component. Task 4 changes it to a compiled C++17 component.

- [ ] **Step 5: Build the contract checkpoint**

Run:

```sh
zsh -ic 'idf; idf.py build'
```

Expected: exit 0 with the new component discovered and no C/C++ linkage
warnings.

- [ ] **Step 6: Commit the telemetry contracts**

```sh
git add components/telemetry
git commit -m "feat: define test-bench telemetry contracts"
```

---

### Task 4: Real mapping, deterministic simulation, and bounded events

**Files:**
- Create: `components/telemetry/src/telemetry_collector.cpp`
- Modify: `components/telemetry/CMakeLists.txt`

**Interfaces:**
- Consumes: `telemetry_source_t` and `TelemetryCollectorConfig` from Task 3.
- Produces: populated `TelemetryBatch` objects for the server pump.

- [ ] **Step 1: Register the collector implementation**

Change `components/telemetry/CMakeLists.txt` to:

```cmake
idf_component_register(
    SRCS "src/telemetry_collector.cpp"
    INCLUDE_DIRS "include"
)
target_compile_features(${COMPONENT_LIB} PUBLIC cxx_std_17)
```

- [ ] **Step 2: Implement bounded helper functions and enum/health mapping**

Start `components/telemetry/src/telemetry_collector.cpp` with:

```cpp
#include "telemetry/telemetry_collector.hpp"

#include <algorithm>
#include <cmath>
#include <limits>
#include <utility>

namespace ecu::telemetry {
namespace {

constexpr std::uint64_t kUsPerSecond = 1000000ULL;
constexpr std::uint64_t kUsPerMillisecond = 1000ULL;

float move_toward(float current, float target, float max_delta) {
    if (current < target) return std::min(target, current + max_delta);
    return std::max(target, current - max_delta);
}

bool synchronized(telemetry_engine_state_t state) {
    return state == TELEMETRY_ENGINE_SYNCHRONIZED;
}

TelemetryHealth real_meta(TimestampUs acquired_at,
                          std::uint64_t sequence,
                          bool valid,
                          HealthState health) {
    TelemetryHealth meta{};
    meta.acquired_at = acquired_at;
    meta.sequence = sequence;
    meta.valid_for_control = valid;
    meta.health = health;
    meta.quality = valid ? Quality::Good : Quality::Suspect;
    meta.origin = DataOrigin::Measured;
    return meta;
}

TelemetryHealth simulated_meta(TimestampUs now,
                               std::uint64_t sequence,
                               bool valid) {
    TelemetryHealth meta{};
    meta.acquired_at = now;
    meta.sequence = sequence;
    meta.valid_for_control = valid;
    meta.health = valid ? HealthState::Valid : HealthState::Stale;
    meta.quality = valid ? Quality::Good : Quality::Suspect;
    meta.origin = DataOrigin::Simulated;
    return meta;
}

} // namespace
```

- [ ] **Step 3: Implement collection and real-state mapping exactly once per ready pump tick**

The constructor performs no allocation; fixed arrays provide the validated event
capacities:

```cpp
TelemetryCollector::TelemetryCollector(telemetry_source_t source,
                                       TelemetryCollectorConfig config)
    : source_(source), config_(config) {
    egt_.celsius = egt_.maximum_celsius = config_.ambient_c;
    water_.celsius = water_.maximum_celsius = config_.ambient_c;
}
```

Implement `collect()` in this order:

```cpp
std::optional<TelemetryBatch> TelemetryCollector::collect(TimestampUs now) {
    if (source_.read == nullptr) return std::nullopt;

    telemetry_real_sample_t sample{};
    if (!source_.read(source_.context, &sample)) return std::nullopt;

    TelemetryBatch batch{};
    batch.collected_at = now;
    batch.state = make_state(sample, now);
    detect_events(sample, batch.state, now);

    batch.event_count =
        std::min(config_.max_events_per_batch, pending_event_count_);
    for (std::size_t index = 0; index < batch.event_count; ++index) {
        batch.events[index] = pending_events_[index];
    }
    for (std::size_t index = batch.event_count;
         index < pending_event_count_;
         ++index) {
        pending_events_[index - batch.event_count] =
            std::move(pending_events_[index]);
    }
    pending_event_count_ -= batch.event_count;
    batch.overflow = overflow_;

    previous_real_ = sample;
    has_previous_real_ = true;
    last_collected_at_ = now;
    return batch;
}
```

In `make_state()`:

- Increment `generation_` once and assign it to `snapshot_generation`.
- Map TPS percent to permille and copy the task-context TPS metadata.
- Map RPM, period, synchronization, revolution identity, and reference time.
- Calculate acceleration only when the previous/current samples are both
  synchronized and `sample.observed_at_us > previous_real_.observed_at_us`:

```cpp
const float elapsed_s = static_cast<float>(sample.observed_at_us -
                                           previous_real_.observed_at_us) /
                        static_cast<float>(kUsPerSecond);
state.engine_speed.acceleration_rpm_per_s =
    elapsed_s > 0.0f
        ? (static_cast<float>(sample.rpm) -
           static_cast<float>(previous_real_.rpm)) / elapsed_s
        : 0.0f;
```

- Map engine health as Stale, Stabilizing, or Valid for no-signal,
  acquisition, or synchronized state.
- Copy the real diagnostic fields into `state.test_bench`.

- [ ] **Step 4: Implement the approved thermal, quick-shifter, map, and knock model**

Calculate elapsed time as zero on the first collection and otherwise from
`now - last_collected_at_`. Thermal targets and rates must use the exact spec
formulas:

```cpp
const bool sync = synchronized(sample.engine_state);
const float rpm = static_cast<float>(sample.rpm);
const float tps = static_cast<float>(sample.tps_percent);
const float egt_target = sync
    ? std::clamp(config_.egt_base_c + config_.egt_rpm_gain * rpm +
                     config_.egt_tps_gain * tps,
                 config_.ambient_c,
                 config_.egt_max_c)
    : config_.ambient_c;
const float water_target = sync
    ? std::clamp(config_.water_base_c + config_.water_rpm_gain * rpm +
                     config_.water_tps_gain * tps,
                 config_.ambient_c,
                 config_.water_max_c)
    : config_.ambient_c;
```

`advance_thermal()` must:

- Choose heat or cool rate from target direction.
- Move no farther than `rate * elapsed_s`.
- Set `rate_c_per_s` to signed movement divided by elapsed time.
- Track maximum temperature.
- Apply EGT thresholds 100/300/750/850 and water thresholds 40/70/100/110.
- Map High to Warning and Critical to CriticalProtectionRequested.
- Set metadata origin to Simulated.

Set quick-shifter state with:

```cpp
state.quick_shifter.armed = sync && sample.rpm >= config_.quick_shift_arm_rpm;
const std::uint64_t period_us =
    static_cast<std::uint64_t>(config_.quick_shift_period_ms) * kUsPerMillisecond;
const std::uint64_t active_us =
    static_cast<std::uint64_t>(config_.quick_shift_active_ms) * kUsPerMillisecond;
state.quick_shifter.active = state.quick_shifter.armed && period_us != 0U &&
                             (now % period_us) < active_us;
```

Set map request to Secondary when TPS is at or above the configured threshold.
Always populate knock using real revolution/RPM/TPS/advance, deterministic
100/600/700 microsecond window offsets, normalized index
`0.5f + rpm / 5000.0f + tps / 100.0f`, rounded raw count, and the configured
candidate threshold. When no reference exists, keep all four knock timestamps
at zero.

- [ ] **Step 5: Implement bounded event creation and aggregate diagnostic deltas**

`enqueue()` must reject a new event when `pending_event_count_` reaches either
the configured capacity or `pending_events_.size()`, and increment the matching
overflow counter based on event kind. Otherwise move the event into
`pending_events_[pending_event_count_++]`.

`detect_events()` must:

- Emit QuickShiftRequest on active changes and retain activation time for the
  release duration; copy `state.quick_shifter.meta` into the event metadata.
- Emit MapSwitchChange on request changes and copy `state.map_switch.meta` into
  the event metadata.
- On every real counter increase, emit one FaultTransition whose `count` is the
  delta: rejected edges map to Noise, late fires to WindowTiming, and schedule
  errors to DeviceFault.
- Use `now` for `occurred_at`, `first_at`, and `last_at` on aggregate diagnostic
  events.
- Skip deltas on the first sample.

Use `std::min<std::uint64_t>(delta,
std::numeric_limits<std::uint32_t>::max())` before assigning event counts.

- [ ] **Step 6: Build and statically inspect boundedness and formulas**

Run:

```sh
zsh -ic 'idf; idf.py build'
rg -n "pending_event_count|event_backlog_capacity|std::clamp|quick_shift_period_ms|knock_candidate_index" components/telemetry
```

Expected: exit 0; fixed event arrays and count guards are present with no
`std::vector`; formulas use configuration members rather than hard-coded UI
values.

- [ ] **Step 7: Commit the collector checkpoint**

```sh
git add components/telemetry
git commit -m "feat: collect real and simulated telemetry"
```

---

### Task 5: Copy the unchanged WebUI and generate SPIFFS inputs

**Files:**
- Create: `webui/.gitignore`
- Create: `webui/package.json`
- Create: `webui/package-lock.json`
- Create: `webui/vite.config.js`
- Create: `webui/src/**`
- Create: `webui/test/**`
- Create: `webui/doc/**`
- Create: `data/**` through the unchanged Vite production build

**Interfaces:**
- Consumes: exact source files from `../idf/webui`.
- Produces: `data/index.html`, gzip JS/CSS, and images for Task 7.
- Preserves: all existing UI behavior and Digital Twin browser logic.

- [ ] **Step 1: Copy the reference source without legacy generated directories**

Because this is a bulk transport containing binary images, use filesystem copy
for the new tree rather than recreating assets. From the project root run:

```sh
mkdir -p webui
cp ../idf/webui/.gitignore webui/.gitignore
cp ../idf/webui/package.json webui/package.json
cp ../idf/webui/package-lock.json webui/package-lock.json
cp ../idf/webui/vite.config.js webui/vite.config.js
cp -R ../idf/webui/src webui/src
cp -R ../idf/webui/test webui/test
cp -R ../idf/webui/doc webui/doc
```

Do not copy `../idf/webui/data`, `../idf/webui/dist`, or
`../idf/webui/node_modules`.

- [ ] **Step 2: Prove that transported UI inputs are byte-for-byte unchanged**

Run:

```sh
diff -qr ../idf/webui/src webui/src
diff -qr ../idf/webui/test webui/test
diff -qr ../idf/webui/doc webui/doc
cmp ../idf/webui/.gitignore webui/.gitignore
cmp ../idf/webui/package.json webui/package.json
cmp ../idf/webui/package-lock.json webui/package-lock.json
cmp ../idf/webui/vite.config.js webui/vite.config.js
```

Expected: all commands exit 0 and print no differences.

- [ ] **Step 3: Install the locked frontend dependencies without changing the lockfile**

Run:

```sh
cd webui && npm ci
```

Expected: exit 0; `webui/node_modules/` is ignored; `git diff --
webui/package-lock.json` prints nothing. If dependency download is blocked by
the sandbox, rerun the same command with network approval rather than changing
package versions.

- [ ] **Step 4: Generate root SPIFFS inputs using the unchanged Vite build**

Run:

```sh
cd webui && npm run build
test -f ../data/index.html
test -f ../data/app.js.gz
test -f ../data/style.css.gz
```

Expected: Vite exits 0 and root `data/` contains only the production HTML,
compressed text assets, and required images copied by the reference config.

- [ ] **Step 5: Recheck source identity after the build**

Run the seven comparison commands from Step 2 again. Expected: no output and
exit 0; only generated `data/` and ignored `webui/dist/` changed.

- [ ] **Step 6: Commit the unchanged frontend and generated firmware assets**

```sh
git add webui data
git commit -m "feat: add unchanged hosted ECU webapp"
```

---

### Task 6: Bounded serializer, pump, transport interface, and static resolver

**Files:**
- Create: `components/telemetry_server/CMakeLists.txt`
- Create: `components/telemetry_server/include/telemetry_server/telemetry_server.h`
- Create: `components/telemetry_server/include/telemetry_server/telemetry_transport.hpp`
- Create: `components/telemetry_server/include/telemetry_server/telemetry_pump.hpp`
- Create: `components/telemetry_server/include/telemetry_server/telemetry_json_serializer.hpp`
- Create: `components/telemetry_server/include/telemetry_server/static_file_resolver.hpp`
- Create: `components/telemetry_server/src/static_file_resolver.cpp`
- Create: `components/telemetry_server/src/telemetry_json_serializer.cpp`
- Create: `components/telemetry_server/src/telemetry_pump.cpp`

**Interfaces:**
- Consumes: `TelemetryCollector`, `TelemetryBatch`, and telemetry types from
  Tasks 3–4.
- Produces: C startup API `telemetry_server_start(const telemetry_source_t *, const telemetry_server_config_t *)`.
- Produces: bounded serializer API used by the HTTP/WebSocket runtime in Task 7.

- [ ] **Step 1: Define the complete C server configuration API**

Create `components/telemetry_server/include/telemetry_server/telemetry_server.h`.
It must include `<stdbool.h>`, `<stdint.h>`, `esp_err.h`, and
`telemetry/telemetry_source.h`, wrap declarations in `extern "C"`, and define:

```c
typedef struct {
    const char *sta_ssid;
    const char *sta_password;
    uint16_t http_port;
    const char *ws_path;
    uint32_t http_task_stack_bytes;
    uint32_t http_task_priority;
    uint16_t http_max_open_sockets;
    bool http_lru_purge_enable;
    const char *static_base_path;
    const char *static_partition_label;
    uint32_t static_max_open_files;
    bool static_close_connection;
    bool diagnostics_heap_checks;
    uint32_t state_hz;
    uint32_t max_events_per_batch;
    uint32_t event_backlog_capacity;
    uint32_t max_frame_bytes;
    uint32_t task_stack_bytes;
    uint32_t task_priority;
    const char *hardware_revision;
    uint32_t auto_record_rpm_threshold;
    uint32_t auto_record_start_ms;
    uint32_t auto_record_stop_ms;
    float ambient_c;
    float egt_base_c;
    float egt_rpm_gain;
    float egt_tps_gain;
    float egt_max_c;
    float egt_heat_c_per_s;
    float egt_cool_c_per_s;
    float water_base_c;
    float water_rpm_gain;
    float water_tps_gain;
    float water_max_c;
    float water_heat_c_per_s;
    float water_cool_c_per_s;
    uint32_t quick_shift_arm_rpm;
    uint32_t quick_shift_period_ms;
    uint32_t quick_shift_active_ms;
    uint8_t secondary_map_tps_percent;
    float knock_candidate_index;
} telemetry_server_config_t;

esp_err_t telemetry_server_start(const telemetry_source_t *source,
                                 const telemetry_server_config_t *config);
```

Document beside the API that start copies the descriptor and all configuration
strings, but the callback function and its `context` target must remain valid for
the firmware lifetime. The bridge in Task 8 uses a static descriptor with a null
context.

- [ ] **Step 2: Port the transport abstraction and make the static resolver fixed-capacity**

Copy these reference files as the behavioral baseline because they contain no
sensor-domain dependency:

```sh
mkdir -p components/telemetry_server/include/telemetry_server
mkdir -p components/telemetry_server/src
cp ../idf/components/telemetry_server/include/telemetry_server/telemetry_transport.hpp components/telemetry_server/include/telemetry_server/
cp ../idf/components/telemetry_server/include/telemetry_server/static_file_resolver.hpp components/telemetry_server/include/telemetry_server/
cp ../idf/components/telemetry_server/src/static_file_resolver.cpp components/telemetry_server/src/
```

Immediately adapt `static_file_resolver.hpp/.cpp` so resolver construction and
requests do not allocate:

- Replace owned `std::string` fields with fixed NUL-terminated arrays: 64 bytes
  for base path, 512 for logical path, and 576 for full filesystem path.
- Store MIME type as a pointer to a string literal.
- Make `IStaticFileCatalog::exists()` accept a NUL-terminated `const char *` so
  the POSIX catalog can call `stat()` directly without constructing a string.
- Add `bool valid() const`; constructor overflow makes the resolver invalid, and
  an overlong request returns `BadRequest`.
- Use `std::string_view` only for non-owning parsing and capacity-check every
  copy/append, including the `.gz` suffix.

Preserve the reference behavior: strip query/fragment, reject `..` and
backslash, try exact then `.gz`, fall back to `/index.html` only for
extensionless routes, and map HTML/JS/CSS/PNG/JPEG/SVG/ICO/JSON/WebP MIME types.
The static handler's `valid()` result participates in application startup
validation.

- [ ] **Step 3: Define a bounded serializer API with no unbounded return string**

Create `telemetry_json_serializer.hpp` with:

```cpp
#pragma once

#include <cstddef>
#include <cstdint>

#include "telemetry/telemetry_types.hpp"
#include "telemetry_server/telemetry_transport.hpp"

namespace ecu::telemetry_server {

struct DeviceIdentity {
    const char *hwid{""};
    const char *hardware_revision{"unknown"};
    const char *chip_model{"unknown"};
    std::uint32_t flash_size_bytes{0};
    const char *firmware_version{""};
};

struct RecordingConfigSnapshot {
    bool auto_enabled{false};
    std::uint32_t rpm_threshold{300};
    std::uint32_t start_debounce_ms{1000};
    std::uint32_t stop_debounce_ms{3000};
};

struct SerializerConfig {
    const char *schema{"ecu.telemetry.v1"};
    std::uint32_t schema_version{1};
    std::uint32_t state_hz{10};
    std::size_t events_per_batch{8};
    DeviceIdentity device{};
};

struct SerializeResult {
    bool ok{false};
    std::size_t size{0};
};

class TelemetryJsonSerializer {
public:
    explicit TelemetryJsonSerializer(SerializerConfig config = {});
    SerializeResult serialize_capabilities(const RecordingConfigSnapshot &recording,
                                           char *buffer,
                                           std::size_t capacity) const;
    SerializeResult serialize_recording_config(const RecordingConfigSnapshot &recording,
                                               char *buffer,
                                               std::size_t capacity) const;
    SerializeResult serialize_batch(const ecu::telemetry::TelemetryBatch &batch,
                                    const TelemetryTransportCounters &transport,
                                    char *buffer,
                                    std::size_t capacity) const;

private:
    SerializerConfig config_{};
};

} // namespace ecu::telemetry_server
```

- [ ] **Step 4: Implement the exact V1 JSON shape with a capacity-checking writer**

In `telemetry_json_serializer.cpp`, implement an internal `JsonWriter` that
owns `{char *buffer, size_t capacity, size_t size, bool ok}`. Every append must
check `incoming <= capacity - size`; failure sets `ok=false` and performs no
out-of-bounds write. Escape quotes, backslashes, newline, carriage return, tab,
and control characters in strings.

Serialize:

- `capabilities`: schema/version, `paths:["state","event"]`, state rate,
  events-per-batch, device, and recording.
- `recording_config`: exact current recording members.
- `telemetry`: `type`, schema, `t_us`, `gen`, `state`, `events`, `overflow`, and
  `transport`.
- State objects and metadata with the exact reference snake_case field names.
- Add `origin` to each real/simulated object.
- Always serialize knock as an object, not null.
- Add `state.test_bench` with engine-state string and every diagnostic field.
- Map FaultKind to the existing strings Noise, WindowTiming, and DeviceFault.
- Map all existing health, quality, thermal, request, map, and event enum strings
  exactly as the unchanged adapter expects.
- Map origins to lowercase `measured`, `derived`, and `simulated`; map test-bench
  engine state to `no_signal`, `acquisition`, and `synchronized`.
- Serialize only finite floating-point values; substitute `0.0` and mark the
  writer failed if a non-finite value reaches the serializer, so invalid JSON is
  never transmitted.

Each public method returns `{writer.ok(), writer.size()}`. It must not return a
partial frame when `ok` is false. Recording state is an explicit immutable
argument for control frames; the pump serializer is never mutated concurrently
by the HTTP task.

Use this exact key inventory (field order may match the reference serializer but
is not semantically significant):

```text
capabilities:
  type, schema, schema_version, paths, state_hz, events_per_batch,
  device.{hwid,hardware_revision,chip_model,flash_size_bytes,firmware_version},
  recording.{auto_enabled,rpm_threshold,start_debounce_ms,stop_debounce_ms}

recording_config:
  type, auto_enabled, rpm_threshold, start_debounce_ms, stop_debounce_ms

telemetry:
  type, schema, t_us, gen,
  state.{tps,rpm,egt,water,quick_shifter,map_switch,knock,test_bench},
  events, overflow, transport

meta:
  acquired_at_us, seq, valid, health, quality, fault_bits

tps:
  permille, pct, fallback_permille, fallback_used, origin, meta
rpm:
  rpm, period_us, accel_rpm_per_s, synchronized,
  crank_reference_trusted, revolution_id, reference_at_us, origin, meta
egt/water:
  c, rate_c_per_s, max_c, state, request, origin, meta
quick_shifter:
  active, armed, origin, meta
map_switch:
  request, origin, meta
knock:
  revolution_id, pickup_edge_at_us, window_opened_at_us,
  window_closed_at_us, read_at_us, raw_integrator_count,
  background_estimate, normalized_index, candidate_knock, valid, health,
  quality, fault_bits, rpm, tps_permille, ignition_angle_deg,
  config_generation, origin
test_bench:
  engine_state, advance_tenths, fire_delay_us, rejected_edges, late_fires,
  schedule_errors, origin

QuickShiftRequest event:
  kind, at_us, active, activated_at_us, released_at_us, duration_us, meta
MapSwitchChange event:
  kind, at_us, request, meta
FaultTransition event:
  kind, at_us, fault, health, first_at_us, last_at_us, count

overflow:
  quick_shift_events, map_switch_events, knock_measurements, fault_events
transport:
  sent_frames, dropped_frames, send_errors
```

For state records that carry `TelemetryHealth`, serialize `origin` beside the
record's existing fields from `meta.origin`; do not change the existing `meta`
shape. Knock and test-bench records carry their origin directly. This keeps the
reference WebUI contract intact while making raw Digital Twin recordings
self-describing.

When serializing events, iterate exactly `batch.event_count` entries from the
fixed `batch.events` array; never inspect unused default entries.

- [ ] **Step 5: Define and implement the bounded pump**

Create `telemetry_pump.hpp` with a constructor accepting collector, serializer,
transport, and maximum frame bytes. It owns a
`std::unique_ptr<char[]> buffer_` allocated with `new (std::nothrow)` and exposes
`bool valid() const` plus `bool tick(TimestampUs now)`.

Implement `tick()` in `telemetry_pump.cpp` in this order:

```cpp
if (!valid() || !transport_.connected()) return false;
if (!transport_.ready()) {
    transport_.note_dropped_frame();
    return false;
}
auto batch = collector_.collect(now);
if (!batch.has_value()) return false;
const auto result = serializer_.serialize_batch(*batch,
                                                transport_.counters(),
                                                buffer_.get(),
                                                buffer_size_);
if (!result.ok) {
    transport_.note_send_error();
    return false;
}
return transport_.send_text(std::string_view(buffer_.get(), result.size));
```

Extend `ITelemetryTransport` with `virtual void note_send_error() = 0;` so
serialization overflow is counted without pretending a socket send occurred.

- [ ] **Step 6: Register and compile the portable server core**

Create `components/telemetry_server/CMakeLists.txt` initially as:

```cmake
idf_component_register(
    SRCS
        "src/static_file_resolver.cpp"
        "src/telemetry_json_serializer.cpp"
        "src/telemetry_pump.cpp"
    INCLUDE_DIRS "include"
    REQUIRES telemetry esp_common
)
target_compile_features(${COMPONENT_LIB} PUBLIC cxx_std_17)
```

Run:

```sh
zsh -ic 'idf; idf.py build'
```

Expected: exit 0. No `sensors/` include appears under either new component.

- [ ] **Step 7: Commit the portable server checkpoint**

```sh
git add components/telemetry_server
git commit -m "feat: add bounded telemetry server core"
```

---

### Task 7: ESP32-S2 Wi-Fi, HTTP, WebSocket, SPIFFS, NVS, and identity runtime

**Files:**
- Create: `components/telemetry_server/src/runtime_internal.hpp`
- Create: `components/telemetry_server/src/wifi_station.cpp`
- Create: `components/telemetry_server/src/static_file_server.cpp`
- Create: `components/telemetry_server/src/websocket_transport.cpp`
- Create: `components/telemetry_server/src/recording_settings.cpp`
- Create: `components/telemetry_server/src/device_identity.cpp`
- Create: `components/telemetry_server/src/telemetry_server.cpp`
- Modify: `components/telemetry_server/CMakeLists.txt`

**Interfaces:**
- Consumes: C server configuration and portable core from Task 6.
- Produces: complete implementation of `telemetry_server_start()`.
- Produces: flashed `build/www.bin` from root `data/`.

- [ ] **Step 1: Define private runtime ownership in one internal header**

`runtime_internal.hpp` must contain the complete declarations—not only forward
declarations—for the focused non-copyable runtime classes shared by the split
`.cpp` files:

```cpp
struct OwnedServerConfig {
    explicit OwnedServerConfig(const telemetry_server_config_t &source);
    OwnedServerConfig(const OwnedServerConfig &) = delete;
    OwnedServerConfig &operator=(const OwnedServerConfig &) = delete;

    telemetry_server_config_t values{};
    std::array<char, 32> ssid{};
    std::array<char, 64> password{};
    std::array<char, 32> ws_path{};
    std::array<char, 64> static_base_path{};
    std::array<char, 16> static_partition_label{};
    std::array<char, 64> hardware_revision{};
};

struct RuntimeDeviceIdentity {
    std::array<char, 32> hwid{};
    std::array<char, 64> hardware_revision{};
    std::array<char, 16> chip_model{};
    std::uint32_t flash_size_bytes{0};
    std::array<char, 33> firmware_version{};
};

class RuntimeDiagnostics final {
public:
    explicit RuntimeDiagnostics(bool heap_checks);
    static unsigned stack_free_bytes();
    void check_heap(const char *location) const;
private:
    bool heap_checks_{false};
};

class WifiStation final {
public:
    WifiStation() = default;
    ~WifiStation();
    esp_err_t start(const telemetry_server_config_t &config);
private:
    static void event_handler(void *arg, esp_event_base_t base,
                              std::int32_t id, void *data);
    void handle_event(esp_event_base_t base, std::int32_t id, void *data);
    esp_netif_t *sta_netif_{nullptr};
    esp_event_handler_instance_t wifi_handler_{nullptr};
    esp_event_handler_instance_t ip_handler_{nullptr};
    bool wifi_initialized_{false};
    bool wifi_started_{false};
};

class StaticFileSystemMount final {
public:
    ~StaticFileSystemMount();
    esp_err_t mount(const telemetry_server_config_t &config);
private:
    std::array<char, 16> partition_label_{};
    bool mounted_{false};
};

class PosixStaticFileCatalog final : public IStaticFileCatalog {
public:
    bool exists(const char *path) const override;
};

class StaticFileHandler final {
public:
    StaticFileHandler(const char *base_path,
                      const IStaticFileCatalog &catalog,
                      const RuntimeDiagnostics &diagnostics,
                      bool close_connection);
    bool valid() const;
    esp_err_t register_handlers(httpd_handle_t server);
private:
    static esp_err_t handle_request(httpd_req_t *request);
    esp_err_t serve(httpd_req_t &request);
    void set_connection_close(httpd_req_t &request) const;
    StaticFileResolver resolver_;
    const RuntimeDiagnostics &diagnostics_;
    bool close_connection_{true};
    std::array<char, 2048> scratch_{};
};

class EspWebSocketTransport final : public ITelemetryTransport {
public:
    explicit EspWebSocketTransport(std::size_t max_payload_bytes);
    bool connected() const override;
    bool ready() const override;
    bool send_text(std::string_view payload) override;
    void note_dropped_frame() override;
    void note_send_error() override;
    TelemetryTransportCounters counters() const override;
    void accept(httpd_handle_t server, int socket);
    void close(int socket);
private:
    struct PendingSend;
    static void send_complete(esp_err_t error, int socket, void *context);
    void finish_send(int socket, std::uint64_t session_id, esp_err_t error);
    std::size_t max_payload_bytes_{0};
    mutable std::mutex mutex_{};
    httpd_handle_t server_{nullptr};
    int socket_{-1};
    std::uint64_t session_id_{0};
    bool active_{false};
    bool send_in_flight_{false};
    TelemetryTransportCounters counters_{};
};

class RecordingSettingsStore final {
public:
    bool load_auto_enabled(bool fallback) const;
    esp_err_t save_auto_enabled(bool enabled) const;
};

class TelemetryServerApplication final {
public:
    TelemetryServerApplication(telemetry_source_t source,
                               const telemetry_server_config_t &config);
    ~TelemetryServerApplication();
    bool valid() const;
    esp_err_t start();
private:
    esp_err_t start_http_server();
    esp_err_t start_pump_task();
    static esp_err_t websocket_handler(httpd_req_t *request);
    static void pump_task(void *context);
    RecordingConfigSnapshot recording_snapshot() const;
    SerializeResult serialize_capabilities();
    SerializeResult serialize_recording_config();
    esp_err_t send_recording_config(httpd_req_t &request);
    esp_err_t handle_recording_config_set(httpd_req_t &request, bool enabled);

    OwnedServerConfig config_;
    telemetry_source_t source_{};
    RuntimeDeviceIdentity device_identity_{};
    mutable std::mutex recording_mutex_{};
    RecordingConfigSnapshot recording_{};
    RecordingSettingsStore recording_store_{};
    ecu::telemetry::TelemetryCollector collector_;
    TelemetryJsonSerializer serializer_;
    EspWebSocketTransport transport_;
    TelemetryPump pump_;
    WifiStation wifi_{};
    StaticFileSystemMount static_filesystem_{};
    PosixStaticFileCatalog static_catalog_{};
    RuntimeDiagnostics diagnostics_;
    StaticFileHandler static_handler_;
    std::unique_ptr<char[]> control_buffer_{};
    httpd_handle_t server_{nullptr};
    TaskHandle_t task_{nullptr};
};
```

Place these declarations in namespace `ecu::telemetry_server`. Include the
ESP-IDF, FreeRTOS, standard-library, telemetry, and static-resolver
headers required by these declarations. Define `PendingSend` in
`websocket_transport.cpp`; all other declarations above remain free of pending
payload ownership. The cross-file functions not represented by class methods are:

```cpp
RuntimeDeviceIdentity read_device_identity(const telemetry_server_config_t &config);
std::optional<bool> parse_recording_config_set(const std::uint8_t *data,
                                               std::size_t size);
```

`OwnedServerConfig` bounded-copies every validated incoming string into its fixed
arrays, then rebinds the pointer fields in `values` to `.data()`. Its constructor
performs no allocation. It is never copied or moved after rebinding, so all
C-string lifetimes cover the application lifetime.

Apply these explicit string checks before construction: SSID 1–31 bytes,
password either empty for an open network or 8–63 bytes for WPA2, WebSocket
path 1–31 bytes and beginning with `/`,
SPIFFS base path 1–63 bytes and beginning with `/`, partition label 1–15 bytes,
and hardware revision 1–63 bytes. Reject an invalid value with
`ESP_ERR_INVALID_ARG`; do not silently truncate application strings.

Define `OwnedServerConfig`, `RuntimeDiagnostics`, and
`TelemetryServerApplication` in `telemetry_server.cpp`; define each other class
in the same focused source named by its responsibility. This keeps the internal
header as the single cross-file contract and avoids duplicate private class
definitions.

- [ ] **Step 2: Port Wi-Fi STA initialization with bounded credential copies**

Use the reference `WifiStation` logic in `wifi_station.cpp`, with these required
changes:

- Read only the passed C config; do not use Kconfig telemetry credentials.
- Reject null/empty SSID with `ESP_ERR_INVALID_ARG`.
- Copy SSID/password with zero-fill and `N - 1` maximum length.
- Set open auth for empty password and WPA2-PSK threshold otherwise.
- Initialize NVS, netif, and default event loop.
- Reconnect on `WIFI_EVENT_STA_DISCONNECTED`.
- Log only connection state and assigned IP, never credentials.
- Track each completed initialization step. The destructor unregisters installed
  event handlers, stops/deinitializes Wi-Fi when started, and destroys the owned
  STA netif without assuming every earlier step succeeded.

- [ ] **Step 3: Port SPIFFS mount and static serving into focused files**

`static_file_server.cpp` must:

- Mount the configured `www` partition at `/www` without format-on-failure.
- Store the partition label only after a successful mount and unregister it in
  the mount object's destructor.
- Log used/total bytes without exposing unrelated configuration.
- Use `StaticFileResolver` for every request.
- Stream files with a fixed 2,048-byte member buffer.
- Set Content-Type, optional Content-Encoding gzip, and Cache-Control.
- Close responses when configured.
- Return 400, 404, or 500 exactly for unsafe, absent, or read-failed files.
- Terminate chunked responses with a zero-length chunk.

- [ ] **Step 4: Port one-client asynchronous WebSocket transport**

`websocket_transport.cpp` must implement every `ITelemetryTransport` method,
including the new `note_send_error()`. Preserve the reference mutex-protected
state and counters. Reject payloads larger than `max_payload_bytes_`. Define
`PendingSend` with owner, HTTP handle, socket, connection session ID, byte count, and
`std::unique_ptr<std::uint8_t[]> payload`. Allocate both the object and its byte
array with `new (std::nothrow)`, copy the bytes only after both allocations
succeed, set `send_in_flight_` before queueing, and free the payload only in the
ESP-IDF completion callback or immediate queue-failure path. Do not construct a
`std::string` for the asynchronous copy because its allocation is not covered by
the explicit no-throw check.

`accept()` closes a different active socket before replacing it and increments
`session_id_` for every accepted upgrade, even if ESP-IDF reuses the same file
descriptor. `close()` only closes the matching active socket. Async completion
always increments `sent_frames` or `send_errors`, but it clears in-flight state
or deactivates the client only when both socket and captured session ID still
match. This prevents a stale completion from corrupting a newer connection that
reused an fd.

- [ ] **Step 5: Implement strict cJSON recording command parsing and NVS persistence**

In `recording_settings.cpp`:

- Use `cJSON_ParseWithLengthOpts()` with the WebSocket byte length and an end
  pointer. After parsing, permit only ASCII JSON whitespace through the exact end
  of the payload; reject trailing non-whitespace data.
- Require a root object.
- Use case-sensitive member lookup and require string member `type` exactly
  equal to `recording_config_set`.
- Require `auto_enabled` to be a cJSON boolean, not a number or string.
- Delete the cJSON tree on every return path.
- Return `std::nullopt` for all invalid inputs.

Persist one `uint8_t` under namespace `digital_twin`, key `auto_rec`. Save and
commit before updating the mutex-protected in-memory recording snapshot. On read
failure, use the configured fallback; on write failure, leave the old setting
unchanged. Capability and acknowledgement serialization receive a copied
recording snapshot; the pump serializer itself remains immutable.

- [ ] **Step 6: Fix ESP32-S2 device identity while preserving capabilities fields**

In `device_identity.cpp`:

- Read the default eFuse MAC.
- Format HWID as `esp32s2-%02x%02x%02x%02x%02x%02x`.
- Set chip model to `ESP32-S2` for this target.
- Read flash size with `esp_flash_get_size()`.
- Read firmware version from `esp_app_get_description()->version`.
- Copy hardware revision from the C configuration.
- Format and copy into the fixed arrays in `RuntimeDeviceIdentity`, always
  NUL-terminate, and point serializer `const char *` members at `.data()`; do not
  allocate identity strings.

- [ ] **Step 7: Compose startup, handlers, and the low-priority pump task**

In `telemetry_server.cpp`, construct `TelemetryServerApplication` members in the
declaration order from `runtime_internal.hpp`. The dependencies are:

1. `OwnedServerConfig` and the copied C source callback/context.
2. Stable device identity plus mutex-protected recording snapshot/store.
3. Collector, immutable serializer, bounded WebSocket transport, and pump.
4. Wi-Fi, SPIFFS catalog/mount, diagnostics, and static handler.
5. A separate `max_frame_bytes` no-throw control-frame buffer.
6. HTTP handle and pump task handle.

`start()` performs Wi-Fi, recording load, SPIFFS mount, HTTP start, then pump
task creation. Configure HTTP with the passed port, stack, task priority,
socket count, LRU purge, and wildcard matcher. Register `/ws` before `/*`.
`valid()` requires non-null source callback, a valid pump, transport maximum, and
control buffer, plus a valid fixed-capacity static handler. Application member
construction may not create `std::string` or `std::vector` storage: the only
fallible C++ allocations are the outer application, pump buffer, control buffer,
incoming WebSocket buffer, and pending asynchronous send, each using an explicit
`std::nothrow` check.

Make partial-start cleanup explicit. The application destructor first deletes a
created pump task, then stops a created HTTP server; the Wi-Fi and SPIFFS member
destructors unregister handlers/stop Wi-Fi and unregister the mounted partition.
Every destructor is safe when its corresponding start step never completed.
This is required before `telemetry_server_start()` may delete an application
whose `start()` returned an error.

The WebSocket handler must:

- Accept GET upgrades and send capabilities.
- Receive frame length before allocating payload.
- Reject payloads larger than `max_frame_bytes`; allocate non-empty receive
  buffers with `new (std::nothrow) std::uint8_t[frame.len]` and return
  `ESP_ERR_NO_MEM` on failure.
- Respond to ping and close control frames.
- Pass text frames through strict recording parsing.
- Persist then respond with `recording_config` on valid updates.
- Ignore unknown text frames.

For capabilities, copy the recording snapshot under its mutex, serialize into
the control buffer, then call `transport.send_text()`; the transport owns its
bounded asynchronous copy before the handler returns. For
`recording_config_set`, save NVS first, update the mutex-protected snapshot,
serialize into the same control buffer, and call synchronous
`httpd_ws_send_frame()` before reusing that buffer. On serialization overflow,
increment `send_errors`; on a failed capability send, close that socket. The
HTTP server task is the sole user of the control buffer, while the pump owns a
different frame buffer.

Create the pump with `xTaskCreate()` on the single-core ESP32-S2, using the
configured absolute priority, not `xTaskCreatePinnedToCore()` or a priority
offset. Use `vTaskDelayUntil()` with `1000 / state_hz` milliseconds and
`esp_timer_get_time()`.

Implement the public function with one static application pointer. Validate all
pointers, string lengths, rates, capacities, priorities, frame size, finite
simulation coefficients, positive thermal rates, valid temperature clamps, and
quick-shifter/map thresholds before allocating the application with
`new (std::nothrow)`. Return `ESP_ERR_INVALID_STATE` on a
second start and delete a failed application before returning its error. Assign
the static pointer only after `start()` succeeds; this avoids retaining a
partially initialized singleton.

- [ ] **Step 8: Register ESP-IDF dependencies and the SPIFFS image**

Replace the component CMake file with:

```cmake
idf_component_register(
    SRCS
        "src/static_file_resolver.cpp"
        "src/telemetry_json_serializer.cpp"
        "src/telemetry_pump.cpp"
        "src/wifi_station.cpp"
        "src/static_file_server.cpp"
        "src/websocket_transport.cpp"
        "src/recording_settings.cpp"
        "src/device_identity.cpp"
        "src/telemetry_server.cpp"
    INCLUDE_DIRS "include"
    REQUIRES
        telemetry
        esp_app_format
        esp_event
        esp_http_server
        esp_netif
        esp_timer
        esp_wifi
        esp_hw_support
        json
        nvs_flash
        spi_flash
        spiffs
)
target_compile_features(${COMPONENT_LIB} PUBLIC cxx_std_17)

set(WEB_ASSET_DIR "${CMAKE_SOURCE_DIR}/data")
if(EXISTS "${WEB_ASSET_DIR}/index.html")
    spiffs_create_partition_image(www "${WEB_ASSET_DIR}" FLASH_IN_PROJECT)
else()
    message(FATAL_ERROR
        "Missing ${WEB_ASSET_DIR}/index.html. Run 'cd webui && npm ci && npm run build' first.")
endif()
```

- [ ] **Step 9: Build the complete but not-yet-started server component**

Run:

```sh
zsh -ic 'idf; idf.py build'
test -f build/www.bin
```

Expected: exit 0; server component and SPIFFS image compile even before main
calls `telemetry_server_start()`.

- [ ] **Step 10: Commit the runtime checkpoint**

```sh
git add components/telemetry_server
git commit -m "feat: add ESP32-S2 telemetry web server runtime"
```

---

### Task 8: C bridge and application startup integration

**Files:**
- Create: `main/telemetry_bridge.h`
- Create: `main/telemetry_bridge.c`
- Modify: `main/test-bench.c`
- Modify: `main/CMakeLists.txt`

**Interfaces:**
- Consumes: engine/TPS snapshots from Task 2 and server C API from Task 6.
- Produces: `esp_err_t telemetry_bridge_start(void)` called once by `app_main()`.

- [ ] **Step 1: Declare the focused bridge entry point**

Create `main/telemetry_bridge.h`:

```c
#pragma once

#include "esp_err.h"

esp_err_t telemetry_bridge_start(void);
```

- [ ] **Step 2: Implement bounded C snapshot mapping**

In `main/telemetry_bridge.c`, include `engine_control.h`, `esp_timer.h`,
`telemetry/telemetry_source.h`, `telemetry_server/telemetry_server.h`,
`test-bench_config.h`, and `tps.h`.

Implement a static callback:

```c
static bool read_real_sample(void *context, telemetry_real_sample_t *sample)
{
    (void)context;
    if (sample == NULL) {
        return false;
    }

    engine_snapshot_t engine;
    tps_snapshot_t tps;
    engine_control_get_snapshot(&engine);
    tps_get_snapshot(&tps);

    *sample = (telemetry_real_sample_t) {
        .observed_at_us = (uint64_t)esp_timer_get_time(),
        .rpm_acquired_at_us = engine.reference_at_us,
        .tps_acquired_at_us = tps.acquired_at_us,
        .revolution_id = engine.revolution_id,
        .rpm = engine.rpm,
        .period_us = engine.period_us,
        .fire_delay_us = engine.delay_us,
        .rejected_edge_count = engine.rejected_edge_count,
        .late_fire_count = engine.late_fire_count,
        .schedule_error_count = engine.schedule_error_count,
        .tps_sequence = tps.sequence,
        .advance_tenths = engine.advance_tenths,
        .tps_percent = tps.percent,
        .engine_state = (telemetry_engine_state_t)engine.state,
        .tps_valid = tps.valid,
    };
    return true;
}
```

Add these static assertions before using the cast:

```c
_Static_assert((int)ENGINE_STATE_NO_SIGNAL ==
                   (int)TELEMETRY_ENGINE_NO_SIGNAL,
               "no-signal enum values must match");
_Static_assert((int)ENGINE_STATE_ACQUISITION ==
                   (int)TELEMETRY_ENGINE_ACQUISITION,
               "acquisition enum values must match");
_Static_assert((int)ENGINE_STATE_SYNCHRONIZED ==
                   (int)TELEMETRY_ENGINE_SYNCHRONIZED,
               "synchronized enum values must match");
```

- [ ] **Step 3: Build the server configuration only from `test-bench_config.h`**

Implement `telemetry_bridge_start()` with the following static source and local,
fully designated configuration so every runtime value comes from
`test-bench_config.h`:

```c
static const telemetry_source_t source = {
    .read = read_real_sample,
    .context = NULL,
};

const telemetry_server_config_t config = {
    .sta_ssid = TELEMETRY_WIFI_STA_SSID,
    .sta_password = TELEMETRY_WIFI_STA_PASSWORD,
    .http_port = TELEMETRY_HTTP_PORT,
    .ws_path = TELEMETRY_WEBSOCKET_PATH,
    .http_task_stack_bytes = TELEMETRY_HTTP_TASK_STACK_SIZE,
    .http_task_priority = TELEMETRY_HTTP_TASK_PRIORITY,
    .http_max_open_sockets = TELEMETRY_HTTP_MAX_OPEN_SOCKETS,
    .http_lru_purge_enable = TELEMETRY_HTTP_LRU_PURGE_ENABLED,
    .static_base_path = TELEMETRY_SPIFFS_BASE_PATH,
    .static_partition_label = TELEMETRY_SPIFFS_PARTITION_LABEL,
    .static_max_open_files = TELEMETRY_SPIFFS_MAX_OPEN_FILES,
    .static_close_connection = TELEMETRY_STATIC_CLOSE_CONNECTION,
    .diagnostics_heap_checks = TELEMETRY_RUNTIME_HEAP_CHECKS,
    .state_hz = TELEMETRY_STATE_HZ,
    .max_events_per_batch = TELEMETRY_MAX_EVENTS_PER_BATCH,
    .event_backlog_capacity = TELEMETRY_EVENT_BACKLOG_CAPACITY,
    .max_frame_bytes = TELEMETRY_MAX_FRAME_BYTES,
    .task_stack_bytes = TELEMETRY_SERVER_TASK_STACK_SIZE,
    .task_priority = TELEMETRY_SERVER_TASK_PRIORITY,
    .hardware_revision = TELEMETRY_HARDWARE_REVISION,
    .auto_record_rpm_threshold = TELEMETRY_AUTO_RECORD_RPM_THRESHOLD,
    .auto_record_start_ms = TELEMETRY_AUTO_RECORD_START_MS,
    .auto_record_stop_ms = TELEMETRY_AUTO_RECORD_STOP_MS,
    .ambient_c = TELEMETRY_SIM_AMBIENT_C,
    .egt_base_c = TELEMETRY_SIM_EGT_BASE_C,
    .egt_rpm_gain = TELEMETRY_SIM_EGT_RPM_GAIN,
    .egt_tps_gain = TELEMETRY_SIM_EGT_TPS_GAIN,
    .egt_max_c = TELEMETRY_SIM_EGT_MAX_C,
    .egt_heat_c_per_s = TELEMETRY_SIM_EGT_HEAT_C_PER_S,
    .egt_cool_c_per_s = TELEMETRY_SIM_EGT_COOL_C_PER_S,
    .water_base_c = TELEMETRY_SIM_WATER_BASE_C,
    .water_rpm_gain = TELEMETRY_SIM_WATER_RPM_GAIN,
    .water_tps_gain = TELEMETRY_SIM_WATER_TPS_GAIN,
    .water_max_c = TELEMETRY_SIM_WATER_MAX_C,
    .water_heat_c_per_s = TELEMETRY_SIM_WATER_HEAT_C_PER_S,
    .water_cool_c_per_s = TELEMETRY_SIM_WATER_COOL_C_PER_S,
    .quick_shift_arm_rpm = TELEMETRY_SIM_QS_ARM_RPM,
    .quick_shift_period_ms = TELEMETRY_SIM_QS_PERIOD_MS,
    .quick_shift_active_ms = TELEMETRY_SIM_QS_ACTIVE_MS,
    .secondary_map_tps_percent = TELEMETRY_SIM_MAP_SECONDARY_TPS,
    .knock_candidate_index = TELEMETRY_SIM_KNOCK_CANDIDATE_INDEX,
};

return telemetry_server_start(&source, &config);
```

Do not read Kconfig telemetry options and do not log credentials.

- [ ] **Step 4: Replace UART-only telemetry ownership with server startup**

In `main/test-bench.c`:

- Remove the old local `TELEMETRY_ENABLED` static assertion; the explicit server
  and UART configuration assertions are already owned by
  `test-bench_config.h`.
- Preserve optional UART diagnostics by changing both existing guards to
  `#if TELEMETRY_UART_LOG_ENABLED` and renaming the period, stack, and priority
  references to `TELEMETRY_UART_PERIOD_MS`,
  `TELEMETRY_UART_TASK_STACK_SIZE`, and `TELEMETRY_UART_TASK_PRIORITY`. The
  default remains disabled, so there is no duplicate periodic task.
- Include `telemetry_bridge.h`.
- Keep all existing initialization and task ordering.
- After `configure_button()` succeeds, start telemetry last:

```c
#if TELEMETRY_SERVER_ENABLED
    const esp_err_t telemetry_result = telemetry_bridge_start();
    if (telemetry_result != ESP_OK) {
        ESP_LOGE(TAG, "telemetry server disabled: %s",
                 esp_err_to_name(telemetry_result));
    }
#endif
```

Do not use `ESP_ERROR_CHECK` for the telemetry result.

- [ ] **Step 5: Compile and link the bridge**

Change `main/CMakeLists.txt` to include `telemetry_bridge.c` and add both the
direct C-contract dependency `telemetry` and the runtime dependency
`telemetry_server` to `PRIV_REQUIRES`:

```cmake
idf_component_register(
    SRCS
        "test-bench.c"
        "engine_control.c"
        "ignition_map.c"
        "status_led.c"
        "telemetry_bridge.c"
        "tps.c"
    INCLUDE_DIRS "."
    PRIV_REQUIRES
        esp_adc
        esp_driver_gpio
        esp_driver_gptimer
        esp_timer
        telemetry
        telemetry_server
)
```

- [ ] **Step 6: Clean-build the fully integrated firmware and assets**

Run:

```sh
zsh -ic 'idf; idf.py fullclean; idf.py build'
test -f build/test-bench.bin
test -f build/www.bin
```

Expected: exit 0; both images exist; no linker pulls in the reference sensor
stack.

- [ ] **Step 7: Inspect task/ISR separation and configuration use**

Run:

```sh
rg -n "telemetry_bridge_start|ESP_ERROR_CHECK|xTaskCreate|xTaskCreatePinnedToCore" main components/telemetry_server
rg -n "TELEMETRY_" main components | sed -n '1,260p'
rg -n "pickup_isr_handler|timer_alarm_callback|httpd_|esp_wifi|fopen|serialize" main/engine_control.c components
```

Expected: telemetry start is non-fatal; the S2 pump uses `xTaskCreate`; network
and filesystem calls remain outside ISR bodies; all application knobs originate
from the config header through the bridge.

- [ ] **Step 8: Commit application integration**

```sh
git add main/test-bench.c main/CMakeLists.txt main/telemetry_bridge.c main/telemetry_bridge.h
git commit -m "feat: serve full test-bench telemetry webapp"
```

---

### Task 9: Build evidence and static subagent verification

**Files:**
- Modify only if required by build errors or accepted static-review findings.

**Interfaces:**
- Consumes: the complete implementation and approved design specification.
- Produces: build evidence and a clean static review with no critical or
  important findings.

- [ ] **Step 1: Prove the WebUI source remains unchanged**

Run:

```sh
diff -qr ../idf/webui/src webui/src
diff -qr ../idf/webui/test webui/test
diff -qr ../idf/webui/doc webui/doc
cmp ../idf/webui/.gitignore webui/.gitignore
cmp ../idf/webui/package.json webui/package.json
cmp ../idf/webui/package-lock.json webui/package-lock.json
cmp ../idf/webui/vite.config.js webui/vite.config.js
```

Expected: no output and exit 0 for every command.

- [ ] **Step 2: Regenerate production assets without running or adding tests**

Run:

```sh
cd webui && npm run build
```

Expected: exit 0; no source or lockfile changes.

- [ ] **Step 3: Perform the final clean ESP-IDF build with the environment loaded**

Run:

```sh
zsh -ic 'idf; idf.py fullclean; idf.py build'
```

Expected: exit 0 with no new compiler/linker warnings treated as acceptable.

- [ ] **Step 4: Confirm both images fit the fixed partition sizes**

Run:

```sh
test -f build/test-bench.bin
test -f build/www.bin
wc -c build/test-bench.bin build/www.bin
zsh -ic 'idf; idf.py size'
```

Expected: `test-bench.bin` is smaller than `0x177000` (1,536,000 bytes) and
`www.bin` is no larger than `0x79000` (495,616 bytes). `idf.py size` exits 0.

- [ ] **Step 5: Run repository hygiene checks**

Run:

```sh
git diff --check
git status --short
rg -n "TELEMETRY_WIFI_STA_PASSWORD|sta_password" main components/telemetry_server
```

Expected: no whitespace errors; status contains only intentional changes; the
password appears only in configuration/copy paths and never in logging or JSON
serialization.

- [ ] **Step 6: Dispatch the requested static subagent review**

Give the reviewer this exact scope:

```text
Review the implementation diff against
docs/superpowers/specs/2026-07-14-telemetry-webapp-transport-design.md.
Do not modify files and do not run builds, automated tests, hardware checks, or
browser tests. Perform a source/configuration-only review. Report only concrete
Critical, Important, or Minor findings with file:line evidence. Check:
1. C/C++ ABI layout and lifetime safety.
2. Existing C ISR/timing ownership and absence of network/allocation/logging in ISRs.
3. Real RPM/TPS/ignition mapping and deterministic simulated EGT/water/QS/map/knock.
4. Exact ecu.telemetry.v1 field compatibility with the unchanged WebUI.
5. Bounded event backlog, frame buffer, async payload lifetime, and backpressure counters.
6. ESP32-S2 single-core task priorities and use of xTaskCreate rather than S3 core pinning.
7. Wi-Fi credential handling, strict recording_config_set parsing, NVS update ordering,
   device identity, and Digital Twin capabilities.
8. Static path traversal protection, gzip/MIME/cache behavior, and SPIFFS partition wiring.
9. No reference sensor stack import and no changes under webui/ relative to ../idf/webui.
10. Configuration coverage, non-fatal telemetry startup, and 2 MB partition limits.
```

- [ ] **Step 7: Resolve all Critical and Important review findings**

For each accepted finding, use `apply_patch`, repeat the directly affected
inspection command, then rerun:

```sh
zsh -ic 'idf; idf.py build'
git diff --check
```

Expected: build and whitespace checks exit 0. Do not make speculative changes
for unsupported findings; record the technical reason when rejecting one.

- [ ] **Step 8: Commit review fixes if the review changed files**

Inspect `git status --short`, stage only the explicit files changed to resolve
accepted review findings, then run
`git commit -m "fix: address telemetry transport static review"`. Do not use a
broad directory add here because unrelated user changes may exist by the time
the review runs. Skip this commit when the static review required no file
changes.

- [ ] **Step 9: Record final handoff evidence**

Run:

```sh
git status --short
git log -8 --oneline
```

Expected: no uncommitted telemetry implementation changes (unrelated user work,
if any, remains untouched) and a linear sequence of the task commits above.
Report the firmware image size, SPIFFS image size, clean build result, and
static-review disposition. Do not claim runtime or hardware validation.
