# Implementation Plan: ECU Telemetry and Ignition System

## Executive Summary

This document serves as the high-level implementation plan for the development and integration of the 4-Node ECU Telemetry and Ignition System. The project realizes a software-defined Electronic Control Unit (ECU) custom-tailored for single-cylinder engines.

### System Overview
The architecture is structured across four distinct nodes:
1. **Simulator (ESP32)**: Generates synthetic sensor signals (Pick-up pulse, TPS, EGT) for test-bench validation.
2. **ECU Firmware (ESP32-S3)**: Formulates the real-time core. Core 0 executes engine critical operations (hard real-time FSM, ISR processing, CDI scheduling). Core 1 processes wireless communications (WebSocket telemetry, HTTP server, local storage, OTA updates).
3. **On-Board Dashboard (Vanilla JS/Vite)**: An interactive web application hosted in the ECU's LittleFS filesystem, ported from an older project. It connects to the ECU via WebSocket for real-time visualization and map tuning.
4. **Remote Server (Proxmox VM)**: Houses the central logging and historical data viewer suite, consisting of an MQTT Broker, an Express.js API Gateway, a PostgreSQL database, and a React SPA for read-only session analysis.

> [!NOTE]
> Detailed technical specifications, low-level design details, and specific sub-system implementation steps are documented in dedicated subfiles inside the [docs/](file:///Users/puddu/Documents/GitHub/ecu-dev-board/idf/docs) directory:
> - Detailed FSM transitions and hardware timings: [elaborato.md](file:///Users/puddu/Documents/GitHub/ecu-dev-board/idf/docs/elaborato.md)
> - Detailed WebUI migration plan and component mappings: [webui-conversion-plan.md](file:///Users/puddu/Documents/GitHub/ecu-dev-board/idf/docs/webui-conversion-plan.md)
> - Overall project objectives and hardware details: [ECU.md](file:///Users/puddu/Documents/GitHub/ecu-dev-board/idf/docs/ECU.md)

---

## User Review Required

Please review the following key decisions and architectural paradigms before proceeding:

> [!IMPORTANT]
> **WebUI Architecture Porting**
> The transition from the older project's WebUI to the ECU Dashboard will retain the core infrastructure (custom store, component lifecycle, socket reconnect logic, Vite build configurations). Older components will also be retained in case of necessity. New components will be built to suit the new domain, and the communication logic will be replaced.

> [!WARNING]
> **Telemetry Logging Strategy**
> For local session telemetry recording on the ECU, data will be captured at **2 Hz** and stored using a **circular buffer** configuration on the ECU. Real-time dashboard telemetry will stream at 10-20 Hz via WebSockets without persisting to flash memory.

---

## High-Level Implementation Phases

### Phase 1: Simulator Baseline
- **Simulator Node Creation**: Configure the secondary ESP32 development board as a physical signal generator capable of emitting a variable frequency square wave (representing Pick-up pulses from 0 to 300 Hz) and analog control voltages (representing TPS and EGT).

### Phase 2: Dual-Core ECU Firmware Construction (Core 0 & Core 1)
- **Core 0 Real-Time Logic**:
  - Implement the Pick-up GPIO Interrupt Service Routine (ISR) to record exact timestamps.
  - Formulate the 6-state engine Finite State Machine (INIT, SYNCING, RUNNING, IDLE, IGNCUT, ALARM).
  - Configure the Lookup Tables in Non-Volatile Storage (NVS) to map RPM to spark advance degrees.
  - Implement CDI timer scheduling to convert advance angles into precise output triggers.
- **Core 1 Communication Tasks**:
  - Initialize the WebSocket server to stream real-time JSON payloads.
  - Formulate the local session buffer for storing telemetry data in a packed binary format.
  - Set up client connections to the remote Proxmox MQTT broker for end-of-session log publishing.
  - Implement the OTA client tasked with polling the update repository.

### Phase 3: WebUI Porting & Frontend Component Implementation
- **Adapter Refactoring**: Replace the old pipe-delimited parser with a robust JSON message parser.
- **Real-Time Components**: Build visual components matching the domain needs:
  - `RpmGauge`: Arc-based SVG tachometer showing 0 to 18,000 RPM.
  - `TpsBar`: Horizontal positioning bar (0-100%).
  - `EgtIndicator`: Thermal meter with Safe/Warning/Danger thresholds.
  - `FsmBadge`: Color-coded status badge showing current state.
  - `MapEditor` & `MapCurve`: Interactive grid and SVG chart to edit 1D Lookup tables.
  - `QsButton`: Quick Shifter activation tool.

### Phase 4: Proxmox Server & Telemetry Ingestion Pipeline
- **Mosquitto Broker Setup**: Deploy the messaging broker inside the Proxmox environment.
- **PostgreSQL Database**: Apply the table schema optimized for both session lists and detailed time-series data storage.
- **Express.js Backend**: Develop the API server that subscribes to the MQTT logging topics, reassembles chunked uploads, and exposes API endpoints for the client UI.
- **React SPA**: Build the historical viewer displaying time-series chart plots, FSM status timelines, and discrete events (such as alarms or shift triggers).

---

## Proposed Repository Structure & Changes

For detailed, mid-level file modifications, reference the corresponding subfiles within the `docs/` folder. The primary file organization is outlined below:

### ECU Firmware (ESP-IDF)
#### [MODIFY] [CMakeLists.txt](file:///Users/puddu/Documents/GitHub/ecu-dev-board/idf/CMakeLists.txt)
#### [MODIFY] [main.c](file:///Users/puddu/Documents/GitHub/ecu-dev-board/idf/main/main.c)

### WebUI Dashboard (Static build for LittleFS)
#### [MODIFY] [package.json](file:///Users/puddu/Downloads/webui/package.json)
#### [MODIFY] [vite.config.js](file:///Users/puddu/Downloads/webui/vite.config.js)
#### [MODIFY] [index.html](file:///Users/puddu/Downloads/webui/src/index.html)
#### [MODIFY] [adapter.js](file:///Users/puddu/Downloads/webui/src/js/core/adapter.js)
#### [MODIFY] [App.js](file:///Users/puddu/Downloads/webui/src/js/core/App.js)
#### [MODIFY] [commandManager.js](file:///Users/puddu/Downloads/webui/src/js/managers/commandManager.js)
#### [MODIFY] [constants.js](file:///Users/puddu/Downloads/webui/src/js/utils/constants.js)
#### [MODIFY] [paths.js](file:///Users/puddu/Downloads/webui/src/js/utils/paths.js)

### Documentation Structure
To keep the codebase tidy and organized, documentation files for individual frontend components must be placed within dedicated subfolders under [src/docs](file:///Users/puddu/Downloads/webui/src/docs).
- Each component will have its own subdirectory matching its component name (e.g., `src/docs/[ComponentName]/`).
- The corresponding documentation markdown files and any local design assets/diagrams must reside inside that subfolder (e.g., `src/docs/WifiConnectionCard/WIFI_CONNECTION_CARD.md`).

---

## Verification Plan

### Automated Testing
- Execute local build scripts and syntax checks for both Svelte/Vite UI (`npm run build`) and ESP-IDF compilation processes (`idf.py build`).
- Simulate JSON payloads locally using mock WebSocket scripts to ensure the UI updates correctly without physical hardware.

### Manual Verification
1. **HW-in-the-Loop Simulation**: Hook the Simulator board to the ECU board. Alter the RPM potentiometer on the Simulator and verify that the tachometer on the WebUI moves in unison.
2. **Ignition Cut Validation**: Press the QS button on the Dashboard and observe the ECU's FSM transit to `IGNCUT` for the configured cycle duration.
3. **Session Upload Verification**: Shut down the simulated engine (0 RPM). Confirm that the ECU publishes the session logging payload via MQTT, that the Express.js gateway inserts it into PostgreSQL, and that it populates the session lists on the React viewer.
