# Sensor Ownership, Communication, Failure Behavior, and Testability

This document implements phase 6 and phase 7 of the sensor-design roadmap.
It extends [sensor_oop.md](sensor_oop.md) without adding production code.

The rules here are architecture decisions for later implementation. Numeric
limits, queue depths, task priorities and sensor thresholds are recorded as
open decisions when they are not already defined in [sensors.md](sensors.md).

---

# Inputs Preserved as Open Decisions

The following requirements are not silently invented in this document:

* Final TPS electrical diagnostic margins, sample rate and filter delay.
* Whether engine control consumes TPS position only or also throttle rate.
* Whether TPS fallback later adds RPM or load restrictions beyond the 70%
  fallback value already specified.
* The method for distinguishing normal engine stop from pickup or signal
  conditioner failure.
* Final knock frequency, gain, crank-angle window, thresholds and authority.
* Final EGT warning, derating and shutdown thresholds after dynamometer
  validation.
* Water-temperature sensor type, interface, thresholds, hysteresis, mandatory
  status, limp RPM limit and warm-up behavior.
* Quick-shifter re-arm behavior.
* Runtime map-switch safe activation boundary and Web UI override arbitration.
* Which faults require automatic recovery, explicit acknowledgement or restart.
* Which sensors are mandatory for engine operation.
* Final degraded-mode RPM, load and ignition limits.
* FreeRTOS task priorities, stack sizes, queue depths and exact timeout values.

Where this document needs a default before those values exist, it defines the
owner, communication path and safe posture, then leaves final numeric policy to
later calibration or engine-control design.

---

# Phase 6 - Ownership and Communication

## Phase 6 design rules

1. Every mutable state has one writer.
2. ISRs and callbacks only capture raw facts and notify the owning service.
3. Domain services publish measurements, events and protection requests.
4. Engine control, safety, telemetry and diagnostics consume published data.
5. Configuration changes are transactions owned by configuration services.
6. Cross-core communication uses immutable snapshots or bounded event queues.
7. Engine-critical work never waits on telemetry, diagnostics, storage or Web UI.

## Mutable-state ownership matrix

| Mutable state | Single writer | Readers | Communication pattern | Notes |
| --- | --- | --- | --- | --- |
| Raw pickup capture transfer slot or ISR queue item | Pickup ISR or edge-capture callback | `PickupAcquisitionService` | Event-based ISR notification | Preallocated only; no allocation or domain decisions in ISR |
| Pickup pulse history and edge plausibility state | `PickupAcquisitionService` | `EngineStateEstimator`, diagnostics | Event-based internal handoff | Owns duplicate-edge and impossible-interval rejection |
| Engine speed, pulse period, acceleration and synchronization confidence | `EngineStateEstimator` | Engine control, safety, telemetry | Snapshot-based publication | RPM is derived state, not a physical sensor |
| TPS calibration loaded in RAM | `ConfigurationService` | `AnalogSensorService`, diagnostics | Request/response plus config generation event | Applying a new calibration must happen at a safe service boundary |
| TPS filtered value, plausibility state and health | `AnalogSensorService` through `TpsSensor` | Engine control, safety, telemetry, diagnostics | Snapshot-based publication | Engine control never calls the ADC driver |
| EGT converter state, thermal trend and health | `ThermalSensorService` through `EgtSensor` | Safety, telemetry, diagnostics | Snapshot-based publication and fault events | Threshold values remain calibration decisions |
| Water-temperature value, thermal trend and health | `ThermalSensorService` through `WaterTemperatureSensor` | Safety, engine-control limiters, telemetry, diagnostics | Snapshot-based publication and protection request events | Sensor loss is not by itself proof of overheating |
| Quick-shifter debounce, request and re-arm state | `DigitalInputService` through `QuickShifterInput` | Quick-shift eligibility, engine control, telemetry | Event-based requests plus snapshot state | Physical input never disables CDI directly |
| Map-switch physical stable state | `DigitalInputService` through `MapSwitchInput` | Map selector, configuration, telemetry | Snapshot plus map-change event | UI override arbitration remains open |
| UI-requested map override | `ConfigurationService` or map-selection service | Map selector, telemetry, diagnostics | Request/response plus snapshot | Persistence and cancellation policy remain open |
| Effective active map selection | Map-selection or calibration service | Engine control, telemetry, diagnostics | Snapshot plus activation event | Activation boundary remains open |
| TPIC8101 window schedule and acquisition state | `KnockAcquisitionService` | `KnockAnalysisService`, diagnostics | Crank-synchronous event records | Separate from generic analog processing |
| Knock background, normalized metric and decision state | `KnockAnalysisService` | Ignition-limit strategy, safety, telemetry | Event records plus snapshot | Final authority and thresholds remain open |
| Aggregate sensor health and degraded-operation requests | `SensorHealthService` | Safety, telemetry, diagnostics | Snapshot plus fault-transition events | Aggregates health; does not mutate sensor internals |
| Published latest-value snapshots | `SensorDataStore` | Engine control, safety, telemetry, diagnostics, logging | Snapshot-based immutable read | Store owns snapshot generation and sequence counters |
| Sensor fault-transition event buffers | Producing service, then event queue owner | Safety, telemetry, diagnostics | Event-based bounded queue | Overflow creates an overflow diagnostic event or counter |
| Diagnostic log/session buffers | Diagnostics or logging service | Telemetry, storage, service tools | Streamed or batched records | Must not backpressure engine-critical services |
| Persisted calibration/configuration | Storage/configuration service | Runtime, sensor services through config snapshots | Request/response at boot and reconfiguration | Storage is not called from sensor objects |
| Startup sequencing state | Runtime/application owner | Services and diagnostics | Request/response and state snapshot | Runtime orders initialization; services report readiness |
| Shutdown or engine-inhibit request state | Safety service and engine-control service | Runtime, telemetry, diagnostics | Event plus snapshot | Sensor objects publish requests, not direct shutdown commands |

## Boundary ownership

| Boundary | Owner | Allowed responsibilities | Prohibited responsibilities |
| --- | --- | --- | --- |
| ISR and driver callback boundary | Infrastructure acquisition adapter | Timestamp raw events, capture status bits, write preallocated transfer item, notify task | Calibration, filtering, logging, storage, Web UI, map changes, actuator commands |
| Acquisition service boundary | Sensor service task or task phase | Consume raw events/samples, run domain sensor object, update health, publish readings/events | Direct CDI output, persistent storage, telemetry serialization |
| Sensor-data publication boundary | `SensorDataStore` | Own immutable latest snapshots, sequence counters and event queues | Pull fresh hardware values, apply sensor calibration |
| Engine-control boundary | Engine-control service | Consume snapshots/events, choose operating point, request actuator commands through actuator interfaces | Read hardware acquisition drivers, mutate sensor state |
| Safety boundary | Safety service | Consume health/protection requests, arbitrate inhibit and degraded-operation requests | Edit sensor calibration, perform raw acquisition |
| Telemetry boundary | Telemetry service | Read snapshots/events, serialize and stream data | Block engine-critical writers, request fresh sensor reads |
| Diagnostics boundary | Diagnostics service | Read snapshots/events, expose fault history, run controlled diagnostic requests | Mutate sensor internals directly, call hardware from arbitrary context |
| Configuration boundary | Configuration service | Validate config, stage updates, persist accepted values, publish config generation changes | Write sensor state directly, reconfigure from ISR, apply unsafe runtime updates |

## Communication mechanisms

| Source | Destination | Mechanism | Communication type | Synchronization and backpressure rule |
| --- | --- | --- | --- | --- |
| Pickup ISR/callback | `PickupAcquisitionService` | Preallocated ISR-safe queue item or direct-to-task notification with captured timestamp | Event-based | If full, increment pickup overflow counter and publish a fault transition from task context |
| Digital edge callback | `DigitalInputService` | ISR-safe queue item or notification | Event-based | If full, collapse to latest edge/state and increment overflow diagnostic |
| ADC/DMA ready callback | `AnalogSensorService` | Notification plus preallocated sample buffer ownership transfer | Event-based or streamed block | If overrun occurs, mark sample gap and let service evaluate stale/degraded state |
| Thermal converter poll | `ThermalSensorService` | Periodic service call through SPI measurement source | Request/response internal to service | Converter timeout publishes hardware fault; no blocking in engine-critical path |
| Pickup service | Engine estimator | In-task call or bounded event queue | Event-based | Estimator must process in timestamp order; impossible backlog becomes sync-loss fault |
| Sensor services | `SensorDataStore` | Publish latest immutable reading with sequence counter | Snapshot-based | Latest-value overwrite is allowed; sequence exposes missed updates |
| Sensor services | `SensorHealthService` | Fault-transition event plus latest health snapshot | Event-based and snapshot-based | Repeated identical faults may be coalesced with count and first/last timestamp |
| Knock acquisition | Knock analysis | Bounded queue of knock event records | Crank-synchronous event stream | On overflow, drop oldest unprocessed analysis record, preserve overflow count, disable adaptive correction until stable |
| `SensorDataStore` | Engine control | Lock-free or short critical-section immutable snapshot read | Snapshot-based | Engine control uses a coherent copy and checks per-input timestamps and validity |
| `SensorDataStore` | Telemetry/logging | Snapshot copy and event drain | Snapshot-based and streamed | Telemetry drops or decimates under load; never blocks sensor publication |
| Configuration service | Sensor services | Staged config object plus generation number, applied at safe service boundary | Request/response plus event | Rejected config returns an error without changing active generation |
| Diagnostics service | Sensor services | Explicit diagnostic command queue where supported | Request/response | Diagnostic commands cannot bypass service ownership or run in ISR context |
| Safety service | Engine control/runtime | Protection request and final inhibit/limit snapshot | Event-based and snapshot-based | Safety may request inhibit; final actuator effect remains owned by engine-control/actuator services |

## Cross-core rules

The final core assignment remains open, but cross-core communication shall obey
these rules:

* Cross-core sensor data is transferred as immutable snapshots or bounded event
  records. Shared mutable sensor objects are prohibited.
* Snapshot publication uses a generation counter. Consumers reject torn or
  inconsistent reads by copying again when the generation changes during read.
* Engine-critical producers never block on Core 0 telemetry, Web UI, storage,
  MQTT, OTA or diagnostics work.
* Locks held by telemetry, diagnostics or configuration code are not taken in
  pickup, ignition or other engine-critical paths.
* Event queues crossing cores are bounded. Overflow behavior is explicit and
  observable through counters and health/fault publication.
* Configuration updates crossing cores are staged and applied by the owning
  service at a safe boundary. Other cores never mutate owner state directly.

## Buffering, overflow and stale-data rules

| Data path | Buffering rule | Overflow or backpressure behavior | Stale-data behavior |
| --- | --- | --- | --- |
| Pickup capture | Preserve valid captures in timestamp order | Overflow is a serious timing fault; engine speed becomes untrusted until recovery | Missing expected captures moves engine speed to stale or unsynchronized |
| TPS latest value | Latest-value snapshot only | Overwrite old latest value; sequence counter exposes missed samples | If sample age exceeds configured timeout, publish stale and use TPS fallback |
| EGT and water temperature | Latest value plus maximum/trend state | Latest-value overwrite allowed; fault events are coalesced | Stale disables dependent adaptation and enters limited strategy |
| Quick-shifter request | Preserve validated request events | If request queue full, ignore new request and publish overflow diagnostic | Stale stable-state scan faults input if state cannot be trusted |
| Map-switch request | Latest stable state plus change event | Repeated changes may be coalesced; invalid rapid changes create fault | If switch state unavailable, select safe default map |
| Knock records | Bounded per-revolution record queue | Drop analysis records under overload, count drops, disable adaptive correction | Missed combustion-event records mark knock stale in event-count units |
| Fault transitions | Bounded event queue plus current health snapshot | Coalesce repeated transitions and increment count | Current health snapshot remains authoritative |
| Telemetry stream | Best-effort stream from snapshots/events | Drop, decimate or batch telemetry; never block producers | Telemetry marks data age and missed sequence counts |
| Diagnostic/session logs | Bounded recording buffer | Drop oldest or stop recording according to logging policy; publish diagnostic | Logging staleness never changes control decisions |

## Startup ownership

Runtime owns startup sequencing:

1. Configuration and storage services load persisted calibration and defaults.
2. Hardware acquisition adapters initialize peripherals.
3. Sensor services start in `Uninitialized` or `Stabilizing`.
4. `SensorDataStore` publishes invalid snapshots with timestamps and health.
5. Engine control remains in a state that does not trust unavailable inputs.
6. Each sensor service transitions to `Valid` only after its own startup rules
   are satisfied.
7. Safety receives health snapshots before engine operation is allowed.

Startup-active quick-shifter input is a diagnostic condition and is ignored
until the input returns to a valid normal state. Startup pickup state is
unsynchronized until sufficient consistent events establish a credible period.

## Shutdown ownership

Sensor objects do not shut down the engine. They publish invalid, failed,
critical or protection-request states. Safety and engine control own the final
inhibit or degraded-operation decision.

Shutdown sequencing is owned by runtime:

1. Safety or engine control publishes the inhibit or shutdown request.
2. Engine control commands actuator-safe behavior through actuator interfaces.
3. Acquisition services stop accepting nonessential requests.
4. Telemetry and diagnostics publish final state if bandwidth is available.
5. Configuration/storage work runs only after engine-critical activity is safe.

## Runtime reconfiguration ownership

Configuration service owns all runtime reconfiguration transactions:

* Requests come from Web UI, diagnostics, stored profiles or calibration tools.
* The configuration service validates the request against current mode.
* Accepted changes receive a new generation number.
* Owning sensor services apply the generation at a safe service boundary.
* Rejected changes leave the active generation unchanged and return an error.
* Configuration persistence is not performed by sensor-domain objects.

Map switching is permitted while running, but the exact safe activation boundary
and Web UI override arbitration remain open decisions from `sensors.md`.

## Prohibited dependencies and direct calls

The following are prohibited:

* Engine control directly reading ADC, SPI, GPIO or TPIC8101 drivers.
* Telemetry or diagnostics asking a hardware driver for fresh sensor data.
* Sensor-domain objects calling Web UI, MQTT, OTA, storage or actuator output.
* ISRs performing calibration, filtering, JSON serialization, logging or config
  changes.
* Configuration service mutating sensor internals outside the owning service.
* Safety directly editing sensor state to force a desired reading.
* Knock analysis directly writing final ignition output.
* Quick-shifter input directly disabling CDI output.

---

# Phase 7 - Failure Behavior and Testability

## Phase 7 design rules

1. Health and fault behavior is part of the sensor contract.
2. Startup validity, stale-data handling and recovery are explicit per family.
3. Fallback values and protection requests are published, not hidden.
4. Tests use deterministic time, simulated hardware sources and replay data.
5. Timing, overload and concurrency behavior are tested before hardware drivers
   are treated as complete.

## Common health states

| State | Meaning | Typical entry | Typical exit |
| --- | --- | --- | --- |
| `Uninitialized` | Service or dependency not ready | Boot, disabled service, missing config | Hardware and required config available |
| `Stabilizing` | Samples/events are arriving but not yet trusted | First plausible sample or edge | Required stable evidence collected |
| `Valid` | Reading/event stream may be used for control | Startup checks passed | Timeout, implausibility, hardware fault or disable |
| `Degraded` | Reading is usable with reduced confidence or protection | Isolated implausible sample, noisy signal, fallback active | Recovery evidence or escalation to failed/stale |
| `Stale` | Last value is too old for normal use | Timeout or missed event count | Fresh plausible data or escalation to failed |
| `Failed` | Signal, hardware, calibration or plausibility fault | Repeated invalid data, hardware error, impossible behavior | Recovery rule or explicit acknowledgement |
| `Disabled` | Input intentionally unavailable | Configuration or feature disabled | Re-enabled by configuration transaction |

Every published reading carries health state, validity, quality, timestamp,
sequence and relevant fault information.

## Sensor-family transition rules

### Pickup and engine-speed state

| Transition | Rule |
| --- | --- |
| Startup validity | Starts `Uninitialized`, enters `Stabilizing` on first plausible falling edge, becomes `Valid` only after sufficient consistent edge periods establish a credible RPM and synchronization state |
| Timeout and stale | Missing expected edges makes RPM and crank reference `Stale` or unsynchronized; final timeout is speed-dependent and remains an open numeric decision |
| Failure | Duplicate edges, impossible pulse intervals, implausible RPM changes or capture overflow move to `Failed` or unsynchronized |
| Recovery | Recovery requires a new sequence of plausible edges; the exact count remains a calibration decision |
| Latching | Pickup loss itself is not permanently latched by default; hardware diagnostic faults may be latched when a diagnostic source exists |

Fallback: engine control must prevent or inhibit ignition scheduling when a
trustworthy crank reference is unavailable. The system still cannot directly
distinguish stopped engine from pickup failure without additional context.

### TPS

| Transition | Rule |
| --- | --- |
| Startup validity | Invalid until acquisition and calibration are available and initial samples are plausible |
| Timeout and stale | If no fresh TPS sample arrives within the configured timeout, publish `Stale` and invalid |
| Failure | Electrical range fault, calibrated range fault, stuck signal, excessive noise or repeated implausible rate of change moves to `Failed` |
| Recovery | Transient range/noise faults may recover after a configured run of plausible samples; invalid calibration requires configuration correction |
| Latching | Calibration faults are latched until configuration changes; transient sample faults are not latched unless later configured |

Fallback: publish invalid TPS status and use the fixed 70% throttle fallback
specified in `sensors.md`. Whether additional RPM/load restrictions are applied
remains open.

### EGT

| Transition | Rule |
| --- | --- |
| Startup validity | Cold ambient values are valid; becomes valid after plausible converter results and valid diagnostic flags |
| Timeout and stale | SPI timeout or missing converter updates move to `Stale`; timeout is longer than TPS but bounded |
| Failure | Open thermocouple, converter fault, invalid cold junction, frozen reading, implausible jump or SPI failure moves to `Failed` |
| Recovery | Normal EGT-dependent operation resumes only after valid measurement remains stable for a configured recovery period |
| Latching | Sensor faults are reported; overtemperature faults may be latched and may require restart or acknowledgement if configured |

Fallback: disable EGT-dependent protection actions that require trusted EGT,
publish the fault and enter a conservative limited-operating strategy.
Critical EGT behavior and thresholds remain calibration decisions.

### Water temperature

| Transition | Rule |
| --- | --- |
| Startup validity | Valid after first plausible measurements; cold ambient values are expected and are not faults |
| Timeout and stale | Missing updates move to `Stale`; timeout is longer than TPS but bounded to preserve cooling protection |
| Failure | Open circuit, short circuit, implausible temperature, impossible rate of change, frozen reading or acquisition failure moves to `Failed` |
| Recovery | Recovery requires plausible values through configured hysteresis and recovery duration |
| Latching | Critical thermal faults may latch if configured; ordinary sensor failure does not imply overheating |

Fallback: report the fault, disable water-temperature-based adaptive
corrections, select conservative ignition/load/RPM limits and continue in a
limited operating mode when permitted. Hard shutdown requires confirmed critical
temperature before sensor loss, corroborating evidence, another safety condition
or configuration that makes the sensor mandatory.

### Quick shifter

| Transition | Rule |
| --- | --- |
| Startup validity | Initial stable state is measured at startup; active-at-startup generates a diagnostic and is ignored |
| Timeout and stale | If stable-state monitoring cannot confirm input state, publish stale/invalid input state |
| Failure | Stuck input, repeated bouncing, implausibly short pulses, excessive activation duration or requests outside permitted operating conditions move to `Failed` or `Degraded` |
| Recovery | Input returns to valid normal state and completes re-arm rule before requests are accepted |
| Latching | Startup-active and stuck-input faults remain active until normal inactive state is observed; final acknowledgement policy remains open |

Fallback: ignore quick-shifter requests while the input is invalid, faulted or
not re-armed. The input never directly commands ignition cut.

### Map switch

| Transition | Rule |
| --- | --- |
| Startup validity | Stable physical switch state is read before initial map selection |
| Timeout and stale | If the switch state cannot be trusted, publish invalid physical state |
| Failure | Invalid electrical state, rapid repeated changes or unavailable selected map moves to `Failed` or `Degraded` |
| Recovery | Stable valid state and available selected map allow recovery |
| Latching | Electrical faults need not latch; invalid map/config faults remain until configuration changes |

Fallback: select the hardcoded safe default map. The Web UI override persistence,
cancellation and timeout policy remains open.

### Knock

| Transition | Rule |
| --- | --- |
| Startup validity | Knock correction is disabled until crank synchronization, TPIC configuration and background estimation are valid |
| Timeout and stale | Stale state is defined in missed combustion-event records rather than only milliseconds |
| Failure | Missing result, stuck result, saturation, implausible background, invalid window timing, TPIC configuration or communication error moves to `Failed` |
| Recovery | Recovery requires valid TPIC communication/configuration, valid window timing and rebuilt background model |
| Latching | TPIC configuration or communication faults may latch until reinitialization; transient missing results may recover after valid records |

Fallback: disable adaptive advance, remove learned positive corrections and use
a validated conservative ignition/load strategy. Knock analysis may publish a
protection request but must not write final ignition output.

## Engine-control and safety fallback ownership

| Fault or health condition | Engine-control behavior | Safety behavior | Open decisions |
| --- | --- | --- | --- |
| Pickup invalid, stale or unsynchronized | Do not schedule ignition from untrusted crank reference | May request inhibit and fault publication | Missing-pulse threshold and stop/failure distinction |
| TPS invalid or stale | Use 70% throttle fallback for load-dependent consumers | May request limited mode if configured | Additional RPM/load limits |
| EGT failed or stale | Avoid EGT-dependent correction paths | Conservative limited strategy and thermal diagnostics | Final thresholds and latching policy |
| Water temperature failed or stale | Disable water-temperature adaptation | Conservative limits; shutdown only with confirmed/corroborated critical condition or mandatory config | Sensor mandatory status and limp RPM |
| Quick shifter failed or not re-armed | Ignore shift request | Publish input fault; no engine shutdown by default | Re-arm and acknowledgement policy |
| Map switch failed or invalid | Use effective safe default map | Validate active map availability | UI override arbitration |
| Knock failed or stale | Disable adaptive knock correction and learned positive advance | Conservative ignition/load strategy | Knock authority level and thresholds |
| SensorDataStore overflow or stale snapshot | Reject stale inputs per validity flags | Publish degraded sensor subsystem health | Exact counters and alert thresholds |

## Test seams

| Seam | Purpose | Required capability |
| --- | --- | --- |
| Hardware source interfaces | Replace ESP-IDF peripherals in tests | Inject analog samples, SPI converter results, digital edges, pickup captures and TPIC results |
| Deterministic time source | Test timeout, stale and debounce behavior | Advance monotonic time without real delays |
| Replay source | Reproduce recorded sessions and failures | Feed timestamped events/samples at controlled speed |
| Fault injector | Exercise health transitions | Inject open/short, timeout, stuck value, bounce, overflow, saturation, SPI failure, TPIC fault and missing pickup |
| Configuration source | Test calibration and runtime updates | Provide valid, invalid and generation-changing config snapshots |
| Publication reader | Verify snapshots and events | Inspect sequence counters, timestamps, health, quality and fault payloads |
| Queue/backpressure harness | Test overload behavior | Fill event queues and verify overflow counters, drops and degraded states |

## Test categories

### Unit tests

* TPS calibration, range validation, rate validation, fallback publication and
  recovery period.
* Pickup edge plausibility, duplicate rejection, RPM estimation and sync loss.
* EGT and water-temperature transfer, stale detection, thermal state and
  recovery hysteresis.
* Quick-shifter debounce, startup-active behavior, stuck input and re-arm.
* Map-switch debounce, invalid map fallback and UI override arbitration once
  arbitration is specified.
* Knock record validation, missing/stuck/saturation detection and background
  state transitions.
* `SensorDataStore` snapshot generation, sequence counters and stale reads.

### Integration tests

* End-to-end analog service publication to engine snapshot and telemetry.
* Pickup event to RPM/sync snapshot and engine-control inhibit when stale.
* Digital input edge to validated quick-shifter event without direct CDI call.
* Map-switch physical event to map-change request and safe default fallback.
* Thermal fault to safety protection request without direct actuator command.
* Knock event record to protection request without direct ignition output.
* Configuration transaction staging, rejection and safe-boundary application.

### HITL tests

* Simulator-generated pickup ramps up to the specified maximum operating range.
* TPS sweep, rapid closure, disconnect, short to ground and short to supply.
* EGT converter fault, open thermocouple and controlled heating profile.
* Water-temperature cold startup, gradual heating, rapid heating and sensor loss.
* Quick-shifter normal activation, bounce, long hold and startup-active state.
* Map-switch startup positions, bounce and runtime changes.
* TPIC8101 communication fault, missing knock result and window timing checks
  when hardware is available.

### Concurrency tests

* Engine-critical snapshot reads while telemetry drains snapshots on another
  core.
* Configuration update request while sensor services publish current data.
* Fault transition queue overflow while current health snapshot remains correct.
* Telemetry backpressure while sensor publication continues.
* Diagnostics requests rejected or deferred when they would violate ownership.

### Overload and timing tests

* Pickup event burst or false-edge storm causes overflow diagnostic and
  sync-loss behavior rather than blocking.
* Knock analysis backlog disables adaptive correction and counts dropped records.
* Telemetry stream overload drops/decimates telemetry without blocking sensors.
* Snapshot publication remains bounded under maximum expected sensor rates.
* Stale transitions occur after deterministic time advances or missed event
  counts.
* ISR work remains limited to timestamp/capture/notify behavior.

## Acceptance criteria for later implementation tests

1. Every mutable sensor-related state has exactly one documented writer.
2. No sensor-domain object depends on Web UI, MQTT, OTA, storage or actuator
   output modules.
3. Engine control obtains sensor inputs only through snapshots or subscribed
   events.
4. ISRs and callbacks perform no calibration, filtering, logging, allocation,
   storage or actuator commands.
5. Every published measurement includes timestamp, validity, health, quality
   and sequence or generation data.
6. Every event path has documented bounded buffering and overflow behavior.
7. Telemetry and diagnostics overload cannot block pickup, engine-speed or
   sensor publication paths.
8. Configuration updates are staged, validated and applied by the owning service
   at a safe boundary.
9. Pickup invalid or stale state prevents ignition scheduling from an untrusted
   crank reference.
10. TPS invalid or stale state publishes invalid status and uses the 70% fallback
    value unless a later engine-control policy adds restrictions.
11. EGT and water-temperature sensor failures disable dependent adaptation and
    publish conservative protection state without claiming unconfirmed
    overheating.
12. Quick-shifter faults cause requests to be ignored until recovery or re-arm.
13. Map-switch faults select a hardcoded safe default map.
14. Knock faults disable adaptive correction and learned positive advance.
15. Deterministic-time tests can trigger startup, stale, timeout, recovery and
    latching transitions without real waiting.
16. Replay tests can feed timestamped sensor data without ESP-IDF dependencies.
17. Fault-injection tests cover open/short, timeout, stuck, noise/bounce,
    overflow, saturation and communication-failure paths.
18. Cross-core snapshot reads are coherent and expose missed updates through
    sequence or generation counters.
19. All unresolved numeric thresholds and calibration decisions remain
    configurable or explicitly blocked before production driver implementation.
