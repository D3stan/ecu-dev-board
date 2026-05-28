# ECU Telemetry & Ignition Core — Final Specification

## 1. System Overview

A 4-node embedded/web system demonstrating a custom ECU for single-cylinder motorcycles. The project covers real-time engine control, live telemetry, map tuning, OTA updates, and session logging.

### Nodes

| # | Node | Hardware | Role |
|---|---|---|---|
| 1 | **Simulator** | ESP32 | Generates simulated sensor signals (pick-up, TPS, EGT). Controlled via its own mini web UI. |
| 2 | **ECU** | ESP32-S3 | Engine control (Core 0) + communications (Core 1). Hosts on-bike dashboard from LittleFS. |
| 3 | **On-Bike Dashboard** | Phone/Tablet browser | SvelteKit app served by ECU. **Full control**: real-time telemetry, map editing, OTA, QS trigger. |
| 4 | **Server** | Proxmox VM | MQTT broker (Mosquitto) + Express.js backend + React SPA. **Read-only**: session history viewer. |

### Protocols

| Path | Protocol | Direction | Payload |
|---|---|---|---|
| Simulator → ECU | GPIO / ADC wires | Input | Square wave (pick-up), analog (TPS, EGT) |
| ECU → Phone | WebSocket | Push | Real-time telemetry JSON (~10–20 Hz) |
| Phone → ECU | WebSocket | Commands | QS trigger, map edit, map switch, config request |
| ECU → MQTT Broker | MQTT publish | Push | Session logs (buffered, sent post-session) |
| MQTT Broker → Express | MQTT subscribe | Push | Session logs → PostgreSQL |
| React SPA → Express | HTTP REST | Pull | Session list, session detail |
| ECU → Proxmox VM | HTTP GET | Pull | OTA version check + firmware download |

---

## 2. Architecture Diagram

```
  ┌──────────────────┐
  │   Simulator      │
  │   (ESP32)        │
  │                  │          GPIO wires
  │  Square wave ────┼────────────────────────────┐
  │  TPS analog  ────┼────────────────────────────┤
  │  EGT analog  ────┼────────────────────────────┤
  │                  │                             │
  │  Mini Web UI ◄───┼── (WiFi AP, config only)   │
  └──────────────────┘                             │
                                                   │
                                         ┌─────────▼────────┐
                                         │    ESP32-S3       │
                                         │    ECU Node       │
                                         │                   │
                                         │  Core 0 (Engine)  │
                                         │  ├─ pick_up ISR   │
                                         │  ├─ rpm_task      │
                                         │  └─ adc_task      │
                                         │                   │
                                         │  Core 1 (Comms)   │
                                         │  ├─ ws_task       │
                                         │  ├─ mqtt_task     │
                                         │  └─ ota_task      │
                                         │                   │
                                         │  LittleFS:        │
                                         │  SvelteKit build  │
                                         └──┬──────────┬─────┘
                                            │          │
                              WebSocket     │          │  MQTT pub (session logs)
                              + HTTP static │          │  HTTP GET (OTA poll)
                                            │          │
                                   ┌────────▼──┐    ┌──▼──────────────────────┐
                                   │ Phone /   │    │   Proxmox VM            │
                                   │ Tablet    │    │                         │
                                   │           │    │  ┌───────────────────┐  │
                                   │ SvelteKit │    │  │ Mosquitto         │  │
                                   │ On-Bike   │    │  └─────────┬─────────┘  │
                                   │ Dashboard │    │            │ subscribe  │
                                   │           │    │  ┌─────────▼─────────┐  │
                                   │ FULL      │    │  │ Express.js        │  │
                                   │ CONTROL   │    │  │ (log ingestion)   │  │
                                   └───────────┘    │  └─────────┬─────────┘  │
                                                    │            │            │
                                                    │  ┌─────────▼─────────┐  │
                                                    │  │ React SPA         │  │
                                                    │  │ (session viewer)  │  │
                                                    │  │ READ-ONLY         │  │
                                                    │  └───────────────────┘  │
                                                    │                         │
                                                    │  PostgreSQL             │
                                                    └─────────────────────────┘
```

---

## 3. Node 1 — Simulator (ESP32)

### Purpose
Replaces real sensors for bench testing. Generates electrical signals that the ECU reads through its normal I/O path (ISR, ADC).

### Outputs to ECU
| Signal | Type | Range | Control |
|---|---|---|---|
| Pick-up | Square wave on GPIO | 0–300 Hz (≈ 0–18,000 RPM for single-cyl) | Adjustable frequency via web UI |
| TPS | Analog voltage (DAC or filtered PWM) | 0–3.3V (0–100% throttle) | Adjustable via web UI slider |
| EGT | Analog voltage (DAC or filtered PWM) | 0–3.3V (mapped to 0–900°C) | Adjustable via web UI slider |

### Web UI
- Hosted on the Simulator ESP32 itself (WiFi AP mode)
- Simple HTML/JS page
- Controls: RPM slider/input, TPS slider, EGT slider
- Presets: "Idle" (1200 RPM, 0% TPS), "Cruise" (6000 RPM, 30% TPS), "WOT" (12000 RPM, 100% TPS)
- Kill switch: stop all signals (simulate engine off)

---

## 4. Node 2 — ECU (ESP32-S3)

### 4.1 FreeRTOS Task Allocation

| Task | Core | Priority | Stack | Role |
|---|---|---|---|---|
| `pick_up_isr` | 0 | — (ISR) | — | Edge-triggered ISR on pick-up GPIO. Captures timestamp, notifies `rpm_task`. |
| `rpm_task` | 0 | Highest | 4 KB | Computes RPM from ISR timestamps. Runs engine FSM. Schedules CDI timer. |
| `adc_task` | 0 | High | 4 KB | Periodic TPS + EGT sampling. Computes Power Jet duty cycle from lookup table. |
| `ws_task` | 1 | High | 8 KB | WebSocket server. Broadcasts telemetry JSON. Receives commands from on-bike dashboard. |
| `mqtt_task` | 1 | Medium | 8 KB | Buffers telemetry during session. Publishes session log to MQTT broker post-session. |
| `ota_task` | 1 | Low | 8 KB | Periodically polls server for new firmware version. Downloads and applies OTA update. |

### 4.2 Engine FSM

```
States: INIT, SYNCING, RUNNING, IDLE, IGNCUT, ALARM

         ┌──────┐  pick-up detected  ┌──────────┐
         │ INIT │──────────────────►│ SYNCING  │
         └──────┘                   └──────────┘
                  ◄── timeout ──────────┘ │ N valid consecutive pulses
                                          ▼
                 RPM < threshold   ┌─────────┐   EGT > MAX
            ┌───────────────────── │ RUNNING │──────────────────┐
            ▼                      └─────────┘                  ▼
         ┌──────┐  RPM = 0              │                   ┌───────┐
         │ IDLE │──────────►INIT        │ QS request        │ ALARM │
         └──────┘                       ▼                   └───────┘
                                  ┌──────────┐                  │ EGT OK
                                  │ IGNCUT   │                  └──────►RUNNING
                                  └──────────┘
                                  (CDI cut for N cycles,
                                   then → RUNNING)
```

**Transitions:**
| From | To | Trigger |
|---|---|---|
| INIT | SYNCING | First pick-up pulse detected |
| SYNCING | RUNNING | N consecutive valid pulses (sync acquired) |
| SYNCING | INIT | Timeout — no pulse for T ms |
| RUNNING | IDLE | RPM drops below idle threshold |
| RUNNING | ALARM | EGT exceeds safety limit |
| RUNNING | IGNCUT | QS trigger received (button or WebSocket cmd) |
| IDLE | INIT | RPM = 0 (engine stopped) |
| ALARM | RUNNING | EGT returns below safe threshold |
| IGNCUT | RUNNING | After N ignition cycles cut |

### 4.3 Lookup Tables (1D, stored in NVS)

**Ignition Advance Map**: `f(RPM) → advance_degrees`
- Configurable number of RPM breakpoints
- Linear interpolation between breakpoints
- Multiple maps supported (Map A, Map B, ...)
- One map active at a time

**Power Jet Duty Cycle Map**: `f(RPM) → duty_cycle_%`
- Same structure as ignition map
- Controls PWM output to Power Jet solenoid

### 4.4 Shared Data Buffer

Core 0 writes → Core 1 reads (lock-free or mutex-protected):

```c
typedef struct {
    uint16_t rpm;
    float    tps_percent;      // 0.0–100.0
    float    egt_celsius;
    float    advance_deg;
    float    pj_duty_percent;
    uint8_t  fsm_state;        // enum
    uint8_t  active_map_id;
    int64_t  timestamp_us;
} ecu_telemetry_t;
```

### 4.5 CDI Output Scheduling

1. `rpm_task` calculates advance angle from lookup table
2. Converts advance degrees → time delay from pick-up pulse (based on current RPM)
3. Starts a hardware timer (ESP32 MCPWM or GP timer)
4. Timer ISR fires → sets CDI GPIO high for spark duration → resets

### 4.6 HTTP + WebSocket Server

- **EspAsyncWebServer** (ESP-IDF port, formerly me-no-dev) handles both HTTP and WebSocket on a single async server
- SvelteKit build files stored **gzip-compressed** (`.gz`) in LittleFS → served with `Content-Encoding: gzip` header → browser decompresses automatically
- This halves flash usage for static assets (~50–70% compression on JS/CSS/HTML)
- Endpoints:
  - `GET /` → `index.html.gz` (SvelteKit entry point)
  - `GET /assets/*` → static `.gz` files (JS/CSS/fonts)
  - `WS /ws` → WebSocket for telemetry + commands

---

## 5. Node 3 — On-Bike Dashboard (SvelteKit)

### Hosting
- Built with SvelteKit (static adapter → pre-rendered)
- Build output **gzip-compressed** and flashed into LittleFS partition on ESP32
- Served by EspAsyncWebServer with `Content-Encoding: gzip` — browser decompresses transparently
- Accessed via phone/tablet browser over WiFi (STA mode, same network)

### Features

| Feature | Description |
|---|---|
| **RPM Gauge** | Large, prominent real-time RPM display |
| **TPS Bar** | Throttle position percentage bar |
| **EGT Indicator** | Temperature with color-coded threshold (green → yellow → red) |
| **FSM State** | Current engine state badge (INIT / SYNCING / RUNNING / IDLE / ALARM / IGNCUT) |
| **Active Map** | Which ignition/PJ map is currently active |
| **Advance Angle** | Current calculated ignition advance |
| **PJ Duty Cycle** | Current Power Jet duty percentage |
| **Map Editor** | Add/remove/edit RPM breakpoints and values. Visual curve display. |
| **Map Switcher** | Select active map from stored maps |
| **QS Trigger** | Button to simulate quick-shifter input |
| **OTA Status** | Current firmware version, check-for-update button (ESP32 polls server) |

### WebSocket Protocol

**Telemetry (ECU → Dashboard):**
```json
{
  "type": "telemetry",
  "data": {
    "rpm": 8500,
    "tps": 72.3,
    "egt": 620,
    "fsm": "RUNNING",
    "advance_deg": 28.5,
    "pj_duty": 45.0,
    "active_map": 1,
    "ts": 1716825600000
  }
}
```

**Commands (Dashboard → ECU):**
```json
{"cmd": "qs_trigger"}

{"cmd": "set_active_map", "map_id": 1}

{"cmd": "edit_map", "map_type": "ignition", "map_id": 1,
 "breakpoints": [
   {"rpm": 1000, "value": 5},
   {"rpm": 3000, "value": 15},
   {"rpm": 6000, "value": 25},
   {"rpm": 9000, "value": 30},
   {"rpm": 12000, "value": 28}
 ]}

{"cmd": "ota_check"}

{"cmd": "get_config"}
```

**Responses (ECU → Dashboard):**
```json
{"type": "ack", "cmd": "set_active_map", "status": "ok"}

{"type": "config", "data": {
  "firmware_version": "1.2.0",
  "maps": {
    "ignition": [{"id": 0, "name": "Stock", "breakpoints": [...]}, ...],
    "power_jet": [{"id": 0, "name": "Stock", "breakpoints": [...]}]
  },
  "active_map_id": 0,
  "sync_pulses_required": 5,
  "egt_alarm_threshold": 800
}}

{"type": "ota_status", "available": true, "remote_version": "1.3.0", "current_version": "1.2.0"}
```

---

## 6. Node 4 — Server (Proxmox VM)

### Components

```
Proxmox VM
├── Mosquitto (MQTT broker, port 1883/8883)
├── PostgreSQL (session storage)
├── Express.js (backend API + MQTT subscriber)
└── React SPA (served by Express, static build)
```

### MQTT — Session Logs

> [!IMPORTANT]
> This section needs careful design. The data format must be driven by what the React dashboard needs to display, and constrained by ESP32 RAM limits.

#### What the React Dashboard Displays

**Session List View** needs per-session summary:
| Field | Source | Purpose |
|---|---|---|
| Session ID | Generated by ESP32 | Unique identifier |
| Start / End time | First and last sample timestamps | Duration calculation |
| Duration | Derived | Quick overview |
| Max RPM | Aggregated from samples | Session intensity indicator |
| Avg RPM | Aggregated from samples | Session character |
| Max EGT | Aggregated from samples | Safety review |
| Alarm count | Count of ALARM events | Reliability indicator |
| QS count | Count of IGNCUT events | Shift frequency |
| Firmware version | From session metadata | Traceability |

**Session Detail View** needs time-series data for charts:
| Chart | X-axis | Y-axis | Notes |
|---|---|---|---|
| RPM over time | timestamp | RPM (0–18k) | Primary chart, large |
| TPS over time | timestamp | TPS % (0–100) | Overlay or separate |
| EGT over time | timestamp | °C (0–900) | With alarm threshold line |
| Ignition advance | timestamp | degrees | Shows map behavior |
| Power Jet duty | timestamp | % (0–100) | Correlates with RPM |
| FSM state | timestamp | state enum | Colored bands/regions on timeline |
| Events | timestamp | markers | Vertical markers for QS, map switch, alarms |

#### ESP32 RAM Budget

ESP32-S3 has ~512 KB total SRAM. After FreeRTOS, WiFi stack, TLS, WebSocket, and LittleFS, realistically **~100–150 KB** is available for the session buffer.

Per-sample data (compact binary in RAM, JSON only at publish time):

```c
typedef struct {
    uint32_t timestamp_ms;    // 4 bytes (relative to session start)
    uint16_t rpm;             // 2 bytes
    uint8_t  tps;             // 1 byte  (0–100, integer %)
    uint16_t egt;             // 2 bytes (°C, integer)
    uint8_t  advance_deg;     // 1 byte  (0–60°, integer)
    uint8_t  pj_duty;         // 1 byte  (0–100%)
    uint8_t  fsm_state;       // 1 byte  (enum)
} __attribute__((packed)) session_sample_t;  // = 12 bytes
```

| Sample Rate | Buffer Size (100 KB) | Max Session Duration |
|---|---|---|
| 10 Hz | ~8,500 samples | ~14 minutes |
| 5 Hz | ~8,500 samples | ~28 minutes |
| 2 Hz | ~8,500 samples | ~70 minutes |
| 1 Hz | ~8,500 samples | ~2.3 hours |

> [!WARNING]
> At 10 Hz, a 14-minute buffer fills 100 KB. A real track session is 15–20 minutes. We need to decide:
> - **1 Hz** is safe for buffer size but charts look blocky
> - **5 Hz** is a good balance (28 min, smooth charts)
> - **10 Hz** risks overflow on long sessions
>
> **Recommendation**: 5 Hz sampling for session logs, with a **circular buffer** that overwrites oldest data if the session exceeds the limit. The on-bike dashboard still gets telemetry at 10–20 Hz via WebSocket (not logged).

#### MQTT Publish Strategy

Session-based (option C from Q23):

1. **Session start**: FSM transitions to `SYNCING` → ESP32 starts buffering
2. **During session**: Samples written to circular buffer at chosen rate
3. **Session end**: FSM returns to `INIT` (RPM = 0 for T seconds) → session finalized
4. **Publish**: ESP32 publishes session log over MQTT. If the payload is too large for a single MQTT message (broker limit, typically 256 KB), split into **chunks**.

#### MQTT Topic Structure

```
ecu/{device_id}/session/meta      → session metadata + summary
ecu/{device_id}/session/samples   → time-series sample data (may be chunked)
ecu/{device_id}/session/events    → discrete events during session
```

**Meta payload:**
```json
{
  "session_id": "uuid",
  "device_id": "ecu-001",
  "start_ts": 1716825600000,
  "end_ts": 1716829200000,
  "duration_s": 3600,
  "sample_rate_hz": 5,
  "sample_count": 1800,
  "max_rpm": 12400,
  "avg_rpm": 6200,
  "max_egt": 720,
  "alarm_count": 0,
  "qs_count": 12,
  "fw_version": "1.2.0"
}
```

**Samples payload** (chunked if needed):
```json
{
  "session_id": "uuid",
  "chunk": 1,
  "total_chunks": 3,
  "samples": [
    {"t": 0, "rpm": 1200, "tps": 0, "egt": 180, "adv": 8, "pj": 0, "fsm": 3},
    {"t": 200, "rpm": 3500, "tps": 25, "egt": 350, "adv": 18, "pj": 10, "fsm": 2},
    ...
  ]
}
```

**Events payload:**
```json
{
  "session_id": "uuid",
  "events": [
    {"t": 1000, "type": "FSM", "from": 0, "to": 1},
    {"t": 5000, "type": "FSM", "from": 1, "to": 2},
    {"t": 45000, "type": "QS"},
    {"t": 120000, "type": "MAP_SWITCH", "map_id": 1},
    {"t": 300000, "type": "ALARM", "egt": 810}
  ]
}
```

> [!NOTE]
> Timestamps in samples/events use `t` = milliseconds relative to `start_ts` (saves bytes vs. absolute timestamps). The backend reconstructs absolute times using `start_ts + t`.

---

### Express.js Backend

**MQTT subscriber:** Connects to Mosquitto broker. Subscribes to `ecu/+/session/#`. Reassembles chunked sample payloads. Inserts complete sessions into PostgreSQL.

**REST API (read-only):**

| Method | Endpoint | Response |
|---|---|---|
| `GET` | `/api/sessions` | List: `[{id, device_id, start_ts, end_ts, duration_s, max_rpm, avg_rpm, max_egt, alarm_count, qs_count, fw_version}]` |
| `GET` | `/api/sessions/:id` | Full session: `{meta, samples[], events[]}` |

**OTA endpoint:**

| Method | Endpoint | Response |
|---|---|---|
| `GET` | `/api/ota/version` | `{"version": "1.3.0", "url": "/api/ota/firmware"}` |
| `GET` | `/api/ota/firmware` | Binary `.bin` file download |

### React SPA (Read-Only)

**Session List View:**
- Sortable/filterable table with columns: date, duration, max RPM, avg RPM, max EGT, alarm count, QS count
- Click a row → navigate to detail

**Session Detail View:**
- **Header**: session date, duration, firmware version, summary stats
- **Main chart area**: stacked/overlaid time-series charts (RPM, TPS, EGT, advance, PJ duty)
- **FSM timeline**: colored horizontal bar showing state regions (green = RUNNING, yellow = IDLE, red = ALARM, blue = IGNCUT)
- **Event markers**: vertical lines on charts for QS triggers, map switches, alarms
- **Zoom/pan**: ability to zoom into a time range for detailed analysis

### PostgreSQL Schema

```sql
CREATE TABLE sessions (
    id           UUID PRIMARY KEY,
    device_id    VARCHAR(32) NOT NULL,
    start_ts     TIMESTAMPTZ NOT NULL,
    end_ts       TIMESTAMPTZ NOT NULL,
    duration_s   INTEGER NOT NULL,
    max_rpm      INTEGER,
    avg_rpm      INTEGER,
    max_egt      INTEGER,
    alarm_count  INTEGER DEFAULT 0,
    qs_count     INTEGER DEFAULT 0,
    fw_version   VARCHAR(16),
    samples      JSONB NOT NULL,           -- array of sample objects
    events       JSONB NOT NULL,           -- array of event objects
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_device_time ON sessions(device_id, start_ts DESC);
```

> [!NOTE]
> Summary stats (`max_rpm`, `avg_rpm`, etc.) are stored as columns for efficient list queries. Full sample/event data lives in JSONB columns for the detail view. This avoids needing to parse JSONB just to render the session list.

---

## 7. Scope Boundary

### In Scope (Elaborato Deliverables)

| Component | Status |
|---|---|
| ECU firmware (ESP-IDF, FreeRTOS, dual-core) | ✅ |
| Engine FSM (6 states) | ✅ |
| Pick-up ISR → RPM → CDI scheduling | ✅ |
| ADC sampling (TPS, EGT) → Power Jet PWM | ✅ |
| 1D lookup tables with interpolation (NVS) | ✅ |
| WebSocket server (telemetry + commands) | ✅ |
| MQTT client (session log publish) | ✅ |
| OTA client (poll + download + apply) | ✅ |
| On-bike dashboard (SvelteKit, LittleFS) | ✅ |
| Simulator ESP32 (signals + web UI) | ✅ |
| Express.js backend (MQTT sub + REST API) | ✅ |
| React SPA (session list + session detail) | ✅ |
| PostgreSQL schema + integration | ✅ |

### Out of Scope (Future Development)

| Component | Notes |
|---|---|
| Knock sensor + active correction | Hardware not available |
| Exhaust valve control | Mechanical not present |
| 3D maps (RPM × TPS) | 1D maps for elaborato, 3D later |
| HITL / CI pipeline | Too heavy for exam scope |
| PCB design (KiCad) | Mention in report as future work |
| OBD-II / CAN bus | Future integration |
| AP + STA WiFi mode | STA-only for now |
| Real EGT sensor (MAX6675) | Simulated for now |
