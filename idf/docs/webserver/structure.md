# WebSocket Telemetry Delivery — Implementation Plan

## Overview

The telemetry core (`SensorTelemetryCollector`) already exists and produces typed `TelemetryBatch`
objects. This plan adds the **WebSocket transport layer** on top of it: a dedicated FreeRTOS task
that periodically calls `collect()`, serializes the batch to JSON, and pushes it over a WebSocket
connection to the browser client.

This implements **Stage 1 (Communication Foundation)** and **Stage 2 (Basic Live Sensor State)**
from `telemetry.md`, using only the already-implemented `SensorTelemetryCollector`.

---

## Design Decisions

| Topic | Decision | Rationale |
|---|---|---|
| **WiFi mode** | Station (STA) — ECU joins an existing network | Simpler integration in a workshop or garage with a router; avoids phone losing internet |
| **WebSocket port/path** | Port `80`, path `/ws` | Standard HTTP port; no firewall issues on most networks |
| **Serialization** | JSON text frames | Debuggable with any WebSocket inspector; no client-side parsing library needed |
| **Webapp hosting** | ECU serves Vite `.gz` static files from flash (SPIFFS/LittleFS) | Self-contained deployment; no external host required; Vite build output is gzip-compressed |

---

## System Context

```
SensorDataStore  <--  sensor_harness_task  (Core 1, priority +1, pinned)
       |  read-only borrow
       v
SensorTelemetryCollector
       |  owned by
       v
telemetry_server_task  (Core 0, priority +2, pinned)
       |  JSON frame
       v
esp_http_server
       |
  +----+------------------------+
  |  GET /ws  (WebSocket)       |  -->  browser dashboard
  |  GET /*   (static .gz)      |  -->  Vite app files from SPIFFS
  +-----------------------------+
```

The engine-control path (Core 1) never touches the network stack and is never blocked by it.

---

## Component Structure

A new `components/telemetry_server` component is introduced. It depends on `telemetry` and
`sensors` (transitively), plus `esp_wifi`, `esp_http_server`, and `spiffs`.

The existing `telemetry` component remains transport-neutral and does not include or depend on
`telemetry_server`.

### New files

| File | Role |
|---|---|
| `components/telemetry_server/CMakeLists.txt` | Component registration |
| `components/telemetry_server/Kconfig` | Menuconfig options |
| `components/telemetry_server/include/telemetry_server/telemetry_server.hpp` | Public API |
| `components/telemetry_server/src/telemetry_server.cpp` | Implementation |

### Modified files

| File | Change |
|---|---|
| `main/main.cpp` | Call `telemetry_server::start()`, pin harness task to Core 1 |
| `main/CMakeLists.txt` | Add `telemetry_server` to `REQUIRES` |
| `main/Kconfig.projbuild` | Add Telemetry Server menu |

---

## Public API

```cpp
namespace ecu::telemetry_server {

struct TelemetryServerConfig {
    // WiFi STA
    const char *sta_ssid          = "";          // set via Kconfig
    const char *sta_password      = "";          // set via Kconfig

    // HTTP / WebSocket
    uint16_t    http_port         = 80;
    const char *ws_path           = "/ws";

    // Static files (SPIFFS)
    const char *spiffs_base_path  = "/www";
    const char *spiffs_partition  = "www";       // partition label in partitions.csv

    // Telemetry pump
    uint32_t    collect_period_ms = 100;         // 10 Hz
    uint32_t    heartbeat_ms      = 500;         // heartbeat when state unchanged
};

// Starts WiFi STA + HTTP/WebSocket server + static file handler + telemetry pump task.
// `store` must outlive the server.
esp_err_t start(ecu::sensors::SensorDataStore &store,
                const TelemetryServerConfig   &config = {});

} // namespace ecu::telemetry_server
```

---

## Data Sent and Frequency

### State frame — sent at 10 Hz

Every 100 ms the telemetry pump task calls `collector.collect(now)` and sends one JSON
WebSocket text frame:

```json
{
  "t":    123456789,
  "gen":  42,
  "tps":  { "pct": 53.1,   "fallback": false, "valid": true,  "health": "Valid",   "seq": 17 },
  "rpm":  { "rpm": 4200.0, "period_us": 14285.7, "accel": 120.5,
            "sync": true,  "ref_trusted": true,  "valid": true, "health": "Valid",  "seq": 18 },
  "egt":  { "c": 520.3,    "rate": 1.2, "max_c": 620.0, "state": "Normal",
            "valid": true, "health": "Valid", "seq": 10 },
  "water":{ "c": 85.1,     "rate": 0.1, "max_c": 92.0,  "state": "Normal",
            "valid": true, "health": "Valid", "seq": 11 },
  "qs":   { "active": false, "armed": false, "valid": true, "seq": 12 },
  "map":  { "request": "Primary", "valid": true, "seq": 13 },
  "knock": null,
  "events": [
    {
      "kind":   "FaultTransition",
      "at":     123400000,
      "fault":  "TpsOutOfRange",
      "health": "Degraded",
      "count":  1
    }
  ],
  "overflow": { "qs": 0, "map": 0, "knock": 0, "fault": 0 }
}
```

#### Field semantics

| Field | Source | Notes |
|---|---|---|
| `t` | `TelemetryBatch::collected_at` | Monotonic µs — client detects staleness |
| `gen` | `TelemetryStateFrame::snapshot_generation` | Duplicate detection |
| `tps.pct` | `TpsTelemetryState::permille / 10.0` | Converted from permille to percent |
| `tps.fallback` | `TpsTelemetryState::fallback_used` | True when using fallback value |
| `rpm.*` | `EngineSpeedTelemetryState` | `accel` = `acceleration_rpm_per_s` |
| `egt.*` / `water.*` | `ThermalTelemetryState` | Same shape for both channels |
| `qs.*` | `QuickShifterTelemetryState` | Physical input state, not shift event |
| `map.request` | `MapSwitchTelemetryState::request` | `"Primary"` or `"Secondary"` |
| `knock` | `TelemetryStateFrame::latest_knock` | `null` when absent |
| `events` | `TelemetryBatch::events` | Ordered, empty array when none |
| `overflow` | `TelemetryBatch::overflow` | Source queue overflows, not WS drops |

Enum values (`health`, `state`, `request`, `fault`) are serialized as human-readable strings.

### Heartbeat — sent at 500 ms when state is unchanged

If `snapshot_generation` matches the last sent generation, no full frame is sent. Instead,
after 500 ms of no change, a compact heartbeat frame is sent:

```json
{ "hb": true, "t": 123456789 }
```

This lets the client distinguish a quiet-but-alive ECU from a dropped connection.

### What is NOT sent in V1

The following are reserved for later stages as defined in `telemetry.md`:

- Full revolution history and per-revolution records (Stage 4)
- Control decisions, applied corrections, active limiters (Stage 5)
- Actuator commands and ignition scheduling (Stage 6)
- Run lifecycle context, firmware/map revisions (Stage 7)
- Raw ADC values, noise statistics, diagnostic traces (Stage 8)

---

## FreeRTOS Task and Core Assignment

### Core allocation

| Core | Owner | Rationale |
|---|---|---|
| **Core 1** (`APP_CPU_NUM`) | `sensor_harness_task` (pinned) | Time-critical sensor acquisition, pickup ISR delivery, no network activity |
| **Core 0** (`PRO_CPU_NUM`) | `telemetry_server_task` (pinned) | WiFi/TCP stack runs on Core 0 by default in ESP-IDF; all I/O here |

The existing `sensor_harness_task` is changed from `xTaskCreate` to
`xTaskCreatePinnedToCore(..., APP_CPU_NUM)` to prevent FreeRTOS from migrating it to Core 0
under load.

### `telemetry_server_task` properties

| Property | Value |
|---|---|
| Core | **Core 0** (`PRO_CPU_NUM`) |
| Priority | `tskIDLE_PRIORITY + 2` |
| Stack | `8192` bytes |
| Wake-up mechanism | `vTaskDelay(pdMS_TO_TICKS(100))` — fixed 100 ms period |

Priority is set above the idle task but below any future real-time tasks on Core 0. The sensor
harness task on Core 1 runs at `+1`; the two cores are independent so priority ordering between
them does not apply directly, but keeping telemetry at `+2` leaves headroom for future Core 0
tasks that may need higher priority.

### Task structure (pseudocode)

```
telemetry_server_task(arg):
    store     = arg->store
    config    = arg->config
    collector = SensorTelemetryCollector(store)
    ws_fd     = -1                          // -1 = no client
    last_gen  = UINT32_MAX
    last_hb_at = esp_timer_get_time()

    loop:
        vTaskDelay(pdMS_TO_TICKS(100))

        if ws_fd == -1:
            continue   // no client -- do NOT drain event queues with nobody listening

        now   = esp_timer_get_time()
        batch = collector.collect(now)
        if !batch: continue

        if batch.state.snapshot_generation == last_gen:
            if (now - last_hb_at) >= 500 000 us:
                send_heartbeat_frame(ws_fd, now)
                last_hb_at = now
            continue

        json   = serialize_batch(batch)     // ~1-2 KB heap-allocated string
        result = httpd_ws_send_frame_async(server_handle, ws_fd, json)

        if result == ESP_OK:
            last_gen   = batch.state.snapshot_generation
            last_hb_at = now
        else:
            ws_fd = -1                      // client disconnected; recover on next connect
```

The `SensorTelemetryCollector` is constructed inside the task. It must not be shared with any
other task (see `basic_sensor_telemetry_core.md` section 7).

---

## WebSocket Session Management

`esp_http_server` supports WebSocket upgrades natively (ESP-IDF >= 5.0).

1. Register a URI handler for `GET /ws` with `.is_websocket = true`.
2. On the first incoming frame (upgrade), store the server handle and client socket file
   descriptor. Only one active client is tracked at a time (last-wins policy).
3. The pump task uses `httpd_ws_send_frame_async()` because the send originates from a
   different task than the HTTP server's internal processing task.
4. On send failure or receipt of a `HTTPD_WS_TYPE_CLOSE` frame, the stored file descriptor is
   set to `-1` and the pump task stops calling `collect()` until a new client connects.

---

## Static File Serving (Vite App)

The Vite production build is placed in a SPIFFS partition labelled `www` in `partitions.csv`.
The Vite build output files must be gzip-compressed (`.gz` extension). The file handler:

- Strips the `.gz` suffix to determine the original `Content-Type` (e.g. `text/javascript` for
  `.js.gz`).
- Sets `Content-Encoding: gzip` on all responses.
- Serves `index.html.gz` as the fallback for any unknown path (SPA client-side routing).

The WebSocket handler at `/ws` is registered before the catch-all handler so it takes
precedence.

---

## Kconfig Options

```kconfig
menu "ECU Telemetry Server"

    config TELEMETRY_SERVER_ENABLED
        bool "Enable WebSocket telemetry server"
        default y

    config TELEMETRY_SERVER_STA_SSID
        string "WiFi Station SSID"
        default ""
        depends on TELEMETRY_SERVER_ENABLED

    config TELEMETRY_SERVER_STA_PASSWORD
        string "WiFi Station password"
        default ""
        depends on TELEMETRY_SERVER_ENABLED

    config TELEMETRY_SERVER_HTTP_PORT
        int "HTTP/WebSocket port"
        default 80
        depends on TELEMETRY_SERVER_ENABLED

    config TELEMETRY_SERVER_COLLECT_HZ
        int "Telemetry state collection rate (Hz)"
        default 10
        range 1 50
        depends on TELEMETRY_SERVER_ENABLED

endmenu
```

---

## Verification Plan

### Build

- `idf.py build` succeeds with no new warnings after adding the component and modifying `main.cpp`.
- SPIFFS image is generated (`idf.py spiffs-image`) and flashed alongside the firmware.

### Runtime

1. Flash firmware; confirm the ECU connects to the configured WiFi network (IP logged to UART).
2. Open `ws://<ECU-IP>/ws` in a WebSocket client (e.g. `websocat`) and confirm JSON frames
   arrive at approximately 10 Hz.
3. Verify `"t"` timestamps advance monotonically and `"gen"` increments when sensor state
   changes.
4. Confirm `"events"` array contains `FaultTransition` entries when a sensor fault is injected.
5. Confirm heartbeat frame `{"hb":true,"t":...}` appears when state is static for more than
   500 ms.
6. Disconnect the WebSocket client; confirm the task recovers and resumes when a new client
   connects.
7. Open `http://<ECU-IP>/` and confirm the Vite app loads and its WebSocket connects
   automatically.
