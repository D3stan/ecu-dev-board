# WebSocket Telemetry Contract V1

This document is the firmware-to-Web UI contract for the first telemetry
WebSocket implementation. It is derived from the transport-neutral telemetry
core contract in `docs/telemetry/basic_sensor_telemetry_core.md`.

The ECU firmware owns this contract. The Web UI should consume only this JSON
shape and must not depend on firmware C++ types or on the old `webui` folder.

---

## Connection

| Item | V1 value |
| --- | --- |
| Transport | WebSocket text frames |
| URL path | `/ws` |
| Default HTTP port | `80` |
| WiFi mode | Station mode |
| Active clients | One active client, newest connection wins |
| Frame encoding | UTF-8 JSON |
| State cadence | 10 Hz by default |

The telemetry server sends data only while an active WebSocket client exists.
The server does not call `SensorTelemetryCollector::collect()` while no client
is available, because collection drains telemetry event queues.

---

## Frame Types

Every frame has a string `type` field.

| Type | Direction | Meaning |
| --- | --- | --- |
| `capabilities` | ECU to UI | Sent when a client connects. Describes supported contract version and paths. |
| `telemetry` | ECU to UI | Periodic latest-state frame plus ordered events and counters. |

The UI should ignore unknown frame types and unknown object fields.

---

## Capabilities Frame

Sent once after the WebSocket session is accepted.

```json
{
  "type": "capabilities",
  "schema": "ecu.telemetry.v1",
  "schema_version": 1,
  "paths": ["state", "event"],
  "state_hz": 10,
  "events_per_batch": 8
}
```

| Field | Meaning |
| --- | --- |
| `schema` | Stable schema identity for this WebSocket contract. |
| `schema_version` | Integer contract version. V1 is `1`. |
| `paths` | Logical telemetry paths available in this firmware. |
| `state_hz` | Nominal periodic telemetry frame rate. |
| `events_per_batch` | Maximum ordered events serialized in one telemetry frame. |

---

## Telemetry Frame

Sent periodically while connected and send-capable.

```json
{
  "type": "telemetry",
  "schema": "ecu.telemetry.v1",
  "t_us": 123456789,
  "gen": 42,
  "state": {
    "tps": {
      "permille": 531,
      "pct": 53.1,
      "fallback_permille": 700,
      "fallback_used": false,
      "meta": {
        "acquired_at_us": 123450000,
        "seq": 17,
        "valid": true,
        "health": "Valid",
        "quality": "Good",
        "fault_bits": 0
      }
    },
    "rpm": {
      "rpm": 4200.0,
      "period_us": 14285.7,
      "accel_rpm_per_s": 120.5,
      "synchronized": true,
      "crank_reference_trusted": true,
      "revolution_id": 1001,
      "reference_at_us": 123449000,
      "meta": {
        "acquired_at_us": 123450000,
        "seq": 18,
        "valid": true,
        "health": "Valid",
        "quality": "Good",
        "fault_bits": 0
      }
    },
    "egt": {
      "c": 520.3,
      "rate_c_per_s": 1.2,
      "max_c": 620.0,
      "state": "Normal",
      "request": "Normal",
      "meta": {
        "acquired_at_us": 123450000,
        "seq": 10,
        "valid": true,
        "health": "Valid",
        "quality": "Good",
        "fault_bits": 0
      }
    },
    "water": {
      "c": 85.1,
      "rate_c_per_s": 0.1,
      "max_c": 92.0,
      "state": "Normal",
      "request": "Normal",
      "meta": {
        "acquired_at_us": 123450000,
        "seq": 11,
        "valid": true,
        "health": "Valid",
        "quality": "Good",
        "fault_bits": 0
      }
    },
    "quick_shifter": {
      "active": false,
      "armed": false,
      "meta": {
        "acquired_at_us": 123450000,
        "seq": 12,
        "valid": true,
        "health": "Valid",
        "quality": "Good",
        "fault_bits": 0
      }
    },
    "map_switch": {
      "request": "Primary",
      "meta": {
        "acquired_at_us": 123450000,
        "seq": 13,
        "valid": true,
        "health": "Valid",
        "quality": "Good",
        "fault_bits": 0
      }
    },
    "knock": null
  },
  "events": [],
  "overflow": {
    "quick_shift_events": 0,
    "map_switch_events": 0,
    "knock_measurements": 0,
    "fault_events": 0
  },
  "transport": {
    "sent_frames": 1,
    "dropped_frames": 0,
    "send_errors": 0
  }
}
```

### Top-Level Fields

| Field | Source | Meaning |
| --- | --- | --- |
| `type` | Server | Always `telemetry` for live frames. |
| `schema` | Server | Stable schema identity. |
| `t_us` | `TelemetryBatch::collected_at` | ECU monotonic collection timestamp in microseconds. |
| `gen` | `TelemetryStateFrame::snapshot_generation` | Latest-value snapshot generation. |
| `state` | `TelemetryBatch::state` | Replaceable latest ECU state. |
| `events` | `TelemetryBatch::events` | Ordered discrete event records. |
| `overflow` | `TelemetryBatch::overflow` | Sensor-store source queue overflows. |
| `transport` | Telemetry server | WebSocket delivery counters, not sensor-domain counters. |

The UI should use `t_us`, `state.*.meta.acquired_at_us`, and `state.*.meta.seq`
to detect stale values or missed latest-value updates.

---

## Metadata

Every latest-value state record carries the same metadata object:

```json
{
  "acquired_at_us": 123450000,
  "seq": 17,
  "valid": true,
  "health": "Valid",
  "quality": "Good",
  "fault_bits": 0
}
```

| Field | Meaning |
| --- | --- |
| `acquired_at_us` | Physical acquisition or event timestamp in ECU monotonic microseconds. |
| `seq` | Sensor-domain sequence number. Gaps indicate missed latest-value updates. |
| `valid` | Whether the sensor-domain value is valid for control. |
| `health` | Sensor health string. |
| `quality` | Sensor quality string. |
| `fault_bits` | Raw bitset; bit positions match `SensorFault`. |

---

## Enum Strings

### Sensor Health

`Uninitialized`, `Stabilizing`, `Valid`, `Degraded`, `Stale`, `Failed`,
`Disabled`

### Sensor Quality

`Unknown`, `Good`, `Suspect`, `Bad`

### Thermal State

`Cold`, `Warming`, `Normal`, `High`, `Critical`, `SensorInvalid`

### Thermal Request

`Normal`, `Warning`, `DeratingRequested`, `CriticalProtectionRequested`,
`SensorInvalid`

### Physical Map Request

`Primary`, `Secondary`

### Sensor Fault

`Stale`, `InvalidConfiguration`, `RangeLow`, `RangeHigh`, `OpenCircuit`,
`ShortToGround`, `ShortToSupply`, `Communication`, `Frozen`, `Rate`, `Noise`,
`Stuck`, `StartupActive`, `Debounce`, `Duplicate`, `Plausibility`, `Overflow`,
`Missing`, `Saturation`, `WindowTiming`, `DeviceFault`

---

## Knock State

When no knock measurement has been collected, `state.knock` is `null`.

When present:

```json
{
  "revolution_id": 1001,
  "pickup_edge_at_us": 123440000,
  "window_opened_at_us": 123440100,
  "window_closed_at_us": 123440600,
  "read_at_us": 123440700,
  "raw_integrator_count": 1234,
  "background_estimate": 100.0,
  "normalized_index": 12.34,
  "candidate_knock": true,
  "valid": true,
  "health": "Valid",
  "quality": "Good",
  "fault_bits": 0,
  "rpm": 6250.0,
  "tps_permille": 512,
  "ignition_angle_deg": 14.5,
  "config_generation": 7
}
```

V1 exposes only the latest knock summary. It is not a revolution-history stream.

---

## Events

Events are ordered by `at_us`.

### Quick-Shift Request

```json
{
  "kind": "QuickShiftRequest",
  "at_us": 123400000,
  "active": true,
  "activated_at_us": 123400000,
  "released_at_us": 123400650,
  "duration_us": 650,
  "meta": {
    "acquired_at_us": 123400000,
    "seq": 4,
    "valid": true,
    "health": "Valid",
    "quality": "Good",
    "fault_bits": 0
  }
}
```

### Map-Switch Change

```json
{
  "kind": "MapSwitchChange",
  "at_us": 123400000,
  "request": "Secondary",
  "meta": {
    "acquired_at_us": 123400000,
    "seq": 5,
    "valid": true,
    "health": "Valid",
    "quality": "Good",
    "fault_bits": 0
  }
}
```

### Fault Transition

```json
{
  "kind": "FaultTransition",
  "at_us": 123400000,
  "fault": "TpsOutOfRange",
  "health": "Degraded",
  "first_at_us": 123400000,
  "last_at_us": 123450000,
  "count": 2
}
```

---

## Backpressure and Loss Semantics

The server sends telemetry only when the active WebSocket transport is ready.
If the socket is disconnected or the previous frame is still pending, the pump
does not call `collect()` and therefore does not drain sensor event queues.

Sensor-store overflow counters are reported in `overflow`. WebSocket transport
delivery counters are reported separately in `transport`.

V1 does not provide recorded-run completeness. Future revolution and recorded
paths must add explicit gap records before they can be used for reconstruction.
