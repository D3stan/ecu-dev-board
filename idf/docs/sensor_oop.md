# Sensor Execution Model and OOP Boundaries

This document implements phase 4 and phase 5 of the sensor-design roadmap.
It is derived from [sensors.md](sensors.md) and converts the sensor
specification into implementation-facing architecture decisions.

Phase 4 defines how inputs are grouped by execution model. Phase 5 defines the
high-level OOP boundaries that later firmware code should follow.

---

# Phase 4 - Sensors Grouped by Execution Model

## Design rule

The firmware shall not create one FreeRTOS task per sensor. A sensor object
represents domain behavior and state. A service represents execution ownership.

Task grouping shall be based on:

1. Activation source: interrupt, periodic timer, crank window, or operator input.
2. Priority and latency requirements.
3. Workload and stack requirements.
4. Blocking behavior.
5. Failure containment.
6. Whether the work must run in an engine-critical context.

## Execution groups

| Execution group | Inputs or work | Trigger | Timing class | Publication | State owner | Initial runtime decision |
| --- | --- | --- | --- | --- | --- | --- |
| Hardware ISR/callback | Pickup falling edge, digital edges, ADC/DMA ready signal, TPIC8101 ready signal | Peripheral interrupt or driver callback | Hard real-time, minimal work only | Raw timestamped event or service notification | Infrastructure acquisition adapter | No domain processing, logging, allocation or calibration in interrupt context |
| Pickup acquisition and engine speed | Pickup edge validation, pulse period, RPM, synchronization confidence | Pickup capture event | Highest sensor priority | Valid capture events plus latest engine-speed state | `PickupAcquisitionService` and `EngineStateEstimator` | Dedicated high-priority engine/pickup task or engine task phase |
| Analog sensor processing | TPS and future medium-rate analog inputs such as battery voltage | Periodic ADC acquisition | Medium-rate periodic | Latest timestamped reading | `AnalogSensorService` | One shared periodic analog service; no task per analog sensor |
| Thermal sensor processing | EGT and water temperature | Periodic converter or ADC read | Slow periodic | Latest temperature, trend, thermal state and health | `ThermalSensorService` | May initially share the analog service task if rates and blocking behavior fit |
| Digital input processing | Quick shifter and map switch | Edge notification plus stable-state scan | Time-sensitive for quick shifter, low-rate for map switch | Validated quick-shift events and stable map-switch state | `DigitalInputService` | Lightweight digital task or event handler; keep cut execution outside the input object |
| Knock window acquisition | TPIC8101 window control and result readout | Crank-synchronous window schedule | Deterministic crank-windowed | One knock-event record per enabled revolution | `KnockAcquisitionService` | Separate from analog processing; final task priority after measured workload |
| Knock signal processing | Background model, signal quality and normalized feature extraction | Knock-event records | Lower than pickup acquisition | Knock feature record and signal health | `KnockSignalProcessingService` | May run as separate lower-priority task when enabled; ECU strategy owns knock interpretation |
| Sensor health aggregation | Stale detection, fault aggregation, degraded-operation requests | Periodic health phase and fault transitions | Low/medium periodic | `SensorHealthSnapshot` and fault events | `SensorHealthService` | Can initially run as a periodic phase of the sensor service |
| Publication store | Coherent latest-value snapshots and event handoff | Service publication calls | Non-blocking boundary | `EngineInputSnapshot`, health snapshot and event queues | `SensorDataStore` | Single writer per published field; consumers receive copies or immutable views |

## Per-input mapping

| Input | Execution group | Publication model | Notes from `sensors.md` |
| --- | --- | --- | --- |
| Pickup | Pickup acquisition and engine speed | Preserve every valid capture event; publish latest RPM and synchronization state | Falling edge only; one event per revolution; invalid crank reference inhibits ignition scheduling |
| TPS | Analog sensor processing | Latest validated throttle value | Periodic ADC; independent from pickup timing; invalid value publishes fault and uses 70% fallback for limited operation |
| EGT | Thermal sensor processing | Latest temperature, trend and thermal state | Slow thermal measurement; protection thresholds require dyno validation |
| Water temperature | Thermal sensor processing | Latest temperature, trend and thermal state | Publishes protection state; sensor failure should not by itself imply overheating |
| Quick shifter | Digital input processing | Preserve every validated request and publish current stable state | Edge/state acquisition with debounce, duration validation and eligibility outside the input object |
| Map switch | Digital input processing | Latest stable selection plus map-change event | Physical switch state is separate from UI override and effective active map |
| Knock | Knock acquisition and signal processing | One crank-synchronous knock-event record per enabled revolution | Normal path reads TPIC8101 integrated result, not a raw waveform block |

## Initial service set

The sensor subsystem shall start with these service boundaries:

| Service | Owns | Writes to | May notify |
| --- | --- | --- | --- |
| `PickupAcquisitionService` | Pickup capture validation and capture history | Pickup event queue and engine-speed state | Engine control, safety, telemetry |
| `EngineStateEstimator` | Derived RPM, acceleration and synchronization confidence | Engine-speed reading inside `EngineInputSnapshot` | Engine control and safety |
| `AnalogSensorService` | TPS state and future fast/medium analog state | Latest analog readings in `SensorDataStore` | Sensor health and telemetry |
| `ThermalSensorService` | EGT and water-temperature state | Latest thermal readings and thermal protection state | Safety, telemetry and diagnostics |
| `DigitalInputService` | Quick-shifter state and map-switch physical state | Digital state snapshot and validated events | Quick-shift strategy, map selector and telemetry |
| `KnockAcquisitionService` | TPIC8101 window scheduling and result acquisition | Knock-event records | Knock signal processing and telemetry |
| `KnockSignalProcessingService` | Background model, signal quality and normalized feature extraction | Knock feature record and signal health | ECU knock strategy, diagnostics and telemetry |
| `SensorHealthService` | Aggregated stale/fault/degraded state | `SensorHealthSnapshot` and fault events | Safety, telemetry and diagnostics |
| `SensorDataStore` | Published latest values and snapshot generation | Immutable snapshots and event queues | Engine control, safety, telemetry and logging |

This service set does not imply the same number of FreeRTOS tasks. Initial
firmware may combine `AnalogSensorService`, `ThermalSensorService` and
`SensorHealthService` into one periodic sensor task. Pickup processing remains
separate from slow sensor processing. Knock acquisition remains separate from
generic analog processing because it is crank-windowed and TPIC8101-specific.

## Single-writer ownership

Every mutable sensor state has exactly one owner:

| Mutable state | Writer | Readers |
| --- | --- | --- |
| Pickup pulse history | `PickupAcquisitionService` | `EngineStateEstimator`, telemetry diagnostics |
| RPM and synchronization state | `EngineStateEstimator` | Engine control, safety, telemetry |
| TPS filtered value, calibration state and fault state | `AnalogSensorService` through `TpsSensor` | Engine control, safety, telemetry |
| EGT and water-temperature thermal state | `ThermalSensorService` | Safety, engine-control limiters, telemetry |
| Quick-shifter debounce and re-arm state | `DigitalInputService` through `QuickShifterInput` | Quick-shift eligibility and telemetry |
| Map-switch physical state | `DigitalInputService` through `MapSwitchInput` | Map selector and telemetry |
| Knock acquisition window and latest raw result | `KnockAcquisitionService` | `KnockSignalProcessingService`, diagnostics |
| Knock background, signal quality and normalized feature state | `KnockSignalProcessingService` | ECU knock strategy, diagnostics, telemetry |
| Published snapshots | `SensorDataStore` | Engine control, safety, telemetry, logging |

Consumers shall not mutate sensor internals. They shall consume events, copies,
or immutable snapshots.

---

# Phase 5 - High-Level OOP Boundaries

## Boundary rule

Classes shall be organized around boundaries and capabilities, not around a
single universal `Sensor` base class. There shall be no mandatory
`ISensor::read()` abstraction because pickup edges, quick-shifter events, TPS
values and TPIC8101 knock records do not share the same behavior.

## Layer responsibilities

| Layer | Responsibility | Examples |
| --- | --- | --- |
| Hardware acquisition ports | Describe hardware capabilities without ECU meaning | `IAnalogSampleSource`, `ISpiMeasurementSource`, `IDigitalInputSource`, `IEdgeCaptureSource`, `IKnockWindowDevice`, `ITimeSource` |
| Sensor-domain objects | Convert raw hardware data into domain readings, events and health | `TpsSensor`, `EgtSensor`, `WaterTemperatureSensor`, `PickupSensor`, `QuickShifterInput`, `MapSwitchInput`, `KnockSensor` |
| Processing policies | Reusable calibration, filtering, validation and recovery behavior | `TpsCalibration`, `ThermalTransferCurve`, `LowPassFilter`, `RangeValidator`, `RateOfChangeValidator`, `TimeoutValidator`, `DebouncePolicy` |
| Estimators and strategies | Derived values and decisions that are not physical sensors | `EngineStateEstimator`, `ThrottleRateEstimator`, `ThermalStateClassifier`, `KnockFeatureExtractor`, `QuickShiftEligibilityPolicy`, `SensorFallbackPolicy` |
| Acquisition services | Own execution context and coordinate one or more sensor-domain objects | `AnalogSensorService`, `ThermalSensorService`, `DigitalInputService`, `PickupAcquisitionService`, `KnockAcquisitionService` |
| Publication boundary | Provide stable data contracts to engine, safety and telemetry consumers | `SensorDataStore`, `EngineInputSnapshot`, `SensorHealthSnapshot`, event queues |

## Hardware acquisition interfaces

Hardware interfaces shall expose what the hardware can produce, not what the
input means to the ECU.

| Interface | Produces | Must not contain |
| --- | --- | --- |
| `IAnalogSampleSource` | ADC code or millivolt sample with acquisition timestamp and hardware status | TPS calibration, throttle percent, thermal state |
| `ISpiMeasurementSource` | Digital converter result, timestamp and communication status | EGT transfer interpretation, thermal protection state |
| `IDigitalInputSource` | Digital level, edge type and timestamp | Quick-shift eligibility, map arbitration |
| `IEdgeCaptureSource` | Edge timestamp, polarity and capture status | RPM, synchronization, ignition scheduling |
| `IKnockWindowDevice` | TPIC8101 configuration status, window control and integrated result | Knock decision policy, ignition correction |
| `ITimeSource` | Common monotonic timestamp | Sensor-specific stale decisions |

ESP-IDF drivers live behind these interfaces. Domain logic must remain testable
with simulated and replayed sources.

## Domain data contracts

All domain-facing readings shall carry timing and health information. The
common value vocabulary is:

| Type | Purpose |
| --- | --- |
| `TimestampUs` | Monotonic acquisition timestamp in microseconds |
| `SequenceCounter` | Detects updates and missed publications |
| `SensorHealthState` | `Uninitialized`, `Stabilizing`, `Valid`, `Degraded`, `Stale`, `Failed`, `Disabled` |
| `SensorQuality` | `Normal`, `Degraded`, `Implausible`, `Saturated`, `Stale` |
| `SensorFault` | Hardware, timeout, disconnected, calibration and plausibility faults |
| `SensorReading<T>` | Generic latest-value carrier for typed engineering values |
| `SensorEvent` | Timestamped event carrier for pickup, quick-shifter, map-switch and fault transitions |

Typed engineering values remain domain-specific:

| Value type | Used by |
| --- | --- |
| `ThrottlePosition` in permille | TPS, engine load and telemetry |
| `TemperatureCelsius` | EGT, water temperature and thermal protection |
| `EngineSpeedState` | RPM, pulse period, acceleration and synchronization confidence |
| `QuickShiftRequestEvent` | Quick-shift eligibility and ignition-cut strategy |
| `MapSelectionState` | Physical switch, UI override and effective map selection |
| `KnockEventRecord` | Knock signal processing, diagnostics and ECU knock strategy |

## Domain objects

| Object | Input dependency | Policy dependencies | Output |
| --- | --- | --- | --- |
| `TpsSensor` | Timestamped analog sample | TPS calibration, low-latency filter, range/rate/stuck validators, timeout validator | `SensorReading<ThrottlePosition>` and optional throttle-rate estimate |
| `EgtSensor` | Timestamped thermal converter or analog sample | EGT transfer curve, slow filter, range/rate/frozen validators, timeout validator | `SensorReading<TemperatureCelsius>` and EGT thermal state |
| `WaterTemperatureSensor` | Timestamped analog NTC temperature sample | NTC transfer curve, thermal thresholds, hysteresis, range/rate/frozen validators | `SensorReading<TemperatureCelsius>` and water thermal state |
| `PickupSensor` | Timestamped edge capture | Polarity, minimum interval, pulse plausibility and timeout rules | Validated pickup capture event |
| `EngineStateEstimator` | Validated pickup capture events | RPM range and acceleration plausibility rules | `EngineSpeedState` |
| `QuickShifterInput` | Timestamped digital level/edge | Polarity, debounce, duration and stuck-input validators | Stable state and `QuickShiftRequestEvent` |
| `MapSwitchInput` | Timestamped digital level | Polarity and debounce policy | Physical map-selection state and change event |
| `KnockSensor` | TPIC8101 window result | TPIC configuration, missing/stuck/saturation validators | `KnockEventRecord` |
| `KnockFeatureExtractor` | Knock event records and operating context | Background model, signal-quality checks and normalization rules | Knock feature record and signal health |

Domain objects shall not trigger CDI output, command actuators, write persistent
storage, communicate with the Web UI or own FreeRTOS tasks.

## Acquisition services

Services own scheduling and coordinate domain objects:

| Service | Execution ownership | Domain objects coordinated |
| --- | --- | --- |
| `PickupAcquisitionService` | Pickup capture queue or notification loop | `PickupSensor`, `EngineStateEstimator` |
| `AnalogSensorService` | Periodic ADC cycle | `TpsSensor` and future medium-rate analog sensors |
| `ThermalSensorService` | Periodic thermal cycle | `EgtSensor`, `WaterTemperatureSensor` |
| `DigitalInputService` | Edge notifications plus debounce scan | `QuickShifterInput`, `MapSwitchInput` |
| `KnockAcquisitionService` | Crank-windowed TPIC8101 control | `KnockSensor` |
| `KnockSignalProcessingService` | Lower-priority knock-event processing | `KnockFeatureExtractor` |
| `SensorHealthService` | Periodic stale/fault aggregation | Health states from all sensor services |

## Publication boundary

The publication boundary is the only supported consumer interface for engine
control, safety, telemetry, diagnostics and logging.

`SensorDataStore` shall provide:

* `EngineInputSnapshot`: latest usable engine-facing values with per-input
  timestamps, validity, quality, health and sequence numbers.
* `SensorHealthSnapshot`: aggregate health and fault state for safety,
  telemetry and diagnostics.
* Event delivery for pickup captures, quick-shifter requests, map-change
  requests, knock records and sensor fault transitions.

Telemetry shall read published snapshots. Engine control shall read published
snapshots and subscribed events. Neither shall pull fresh values directly from
hardware drivers.

## Dependency direction

The intended dependency direction is:

```text
ESP-IDF concrete drivers
    -> hardware acquisition interfaces
    -> sensor-domain objects and processing policies
    -> acquisition services and estimators
    -> SensorDataStore snapshots and event queues
    -> engine control, safety, telemetry and diagnostics
```

Dependencies shall not point upward. For example:

* `TpsSensor` shall not know about ignition maps, Web UI, telemetry JSON or NVS.
* `PickupSensor` shall not schedule spark output.
* `QuickShifterInput` shall not directly disable CDI output.
* Sensor-side knock processing publishes feature records and signal health only;
  ECU strategy owns knock interpretation, protection requests and final ignition
  limiting.
* Hardware acquisition adapters shall not apply sensor-domain calibration.
