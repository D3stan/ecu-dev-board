## Roadmap for the sensor-design phase

1. **Inventory the inputs** and classify each by signal type, timing requirements and safety importance.
2. **Define the data contract**: what a sensor produces beyond a number—timestamp, validity, units, quality and faults.
3. **Separate acquisition from interpretation**: hardware sampling, filtering/calibration and engine-domain meaning should be different responsibilities.
4. **Group sensors by execution model**, not one FreeRTOS task per sensor. Implemented in [sensor_execution_oop.md](sensor_execution_oop.md#phase-4---sensors-grouped-by-execution-model).
5. **Define the high-level OOP boundaries**: hardware interfaces, sensor objects, processing policies, acquisition services and published snapshots. Implemented in [sensor_execution_oop.md](sensor_execution_oop.md#phase-5---high-level-oop-boundaries).
6. **Define ownership and communication** between interrupts, tasks, engine control, safety and telemetry.
7. **Design failure behaviour and testability** before implementing drivers.
8. Only after these decisions, create the final class diagram, task matrix and implementation backlog.

---

# 1. Start by redefining what “sensor” means

The inputs listed in your ECU specification are not all the same kind of sensor:

* Pickup
* TPS
* Knock sensor
* EGT
* Quick shifter
* Map switches and other digital inputs 

They require fundamentally different acquisition models.

| Family                           | Inputs                    | Behaviour                                                        |
| -------------------------------- | ------------------------- | ---------------------------------------------------------------- |
| **Timing reference**             | Pickup                    | Asynchronous edge with precise timestamp                         |
| **Periodic analog measurements** | TPS, EGT, battery voltage | Sampled periodically, calibrated and filtered                    |
| **High-bandwidth signal**        | Knock sensor              | Continuous or windowed acquisition followed by signal processing |
| **Asynchronous digital event**   | Quick shifter, switches   | Edge or state change with debounce and validation                |
| **Derived engine values**        | RPM, acceleration, phase  | Calculated from other inputs rather than directly sampled        |

This classification should drive both your OOP design and your FreeRTOS design.

A single generic `Sensor` abstraction with a method conceptually equivalent to “read value” would be too weak. Reading TPS, receiving a pickup timestamp and processing a knock waveform are not the same operation.

---

# 2. First design questions

Before defining classes, I would ask these questions.

## Which sensors belong in the first working milestone?

My suggested order is:

1. **TPS**
2. **A slow analog sensor**, such as EGT or battery voltage
3. **Quick shifter or another digital input**
4. **Pickup capture and RPM calculation**
5. **Knock acquisition last**

This gives you progressively different acquisition models without starting with the most complex signal.

There is an argument for starting with the pickup because it is central to the ECU. However, pickup processing immediately introduces precise capture timing, interrupt affinity, RPM validation and engine synchronization. TPS is a simpler place to establish the sensor architecture itself.

A practical first sensor milestone could therefore be:

* One analog acquisition path.
* Calibration.
* Filtering.
* Validity detection.
* Timestamped publication.
* Consumption by a diagnostic or telemetry component.
* Simulated input for tests.

Once that structure works, apply the same architectural principles to the other sensor families.

---

## Does every sensor need every raw sample preserved?

Probably not.

For each sensor, decide whether consumers need:

* Only the latest valid value.
* Every acquired sample.
* An accumulated statistic.
* Only significant events.
* A block of samples.

Examples:

| Sensor          | Likely publication model                                                          |
| --------------- | --------------------------------------------------------------------------------- |
| TPS             | Latest filtered value                                                             |
| EGT             | Latest filtered value                                                             |
| Battery voltage | Latest filtered value plus minimum                                                |
| Pickup          | Every valid timing event, or latest period plus event notification                |
| Quick shifter   | Every validated activation event                                                  |
| Knock           | Blocks or computed knock metrics, not individual raw samples for normal consumers |

This decision affects whether you need snapshots, queues, notifications or stream buffers.

---

## Must acquisition be synchronized with the engine cycle?

The current project description says the pickup event should be followed by immediate RPM and TPS ADC acquisition.  I would question this design.

TPS normally does not need to be physically sampled at the exact pickup instant. A better default is:

* TPS is sampled continuously or periodically.
* The latest timestamped and validated TPS value is published.
* Engine control takes a consistent snapshot when processing a pickup event.

This avoids coupling analog acquisition latency to ignition timing.

Engine-synchronous sampling may still be useful for particular signals, but it should be a deliberate requirement rather than the default architecture.

---

## What does “valid TPS” mean?

A sensor design needs more than minimum and maximum voltage.

For TPS, for example:

* What voltage means closed throttle?
* What voltage means full throttle?
* What electrical range is physically plausible?
* How quickly can the value plausibly change?
* What happens if the signal becomes disconnected?
* What happens if the ADC saturates?
* Is calibration fixed at manufacturing time or user-adjustable?
* Is there a default calibration?
* What value does engine control use when TPS is invalid?
* How long can the last valid value remain usable?

These decisions belong in the sensor contract before implementation.

---

# 3. Define the data contract before the classes

A sensor should not publish only a primitive number such as `37.2`.

A domain-level sensor reading should conceptually contain:

| Field                            | Purpose                                                  |
| -------------------------------- | -------------------------------------------------------- |
| **Value**                        | Calibrated engineering value                             |
| **Unit or fixed representation** | Degrees, millivolts, permille, RPM, etc.                 |
| **Timestamp**                    | When the physical measurement was taken                  |
| **Validity**                     | Whether the value may be used for control                |
| **Quality**                      | Normal, degraded, stale, implausible, saturated          |
| **Source status**                | Hardware error, timeout, disconnected, calibration error |
| **Sequence or generation**       | Allows consumers to detect updates or missed data        |

This data structure becomes the contract between sensor processing and the rest of the ECU.

## Separate three representations

For each analog sensor, distinguish:

### Raw sample

What the hardware produced:

* ADC count.
* Capture timestamp.
* Digital level.
* DMA sample block.

### Physical measurement

The hardware value converted into physical meaning:

* Voltage.
* Resistance.
* Temperature.
* Throttle position.
* Pulse period.

### Control-domain value

The representation used by engine strategies:

* TPS from 0 to 1000 permille.
* Temperature with validity and derating state.
* RPM with confidence.
* Knock intensity for the current combustion window.

This separation avoids putting calibration details into engine-control logic.

---

# 4. Proposed high-level OOP layers

I would divide the sensor area into five layers.

## Layer 1 — Hardware acquisition interfaces

These interfaces describe what the hardware can do, not what the sensor means.

Possible conceptual interfaces:

* `IAnalogAcquisition`
* `IDigitalInput`
* `IEdgeCapture`
* `ISampleStream`
* `ITimeSource`

Their responsibility is limited to questions such as:

* Acquire a sample.
* Start or stop acquisition.
* Report a captured edge.
* Provide a sample block.
* Supply timestamps.
* Report hardware-level errors.

They should not know what TPS, EGT or knock means.

This layer is the boundary between ESP-IDF drivers and the rest of the application.

---

## Layer 2 — Sensor-domain objects

These classes represent real ECU inputs:

* `TpsSensor`
* `EgtSensor`
* `BatteryVoltageSensor`
* `PickupSensor`
* `QuickShifterInput`
* `KnockSensor`

Their responsibilities would be:

* Interpret hardware data.
* Apply calibration.
* Apply sensor-specific validation.
* Maintain sensor-specific health state.
* Produce a domain-level reading.

A `TpsSensor` knows what closed throttle, full throttle and plausible movement mean. The underlying ADC acquisition object does not.

A `PickupSensor` knows about pulse periods and plausibility. It should not know the ignition map or CDI output timing.

---

## Layer 3 — Processing policies

Filtering, calibration and validation should generally be composed into sensor objects rather than inherited from a large base sensor class.

Conceptual policies include:

* `CalibrationPolicy`
* `FilterPolicy`
* `RangeValidator`
* `RateOfChangeValidator`
* `TimeoutValidator`
* `DebouncePolicy`
* `FaultRecoveryPolicy`

This provides flexibility without creating an inheritance tree such as:

```text
Sensor
 └── AnalogSensor
      └── FilteredAnalogSensor
           └── CalibratedFilteredAnalogSensor
                └── TPS
```

That hierarchy would become difficult to evolve.

Composition is more appropriate:

```text
TPS sensor
 ├── analog acquisition dependency
 ├── TPS calibration
 ├── TPS filter
 └── TPS validation rules
```

---

## Layer 4 — Acquisition services

A service owns an execution context and coordinates one or more sensor objects.

Initial service candidates:

* `AnalogSensorService`
* `DigitalInputService`
* `PickupAcquisitionService`
* `KnockAcquisitionService`
* `SensorHealthService`

These are the classes most likely to own or be associated with FreeRTOS tasks.

The important distinction is:

> Sensors represent data and behaviour; services represent scheduled execution.

A `TpsSensor` does not require its own task. The analog service may acquire and process TPS, EGT and battery voltage together.

---

## Layer 5 — Sensor publication and access

Consumers should not directly call acquisition drivers or inspect mutable sensor internals.

Introduce a publication boundary such as:

* `SensorSnapshot`
* `EngineInputSnapshot`
* `SensorRepository`
* `SensorDataStore`

I would favour immutable snapshots for control consumers.

An engine-input snapshot might conceptually contain:

* TPS reading.
* RPM and timing state.
* EGT reading.
* Quick-shifter state.
* Knock metric.
* Battery voltage.
* Global timestamp.
* Per-input validity flags.
* Snapshot generation.

Consumers include:

* Engine-control logic.
* Safety logic.
* Actuator strategies.
* Telemetry.
* Diagnostics.
* Logging.

Telemetry should read published data. It should never ask the TPS hardware driver for a fresh sample.

---

# 5. Do not create one universal sensor interface

It is tempting to create:

```text
ISensor
- initialize
- read
- getValue
```

This works only for simple periodic sensors.

It does not naturally model:

* Pickup edge capture.
* Knock sample streams.
* Quick-shifter events.
* Sensors with multiple outputs.
* DMA acquisition.
* Derived values such as RPM.

A better approach is to define interfaces around **capabilities and boundaries**.

## Hardware capabilities

* Analog sampling.
* Digital state.
* Edge capture.
* Sample streaming.
* Time source.

## Domain-facing capabilities

* Latest measurement provider.
* Event source.
* Sample-block consumer.
* Health provider.
* Calibratable sensor.

A sensor can support the capabilities it genuinely needs.

For example:

| Class         | Relevant capabilities                         |
| ------------- | --------------------------------------------- |
| TPS           | Latest measurement, health, calibration       |
| EGT           | Latest measurement, health, calibration       |
| Pickup        | Timing-event source, RPM measurement, health  |
| Quick shifter | Event source, current state, health           |
| Knock         | Sample-block processing, knock metric, health |

This avoids forcing unrelated objects through the same abstraction.

---

# 6. FreeRTOS design: tasks by acquisition model

The sensor design should not initially produce one task per class.

A reasonable target is:

| Execution context                               | Sensors/work                                                                  |
| ----------------------------------------------- | ----------------------------------------------------------------------------- |
| **Hardware ISR/callback**                       | Capture timestamps, acknowledge hardware, store minimal raw data, notify task |
| **Analog sensor task**                          | TPS, EGT, battery and other low/medium-rate analog processing                 |
| **Digital input task or event handler**         | Quick shifter, switches and debounced digital inputs                          |
| **Pickup/engine task**                          | Consume capture events, validate timing and derive RPM                        |
| **Knock task**                                  | Process high-rate blocks and calculate knock metrics                          |
| **Sensor health task or periodic health phase** | Detect stale and failed inputs                                                |

You may initially combine analog, digital and health processing into one `SensorService` task. They can be split later when their rates or priorities justify it.

## Questions for task decomposition

For each possible task, ask:

1. Does it need a different priority?
2. Does it block on a different hardware event?
3. Does it have a significantly different frequency?
4. Could its workload delay a critical sensor?
5. Does it require a large stack?
6. Does it belong on a different core?
7. Would separating it make failure containment easier?

If most answers are no, it probably does not need a separate task.

---

# 7. Suggested initial FreeRTOS ownership model

## Core 1

Likely owners:

* Pickup capture and derived RPM.
* Engine-facing sensor snapshot.
* Fast analog processing needed by engine control.
* Quick-shifter event processing.

## Core 0

Likely consumers:

* Telemetry.
* Web UI.
* Display.
* Persistent calibration storage.
* Diagnostic logs.

Knock processing should be assigned only after its computational load and timing requirements are measured. It may justify a dedicated task, but it should not initially be allowed to delay pickup or ignition processing.

## Single-writer principle

Every mutable sensor state should have one owner.

For example:

* Analog service owns TPS internal state.
* Pickup service owns pulse history and RPM state.
* Knock service owns knock processing state.
* Sensor repository owns snapshot publication.

Other tasks should consume copies or immutable views.

This is much easier to reason about than several tasks locking and modifying the same sensor objects.

---

# 8. Interrupt responsibility

Interrupts and driver callbacks should belong to the acquisition layer, not directly to domain sensor classes or engine strategies.

Their responsibilities should be limited to:

* Capture raw event data.
* Timestamp it.
* Detect immediate hardware overflow where necessary.
* Place it in a preallocated transfer structure.
* Notify the owning service.

They should not perform:

* General calibration.
* Complex filtering.
* Logging.
* Web telemetry.
* Persistent storage.
* Configuration changes.
* High-level engine decisions.

For the pickup, a hardware callback could publish a timing event to the pickup or engine service.

For the quick shifter, it could publish a digital edge event.

For analog DMA, it could announce that a sample block is ready.

The same architectural rule applies even though the underlying peripherals are different.

---

# 9. Sensor health must be part of the original design

Do not add diagnostics after the normal value path has been completed.

Each sensor needs a state model such as:

```text
UNINITIALIZED
CALIBRATING
VALID
DEGRADED
STALE
FAILED
DISABLED
```

The exact states can be simplified, but the design needs to answer:

* When does a sensor become valid after startup?
* How many valid samples are required?
* How is an isolated bad sample handled?
* When does repeated invalid data become a fault?
* Can the sensor automatically recover?
* Is a fault latched?
* What fallback does engine control use?
* Is engine operation still allowed?

## Example fallback questions

### TPS failure

* Use a fixed conservative map?
* Use RPM-only ignition?
* Limit engine speed?
* Inhibit auxiliary actuators?
* Stop the engine?

### EGT failure

* Continue without temperature correction?
* Apply a conservative derating?
* Warn only?
* Stop after exceeding a timeout?

### Pickup failure

* Immediately inhibit ignition?
* How quickly?
* What constitutes a missing pulse while cranking versus while running?

### Knock failure

* Disable active knock correction?
* Apply a fixed conservative retard?
* Continue with the base map?

These are domain decisions, but they affect the sensor interface because validity and fault information must be available to consumers.

---

# 10. Calibration ownership

Calibration should not be mixed with raw hardware acquisition.

You need to decide whether calibration belongs to:

* The sensor-domain object.
* A separate calibration object used by the sensor.
* A central calibration repository.
* A combination of sensor-specific calibration and central persistence.

My preferred division is:

| Responsibility                      | Owner                                           |
| ----------------------------------- | ----------------------------------------------- |
| Calibration meaning and validation  | Sensor-domain object or sensor calibration type |
| Active calibration values in RAM    | Sensor service or configuration repository      |
| Loading and storing calibration     | Configuration/storage service                   |
| Applying calibration to raw samples | Sensor-domain object                            |
| Updating calibration while running  | Controlled configuration transaction            |

The ADC driver should not know that two voltage values represent closed and open throttle.

---

# 11. Filtering questions

Do not select filters before defining what problem you are solving.

For every sensor, ask:

* Is the noise random, periodic or caused by electrical interference?
* Must step changes be preserved?
* What delay is acceptable?
* What maximum rate of change is physically possible?
* Is the filter used for control, telemetry or both?
* Should control and telemetry use different filtered values?
* What happens when samples are missing?
* Should filtering reset after a fault?

## Likely differences

### TPS

Needs useful responsiveness with noise rejection. Excessive filtering would delay detection of rapid throttle movement.

### EGT

Can generally tolerate much slower filtering.

### Battery voltage

May need both a filtered normal value and rapid undervoltage detection.

### Pickup

Usually needs edge validation rather than conventional averaging.

### Quick shifter

Needs debounce and duration validation rather than an analog low-pass filter.

### Knock

Needs frequency-domain or band-limited processing and engine-position windowing. It is a separate signal-processing subsystem.

A generic `LowPassFilter` inside every sensor would therefore not be sufficient as the sensor architecture.

---

# 12. Time and synchronization model

All sensor data should use a common monotonic time source.

You need to decide:

* Timestamp at hardware acquisition or after task processing?
* Timestamp units?
* Timestamp resolution?
* Wraparound strategy?
* How consumers compare timestamps?
* How stale thresholds are represented?
* Whether pickup capture time and ADC sample time are directly comparable?

The acquisition timestamp is normally the important one.

A TPS sample processed 500 microseconds later should still carry the time at which it was acquired, not merely the time at which the FreeRTOS task processed it.

## Consistent snapshots

An engine-control cycle might require:

* Current pickup timestamp.
* Most recent TPS reading.
* Most recent EGT reading.
* Current quick-shifter state.
* Sensor validity.

Those values will not normally have identical timestamps. The snapshot should therefore preserve individual timestamps and validity information rather than pretending that all values were sampled simultaneously.

---

# 13. Derived sensors and estimators

RPM should not necessarily be modelled as a physical sensor.

The pickup hardware provides timestamped edges. An estimator derives:

* Pulse period.
* RPM.
* Acceleration or deceleration.
* Engine-running state.
* Confidence.
* Possibly phase information.

This suggests separating:

* `PickupSensor` or `PickupCapture`: interprets the electrical pulse.
* `EngineSpeedEstimator`: converts valid pulse timing into RPM and related state.

The same principle applies elsewhere:

* Throttle-rate is derived from TPS history.
* Thermal state may combine EGT and operating duration.
* Knock status is derived from signal blocks and engine position.

Derived values should not be hidden inside hardware drivers.

---

# 14. Recommended conceptual class map

A first high-level model could look like this:

```text
EcuApplication
│
├── SensorSubsystem
│   ├── AnalogSensorService
│   │   ├── TpsSensor
│   │   ├── EgtSensor
│   │   └── BatteryVoltageSensor
│   │
│   ├── DigitalInputService
│   │   ├── QuickShifterInput
│   │   └── MapSwitchInput
│   │
│   ├── PickupAcquisitionService
│   │   ├── PickupSensor
│   │   └── EngineSpeedEstimator
│   │
│   ├── KnockAcquisitionService
│   │   ├── KnockSensor
│   │   └── KnockAnalyzer
│   │
│   └── SensorDataStore
│       ├── EngineInputSnapshot
│       └── SensorHealthSnapshot
│
├── EngineControlService
├── SafetyService
├── TelemetryService
└── ConfigurationService
```

This is not intended as the final class diagram. It is a starting responsibility model.

The likely stable dependencies are:

```text
ESP-IDF hardware drivers
        ↓
Hardware acquisition interfaces
        ↓
Sensor-domain objects and estimators
        ↓
Acquisition services
        ↓
Immutable snapshots
        ↓
Engine control / safety / telemetry
```

Dependencies should not point back upward.

For example, `TpsSensor` should not know about the Web UI or ignition map.

---

# 15. Where interfaces are actually useful

Do not create an interface for every class merely because the design is OOP.

Interfaces are especially useful at these boundaries:

## Hardware replacement boundary

Allows the same sensor-domain object to receive data from:

* Real ESP32 hardware.
* A simulated source.
* A HITL source.
* A recorded sample stream.

## Time boundary

A time-source interface allows deterministic tests without real time.

## Storage/configuration boundary

Allows calibration to come from production storage, defaults or tests.

## Publication boundary

Allows engine control to consume sensor snapshots without knowing the acquisition details.

## Signal-processing strategy boundary

Useful when filters or validators may genuinely vary between configurations.

Concrete classes are sufficient when no meaningful substitution or test seam exists.

---

# 16. Testability should influence the interfaces

Your project includes JTAG, HITL and an external simulator.  The sensor architecture should explicitly support three data-source modes.

## Physical mode

Real hardware peripherals produce samples.

## Simulated mode

Software-provided samples exercise sensor logic on a development machine or embedded target.

## Replay mode

Previously recorded sensor data is reproduced with controlled timing.

This means the domain sensor and estimator classes should not depend directly on ESP-IDF types.

For example, the TPS interpretation logic should be testable with a sequence of abstract raw samples:

* Normal sweep.
* Disconnection.
* Short to ground.
* Short to supply.
* Noisy idle.
* Rapid opening.
* Calibration outside the expected range.

The ESP-IDF-specific acquisition component is then tested separately.

---

# 17. Design document to create for every sensor

Before classes are finalized, complete one row per sensor:

| Property              | Question                                      |
| --------------------- | --------------------------------------------- |
| Name                  | What is the physical input?                   |
| Purpose               | Which control or diagnostic functions use it? |
| Electrical type       | Analog, digital, frequency, waveform?         |
| Acquisition model     | Periodic, edge-driven, DMA stream?            |
| Sampling requirement  | How often or under which event?               |
| Timestamp requirement | What precision is needed?                     |
| Raw representation    | What does the hardware produce?               |
| Engineering unit      | What does the sensor publish?                 |
| Calibration           | Which parameters are required?                |
| Filtering             | What noise must be rejected?                  |
| Plausibility          | Which values and transitions are impossible?  |
| Stale timeout         | How old may the value become?                 |
| Startup behaviour     | When does it first become valid?              |
| Fault behaviour       | What happens when it fails?                   |
| Consumers             | Engine, safety, telemetry, actuator control?  |
| Publication model     | Latest value, event, sample block?            |
| Required task context | Which service owns it?                        |
| Test strategy         | Simulation, replay, injected faults?          |

This matrix is the main design input for the eventual class diagram.

---

# 18. Recommended scope of the first macro-area iteration

For the first complete sensor-area iteration, I would include:

## In scope

* One analog acquisition service.
* TPS as the first real domain sensor.
* A generic slow analog sensor, preferably battery voltage or EGT.
* Calibration and validation concepts.
* Timestamped readings.
* Sensor-health states.
* Immutable sensor snapshot.
* Telemetry consumption of the snapshot.
* Simulated acquisition source.
* Defined startup and failure behaviour.

## Explicitly postponed

* Full knock detection.
* Engine-synchronous ADC sampling.
* Adaptive filtering.
* Calibration persistence transactions.
* Cross-sensor plausibility.
* Complex engine-state estimation.
* Redundant sensors.
* Runtime reconfiguration while the engine is running.

This produces an end-to-end vertical slice without attempting every input simultaneously.

---

# 19. Decisions I would make now

Unless later requirements contradict them, I would establish these initial rules:

1. **No task per sensor.**
2. **No universal `ISensor::read()` abstraction.**
3. **Hardware acquisition and sensor meaning are separate layers.**
4. **Each mutable sensor state has one owner.**
5. **Engine control consumes snapshots, not hardware drivers.**
6. **Every published reading contains timestamp and validity.**
7. **Calibration, filtering and validation are separate responsibilities.**
8. **Interrupts only transfer minimal raw events into task context.**
9. **Knock is treated as a separate subsystem.**
10. **TPS sampling is initially independent from pickup timing.**
11. **Domain processing remains independent of ESP-IDF to support simulation and HITL.**
12. **Fault and fallback behaviour are designed before implementation.**

The next useful design step is to fill the sensor matrix for **TPS first**, then apply the resulting model to EGT, quick shifter, pickup and finally knock.
