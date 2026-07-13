# Pickup-Driven CDI Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement pickup-based RPM measurement, TPS/map advance calculation, GPTimer-scheduled CDI firing, manual fallback, telemetry, and RGB controller status.

**Architecture:** A falling-edge GPIO ISR timestamps the MAX9924 signal using a free-running 1 MHz GPTimer. Focused modules provide TPS median filtering, bilinear map lookup, controller state, timed simultaneous fire outputs, and task-context status/telemetry.

**Tech Stack:** C11, ESP-IDF 5.5.4, ESP32-S2 GPIO, GPTimer, dedicated GPIO, ADC oneshot driver, FreeRTOS tasks, CMake.

## Global constraints

- Do not add automated test files; the user requested build, inspection, and subagent verification instead.
- Preserve the existing user change setting the CDI pulse width to 500 microseconds.
- Use one falling-edge pickup event per revolution and suppress the first event.
- Keep all tunable parameters and target pin assignments in `main/test-bench_config.h`.
- Keep ignition map data outside `main/test-bench.c`.
- Avoid logging, blocking calls, and dynamic allocation in runtime ISRs.
- Work in the current detached checkout because it contains the user's uncommitted configuration change.

---

### Task 1: Configuration and pure data modules

**Files:**
- Modify: `main/test-bench_config.h`
- Create: `main/ignition_map.h`
- Create: `main/ignition_map.c`
- Create: `main/tps.h`
- Create: `main/tps.c`

**Interfaces:**
- `esp_err_t ignition_map_validate(uint16_t pickup_angle_tenths)`
- `uint16_t ignition_map_lookup(uint32_t rpm, uint8_t tps_percent)`
- `esp_err_t tps_init(void)`
- `uint8_t tps_get_percent(void)`

- [x] Add target-conditional pin assignments, RPM/angle/timeout/ADC/telemetry macros, task sizing, and compile-time range assertions to `test-bench_config.h`.
- [x] Add the approved axes and advance cells to `ignition_map.c` and implement clamped rounded bilinear interpolation.
- [x] Implement ADC1 GPIO1 oneshot sampling at 30 Hz and median-of-five publication in `tps.c`.
- [x] Declare only the public initialization and read interfaces in the headers.
- [x] Build with `zsh -ic 'idf; idf.py build'` and resolve every compiler or linker error before Task 2.

### Task 2: Status LED and engine controller

**Files:**
- Create: `main/status_led.h`
- Create: `main/status_led.c`
- Create: `main/engine_control.h`
- Create: `main/engine_control.c`

**Interfaces:**
- `esp_err_t status_led_init(void)`
- `void status_led_set_state(engine_state_t state)`
- `esp_err_t engine_control_init(void)`
- `bool engine_control_request_manual_fire(void)`
- `void engine_control_service(void)`
- `engine_state_t engine_control_get_state(void)`
- `void engine_control_get_snapshot(engine_snapshot_t *snapshot)`

- [x] Define the no-signal, acquisition, and synchronized states plus the telemetry snapshot structure in `engine_control.h`.
- [x] Implement active-high red/yellow/green state application in `status_led.c`, with blue low.
- [x] Configure a free-running 1 MHz GPTimer, dedicated GPIO4/GPIO15 output bundle, and falling-edge GPIO2 pickup input in `engine_control.c`.
- [x] Implement period validation, first-edge suppression, latest-period RPM, map lookup, absolute target calculation, and late-fire accounting.
- [x] Implement GPTimer pulse-start/pulse-end alarms and serialize manual and automatic firing under an ISR-safe critical section.
- [x] Implement 500 millisecond inactivity service that clears synchronization, cancels pending output, forces outputs low, and allows manual firing.
- [x] Build with `zsh -ic 'idf; idf.py build'` and resolve every compiler or linker error before Task 3.

### Task 3: Application integration and documentation

**Files:**
- Modify: `main/test-bench.c`
- Modify: `main/CMakeLists.txt`
- Modify: `docs/esp32-s2-mini_pins.md`

**Interfaces:**
- `app_main()` initializes status, TPS, map/controller, button task, service task, and optional telemetry.

- [x] Replace the direct button-to-RMT path with initialization orchestration and a debounced manual-fire task.
- [x] Add a periodic service task that applies controller state to the RGB LED and runs the 500 millisecond timeout logic.
- [x] Add compile-time optional 200 millisecond telemetry using controller snapshots.
- [x] Register all sources and required ESP-IDF components in `main/CMakeLists.txt`.
- [x] Update the board pin assignment table and timing behavior in `docs/esp32-s2-mini_pins.md`.
- [x] Run `zsh -ic 'idf; idf.py fullclean; idf.py build'`, `git diff --check`, and focused `rg` inspection of ISR bodies and configuration references.
- [x] Request an independent subagent review against the design specification and address all critical or important findings.
