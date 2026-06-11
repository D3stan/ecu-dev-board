# ECU Simulator Node Testing & Verification Guide

This guide provides comprehensive instructions to build, flash, connect, wire, and test the **ECU Simulator Node** on an **ESP32-S2** development board (such as the Lolin S2 Mini) using native ESP-IDF.

---

## 1. System & Architecture Overview

The ECU Simulator Node simulates engine physical behavior (crankshaft RPM pulses, throttle load, exhaust gas temperature) to test the engine controller (ECU) in a Hardware-in-the-Loop (HIL) setup. 

The simulator features:
- **Kinematics Engine**: Simulates flywheel rotational inertia and thermodynamics (EGT).
- **Physical Output Signals**: Generates pickup coil square waves (LEDC) and dual analog sensor signals (DAC).
- **Embedded Web Server**: Serves a single-file, highly-responsive Vite-based monitoring dashboard.
- **WebSocket Gateway**: Stream live telemetry at 10 Hz and receives manual overrides and faults from operators in real-time.
- **ADC Sampling**: Reads physical potentiometers on-board to adjust TPS/EGT parameters.

---

## 2. Hardware Pinout & Wiring (ESP32-S2)

Refer to the table below for the physical GPIO assignments configured in [pins.h](file:///Users/puddu/Documents/GitHub/ecu-dev-board/emulator/main/pins.h):

| Signal Name | ESP32-S2 GPIO | Mode | Description | Electrical Specification |
|:---|:---:|:---:|:---|:---|
| **SIM_PIN_PICKUP** | `GPIO 13` | Output | Crankshaft pick-up coil emulation | 0V to 3.3V square wave ($f = \text{RPM} / 60$) |
| **SIM_PIN_TPS_OUT** | `GPIO 18` | Output | Simulated Throttle Position (TPS) voltage | Analog 0V to 3.3V (DAC Channel 2) |
| **SIM_PIN_EGT_OUT** | `GPIO 17` | Output | Simulated Exhaust Gas Temp (EGT) voltage | Analog 0V to 3.3V (DAC Channel 1) |
| **SIM_PIN_SPARK** | `GPIO 21` | Input | Spark ignition trigger feedback | Digital Input, Rising-Edge Interrupt |
| **SIM_PIN_QS_OUT** | `GPIO 12` | Output | Quick-Shifter switch pull-down signal | Digital Output (Active-Low, default High) |
| **SIM_PIN_QS_IN** | `GPIO 14` | Input | Physical Quick-Shifter button | Digital Input (Active-Low, internal pull-up, debounced in fast poll) |
| **SIM_PIN_TPS_POT** | `GPIO 1` | Input | Manual TPS tuning dial | Analog Input (ADC1 Channel 0) |
| **SIM_PIN_EGT_POT** | `GPIO 2` | Input | Manual EGT tuning dial | Analog Input (ADC1 Channel 1) |

> [!CAUTION]
> **CDI Spark Ignition Voltage Warning**
> Direct connection of CDI coil spark outputs (which can spike to hundreds of volts) to the ESP32-S2 GPIO input (`GPIO 21`) will instantly destroy the MCU. You **must** utilize a high-speed optocoupler or a transistor level-shifter interface to decouple high-voltage ignition signals from the simulator.

---

## 3. Building & Flashing

### Step 1: Compile and Inline the Web UI
Before compiling the firmware, run the Python automation builder script. This script builds the Vite frontend, extracts code assets, forces production mode, gzips the code, and writes it directly to a C header file [index_html.h](file:///Users/puddu/Documents/GitHub/ecu-dev-board/emulator/main/index_html.h).

```bash
cd /Users/puddu/Documents/GitHub/ecu-dev-board/emulator
python3 web_builder.py
```

### Step 2: Set up ESP-IDF Environment
Load the ESP-IDF toolchain variables (using version 5.5.4):

```bash
. ~/.espressif/v5.5.4/esp-idf/export.sh
```

### Step 3: Build, Flash, and Monitor
Connect your ESP32-S2 board via USB, then run the compilation, flash, and serial monitor sequence:

```bash
# Set target chip to esp32s2 if doing a clean build configuration
idf.py set-target esp32s2

# Build, flash, and open monitor (replace /dev/tty.usb... with your actual port if required)
idf.py build flash monitor
```

---

## 4. Connecting to the Web Dashboard

Once booted, the ESP32-S2 initializes its internal NVS storage, spins up WiFi in Access Point (AP) mode, and starts the HTTP/WebSocket servers:

1. **Connect to WiFi**: On your PC or smartphone, search for the WiFi network:
   - **SSID**: `ESP32S2_ECU_SIM`
   - **Password**: `12345678`
2. **Access the Console**: Open your web browser and navigate to:
   - `http://192.168.4.1/`
3. **Verify Connection**: The status badge on the top right of the dashboard should toggle to green **Connected**.

---

## 5. Functional Test Cases

### Test Case 1: UART Telemetry Log Check
- **Procedure**: Connect the ESP32-S2 to a terminal emulator (e.g. `idf.py monitor`).
- **Pass Criteria**: Verify that a JSON telemetry payload is outputted at a 10 Hz frequency:
  ```json
  {"type": "sim_telemetry", "data": {"rpm": 1200.0, "tps": 0.0, "egt": 20.0, "ecu_advance": 15.00, "spark_detected": true, "overrides": {"tps": false, "egt": false, "rpm": false, "egt_fault": false}}}
  ```

### Test Case 2: Analog Dial Tuning (TPS & EGT Potentiometers)
- **Setup**: Connect two physical $10\text{k}\Omega$ potentiometers (outer pins to `2.5V`/`GND` on ESP32-S2, wiper pins to `GPIO 1` and `GPIO 2`). If only `3.3V` is available, add a divider so the wiper presented to the ESP32-S2 ADC does not exceed about `2.5V`.
- **Procedure**: Rotate the TPS dial wiper.
- **Pass Criteria**:
  1. The Web UI dashboard and terminal output should show the live TPS value rising/falling smoothly (0% to 100%).
  2. Because TPS determines simulated throttle load, the computed Engine RPM should automatically ramp up/down (1200 RPM up to 18,000 RPM) with simulated flywheel inertia.
  3. The calculated EGT should also begin to rise due to engine load and speed thermal calculations.
  4. Repeat with the EGT potentiometer to manually calibrate baseline temperature.

### Test Case 3: Web-Based Control Overrides
- **Procedure**:
  1. Open the dashboard, locate the **Hardware Overrides** panel, and toggle the **Override TPS** checkbox.
  2. Drag the TPS override slider.
  3. Open the RPM override page, enable RPM override, and set a target RPM.
  4. Locate the **Override EGT** checkbox, toggle it, and drag the EGT override slider.
- **Pass Criteria**:
  - Rotating physical potentiometers should no longer affect the values.
  - The simulated values should lock exactly to the web dashboard slider positions.
  - Measure the analog voltages on `GPIO 18` (TPS) and `GPIO 17` (EGT) using a multimeter. Ensure that 0% throttle / 20°C corresponds to `~0V` and 100% throttle / 1000°C corresponds to `~3.3V` (scaling linearly).

### Test Case 4: EGT Overheat Fault Injection
- **Procedure**: On the dashboard, click **INJECT EGT OVERHEAT**.
- **Pass Criteria**:
  - The EGT temperature gauge on the dashboard should rapidly override all other inputs and ram up to **850°C**.
  - Toggling the fault button off should restore EGT values back to normal mapped levels.

### Test Case 5: Quick-Shifter Signal Verification
- **Setup**:
  1. Connect an oscilloscope or logic analyzer to `GPIO 12` (`SIM_PIN_QS_OUT`).
  2. Connect a momentary button between `GPIO 14` (`SIM_PIN_QS_IN`) and `GND`.
- **Procedure**:
  1. On the dashboard, click **TRIGGER QUICK-SHIFTER**.
  2. Press and release the physical button on `GPIO 14`.
  3. Hold the physical button down for longer than one second.
- **Pass Criteria**:
  - The signal on `GPIO 12` should drop from `3.3V` (High) to `0V` (Low) for exactly **75ms** (calibrated trigger duration) and then return to `3.3V`.
  - The Web UI button and physical button should produce the same output pulse.
  - Holding the physical button should not repeatedly retrigger; a new pulse should occur only after release and another press.

### Test Case 6: Pick-up Coil Pulse Generator Verification
- **Setup**: Connect an oscilloscope or frequency counter to `GPIO 13` (`SIM_PIN_PICKUP`).
- **Procedure**:
  1. Set target RPM to 3,000 RPM. Verify the output frequency is:
     $$f = \frac{3000}{60} = 50\text{ Hz}$$
  2. Set target RPM to 12,000 RPM. Verify the output frequency is:
     $$f = \frac{12000}{60} = 200\text{ Hz}$$
- **Pass Criteria**: The output waveform should be a clean, 0-3.3V square wave at 50% duty cycle with the correct corresponding frequency.
