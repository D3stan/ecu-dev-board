# WebUI – WebSocket Telemetry V1 Adaptation

This document specifies the concrete changes needed to adapt the WebUI to the
ECU WebSocket Telemetry Contract V1 (`ecu.telemetry.v1`).

The firmware contract is defined in:
- `docs/webserver/websocket_contract.md` — JSON wire format (source of truth)
- `docs/telemetry/basic_sensor_telemetry_core.md` — C++ types behind the JSON

The WebUI architecture is described in:
- `webui/doc/js_architecture.md`

---

## Context and Gap Analysis

### What the firmware now sends

| Frame type     | When          | Key content                                                         |
|----------------|---------------|---------------------------------------------------------------------|
| `capabilities` | On connect    | `schema`, `schema_version`, `paths`, `state_hz`, `events_per_batch` |
| `telemetry`    | ~10 Hz        | `t_us`, `gen`, `state.*`, `events[]`, `overflow`, `transport`       |

### What the current adapter expects

`adapter.js` currently parses a single frame type `sim_telemetry` and reads a
flat payload:

```json
{ "type": "sim_telemetry", "data": { "rpm": ..., "tps": ..., "egt": ...,
  "ecu_advance": ..., "spark_detected": ..., "overrides": { ... } } }
```

### Field mapping delta

| Concept          | Old field (flat)   | New field (V1)                   | Notes                              |
|------------------|--------------------|----------------------------------|------------------------------------|
| RPM              | `data.rpm`         | `state.rpm.rpm`                  |                                    |
| TPS              | `data.tps` (%)     | `state.tps.permille` ÷ 10        | Convert permille → percent         |
| EGT              | `data.egt`         | `state.egt.c`                    |                                    |
| Ignition advance | `data.ecu_advance` | `state.knock.ignition_angle_deg` | Only present when knock is non-null |
| Spark detected   | `data.spark_detected` | *(absent from V1)*            | Remove or keep as always-false     |
| Water temp       | *(absent)*         | `state.water.c`                  | New                                |
| QS active        | *(absent)*         | `state.quick_shifter.active`     | New                                |
| QS armed         | *(absent)*         | `state.quick_shifter.armed`      | New                                |
| Map request      | *(absent)*         | `state.map_switch.request`       | New (`"Primary"` / `"Secondary"`)  |
| Knock summary    | *(absent)*         | `state.knock` (nullable object)  | New                                |
| Sensor meta      | *(absent)*         | `state.*.meta.*`                 | health, quality, valid, fault_bits |
| Events           | *(absent)*         | `events[]`                       | New ordered batch                  |
| Overflow         | *(absent)*         | `overflow.*`                     | New                                |
| Transport        | *(absent)*         | `transport.*`                    | New                                |
| Capabilities     | *(absent)*         | `capabilities` frame             | New handshake on connect           |

---

## Required Changes

### 1. `utils/paths.js`

Add all new telemetry path constants. **Existing keys must not be renamed** to
preserve current UI component bindings.

```js
export const Paths = {
  TELEMETRY: {
    // ── Existing keys — do not rename ──
    RPM:            "telemetry.rpm",
    TPS:            "telemetry.tps",
    EGT:            "telemetry.egt",
    ECU_ADVANCE:    "telemetry.ecu_advance",   // mapped from knock.ignition_angle_deg when available
    SPARK_DETECTED: "telemetry.spark_detected", // always false in V1 (field absent)

    // ── New V1 keys ──
    TIMESTAMP:          "telemetry.t_us",
    GEN:                "telemetry.gen",

    TPS_FALLBACK_USED:  "telemetry.tps_fallback_used",
    RPM_ACCEL:          "telemetry.rpm_accel",
    RPM_SYNCHRONIZED:   "telemetry.rpm_synchronized",

    WATER_TEMP:         "telemetry.water_temp",
    WATER_STATE:        "telemetry.water_state",        // ThermalState string
    WATER_REQUEST:      "telemetry.water_request",      // ThermalRequest string

    EGT_STATE:          "telemetry.egt_state",          // ThermalState string
    EGT_REQUEST:        "telemetry.egt_request",        // ThermalRequest string

    QS_ACTIVE:          "telemetry.qs_active",
    QS_ARMED:           "telemetry.qs_armed",

    MAP_REQUEST:        "telemetry.map_request",        // "Primary" | "Secondary"

    KNOCK:              "telemetry.knock",              // full knock object or null

    // Per-sensor meta objects { health, quality, valid, fault_bits, seq, acquired_at_us }
    TPS_META:           "telemetry.meta.tps",
    RPM_META:           "telemetry.meta.rpm",
    EGT_META:           "telemetry.meta.egt",
    WATER_META:         "telemetry.meta.water",
    QS_META:            "telemetry.meta.qs",
    MAP_META:           "telemetry.meta.map",

    OVERFLOW:           "telemetry.overflow",
    TRANSPORT:          "telemetry.transport",

    // Accumulated event log (bounded ring buffer, max MAX_EVENTS_LOG entries)
    EVENTS:             "telemetry.events",
  },

  // ── New top-level group for connection handshake ──
  CONNECTION: {
    SCHEMA_VERSION:   "connection.schema_version",
    STATE_HZ:         "connection.state_hz",
    EVENTS_PER_BATCH: "connection.events_per_batch",
  },

  // ── Unchanged ──
  OVERRIDES: { /* ... keep as-is ... */ },
  SOCKET: { STATE: "socket.state" },
};
```

---

### 2. `core/adapter.js`

Full rewrite of `dispatchMessage`. The existing export signatures
(`dispatchMessage`, `setBootstrapProcessedNotifier`) are preserved so `App.js`
needs no changes.

```js
import { Store } from "./store.js";
import { Paths } from "../utils/paths.js";

/** Maximum number of events kept in Paths.TELEMETRY.EVENTS ring buffer. */
const MAX_EVENTS_LOG = 100;

/**
 * Parses and dispatches incoming WebSocket JSON frames from the ECU.
 * Handles the two V1 frame types: "capabilities" and "telemetry".
 * Unknown frame types are silently ignored per contract.
 *
 * @param {string} raw Raw JSON string from the WebSocket
 */
export function dispatchMessage(raw) {
  if (typeof raw !== "string") return;

  // Ignore legacy pipe-delimited system messages handled by socket.js
  if (!raw.trimStart().startsWith("{")) return;

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (err) {
    console.error("[Adapter] JSON parse error:", err, raw);
    return;
  }

  switch (payload.type) {
    case "capabilities":
      _handleCapabilities(payload);
      break;
    case "telemetry":
      _handleTelemetry(payload);
      break;
    default:
      // Contract: UI must ignore unknown frame types
      break;
  }
}

// ─────────────────────────────────────────────
// Private: capabilities frame
// ─────────────────────────────────────────────

function _handleCapabilities(cap) {
  console.info("[Adapter] ECU capabilities:", cap.schema, "v" + cap.schema_version,
    "@ " + cap.state_hz + " Hz");

  Store.set(Paths.CONNECTION.SCHEMA_VERSION,   cap.schema_version   ?? 1);
  Store.set(Paths.CONNECTION.STATE_HZ,         cap.state_hz         ?? 10);
  Store.set(Paths.CONNECTION.EVENTS_PER_BATCH, cap.events_per_batch ?? 8);
}

// ─────────────────────────────────────────────
// Private: telemetry frame
// ─────────────────────────────────────────────

function _handleTelemetry(frame) {
  const s = frame.state;
  if (!s) return;

  // ── Top-level frame identity ──
  Store.set(Paths.TELEMETRY.TIMESTAMP, frame.t_us ?? 0);
  Store.set(Paths.TELEMETRY.GEN,       frame.gen  ?? 0);

  // ── TPS ──
  if (s.tps != null) {
    // Write to existing key as percent (backward-compat with current UI)
    Store.set(Paths.TELEMETRY.TPS,             (s.tps.permille ?? 0) / 10.0);
    Store.set(Paths.TELEMETRY.TPS_FALLBACK_USED, !!s.tps.fallback_used);
    Store.set(Paths.TELEMETRY.TPS_META,          _normMeta(s.tps.meta));
  }

  // ── RPM ──
  if (s.rpm != null) {
    Store.set(Paths.TELEMETRY.RPM,             s.rpm.rpm           ?? 0);
    Store.set(Paths.TELEMETRY.RPM_ACCEL,       s.rpm.accel_rpm_per_s ?? 0);
    Store.set(Paths.TELEMETRY.RPM_SYNCHRONIZED, !!s.rpm.synchronized);
    Store.set(Paths.TELEMETRY.RPM_META,         _normMeta(s.rpm.meta));
  }

  // ── EGT ──
  if (s.egt != null) {
    Store.set(Paths.TELEMETRY.EGT,         s.egt.c            ?? 0);
    Store.set(Paths.TELEMETRY.EGT_STATE,   s.egt.state        ?? "Unknown");
    Store.set(Paths.TELEMETRY.EGT_REQUEST, s.egt.request      ?? "Normal");
    Store.set(Paths.TELEMETRY.EGT_META,    _normMeta(s.egt.meta));
  }

  // ── Water temperature ──
  if (s.water != null) {
    Store.set(Paths.TELEMETRY.WATER_TEMP,    s.water.c       ?? 0);
    Store.set(Paths.TELEMETRY.WATER_STATE,   s.water.state   ?? "Unknown");
    Store.set(Paths.TELEMETRY.WATER_REQUEST, s.water.request ?? "Normal");
    Store.set(Paths.TELEMETRY.WATER_META,    _normMeta(s.water.meta));
  }

  // ── Quick-shifter ──
  if (s.quick_shifter != null) {
    Store.set(Paths.TELEMETRY.QS_ACTIVE, !!s.quick_shifter.active);
    Store.set(Paths.TELEMETRY.QS_ARMED,  !!s.quick_shifter.armed);
    Store.set(Paths.TELEMETRY.QS_META,   _normMeta(s.quick_shifter.meta));
  }

  // ── Map switch ──
  if (s.map_switch != null) {
    Store.set(Paths.TELEMETRY.MAP_REQUEST, s.map_switch.request ?? "Primary");
    Store.set(Paths.TELEMETRY.MAP_META,    _normMeta(s.map_switch.meta));
  }

  // ── Knock (nullable) ──
  // Also back-fills ECU_ADVANCE from the knock summary when available,
  // preserving the existing store key used by legacy UI widgets.
  Store.set(Paths.TELEMETRY.KNOCK, s.knock ?? null);
  if (s.knock != null) {
    Store.set(Paths.TELEMETRY.ECU_ADVANCE, s.knock.ignition_angle_deg ?? 0);
  }
  // SPARK_DETECTED has no equivalent in V1; leave current value untouched
  // (it was set to false during init and is not meaningful in V1).

  // ── Overflow & transport counters ──
  if (frame.overflow != null) {
    Store.set(Paths.TELEMETRY.OVERFLOW, frame.overflow);
  }
  if (frame.transport != null) {
    Store.set(Paths.TELEMETRY.TRANSPORT, frame.transport);
  }

  // ── Events (bounded ring buffer) ──
  if (Array.isArray(frame.events) && frame.events.length > 0) {
    const current = Store.get(Paths.TELEMETRY.EVENTS) ?? [];
    const merged  = [...current, ...frame.events];
    // Keep only the most recent MAX_EVENTS_LOG entries
    Store.set(Paths.TELEMETRY.EVENTS,
      merged.length > MAX_EVENTS_LOG ? merged.slice(-MAX_EVENTS_LOG) : merged);
  }
}

// ─────────────────────────────────────────────
// Helper: normalise meta object
// Converts snake_case firmware keys to a consistent shape.
// ─────────────────────────────────────────────

function _normMeta(meta) {
  if (!meta) return null;
  return {
    acquiredAtUs: meta.acquired_at_us ?? 0,
    seq:          meta.seq            ?? 0,
    valid:        !!meta.valid,
    health:       meta.health         ?? "Unknown",
    quality:      meta.quality        ?? "Unknown",
    faultBits:    meta.fault_bits     ?? 0,
  };
}

/** Kept for App.js bootstrap compatibility — no-op in V1. */
export function setBootstrapProcessedNotifier(_fn) {}
```

---

### 3. `core/socket.js`

#### 3.1 Connection URL

`socket.js` already constructs the URL as `ws://${url}` where `url` is supplied
via `setConfig({ url })` in `App.js`.  `App.js` derives the host from
`window.location.hostname`.  The path must be `/ws` as required by the contract.

Verify that `App.js` (or wherever `setConfig` is called) passes:

```js
Socket.setConfig({ url: `${window.location.hostname}/ws` });
```

If it currently passes a different path (e.g. `/api/ws` or no path), update
that call site — **not** `socket.js` itself.

#### 3.2 Watchdog timeout

The firmware sends at `state_hz` (default 10 Hz → one frame every 100 ms).
The current `CONFIG.disconnectTimeout` is 2 000 ms, which gives a 20-frame
grace window — this is **acceptable and requires no change** for V1.

If future firmware exposes a lower `state_hz`, the adapter can update the
watchdog dynamically after receiving the `capabilities` frame:

```js
// Optional future enhancement inside _handleCapabilities():
const hz = cap.state_hz ?? 10;
const gracePeriodMs = Math.round((1000 / hz) * 5); // 5 missed frames
Socket.CONFIG.disconnectTimeout = Math.max(gracePeriodMs, 500);
```

This is **not required for V1** and should only be added if testing reveals
spurious watchdog timeouts.

---

### 4. `App.js` — Mock data generator

When `config.useMockData` is true, `App.js` injects a mock telemetry emitter.
The mock must now emit **V1-shaped frames** instead of `sim_telemetry`:

```js
// Mock emitter — replace old sim_telemetry generator with:
function emitMockTelemetry() {
  const rpm   = 1200 + Math.random() * 5000;
  const frame = {
    type:   "telemetry",
    schema: "ecu.telemetry.v1",
    t_us:   Date.now() * 1000,
    gen:    mockGen++,
    state: {
      tps: {
        permille:         Math.round(Math.random() * 1000),
        fallback_permille: 700,
        fallback_used:    false,
        meta: _mockMeta(),
      },
      rpm: {
        rpm:              rpm,
        period_us:        60_000_000 / rpm,
        accel_rpm_per_s:  (Math.random() - 0.5) * 200,
        synchronized:     true,
        crank_reference_trusted: true,
        revolution_id:    mockGen,
        reference_at_us:  Date.now() * 1000,
        meta: _mockMeta(),
      },
      egt: {
        c:           400 + Math.random() * 300,
        rate_c_per_s: (Math.random() - 0.5) * 5,
        max_c:        750,
        state:        "Normal",
        request:      "Normal",
        meta: _mockMeta(),
      },
      water: {
        c:           70 + Math.random() * 30,
        rate_c_per_s: (Math.random() - 0.5) * 0.5,
        max_c:        100,
        state:        "Normal",
        request:      "Normal",
        meta: _mockMeta(),
      },
      quick_shifter: { active: false, armed: false, meta: _mockMeta() },
      map_switch:    { request: "Primary",              meta: _mockMeta() },
      knock:         null,
    },
    events:   [],
    overflow: { quick_shift_events: 0, map_switch_events: 0,
                knock_measurements: 0, fault_events: 0 },
    transport: { sent_frames: mockGen, dropped_frames: 0, send_errors: 0 },
  };
  dispatchMessage(JSON.stringify(frame));
}

let mockGen = 0;
function _mockMeta() {
  return {
    acquired_at_us: Date.now() * 1000,
    seq:            mockGen,
    valid:          true,
    health:         "Valid",
    quality:        "Good",
    fault_bits:     0,
  };
}
```

The mock should also emit a one-shot `capabilities` frame on startup:

```js
dispatchMessage(JSON.stringify({
  type:             "capabilities",
  schema:           "ecu.telemetry.v1",
  schema_version:   1,
  paths:            ["state", "event"],
  state_hz:         10,
  events_per_batch: 8,
}));
```

---

## What Does Not Change

| Module                         | Reason                                                                  |
|--------------------------------|-------------------------------------------------------------------------|
| `core/store.js`                | No changes needed; path strings are just string constants               |
| `core/socket.js`               | Connection/reconnect/watchdog logic is protocol-agnostic                |
| `core/Component.js`, `Page.js` | Lifecycle and reactive subscription system is unaffected                |
| All UI components / pages      | They subscribe to `Paths.TELEMETRY.*` keys which are preserved          |
| `managers/`                    | No protocol coupling in any manager                                     |

---

## UI Components — Existing Bindings (informational)

Existing dashboard components subscribe to these keys, which the new adapter
continues to write:

| Store path           | Mapped from         |
|----------------------|---------------------|
| `telemetry.rpm`      | `state.rpm.rpm`     |
| `telemetry.tps`      | `state.tps.permille / 10` |
| `telemetry.egt`      | `state.egt.c`       |
| `telemetry.ecu_advance` | `state.knock.ignition_angle_deg` (when knock != null) |
| `telemetry.spark_detected` | Not in V1 — remains at initial value (false) |

Updating UI components to display new sensors (water temp, QS, map, events,
health badges) is additive follow-up work and is out of scope for this change.

---

## Verification

### Build check
Run the frontend dev server and confirm zero import/parse errors:
```sh
npm run dev
```

### Mock data (local)
1. Enable `config.useMockData = true`.
2. Open the browser.
3. Confirm telemetry values update at ~10 Hz with no console errors.
4. Confirm `Store.get("telemetry.rpm")`, `.tps`, `.egt` are populated.
5. Confirm `Store.get("connection.state_hz")` equals `10`.

### Real hardware
1. Connect browser to `ws://<ESP-IP>/ws`.
2. Confirm the `capabilities` frame is logged: `[Adapter] ECU capabilities: ecu.telemetry.v1 v1 @ 10 Hz`.
3. Confirm RPM, TPS, EGT update in the dashboard.
4. Confirm water temp, QS, map request are available via browser console:
   ```js
   Store.get("telemetry.water_temp");
   Store.get("telemetry.qs_active");
   Store.get("telemetry.map_request");
   ```
5. Confirm the watchdog does not fire spuriously.
6. Disconnect and confirm automatic reconnect.
