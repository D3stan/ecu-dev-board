# Simulator Web UI Specification

The **Simulator Web UI** is an interactive, lightweight control panel hosted directly on the simulator board. It enables HIL (Hardware-in-the-Loop) test-bench operator control, manual value overrides, and live spark timing feedback.

---

## Embedded Web Server & WebSocket Architecture

To keep the simulator deployment simple and free from filesystem mounting dependencies, the entire frontend is implemented as a **single-file inline HTML/CSS/JS page** stored as a static character array in the firmware (`index_html.h`).

- **Server Library**: ESP-IDF `esp_http_server` module.
- **Routing**: Two light endpoints:
  - `GET /` — Serves the inlined HTML/CSS/JS page.
  - `WS /ws` — Dual-direction JSON communication channel handler.

### Asynchronous Request Handling & Thread Safety
Because the `esp_http_server` runs in its own FreeRTOS task spawned by `httpd_start()`, WebSocket callbacks are executed in a separate background thread context. To maintain maximal timing precision inside the simulator's core superloop, incoming command mutations (like virtual overrides or value edits) write directly to volatile state fields inside `sim_state_t`. 

No complex blocking synchronization (e.g., mutex locks) is used, since manual operator overrides are not timing-critical and do not require strict lock-step synchronization.

---

## Dual-Direction JSON API

The Web UI and Simulator communicate over WebSockets using flat JSON payloads:

### 1. Telemetry Frame (Simulator → Web UI)
Pushed at **10 Hz**:
```json
{
  "type": "sim_telemetry",
  "data": {
    "rpm": 9200,
    "tps": 78.4,
    "egt": 720,
    "ecu_advance": 32.5,
    "spark_detected": true,
    "overrides": {
      "tps": true,
      "egt": false,
      "egt_fault": false
    }
  }
}
```

### 2. Control Commands (Web UI → Simulator)
Sent when the operator interacts with the Web UI controls:
- **Toggle Parameter Override Mode**:
  `{"cmd": "toggle_override", "param": "tps", "active": true}`
- **Modify Virtual Parameter Value**:
  `{"cmd": "set_value", "param": "tps", "value": 78.4}`
- **Inject Fault Condition**:
  `{"cmd": "inject_fault", "fault": "egt_overheat", "active": true}`

---

## UI Layout & Interaction Sections

The Web UI features a dark, dashboard-style responsive layout:

```
+-------------------------------------------------------------+
|  ECU SIMULATOR CONTROL CENTER                      [Connected] |
+-------------------------------------------------------------+
|  [ ENGINE LIVE METRICS ]                                    |
|   RPM: 9200            TPS: 78.4%           EGT: 720°C      |
|   Spark Advance: 32.5° BTDC                  [SPARK ACTIVE] |
+-------------------------------------------------------------+
|  [ HARDWARE OVERRIDES ]                                     |
|   [x] Override TPS    (==[===================] 78.4%)       |
|   [ ] Override EGT    (==========[===========] 400°C)       |
+-------------------------------------------------------------+
|  [ FAULT INJECTION ]                                        |
|   [ INJECT EGT OVERHEAT ]       [ TRIGGER QUICK-SHIFTER ]   |
|   (Forces EGT to 850°C)          (Flashes spark cut timing) |
+-------------------------------------------------------------+
```

### 1. Live Engine Telemetry Block
- **RPM Meter**: Digital display showing current dynamically computed RPM.
- **Spark Advance Monitor**: Shows the calculated ignition advance degree relative to the crankshaft position trigger (e.g. `32.5° BTDC`).
- **Spark Indicator**: Pulsing virtual LED that flashes green whenever physical sparks are captured. If the ECU cuts spark (e.g. during a Quick Shift cut), the LED goes dark.

### 2. Hardware Overrides Panel
By default, the simulator reads physical potentiometers (TPS/EGT) connected to the ADC. Checking an "Override" box activates a software-lock:
- **Override TPS**: Detaches the TPS parameter from the physical potentiometer and binds it to a smooth web slider (0–100%).
- **Override EGT**: Detaches the EGT thermal calculation and binds it to a web slider (20°C to 1000°C).

### 3. Fault & Event Injector Panel
Contains instant actions designed to stress-test the ECU:
- **EGT Overheat Button**: Simulates thermocouple failure or engine overheat. Bypasses calculations to force simulated EGT to **850°C**. The operator can then verify that the ECU successfully transits to the `ALARM` state and trips safety outputs.
- **Quick-Shifter Trigger Button**: Sends a command to pull the digital output pin (`SIM_PIN_QS_OUT`) low for a brief duration (50ms–100ms) to simulate a physical shifter cut switch press, testing the ECU's shift cut detection code.

---

## Relocation & Build Chain

The Web UI source code was relocated from the `idf/webui` directory to the `emulator/webui` directory to keep the emulator project self-contained and version-controlled.

### Compilation and Inlining Flow

To compile and integrate the Web UI into the native ESP-IDF firmware:
1. **Build Tool**: The automation script [web_builder.py](file:///Users/puddu/Documents/GitHub/ecu-dev-board/emulator/web_builder.py) in the `emulator` directory automates the pipeline.
2. **Execution Steps**:
   - Executes `npm run build` inside [webui](file:///Users/puddu/Documents/GitHub/ecu-dev-board/emulator/webui) to compile static assets into `dist/`.
   - Reads the built `index.html`.
   - Decompresses and extracts the CSS (`style.css.gz`) and JavaScript (`app.js.gz`) assets.
   - Inlines the CSS and JavaScript content directly into `index.html` using `<style>` and `<script>` tags, making it a single self-contained document.
   - Replaces `const isDev = true;` with `const isDev = false;` to switch the UI to production mode (connecting to the ESP32 WebSocket server at `ws://<ESP_IP>/ws` rather than mock local telemetry).
   - Compresses (gzip) the final inlined HTML to minimize flash footprint.
   - Generates [index_html.h](file:///Users/puddu/Documents/GitHub/ecu-dev-board/emulator/main/index_html.h) containing the gzipped hex byte array `index_html_gz[]` and its length.
3. **Usage Command**:
   ```bash
   python3 web_builder.py
   ```

