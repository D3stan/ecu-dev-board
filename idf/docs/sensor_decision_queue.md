# Sensor Macro-Area Decision Queue

This document tracks the sensor macro-area decisions that must be resolved
before turning the sensor architecture into class diagrams, task matrices or
production code.

All decisions in this queue have been resolved. The scope remains limited to
the sensor macro area. Final ignition maps, final engine derating values, final
dyno thresholds, Web UI override policy and exact FreeRTOS priorities or queue
depths are intentionally outside this list unless they affect a sensor boundary.

---

# Resolved Decisions

## Decision 1 - Common timebase and timestamp model

Selected option 1.

Use a monotonic unsigned 64-bit microsecond timestamp, represented as
`TimestampUs`.

The timestamp is acquired at the hardware event or physical sample time.
Published snapshots preserve per-input timestamps. Pickup handling may preserve
raw hardware ticks internally when useful, but published domain data uses
`TimestampUs`.

## Decision 2 - Published sensor value representation

Selected option 1.

Use a common `SensorReading<T>` envelope plus typed domain values.

Each latest-value reading carries:

* Typed value, such as `ThrottlePositionPermille`,
  `TemperatureCelsius` or `EngineSpeedState`.
* `TimestampUs acquired_at`.
* `uint32_t sequence`.
* `bool valid_for_control`.
* `SensorHealthState`.
* `SensorQuality`.
* Fault bitset or fault code.

Event-based inputs use a sibling `SensorEvent<T>` with the same timing,
validity, health and fault vocabulary. Knock uses `KnockEventRecord`, but that
record still includes the same validity, health, timestamp and fault fields.

## Decision 3 - Health-state model, recovery and latching

Selected option 1.

Use one common health vocabulary for all families:

* `Uninitialized`.
* `Stabilizing`.
* `Valid`.
* `Degraded`.
* `Stale`.
* `Failed`.
* `Disabled`.

Each family defines its own transition guards:

* Startup evidence.
* Stale trigger.
* Failure trigger.
* Recovery evidence.
* Latching category.

Faults are categorized as:

* Transient auto-recoverable.
* Persistent recoverable after stable samples.
* Configuration-latched.
* Safety-latched.

Safety, telemetry and diagnostics get one vocabulary, while each sensor keeps
its own plausibility logic.

## Decision 4 - TPS diagnostics, filtering and fallback boundary

Selected option 1.

Define the TPS architecture now, but leave numeric margins and filter constants
as calibration values.

The TPS contract is:

* TPS is required for normal mapped operation.
* TPS acquisition is periodic and independent from pickup timing.
* Calibration uses closed-throttle and full-throttle endpoints.
* The sensor checks electrical range, calibrated range, stuck signal, excessive
  noise and implausible rate of change.
* Filtering is low-latency and must not hide rapid throttle closure.
* Transient sample faults may auto-recover after stable plausible samples.
* Invalid calibration is latched until configuration changes.
* If TPS is invalid or stale, publish invalid TPS and the fixed 70 percent
  fallback value already specified in `sensors.md`.
* Additional RPM or load restrictions belong to later engine-control policy,
  not the TPS object.

## Decision 5 - Pickup validity and stopped-engine distinction

Selected option 1.

Use engine context plus pickup evidence.

The pickup contract is:

* No pickup edges before synchronization means stopped, cranking-not-yet-synced
  or not-yet-running, not an immediate sensor failure.
* Once synchronized and running, missing speed-dependent expected edges moves
  engine speed to `Stale` or unsynchronized.
* Ignition scheduling is inhibited whenever the crank reference is untrusted.
* Impossible intervals, duplicate edges, capture overflow or hardware
  diagnostic faults move the pickup path to `Failed` or unsynchronized.
* Recovery requires a new sequence of plausible falling edges.
* Normal loss of motion is not permanently latched by default.

A single missing-edge rule is not used because it cannot safely distinguish a
stopped engine from failed pickup hardware.

## Decision 6 - EGT acquisition, fault and recovery behavior

Selected option 1.

Treat EGT as a protection and diagnostic input that is not mandatory for basic
engine operation.

The EGT contract is:

* MAX31856 diagnostics, SPI status and temperature plausibility are part of the
  sensor reading.
* Startup ambient readings are valid, but EGT-dependent protection is delayed
  until engine-running context is available.
* Open thermocouple, converter fault, invalid cold junction, frozen reading,
  implausible jump or SPI failure moves EGT to `Failed` or `Stale`.
* Sensor faults are reported and may latch as diagnostic faults.
* Overtemperature faults may latch according to later safety policy.
* EGT failure disables EGT-dependent protection actions and requests
  conservative limited operation.
* EGT failure alone does not cause immediate hard shutdown.
* Normal EGT-dependent operation resumes only after valid measurement remains
  stable for a configured recovery period.

Final EGT thresholds still require dynamometer validation.

## Decision 7 - Water-temperature interface and fallback

Selected option 1 with the first supported hardware path constrained to analog
NTC.

Water temperature remains a thermal-domain sensor boundary, but the initial
hardware acquisition path is analog NTC rather than a digital temperature
interface.

The water-temperature contract is:

* `WaterTemperatureSensor` consumes a timestamped temperature sample produced
  from an analog NTC acquisition path.
* The analog source owns ADC sampling, pull-up/reference configuration and raw
  electrical diagnostics.
* The sensor-domain object owns NTC transfer interpretation, calibration,
  plausibility, thermal state and health.
* Published data includes temperature, rate of change, maximum observed value,
  thermal state and health.
* Cold ambient startup values are valid and not faults.
* Open, short, implausible temperature, impossible rate of change, frozen value
  or acquisition failure moves the sensor to `Failed` or `Stale`.
* Sensor loss disables water-temperature-based adaptive corrections.
* Sensor loss does not by itself prove overheating.
* Conservative limits are requested only when configured mandatory, when there
  was confirmed critical temperature before sensor loss, or when corroborating
  evidence exists.

The exact NTC model, installation location, thresholds and hysteresis remain
calibration and hardware-selection decisions.

## Decision 8 - Quick-shifter polarity, debounce, duration and re-arm

Selected option 1 with a specific re-arm rule.

Treat the hardware input as active-low with pull-up bias, and normalize it to a
domain-level `active == true` request inside `QuickShifterInput`.

The quick-shifter contract is:

* Electrical idle state is high because the contact is normally open with
  pull-up bias.
* Electrical active state is low.
* Domain code never depends on raw GPIO polarity.
* Activation and release both require debounce.
* Very short pulses are rejected as bounce.
* Excessive active duration is reported as stuck or degraded input.
* Active-at-startup is diagnostic and ignored until inactive state is observed.
* A new request is accepted only after a valid input state change followed by
  the configured re-arm timeout.
* The re-arm timeout is evaluated only while the input is valid.
* Invalid, bouncing, stale or faulted input state prevents re-arm progress.
* A held input never generates repeated shift requests by timer alone.
* Eligibility and ignition-cut execution remain outside the input object.

This reconciles `sensors.md`: active-low operation is the electrical rule,
while active remains the domain meaning.

## Decision 9 - Map-switch physical input behavior

Selected option 1.

The map switch owns only physical input qualification.

The map-switch contract is:

* `DigitalInputService` debounces the latched physical switch.
* `MapSwitchInput` publishes latest stable physical request and map-change
  event.
* The map selector validates that the requested map exists.
* Effective active map is owned outside the digital input object.
* If the physical switch is invalid, MapSwitchInput publishes an invalid physical-state fault. If the requested map is unavailable, the map-selection service publishes a map-selection fault and selects the hardcoded safe default.
* Web UI override arbitration remains outside the sensor macro area.

This keeps sensor ownership separate from configuration and engine-map
activation.

## Decision 10 - Knock macro-area scope

Selected option 1 with a boundary correction.

The sensor macro area owns knock acquisition, diagnostics, conditioning and
feature publication. ECU strategy owns knock interpretation and any control
authority.

The earlier analysis-service name was too broad for the sensor macro area. Use
`KnockSignalProcessingService` or `KnockFeatureExtractionService` for the
sensor-side component.

The knock contract is:

* TPIC8101 configuration and communication are owned by
  `KnockAcquisitionService`.
* One crank-windowed `KnockEventRecord` is published per enabled revolution.
* Each record carries result count, timestamp, revolution context, window
  context, validity, health and active TPIC configuration.
* Missing, stuck, saturated, mistimed or communication-failed records produce
  health/fault states.
* Sensor-side knock processing may compute background, signal quality and
  normalized feature values.
* Sensor-side knock processing does not classify final engine knock state,
  request ignition retard, request protection, choose thresholds for authority
  or write final ignition output.
* ECU-level knock strategy may later consume the feature record and decide
  conservative action.

Final knock frequency, gain, window, thresholds and authority remain staged
calibration and ECU-strategy decisions.

## Decision 11 - Sensors mandatory for engine operation

Selected option 1.

Only the crank reference is strictly mandatory for ignition scheduling.

The mandatory-status contract is:

* Pickup and trusted engine-speed state are mandatory for ignition scheduling.
* TPS is mandatory for normal mapped operation, but invalid TPS uses the fixed
  70 percent fallback for limited operation.
* EGT is not mandatory for basic operation; failure disables EGT-dependent
  protection and requests conservative limited operation.
* Water temperature is not mandatory until explicitly configured as mandatory;
  failure disables dependent adaptation and may request conservative limits.
* Knock is not mandatory; failure disables adaptive knock correction and learned
  positive advance in the ECU strategy.
* Quick shifter is optional; failure ignores quick-shift requests.
* Map switch is optional; failure selects the hardcoded safe default map.

This matches the existing fallback language and avoids turning optional
features into startup blockers.

## Decision 12 - Buffering and overflow policy classes

Selected option 1.

Use a small set of policy classes by data criticality:

* Pickup capture: bounded timestamp-ordered event path; overflow is a serious
  timing fault and makes crank reference untrusted until recovery.
* Latest-value readings: overwrite latest snapshot, increment sequence and let
  consumers detect missed updates.
* Quick-shifter requests: preserve validated request events; when full, reject
  new request and publish overflow diagnostic.
* Map-switch changes: coalesce repeated changes and keep latest stable state.
* Knock records: bounded per-revolution stream; under backlog, drop sensor-side
  feature-processing records, count drops and publish degraded knock data.
* Fault transitions: coalesce repeated identical transitions with count and
  first/last timestamp.
* Telemetry and diagnostic streams: best effort; drop, decimate or batch
  without blocking engine-critical producers.

Pickup, latest analog readings, rider requests, knock records and telemetry do
not have the same loss semantics, so they should not share one queue policy.

---

# Decisions Still Outside This Queue

The following remain unresolved because they are calibration, hardware
selection, engine-control or UI-policy decisions rather than sensor macro-area
architecture:

* Final TPS electrical diagnostic margins, sample rate and filter constants.
* Final degraded-mode RPM, load and ignition limits.
* Final EGT warning, derating and shutdown thresholds.
* Final water-temperature NTC model, installation location, thresholds and
  hysteresis.
* Final knock frequency, gain, crank-angle window, thresholds and authority.
* Final Web UI map-override persistence, cancellation and timeout behavior.
* Exact FreeRTOS task priorities, stack sizes, queue depths and timeout values.
