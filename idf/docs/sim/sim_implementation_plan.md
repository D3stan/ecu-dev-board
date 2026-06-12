# Implementation Plan: ECU Simulator Node (ESP-IDF Native)

This document outlines a high-level, phased implementation plan to build the **ECU Simulator Node** on an ESP32-S2 development board using the native **ESP-IDF framework**. The plan is structured into five progressive phases ordered by technical complexity, with minimal code to maintain a clean architecture focus.

---

## User Review Required

> **Important:**
> **Centralized Pin Configurations (`pins.h`)**
> All physical pin definitions are completely decoupled from driver logic. You must review the default GPIO selections in `pins.h` once hardware is wired, or adjust them for specific ESP32-S2 pinouts.

---

## Proposed Changes

### Phase 1: Project Setup & Native configuration (Low Complexity)

Establish the basic project skeleton, build targets, and centralized pin mappings inside a native ESP-IDF environment.

#### [NEW] [pins.h](pins.h) (Macro Configuration Header)
- Define pin macros for all simulator functions to ensure portability.
- Default pin assignments for ESP32-S2:
  - `SIM_PIN_PICKUP` (Pick-up coil output)
  - `SIM_PIN_TPS_OUT` (TPS analog output - DAC Channel 2 / GPIO 18)
  - `SIM_PIN_EGT_OUT` (EGT analog output - DAC Channel 1 / GPIO 17)
  - `SIM_PIN_SPARK` (CDI Spark input interrupt)
  - `SIM_PIN_QS_OUT` (Quick-Shifter pulse output)
  - `SIM_PIN_TPS_POT` & `SIM_PIN_EGT_POT` (Analog manual cockpit inputs - ADC1 Channels)

#### [MODIFY] [CMakeLists.txt](../../CMakeLists.txt) (ESP-IDF Build Configuration)
- Set up target board target configurations for ESP-IDF native compiling.
- Include standard ESP-IDF component lists (driver, esp_http_server, esp_timer, adc, dac).

---

### Phase 2: Core Superloop & Kinematics Engine (Medium Complexity)

Implement the main non-blocking control loop and physical state integration models.

#### [NEW] [sim_state.h](sim_state.h) (Core Global Memory Model)
- Define state structs tracking dynamic and virtual variables:
```c
typedef struct {
    float tps;          // 0.0 - 100.0 %
    float egt;          // 20.0 - 1000.0 °C
    float rpm;          // 0.0 - 18000.0 RPM
    bool spark_detected;
    float spark_advance;
} sim_state_t;
```

#### [NEW] [main.c](../../main/main.c) (Loop Control & Kinematics)
- Implement `app_main` running a strict, non-blocking time-sliced scheduler using `esp_timer_get_time()`:
  - **100 Hz simulation tick**: Runs kinematics integrations (integrates TPS load to calculate transient RPM under simulated flywheel inertia; computes EGT rise/decay equations).
  - **10 Hz telemetry tick**: Serializes `sim_state` parameters to JSON format and broadcasts via UART and WebSockets.
- Implement the thermodynamics bypass when `fault_egt_overheat` is active (instantly forcing EGT to 850°C).

---

### Phase 3: Hardware I/O Generation (Medium Complexity)

Set up signal generator outputs (crankshaft pick-up and dual DAC analog sensors) and the Quick-Shifter digital pulse.

#### [NEW] [sim_io_outputs.c](sim_io_outputs.c) (LEDC & Dual DAC Outputs)
- **Pick-up Coil Generator**:
  - Initialize LEDC on `SIM_PIN_PICKUP` using a dedicated timer running a 50% duty cycle.
  - Implement a dynamic frequency updater function translating target RPM to Hz:
    $$f = \frac{\text{RPM}}{60}$$
- **Dual Hardware DAC Analog Outputs**:
  - Initialize the hardware DAC on both channels (`DAC_CHANNEL_1` for EGT and `DAC_CHANNEL_2` for TPS).
  - Map analog voltage updates directly to DAC register writes (0-255 scale representing 0V to 3.3V), eliminating the need for PWM smoothing or external RC filters.
- **Quick-Shifter Digital Switch Simulator**:
  - Configure `SIM_PIN_QS_OUT` as a digital output, initializing it to a High (inactive) state.
  - Implement a non-blocking pulse trigger: when activated, pull the pin Low (active) and set a microsecond timer to release it High after a calibrated duration (50ms–100ms).

---

### Phase 4: Embedded Web UI & Native esp_http_server (High Complexity)

Embed the compiled Web UI assets and set up the native WebSocket server.

#### [NEW] [index_html.h](index_html.h) (Inlined Web UI Assets)
- Store the compiled and bundled single-file Vite HTML page as a static C character array (`const char index_html[]`).

#### [NEW] [web_builder.py](web_builder.py) (Asset Bundling Script)
- Create a Python script in the build chain to compile the Vite project (see webui/), bundle the built assets into a single static file, and export it directly as `index_html.h`.

#### [NEW] [sim_net.c](sim_net.c) (esp_http_server Routing)
- Spin up `esp_http_server` on port 80.
- Register endpoints:
  - `GET /` -> Serves `index_html`.
  - `WS /ws` -> Dual-direction WebSocket handler.
- Implement the WebSocket event handler:
  - Receive incoming WebSocket packets from the HTTP task context.
  - Parse control messages (`toggle_override`, `set_value`, `inject_fault`).
  - Write values directly to volatile parameters in the `sim_state` global instance.

---

### Phase 5: Passive Spark Advance Monitoring (High Complexity)

Develop the timing measurement block to calculate spark degrees relative to the generated pick-up signal.

#### [NEW] [sim_io_capture.c](sim_io_capture.c) (Timing Interrupt Service Routine)
- Configure `SIM_PIN_SPARK` with an active-high rising-edge GPIO interrupt.
- Create a low-latency Interrupt Service Routine (ISR) that records the hardware timestamp of the ECU's spark trigger:
  `t_spark = esp_timer_get_time();`
- Implement a passive measurement function running at the start of loop ticks:
  - Calculate `Delta T` between the generated pick-up edge timestamp (`t_pickup`) and the last ECU spark capture (`t_spark`).
  - Translate the time gap to physical BTDC (Before Top Dead Center) degrees based on current running RPM.
  - Track spark presence: if no spark interrupt occurs within two rotation periods, flag `spark_detected = false` and drop simulated EGT.

---

## Verification Plan

### Automated Tests
- Jumper `SIM_PIN_QS_OUT` to a test input pin to verify active-low pulse duration is exactly within 50ms–100ms.
- Run `web_builder.py` and verify `index_html.h` is successfully compiled and inlined.

### Manual Verification
1. **Dynamic Tuning Verification**: Log into the web dashboard, move the TPS override slider, and verify that the calculated RPM increases smoothly and is reflected in the pickup wave frequency on an oscilloscope.
2. **Ignition Cut Test**: Trigger a Quick-Shift pulse from the Web UI and check that the QS pin pulls low for the designated duration. Verify that spark signals captured on `SIM_PIN_SPARK` cut out during this window and EGT drops.
3. **Overheat Fault Test**: Toggle the EGT Overheat fault and verify that EGT instantly rises to 850°C regardless of engine speed.
