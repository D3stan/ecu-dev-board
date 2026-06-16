# Basic Sensor Telemetry Core Contract

This document defines the exact V1 output of the transport-neutral telemetry
core. It is the contract consumed by the future webserver/WebSocket layer.

The telemetry core does not serialize JSON, own WebSocket sessions, configure
WiFi, serve static files, or know about the browser client. It produces typed
C++ records in domain-native units.

---

## 1. Producer API

The V1 collector API should be:

```cpp
namespace ecu::telemetry {

struct SensorTelemetryCollectorConfig {
    std::size_t max_events_per_batch{8};
};

class SensorTelemetryCollector {
public:
    explicit SensorTelemetryCollector(ecu::sensors::SensorDataStore &store,
                                      SensorTelemetryCollectorConfig config = {});

    std::optional<TelemetryBatch> collect(ecu::sensors::TimestampUs now);
};

} // namespace ecu::telemetry
```

Callers should invoke `collect(now)` only when they are ready to consume a
batch. Calling `collect()` copies the latest state and drains sensor event
queues into the telemetry collector.

The collector does not apply a send rate. A telemetry task or webserver adapter
can call it at approximately 10 Hz for the initial live dashboard use case.

The `std::optional` return is reserved for future disabled/rate-limited modes.
V1 normally returns a populated `TelemetryBatch`.

---

## 2. Common Metadata

Every latest-value state record carries:

```cpp
struct TelemetryHealth {
    ecu::sensors::TimestampUs acquired_at;
    ecu::sensors::SensorSequence sequence;
    bool valid_for_control;
    ecu::sensors::SensorHealthState health;
    ecu::sensors::SensorQuality quality;
    std::uint64_t fault_bits;
};
```

Field semantics:

| Field | Meaning |
| --- | --- |
| `acquired_at` | Physical acquisition/event timestamp from the sensor domain, in monotonic microseconds. |
| `sequence` | Per-reading sequence assigned by `SensorDataStore`. Missed values can be detected by gaps. |
| `valid_for_control` | Whether the sensor-domain value is usable by control logic. Telemetry does not reinterpret it. |
| `health` | Sensor-domain health state, such as `Valid`, `Stale`, `Failed`, or `Degraded`. |
| `quality` | Sensor-domain quality state, such as `Good`, `Suspect`, or `Bad`. |
| `fault_bits` | Raw `FaultBitset::bits()`. Bit positions correspond to `SensorFault` enum values. |

Telemetry does not calculate stale state itself. It only forwards the health,
quality, validity, timestamps, sequences, and fault bits already published by
the sensor domain.

---

## 3. Batch Shape

The collector produces one batch per call:

```cpp
struct TelemetryBatch {
    ecu::sensors::TimestampUs collected_at;
    TelemetryStateFrame state;
    std::vector<TelemetryEventFrame> events;
    TelemetryOverflowCounters overflow;
};
```

Field semantics:

| Field | Meaning |
| --- | --- |
| `collected_at` | Monotonic timestamp passed by the caller to `collect(now)`. |
| `state` | Replaceable latest sensor state. Consumers may drop older state frames. |
| `events` | Ordered light event records emitted in this batch. Consumers should preserve order. |
| `overflow` | Sensor-store overflow counters observed at collection time. These are source queue overflows, not WebSocket drops. |

`TelemetryOverflowCounters` mirrors `sensors::SensorOverflowCounters`:

```cpp
struct TelemetryOverflowCounters {
    std::uint32_t quick_shift_events;
    std::uint32_t map_switch_events;
    std::uint32_t knock_measurements;
    std::uint32_t fault_events;
};
```

---

## 4. Latest State Frame

The V1 state frame is:

```cpp
struct TelemetryStateFrame {
    std::uint32_t snapshot_generation;
    TpsTelemetryState tps;
    EngineSpeedTelemetryState engine_speed;
    ThermalTelemetryState egt;
    ThermalTelemetryState water_temperature;
    QuickShifterTelemetryState quick_shifter;
    MapSwitchTelemetryState map_switch;
    std::optional<KnockTelemetryState> latest_knock;
};
```

`snapshot_generation` is copied from `EngineInputSnapshot::generation`.

### 4.1 TPS

```cpp
struct TpsTelemetryState {
    int permille;
    int fallback_permille;
    bool fallback_used;
    TelemetryHealth meta;
};
```

Units:

| Field | Unit |
| --- | --- |
| `permille` | 0 to 1000 throttle opening, or fallback value when fallback is used. |
| `fallback_permille` | Fallback throttle value published by the TPS domain. |
| `fallback_used` | True when the TPS value is a fallback, not a normal measurement. |

The webserver may convert `permille / 10.0` to percent for JSON/UI output.

### 4.2 Engine Speed / Pickup State

```cpp
struct EngineSpeedTelemetryState {
    float rpm;
    float period_us;
    float acceleration_rpm_per_s;
    bool synchronized;
    bool crank_reference_trusted;
    ecu::sensors::RevolutionId revolution_id;
    ecu::sensors::TimestampUs reference_at;
    TelemetryHealth meta;
};
```

Units:

| Field | Unit |
| --- | --- |
| `rpm` | Revolutions per minute. |
| `period_us` | Revolution period in microseconds. |
| `acceleration_rpm_per_s` | RPM change per second. |
| `reference_at` | Timestamp of the crank reference used for this state. |

No full revolution history is emitted in V1. `revolution_id` is included only
as the latest state identity.

### 4.3 Thermal State

EGT and water temperature use the same record shape:

```cpp
struct ThermalTelemetryState {
    float celsius;
    float rate_c_per_s;
    float maximum_celsius;
    ecu::sensors::ThermalState state;
    ecu::sensors::ThermalRequestLevel request;
    TelemetryHealth meta;
};
```

Units:

| Field | Unit |
| --- | --- |
| `celsius` | Degrees Celsius. |
| `rate_c_per_s` | Temperature change in degrees Celsius per second. |
| `maximum_celsius` | Maximum observed temperature published by the sensor domain. |

The `request` field is a sensor-side request level only. It is not a final
safety or actuator command.

### 4.4 Quick-Shifter State

```cpp
struct QuickShifterTelemetryState {
    bool active;
    bool armed;
    TelemetryHealth meta;
};
```

This is the current stable quick-shifter input state. Validated shift requests
are emitted separately as events.

### 4.5 Map-Switch State

```cpp
struct MapSwitchTelemetryState {
    ecu::sensors::PhysicalMapRequest request;
    TelemetryHealth meta;
};
```

This is only the physical switch request, `Primary` or `Secondary`. It is not
the effective active map and does not imply that a runtime map change has been
accepted.

### 4.6 Latest Knock Summary

```cpp
struct KnockTelemetryState {
    ecu::sensors::RevolutionId revolution_id;
    ecu::sensors::TimestampUs pickup_edge_at;
    ecu::sensors::TimestampUs window_opened_at;
    ecu::sensors::TimestampUs window_closed_at;
    ecu::sensors::TimestampUs read_at;
    std::uint32_t raw_integrator_count;
    float background_estimate;
    float normalized_index;
    bool candidate_knock;
    bool valid_for_control;
    ecu::sensors::SensorHealthState health;
    ecu::sensors::SensorQuality quality;
    std::uint64_t fault_bits;
    float rpm;
    int tps_permille;
    float ignition_angle_deg;
    std::uint32_t config_generation;
};
```

The collector drains `SensorDataStore::pop_knock_measurement()` and retains
only the newest available measurement as `latest_knock`.

V1 does not emit knock measurements as ordered revolution records. The latest
knock summary is suitable for a live dashboard but not for run reconstruction.

---

## 5. Event Frames

The collector emits light events from the sensor-domain event queues:

```cpp
enum class TelemetryEventKind {
    QuickShiftRequest,
    MapSwitchChange,
    FaultTransition,
};

struct TelemetryEventFrame {
    TelemetryEventKind kind;
    ecu::sensors::TimestampUs occurred_at;
    std::variant<QuickShiftTelemetryEvent,
                 MapSwitchTelemetryEvent,
                 FaultTelemetryEvent> payload;
};
```

`occurred_at` is a common sorting/serialization helper:

| Event kind | `occurred_at` source |
| --- | --- |
| `QuickShiftRequest` | `SensorEvent<QuickShiftRequest>::acquired_at` |
| `MapSwitchChange` | `SensorEvent<MapSwitchState>::acquired_at` |
| `FaultTransition` | `FaultTransition::first_at` |

### 5.1 Quick-Shift Request Event

```cpp
struct QuickShiftTelemetryEvent {
    bool active;
    ecu::sensors::TimestampUs activated_at;
    ecu::sensors::TimestampUs released_at;
    std::uint32_t duration_us;
    TelemetryHealth meta;
};
```

`meta.sequence` is the event sequence assigned by `SensorDataStore`.

### 5.2 Map-Switch Change Event

```cpp
struct MapSwitchTelemetryEvent {
    ecu::sensors::PhysicalMapRequest request;
    TelemetryHealth meta;
};
```

`meta.sequence` is the event sequence assigned by `SensorDataStore`.

### 5.3 Fault Transition Event

```cpp
struct FaultTelemetryEvent {
    ecu::sensors::SensorFault fault;
    ecu::sensors::SensorHealthState health;
    ecu::sensors::TimestampUs first_at;
    ecu::sensors::TimestampUs last_at;
    std::uint32_t count;
};
```

Fault transitions currently do not have an event sequence in
`SensorDataStore`, so ordering uses `first_at`.

---

## 6. Event Draining and Ordering

When `collect(now)` is called:

1. The collector copies `SensorDataStore::snapshot()`.
2. The collector drains all currently available knock measurements and updates
   `latest_knock` with the newest drained measurement.
3. The collector drains currently available quick-shifter, map-switch, and
   fault events into a collector-owned pending-event backlog.
4. Pending events are ordered by `occurred_at`.
5. The batch emits at most `max_events_per_batch` events.
6. Remaining pending events stay in the collector backlog and are emitted by
   later `collect()` calls.
7. Overflow counters are copied from `SensorDataStore::overflow_counters()`.

Consumers that cannot send a batch should avoid calling `collect()`. The
webserver layer owns transport backpressure policy.

Events are best-effort observability records. The engine-control path must not
wait for telemetry collection or delivery.

---

## 7. Threading and Ownership Expectations

The V1 collector should be owned by one telemetry/webserver task or service
phase. Do not call one collector instance concurrently from multiple tasks.

The collector depends only on:

* `ecu::sensors::SensorDataStore`
* sensor-domain value types from `components/sensors`

The sensor component must not include or depend on the telemetry component.

---

## 8. Consumer Responsibilities

The webserver/WebSocket layer should:

* Decide when to call `collect(now)`.
* Decide whether to serialize every field or a subset.
* Convert C++ enums to strings or numeric codes.
* Convert TPS permille to percent if desired.
* Convert timestamps to client-relative time if desired.
* Apply WebSocket/session backpressure policy.
* Count and report transport-level drops separately from sensor-store overflow.

The webserver/WebSocket layer must not:

* Read hardware drivers directly for telemetry.
* Reach into sensor-domain objects.
* Mutate sensor readings.
* Treat sensor-side thermal requests as final safety decisions.
* Treat the physical map-switch request as the effective active map.
