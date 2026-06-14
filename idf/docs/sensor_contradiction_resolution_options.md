# Sensor contradiction resolution options

This document lists the contradiction points found during the roadmap point
1-7 review and proposes two possible resolutions for each one.

Choose one option per item. After the choices are made, update the architecture
documents to match the selected resolutions and then reorganize the file
structure so each document has a clear purpose with minimal repetition.

Suggested response format:

```text
C1: A
C2: B
C2b: A
C3: A
C4: B
C5: A
C6: A
C7: B
```

---

# C1 - Battery voltage example versus current sensor scope

## Contradiction

The original roadmap uses battery voltage as an example slow analogue sensor,
while the current sensor specification covers water temperature instead.
Battery voltage is useful, but it is not part of the current sensor macro-area
scope.

## Option A - Keep battery voltage future-only

Rewrite roadmap examples so the current v1 scope is:

* TPS
* EGT
* Water temperature
* Pickup
* Quick shifter
* Map switch
* Knock

Battery voltage remains a future analogue input mentioned only as an extension
example.

Impact:

* Lowest scope increase.
* Keeps the sensor documents aligned with the current specification.
* Avoids adding a partial battery-voltage contract that is not implemented
  elsewhere.

## Option B - Add battery voltage to the sensor scope

Add battery voltage as an explicit input in the sensor architecture, including
classification, owner, data contract, failure behavior, fallback behavior and
tests.

Impact:

* Makes the original roadmap example real instead of removing it.
* Increases scope because battery voltage needs its own design matrix and
  failure policy.
* Useful if voltage diagnostics are required early for ECU safety or power
  stability.

---

# C2 - Knock records versus the common reading contract

## Contradiction

`KnockEventRecord` is not a normal latest-value `SensorReading<T>`, but the
architecture also says all published sensor data should share timing,
validity, health, quality and fault information.

## Option A - Keep `KnockEventRecord` as a sibling contract

Keep `SensorReading<T>` for latest-value readings and keep
`KnockEventRecord` as a separate event record. Require `KnockEventRecord` to
carry the same metadata vocabulary:

* Acquisition timestamp
* Sequence or revolution identifier
* Validity
* Health state
* Quality
* Fault bits or fault code

Impact:

* Models crank-synchronous knock behavior directly.
* Avoids forcing an event stream into a latest-value abstraction.
* Requires documentation to state clearly that metadata consistency does not
  imply identical container types.

## Option B - Create one generic publication envelope

Replace the distinction with a generic publication envelope, such as
`PublishedSensorData<T>`, then use transport type to distinguish latest values,
events and crank-synchronous records.

Impact:

* Gives every sensor output one top-level shape.
* Makes metadata handling more uniform.
* Risks hiding important semantic differences between latest-value snapshots,
  preserved events and per-revolution knock records.

---

# C2b - Knock "decision" wording risk

## Contradiction

Older knock wording includes "Knock decision", while the final ownership rule
says sensor-side knock processing must not own final ECU knock interpretation,
ignition authority or protection decisions.

## Option A - Rename the sensor-side field

Replace "Knock decision" with a non-authoritative field name such as:

* `threshold_result`
* `feature_classification`
* `sensor_knock_indicator`
* `candidate_knock_flag`

Document that ECU-level knock strategy owns the final decision and authority.

Impact:

* Strongest ownership boundary.
* Reduces risk that implementation gives sensor-side code control authority.
* Requires updating existing wording wherever "decision" appears.

## Option B - Keep the term but qualify it everywhere

Keep "Knock decision", but define it as a non-authoritative sensor-side
diagnostic result. Add explicit wording that it cannot request ignition retard,
protection, map selection or final knock state.

Impact:

* Less document churn.
* Preserves familiar signal-processing vocabulary.
* Higher ambiguity risk because "decision" can still be mistaken for control
  authority.

---

# C3 - Thermal protection language versus actuator ownership

## Contradiction

Thermal sections describe warning, derating and shutdown responses. This can be
misread as EGT or water-temperature sensor objects commanding actuators or
engine shutdown directly.

## Option A - Move final responses out of sensor documents

Keep sensor documents limited to:

* Readings
* Health
* Thermal states
* Protection requests
* Faults and fallback posture

Move final derating, inhibit, shutdown and actuator behavior to a safety or
engine-control document.

Impact:

* Cleanest ownership model.
* Reduces repetition between sensor and safety documents.
* Requires creating or updating a separate safety/engine-control protection
  document.

## Option B - Keep response lists but mark them consumer-owned

Leave the response lists in the sensor documents, but rewrite each section so
it says the sensor publishes a request or state and safety or engine control
owns the final action.

Impact:

* Keeps thermal intent close to the sensor specification.
* Less restructuring.
* More repetition, because final authority must be restated in every thermal
  section.

---

# C4 - EGT listed near analogue sensors but implemented as SPI converter path

## Contradiction

The roadmap originally groups EGT with slow analogue examples, but the selected
EGT design uses an AiM K-type thermocouple and MAX31856 SPI converter. EGT is
thermal, but it is not an ADC-owned analogue input in the same sense as TPS or
water-temperature NTC.

## Option A - Make EGT a dedicated SPI thermal path

Document EGT as owned by `ThermalSensorService` through
`ISpiMeasurementSource`, while TPS and water-temperature NTC use analogue ADC
paths.

Impact:

* Most precise hardware ownership.
* Avoids treating SPI converter diagnostics as analogue ADC behavior.
* Keeps EGT converter faults and thermocouple diagnostics explicit.

## Option B - Define thermal service as the primary grouping

Group EGT and water temperature under `ThermalSensorService`, and make the
service support multiple acquisition ports:

* `ISpiMeasurementSource` for EGT/MAX31856
* `IAnalogSampleSource` for water-temperature NTC

Impact:

* Strong thermal-domain coherence.
* Allows shared thermal trend, maximum and protection-state logic.
* Requires careful wording so service grouping does not imply identical
  hardware acquisition.

---

# C5 - Universal `ISensor::read()` versus capability-specific interfaces

## Contradiction

A universal `ISensor::read()` abstraction contradicts pickup edge capture,
quick-shifter events, map-switch state changes and crank-windowed knock
records.

## Option A - Ban universal sensor reads

Use only capability ports and typed domain contracts:

* `IAnalogSampleSource`
* `ISpiMeasurementSource`
* `IDigitalInputSource`
* `IEdgeCaptureSource`
* `IKnockWindowDevice`
* `SensorReading<T>`
* `SensorEvent<T>`
* `KnockEventRecord`

Impact:

* Best fit for different acquisition models.
* Keeps interfaces honest and testable.
* Requires more explicit types at boundaries.

## Option B - Keep a tiny common lifecycle/health interface

Do not create `read()`, but allow a narrow common interface for shared status,
such as:

* `initialize()`
* `health()`
* `last_fault()`
* `apply_config_generation()`

Actual data acquisition and publication remain capability-specific.

Impact:

* Gives common service code a small shared surface.
* Avoids pretending all sensors produce data the same way.
* Still needs strict rules so the lifecycle interface does not grow into a
  weak universal sensor base class.

---

# C6 - Runtime map switching versus unresolved activation and UI arbitration

## Contradiction

Map switching is permitted while the engine is running, but the safe activation
boundary and Web UI override arbitration are outside the sensor macro-area.
The physical map switch cannot own the effective active map by itself.

## Option A - Keep map input physical-only

Document `MapSwitchInput` as owning only the debounced physical request. Move
effective map selection, UI override, activation boundary and persistence to a
separate map-selection or configuration document.

Impact:

* Cleanest sensor ownership boundary.
* Prevents physical GPIO code from owning map strategy.
* Requires a follow-up map-selection architecture document before
  implementation.

## Option B - Define a minimal map-selection contract here

Keep the sensor document as the owner of physical switch qualification, but add
a minimal effective-map contract:

* Physical request
* UI request
* Effective active map
* Selection reason
* Safe default fallback

Leave persistence, timeout and cancellation as later Web UI policy.

Impact:

* Gives implementers enough structure for early map switching.
* Reduces the number of documents needed for a first version.
* Risks mixing sensor input ownership with map-management policy.

---

# C7 - Sensor failure behavior versus engine shutdown assumptions

## Contradiction

Sensor failures do not all imply engine shutdown. Pickup is mandatory for
ignition scheduling, TPS has a 70 percent fallback, and EGT, water temperature,
knock, quick shifter and map switch each have different degraded behaviors.

## Option A - Centralize fallback authority in safety and engine control

Keep each sensor responsible for publishing health, validity, fallback value or
protection request. Safety and engine control decide final inhibit, derating,
RPM/load limit and actuator behavior.

Impact:

* Strongest single-owner model for final engine behavior.
* Prevents individual sensors from independently changing actuator outputs.
* Requires safety and engine-control design to consume all fallback states.

## Option B - Add configurable operating profiles

Define profile-dependent mandatory behavior, for example:

* Development profile
* Dyno profile
* Race profile
* Production safety profile

Each profile decides which sensors are mandatory, optional or degraded-mode
only.

Impact:

* Handles cases where the same sensor should be optional in development but
  mandatory in production.
* Makes degraded-mode policy explicit and configurable.
* Adds configuration and test matrix complexity.
