# Simulator Node High-Level Architecture Prototyping

This document outlines the high-level architecture of the **ECU Simulator Node**. The simulator runs on a secondary ESP32 development board, serving as a hardware-in-the-loop (HIL) test-bench. It physicalizes mechanical and thermal signals (Pick-up coil sensor, Throttle Position Sensor, Exhaust Gas Temperature) and measures the resulting ECU CDI (Capacitor Discharge Ignition) trigger output to calculate spark advance.

## Design Philosophy: No FreeRTOS

To ensure sub-microsecond pulse timing accuracy, zero task-switching overhead, and maximal determinism, **the Simulator does not employ FreeRTOS multitasking**. Instead, it uses a **bare-metal-style superloop** paired with hardware interrupts and low-overhead timers. 

### Why Skip FreeRTOS?
- **Ultra-low latency**: Direct register manipulation and hardware interrupts avoid context-switching delays, preserving precise phase relationships between mechanical pulses and ignition triggers.
- **Extreme simplicity**: Eliminates race conditions, mutex locks, and multi-threaded stack sizing problems.
- **Deterministic signal timing**: High-precision square waves represent crankshaft rotation up to 18,000 RPM (300 Hz pick-up frequency) generated via hardware timers, unaffected by RTOS scheduler ticks.

---

## High-Level Architecture Overview

The simulator consists of three key architectural blocks cooperating in a single-threaded loop:

```mermaid
graph TD
    subgraph MCU Core [MCU Core & State Machine]
        Superloop[Superloop Main Timing Loop]
        EngineSim[Engine Kinematics & Thermal Simulator]
        Telemetry[JSON Frame Composer]
    end

    subgraph IO [I/O - Signal Generators & Capture]
        ADC_Read[ADC: Read TPS & EGT Potentiometers]
        PulseGen[Hardware Timer: Pick-up Pulse Generator]
        SparkCapture[GPIO Interrupt: Spark Timing Capture]
    end

    subgraph WebUI [Simulator Web UI & API]
        HTTPServer[esp_http_server - Web & WS Interfaces]
        OverrideMgr[Manual Override / Fault Injector]
    end

    Superloop -->|Run Periodic| EngineSim
    Superloop -->|Process Polls| ADC_Read
    EngineSim -->|Compute Target Freq| PulseGen
    SparkCapture -->|Record Spark Offset| EngineSim
    HTTPServer -->|Inject Overrides| OverrideMgr
    OverrideMgr -->|Override Params| EngineSim
    EngineSim -->|State Payload| Telemetry
    Telemetry -->|Stream via Websockets| HTTPServer
```

---

## Important Subsystems

To keep the codebase modular and organized, the architecture is split into three main technical specifications:

### 1. [MCU Core (Engine Simulator)](file:///Users/puddu/Documents/GitHub/ecu-dev-board/idf/docs/sim/mcu_core.md)
Responsible for engine rotation kinematics, thermal rise/decay equations, virtual overrides, and telemetry compilation. It coordinates the overall logic of the simulation without spawning concurrent tasks.

### 2. [I/O Interface (Hardware Layer)](file:///Users/puddu/Documents/GitHub/ecu-dev-board/idf/docs/sim/io.md)
Responsible for physical interaction:
- **Generation**: Creating the pick-up sensor square wave (0–300 Hz) using the ESP32 hardware timer or LEDC.
- **Measurement**: Capturing the ECU's CDI spark output with a high-precision input capture GPIO interrupt.
- **Sampling**: Reading physical potentiometers using the ADC to simulate TPS and EGT sensors.

### 3. [Simulator Web UI (Interactive Panel)](file:///Users/puddu/Documents/GitHub/ecu-dev-board/idf/docs/sim/web_ui.md)
A lightweight web interface hosted directly on the simulator's flash filesystem. It allows developers to:
- Actively override analog sensor values (TPS, EGT) via virtual sliders.
- Artificially inject faults (e.g., EGT overheating) to test the ECU's `ALARM` state.
- Monitor physical spark timing metrics calculated by the capture system.

---

## HIL Hardware Connections

The ECU (ESP32-S3) and the Simulator (ESP32) are cross-connected to construct a closed-loop system:

| Simulator Pin (ESP32) | Connection Type | ECU Pin (ESP32-S3) | Signal Description |
|-----------------------|-----------------|---------------------|--------------------|
| **GPIO 25 (DAC/PWM)** | Output → Input   | **GPIO 4**          | Pick-up Coil Pulse (0-300 Hz square wave) |
| **GPIO 26 (DAC/PWM)** | Output → Input   | **GPIO 5**          | Throttle Position Sensor (TPS) Analog Voltage (0-3.3V) |
| **GPIO 27 (DAC/PWM)** | Output → Input   | **GPIO 6**          | Exhaust Gas Temp (EGT) Analog Voltage (0-3.3V) |
| **GPIO 34 (Input)**   | Input ← Output   | **GPIO 7**          | CDI Ignition Spark Trigger |
| **GND**               | Ground Share    | **GND**             | Common Ground Reference |
