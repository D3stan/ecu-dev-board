# ECU Input and Sensor Subsystem Design Specification

## 1. Scope

This document defines the high-level classification and sensor-domain
requirements for the input subsystem of a custom ESP32-S3 ECU for
single-cylinder two-stroke engines.

The inputs covered are:

* Crankshaft pickup
* Throttle Position Sensor
* Knock-sensor subsystem
* Exhaust Gas Temperature sensor
* Water-temperature sensor
* Quick-shifter input
* Map-selection switch

This document is the per-sensor requirements source. Execution ownership,
class boundaries, FreeRTOS task grouping, communication, fallback authority,
testability and implementation backlog are defined in [sensor_oop.md](sensor_oop.md).

---

# 2. Requirements conventions

Each sensor section defines:

* Physical input and purpose
* Electrical or converter interface
* Acquisition model
* Published engineering value or event
* Calibration and filtering requirements
* Plausibility, startup, stale and fault behavior
* Consumers
* Test strategy

This document does not define FreeRTOS task ownership, class boundaries,
communication mechanisms, final safety authority or implementation backlog.
Those belong to [sensor_oop.md](sensor_oop.md).

---

# 3. Input classification summary

| Input             | Input family                          | Acquisition model                              | Primary publication                       | Engine synchronization                    | Domain owner                    | Acquisition port                |
| ----------------- | ------------------------------------- | ---------------------------------------------- | ----------------------------------------- | ----------------------------------------- | ------------------------------- | ------------------------------- |
| Pickup            | Timing reference                      | Hardware edge capture                          | Every valid edge and derived engine state | Defines synchronization                   | Pickup acquisition service      | Edge capture                    |
| TPS               | Periodic analogue measurement         | Periodic ADC acquisition                       | Latest validated throttle value           | Normally independent                      | Analogue sensor service         | Analogue sample                 |
| Knock             | Crank-windowed combustion measurement | TPIC8101 integration window and result readout | Knock measurement per enabled revolution  | Strongly synchronized                     | Knock acquisition service       | Knock window device            |
| EGT               | Slow thermal measurement              | Periodic digital converter reading             | Latest temperature and thermal state      | Independent                               | Thermal sensor service          | SPI measurement source         |
| Water temperature | Slow thermal measurement              | Periodic analogue NTC acquisition              | Latest temperature and thermal state      | Independent                               | Thermal sensor service          | Analogue sample                 |
| Quick shifter     | Asynchronous rider request            | Digital edge and state acquisition             | Validated shift request and current state | Not crank-synchronous, but time-sensitive | Digital input service           | Digital input                   |
| Map switch        | User strategy-selection input         | Digital state change or periodic scan          | Stable physical map request               | Independent                               | Digital input service           | Digital input                   |

---

# 4. Pickup subsystem

## 4.1 General classification

**Physical input family:** Conditioned crankshaft-position signal.

**Electrical source:** Inductive variable-reluctance pickup followed by external signal conditioning.

**Software-visible signal:** Digital square wave comparable to a Hall-sensor output.

**Relevant edge:** Falling edge only.

**Events per revolution:** One event per crankshaft revolution.

**Engine type:** Single-cylinder two-stroke only.

**Purpose:** Provide the primary crankshaft timing reference, engine-speed information and ignition-event reference.

The pickup identifies crank phase because its physical position is known and fixed at a calibrated angle before top dead centre. The precise trigger angle depends on the engine installation.

## 4.2 Sensor design matrix

| Property                      | Classification                                                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Name**                      | Crankshaft pickup and timing-reference subsystem                                                                                                       |
| **Purpose**                   | Determine crankshaft timing, calculate RPM and provide the reference for ignition and knock-window scheduling                                          |
| **Electrical type**           | Conditioned digital square wave originating from a VR pickup                                                                                           |
| **Acquisition model**         | Asynchronous hardware capture of each falling edge                                                                                                     |
| **Events per revolution**     | One                                                                                                                                                    |
| **Maximum speed**             | 25,000 RPM                                                                                                                                             |
| **Required angular accuracy** | Target overall timing accuracy of 0.1 crank degree                                                                                                     |
| **Timestamp requirement**     | Highest precision of all ECU inputs; the complete acquisition and scheduling error budget must satisfy the angular-accuracy requirement at maximum RPM |
| **Raw representation**        | Hardware timer count, falling-edge event and capture status                                                                                            |
| **Engineering values**        | Pulse period, RPM, crank reference time, acceleration estimate and synchronization state                                                               |
| **Calibration**               | Trigger angle before TDC, signal polarity and valid RPM range                                                                                          |
| **Filtering**                 | Hardware signal conditioning, edge qualification, minimum-pulse-interval rejection and timing plausibility checks                                      |
| **Plausibility**              | Reject duplicate edges, impossible pulse intervals, implausible RPM changes and false edges                                                            |
| **Startup behaviour**         | Initially unsynchronized; becomes usable only after sufficient consistent events establish a credible period                                           |
| **Stale behaviour**           | Missing events indicate either engine stop or pickup failure; these conditions cannot currently be distinguished directly                              |
| **Fault behaviour**           | Prevent or inhibit ignition scheduling when a trustworthy crank reference is unavailable                                                               |
| **Consumers**                 | Ignition control, knock-window control, engine-state estimation, power-jet strategy, exhaust-valve strategy, safety and telemetry                      |
| **Publication model**         | Preserve every valid capture event; separately publish the latest derived RPM and synchronization state                                                |
| **Required task context**     | Minimal hardware callback followed by a high-priority pickup or engine service                                                                         |
| **Test strategy**             | RPM ramps, rapid acceleration and deceleration, missing edges, duplicate edges, noise, timer wraparound and operation up to 25,000 RPM                 |

## 4.3 Domain separation

The subsystem shall distinguish between:

* Physical edge acquisition
* Pickup-signal validation
* Engine-speed estimation
* Crank-reference synchronization
* Ignition scheduling

The pickup-acquisition component shall not own the ignition map or make high-level ignition decisions.

## 4.4 Current limitation

The system currently cannot directly distinguish between:

* An engine that has stopped normally
* A disconnected or failed pickup
* A failed signal conditioner

This distinction may later require additional context such as starter state, recent engine state, electrical diagnostics or pickup-conditioning diagnostics.

---

# 5. Throttle Position Sensor subsystem

## 5.1 General classification

**Input family:** Periodic analogue measurement.

**Electrical range:** Nominally 0–3.3 V.

**Purpose:** Represent rider load demand and provide the load axis for ignition and actuator maps.

**Publication model:** Latest validated throttle value rather than every individual ADC sample.

**Engine synchronization:** TPS acquisition is normally independent of the pickup signal.

## 5.2 Sensor design matrix

| Property                       | Classification                                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| **Name**                       | Throttle Position Sensor                                                                                      |
| **Purpose**                    | Determine throttle opening and rider load demand                                                              |
| **Electrical type**            | Analogue voltage in the nominal 0–3.3 V range                                                                 |
| **Acquisition model**          | Periodic ADC acquisition                                                                                      |
| **Sampling requirement**       | Regular sampling fast enough to detect rapid throttle movement without coupling acquisition to the pickup ISR |
| **Timestamp requirement**      | Timestamp at physical acquisition for stale-data and throttle-rate evaluation                                 |
| **Raw representation**         | ADC code plus calibrated input voltage for real hardware                                                       |
| **Engineering unit**           | Normalized throttle opening, preferably 0–100% or 0–1000 permille                                             |
| **Calibration**                | Closed-throttle and full-throttle voltage endpoints                                                            |
| **Current calibration method** | Calibration values are initially treated as known and may be entered manually                                 |
| **Future calibration method**  | Automatic calibration shall be added later without changing the external sensor contract                      |
| **Configuration interface**    | Manual calibration shall be configurable through the Web UI                                                   |
| **Filtering**                  | Low-latency filtering that reduces electrical noise without hiding rapid throttle closure                     |
| **Fastest expected movement**  | Full-open to closed may occur in approximately 300 ms; this value is provisional and requires validation      |
| **Plausibility**               | Electrical range, calibrated range, rate of change, stuck signal and excessive noise                          |
| **Startup behaviour**          | Invalid until acquisition and calibration are available and initial samples are plausible                     |
| **Fault behaviour**            | Publish invalid TPS status and use a fixed 70% throttle fallback value                                        |
| **Fallback purpose**           | Permit limited ECU operation rather than stopping the engine                                                  |
| **Consumers**                  | Ignition lookup, power jet, exhaust valve, quick-shifter strategy, telemetry and diagnostics                  |
| **Publication model**          | Latest validated position, timestamp, health state and optionally throttle-rate estimate                      |
| **Required task context**      | Analogue sensor service                                                                                       |
| **Test strategy**              | Full sweep, rapid closure, noise, disconnect, short to ground, short to supply and invalid calibration        |

## 5.3 Calibration architecture requirement

Calibration shall be represented independently from ADC acquisition so that the calibration mechanism can evolve from manual configuration to automatic calibration without changing:

* The TPS publication contract
* Engine-control consumers
* Telemetry consumers
* The underlying ADC abstraction

## 5.4 Deferred TPS decisions

Final TPS electrical margins, sample rate, filter delay, throttle-rate use and
additional degraded-mode limits are tracked in
[sensor_oop.md](sensor_oop.md#11-explicit-open-decisions).

---

# 6. Knock-sensor subsystem

## 6.1 General classification

**Physical sensor:** Bosch KS4-P broadband piezoelectric vibration sensor.

**Signal conditioner:** Texas Instruments TPIC8101.

**Physical sensor family:** Passive broadband structure-borne vibration sensor.

**ECU subsystem family:** Crank-synchronous combustion-event measurement.

The Bosch sensor produces an analogue vibration waveform. The TPIC8101 performs high-rate conversion, programmable band-pass filtering, rectification and integration internally.

The normal software-visible result is therefore not a raw waveform block. It is an integrated knock-intensity result associated with a defined crank-angle window.

For a single-cylinder two-stroke engine, one combustion opportunity occurs every crankshaft revolution. One valid knock result is therefore expected for each enabled revolution.

## 6.2 Sensor design matrix

| Property                       | Classification                                                                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Name**                       | Knock and combustion-vibration subsystem                                                                                                                            |
| **Purpose**                    | Measure vibration energy in a selected frequency band and support conservative ignition correction and engine protection                                            |
| **Sensor electrical type**     | Passive two-wire piezoelectric vibration sensor                                                                                                                     |
| **Signal conditioner**         | TPIC8101 with input amplification, internal conversion, programmable band-pass filtering, full-wave rectification and integration                                   |
| **Acquisition model**          | Continuous physical vibration signal with crank-windowed measurement                                                                                                |
| **Window control**             | The ECU controls the TPIC8101 integration window using crank-angle timing                                                                                           |
| **Sampling requirement**       | No high-rate external MCU sampling is required during normal operation                                                                                              |
| **Result acquisition**         | One integrated result is read per enabled measurement window                                                                                                        |
| **Timestamp requirement**      | Every result shall be associated with `revolution_id`, pickup-edge time, window-open time, window-close time, read time, RPM, TPS/load and ignition angle           |
| **Raw representation**         | Preferred: TPIC8101 digital integrator count stored in a wider ECU field                                                                                            |
| **Engineering unit**           | Dimensionless knock counts or normalized knock index                                                                                                                |
| **Calibration**                | Sensor variant, mounting location, mounting torque, input gain, programmable gain, filter centre frequency, window angles, background model and sensor thresholds  |
| **Filtering**                  | TPIC8101 frequency filtering and integration followed by firmware signal-quality checks, background estimation and normalization                                   |
| **Plausibility**               | Missing result, stuck result, saturation, implausible background, invalid window timing and TPIC configuration or communication errors                              |
| **Stale timeout**              | Defined primarily in missed combustion events rather than only in milliseconds                                                                                      |
| **Startup behaviour**          | Knock correction disabled until crank synchronization, TPIC configuration and background estimation are valid                                                       |
| **Fault behaviour**            | Publish invalid, stale or degraded knock feature state; ECU-level knock strategy disables adaptive advance and learned positive corrections                         |
| **Consumers**                  | Ignition correction, engine protection, calibration tools, diagnostics and telemetry                                                                                |
| **Publication model**          | One `KnockWindowMeasurement` per enabled revolution                                                                                                                 |
| **Required task context**      | Deterministic crank-timing context for window control and result acquisition; lower-priority service for normalization and adaptation                               |
| **Raw diagnostic acquisition** | Optional separate diagnostic path; not provided by the standard TPIC8101 result                                                                                     |
| **Test strategy**              | Injected bursts, frequency sweeps, clipping tests, window timing tests, mechanical-noise tests and dynamometer validation                                           |

## 6.3 Knock window measurement

Knock does not publish a latest-value `SensorReading<T>`. It publishes a
crank-synchronous `KnockWindowMeasurement` sibling contract.

The real-time crank timing path owns the `revolution_id`, pickup-edge
timestamp and predicted revolution period. The knock window scheduler borrows
that context when it schedules the TPIC8101 integration window. The low-level
TPIC8101 driver only toggles the integration window and reads the held result;
it does not know about revolutions, TDC, combustion or cylinders.

Each published `KnockWindowMeasurement` shall conceptually include:

* `RevolutionId revolution_id`
* `TimestampUs pickup_edge_at`
* `TimestampUs window_opened_at`
* `TimestampUs window_closed_at`
* `TimestampUs read_at`
* Raw TPIC8101 integrator count
* Background estimate when available
* Normalized knock feature when available
* Non-authoritative sensor threshold result or candidate knock flag when used
* Validity
* Health state
* Quality
* Fault bits
* RPM
* TPS or load
* Ignition angle
* Active TPIC configuration

The SPI read time does not determine which revolution the measurement belongs
to. The revolution association is assigned when the measurement is scheduled.

Fault handling shall include:

* No valid crank synchronization: do not schedule a knock window and publish or
  count knock unavailable.
* Predicted integration window outside the valid TPIC8101 duration: skip that
  revolution and record a window-out-of-range fault.
* Missed INT/HOLD timing: mark that revolution measurement invalid.
* Late or failed SPI read: mark that revolution measurement failed and never
  silently reuse an old TPIC result.

## 6.4 Frequency-range assumptions

The KS4-P shall be treated as a broadband or flat-type knock sensor over the useful range rather than intentionally using its main mechanical resonance.

The useful combined sensor and TPIC8101 range is expected to be approximately 3–20 kHz.

The final frequency shall be selected through engine testing. Initial candidate centre frequencies may include values around:

* 6.37 kHz
* 7.27 kHz
* 8.02 kHz
* 8.95 kHz
* 10.12 kHz
* 11.22 kHz
* 12.10 kHz

The selected band shall maximize the separation between verified knock and normal engine vibration rather than simply selecting the largest-amplitude signal.

## 6.5 Mounting requirements

The sensor shall use:

* A rigid and repeatable machined mounting boss
* A location close to the combustion chamber
* Controlled mounting torque
* A mechanically stiff cylinder, head or nearby crankcase structure
* Consistent mounting between calibration and production testing

## 6.6 Signal-interface requirements

The knock-sensor wiring and TPIC8101 interface shall account for:

* Controlled sensor return
* Twisted-pair or shielded wiring
* Separation from CDI and spark-plug wiring
* Automotive transient and EMI protection
* Quiet analogue grounding
* Short front-end routing
* Correct 3.3 V/5 V digital-level translation between TPIC8101 and ESP32-S3

## 6.7 Development stages

Knock functionality shall be introduced progressively:

1. Diagnostic logging only
2. Frequency, gain, mounting and window calibration
3. ECU-level knock classification without ignition authority
4. Limited retard-only authority
5. Bounded closed-loop correction after validation

## 6.8 Ignition-control use

High knock-feature values may indicate abnormal combustion, excessive thermal stress or unsuitable fuel quality.

The ECU-level knock strategy may therefore request:

* A more conservative maximum ignition advance
* A bounded temporary retard
* Removal of learned positive advance
* Reduced permitted load or RPM
* A conservative fallback map

The sensor-side knock subsystem shall publish acquisition records, normalized
features and health only. It shall not publish final knock interpretation,
request ignition authority or write the final ignition output.

Excessive retard shall not be assumed to be safe because it may increase exhaust temperature, particularly on a two-stroke engine.

---

# 7. Exhaust Gas Temperature subsystem

## 7.1 General classification

**Selected sensor:** AiM M5 exhaust-gas thermocouple, part number 3CVGAS807.

**Sensor type:** K-type thermocouple.

**Measurement range:** 0–1000°C.

**Converter:** MAX31856 thermocouple-to-digital converter.

**Purpose:** Exhaust-temperature monitoring, measurement and diagnostics. EGT provides a repeatable thermal reference for a validated engine setup.

**Engine scope:** Two-stroke only.

## 7.2 Signal chain

The conceptual signal chain is:

AiM M5 K-type thermocouple → protection and filtering → MAX31856 → SPI → ECU

The converter provides:

* Cold-junction compensation
* K-type linearization
* Analogue-to-digital conversion
* Open-sensor detection
* Temperature-threshold diagnostics
* Mains-noise rejection

## 7.3 Sensor design matrix

| Property                  | Classification                                                                                                             |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Name**                  | Exhaust Gas Temperature subsystem                                                                                          |
| **Purpose**               | Measure exhaust-gas temperature, monitor thermal trends and identify abnormal combustion or fuelling behaviour            |
| **Electrical type**       | Low-level K-type thermocouple voltage                                                                                      |
| **Converter**             | MAX31856                                                                                                                   |
| **Acquisition model**     | Periodic SPI acquisition                                                                                                   |
| **Sampling requirement**  | Slow to moderate rate appropriate for thermal behaviour                                                                    |
| **Timestamp requirement** | Sufficient for stale detection, maximum tracking and rate-of-rise evaluation                                               |
| **Raw representation**    | MAX31856 temperature result and diagnostic flags                                                                           |
| **Engineering unit**      | Degrees Celsius                                                                                                            |
| **Calibration**           | Thermocouple type, cold-junction behaviour, installation position and any installation-specific correction                 |
| **Filtering**             | Stable temperature estimate plus a less-delayed protection path where appropriate                                          |
| **Plausibility**          | Open thermocouple, converter fault, invalid cold junction, implausible jumps, frozen reading and SPI failure               |
| **Stale timeout**         | Longer than TPS but bounded so thermal protection is not silently lost                                                     |
| **Startup behaviour**     | Electrical diagnostics active immediately; EGT-based protection actions delayed until the engine is confirmed running      |
| **Fault behaviour**       | Disable EGT-dependent protection actions, publish a fault and enter a conservative limited-operating strategy              |
| **Consumers**             | Engine protection, power-jet strategy, RPM limits, telemetry and diagnostics                                               |
| **Publication model**     | Latest validated temperature, rate of rise, maximum temperature and health state                                           |
| **Required task context** | Slow thermal or sensor service                                                                                             |
| **Test strategy**         | Cold startup, controlled heating, threshold crossing, open circuit, converter loss, invalid cold junction and frozen value |

## 7.4 Probe installation

The initial installation shall use:

* Approximately 150 mm distance from the exhaust port
* Distance measured from the cylinder-to-exhaust interface
* Welded M5 mounting boss
* Probe insertion of approximately 25–50% of the internal header diameter
* Repeatable position and insertion depth between tests

The cable shall be routed away from:

* Spark-plug and CDI wiring
* Ignition coil
* Pickup wiring
* Power-jet wiring
* Exhaust-valve actuator wiring
* High-current conductors

## 7.5 Expected operating regions

Initial two-stroke engineering ranges are:

| Operating condition         |         Provisional EGT |
| --------------------------- | ----------------------: |
| Engine off or cold          |   Approximately ambient |
| Idle and light load         | Approximately 150–450°C |
| Normal loaded operation     | Approximately 450–650°C |
| High-load validation region | Approximately 650–750°C |

These values are not universal tuning targets. Final limits shall be determined for the specific engine, probe installation, fuel, ignition timing and operating conditions.

## 7.6 Protection thresholds

Provisional two-stroke thresholds are:

| Protection level       | Condition                                  |
| ---------------------- | ------------------------------------------ |
| Warning                | At or above 650°C for at least 2.0 seconds |
| Derating               | At or above 700°C for at least 1.0 second  |
| Shutdown               | At or above 750°C for at least 0.5 seconds |
| Suggested reset region | Below approximately 620°C                  |

All thresholds, delays and hysteresis values shall remain configurable.

## 7.7 Sensor-published protection requests

The EGT sensor-domain path shall publish temperature, trend, maximum observed
temperature, health and a thermal request level. It shall not command a final
power-jet target, RPM limit, load limit, ignition cut or shutdown.

The thermal request levels are:

| Request level | Sensor-side meaning |
| --- | --- |
| Normal | EGT is valid and below warning conditions |
| Warning | EGT is above the configured warning condition |
| Derating requested | EGT is above the configured derating condition |
| Critical protection requested | EGT is above the configured critical condition |
| Sensor invalid | EGT measurement is unavailable, stale or failed |

Safety and engine-control policies own final rider notification, enrichment,
load limits, RPM limits, latching, acknowledgement and shutdown behavior.

## 7.8 EGT interpretation

High EGT may indicate excessive thermal load, unsuitable ignition timing, poor fuelling or other abnormal operating conditions.

EGT shall not be used by itself to advance, retard or otherwise select ignition timing.

Ignition timing shall be established from power, detonation margin and validated calibration data. EGT is used to monitor the exhaust-temperature result of that calibration and to detect departures from a previously validated setup.

Preferred downstream policy order is mixture enrichment, load or RPM reduction,
and controlled shutdown if the temperature remains critical. That policy is not
owned by the EGT sensor object.

## 7.9 Cold-start behaviour

During cold start:

* Ambient-temperature readings are valid
* Low EGT shall not be treated as a fault
* EGT-based protection actions shall remain inactive
* Electrical, communication and open-circuit diagnostics shall remain active

Protection activation may require:

* Valid RPM
* Confirmed engine-running state
* Valid converter status
* EGT above approximately 100–150°C, or
* A configurable delay after engine start

A provisional activation delay is approximately 10 seconds.

## 7.10 Sensor-failure fallback

When EGT becomes unavailable during operation, the ECU shall:

* Avoid an immediate hard ignition cut based only on sensor failure
* Disable EGT-dependent protection actions
* Latch and report an EGT fault
* Publish a conservative-operation request for safety and engine control
* Continue in a limited operating mode

Normal EGT-dependent operation shall resume only after the measurement remains valid for a configured recovery period.

---

# 8. Water-temperature subsystem

## 8.1 General classification

**Input family:** Slow thermal measurement.

**Primary purpose:** Engine-cooling and overtemperature safety.

**Secondary purposes:**

* Warm-up-state determination
* Temperature-dependent operating limits
* Conservative ignition-limit selection
* RPM or load restriction
* Telemetry and diagnostics

**Publication model:** Latest validated water temperature, rate of change, maximum value and thermal state.

The initial electrical interface is an analogue NTC path. The exact sensor
model, pull-up or reference values and installation location have not yet been
selected.

## 8.2 Sensor design matrix

| Property                  | Classification                                                                                                             |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Name**                  | Engine water-temperature or coolant-temperature subsystem                                                                  |
| **Purpose**               | Monitor cooling-system temperature and protect the engine from sustained overheating                                       |
| **Electrical type**       | Analogue NTC temperature sensor path; exact NTC model and installation remain to be selected                              |
| **Acquisition model**     | Periodic low-rate acquisition                                                                                              |
| **Sampling requirement**  | Low to moderate rate because coolant temperature changes slowly                                                            |
| **Timestamp requirement** | Sufficient for stale detection, trend analysis and rate-of-rise calculation                                                |
| **Raw representation**    | ADC value, calibrated millivolts and resistance-derived value from the NTC acquisition path                                |
| **Engineering unit**      | Degrees Celsius                                                                                                            |
| **Calibration**           | Sensor transfer curve, pull-up or interface parameters, installation location and valid range                              |
| **Filtering**             | Stable low-noise temperature estimate with a separate rapid overtemperature path if necessary                              |
| **Plausibility**          | Open circuit, short circuit, implausible temperature, impossible rate of change, frozen value and acquisition failure      |
| **Stale timeout**         | Longer than TPS but bounded to ensure cooling protection remains available                                                 |
| **Startup behaviour**     | Valid after the first plausible measurements; cold ambient values are expected and not faults                              |
| **Fault behaviour**       | Report the fault, disable water-temperature-based adaptation and enter a conservative limited-operating strategy           |
| **Consumers**             | Engine protection, ignition limits, warm-up logic, RPM limiting, display, telemetry and diagnostics                        |
| **Publication model**     | Latest temperature, rate of change, maximum value, timestamp and health state                                              |
| **Required task context** | Thermal or analogue sensor service                                                                                         |
| **Test strategy**         | Cold startup, gradual heating, threshold crossing, rapid heating, open circuit, short circuit, frozen reading and recovery |

## 8.3 Thermal states

The subsystem should classify the measured temperature into states such as:

* Cold
* Warming
* Normal
* High
* Critical
* Sensor invalid

The exact boundaries shall be configured after selecting the engine, cooling system and sensor.

## 8.4 Sensor-published protection requests

The water-temperature sensor-domain path shall publish temperature, trend,
maximum observed temperature, thermal state, health and a thermal request
level. It shall not command final ignition limits, map selection, RPM limits,
load limits, cooling actuators or shutdown.

The thermal request levels are:

| Request level | Sensor-side meaning |
| --- | --- |
| Normal | Temperature is valid and below warning conditions |
| Warning | Temperature is above the configured warning condition |
| Derating requested | Temperature is above the configured derating condition |
| Critical protection requested | Temperature is above the configured critical condition |
| Sensor invalid | Temperature measurement is unavailable, stale or failed |

Safety and engine-control policies own rider notification, logging, final
ignition limits, RPM limits, map selection, high-load restriction, latching,
acknowledgement and shutdown behavior.

## 8.5 Ignition-control use

High water temperature may limit the maximum permitted ignition advance.

The temperature subsystem shall publish thermal state and protection requests. It shall not directly command the CDI output.

The final correction strategy may depend on:

* Current temperature
* Rate of temperature rise
* RPM
* TPS or load
* Duration above the warning threshold
* EGT state
* Knock state

## 8.6 Sensor-failure fallback

Loss of the water-temperature sensor shall not automatically imply that the engine is overheating.

The ECU should instead:

* Report the sensor fault
* Disable water-temperature-based adaptive corrections
* Publish a conservative-operation request for safety and engine control
* Continue in a limited-operating mode when permitted

A hard shutdown should require either:

* A confirmed critical temperature before sensor loss
* Corroborating thermal evidence
* Another safety condition
* A configuration that requires the sensor for engine operation

## 8.7 Deferred water-temperature decisions

The exact NTC model, pull-up/reference values, analogue front end,
installation, thresholds, hysteresis, operating-profile policy, limp limits and
warm-up behavior are tracked in
[sensor_oop.md](sensor_oop.md#11-explicit-open-decisions).

---

# 9. Quick-shifter subsystem

## 9.1 General classification

**Input family:** Asynchronous digital rider request.

**Sensor type:** Digital.

**Contact type:** Normally open.

**Domain activation:** The domain-level request is active when
`QuickShifterInput` normalizes the active-low electrical input to `active ==
true`.

**Purpose:** Request a temporary ignition cut during an eligible gear shift.

The input may remain physically active throughout the shift.

The ignition-cut duration shall depend on RPM and TPS.

## 9.2 Electrical specifications

* Normally-open contact
* Active-low operation
* Pull-up bias
* Domain-level active state after polarity normalization

## 9.3 Sensor design matrix

| Property                        | Classification                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Name**                        | Quick-shifter request input                                                                                                                 |
| **Purpose**                     | Request an ignition cut during an upshift                                                                                                   |
| **Electrical type**             | Conditioned digital input                                                                                                                   |
| **Contact type**                | Normally open                                                                                                                               |
| **Acquisition model**           | Asynchronous edge detection plus stable-state monitoring                                                                                    |
| **Sampling requirement**        | Detect every valid activation and release                                                                                                   |
| **Timestamp requirement**       | Record activation, release and total request duration                                                                                       |
| **Raw representation**          | Digital level, edge type and timestamp                                                                                                      |
| **Engineering state**           | Inactive, candidate request, valid request, active, released, faulted or re-arming                                                          |
| **Calibration**                 | Polarity, Schmitt thresholds, debounce time, minimum RPM, TPS conditions, cut-time map and recovery behaviour                               |
| **Filtering**                   | Hardware or software Schmitt-trigger behaviour, debounce and pulse-duration validation                                                      |
| **Plausibility**                | Stuck input, repeated bouncing, implausibly short pulses, excessive activation duration and requests outside permitted operating conditions |
| **Maximum expected activation** | Approximately one second in general operation, but not treated as an unconditional hard limit                                               |
| **Startup behaviour**           | Determine initial stable state; an active signal at startup shall generate a diagnostic and remain ignored                                  |
| **Fault behaviour**             | Report the input fault and ignore the quick-shifter request until the signal returns to a valid normal state                                |
| **Consumers**                   | Quick-shift eligibility strategy, ignition-cut strategy, telemetry and diagnostics                                                          |
| **Publication model**           | Preserve every validated request and publish the current stable input state                                                                 |
| **Required task context**       | Minimal digital callback plus digital-input or engine-control service                                                                       |
| **Test strategy**               | Normal shift, bounce, short pulse, long hold, stuck input, startup-active state and repeated requests                                       |

## 9.4 Eligibility conditions

A quick-shifter request shall be accepted only when configurable conditions are satisfied.

These conditions may include:

* Minimum RPM
* TPS range or minimum throttle opening
* Engine-running state
* No conflicting ignition fault
* No active previous cut
* Valid input state
* Re-arm completion

The user shall be able to configure at least:

* Minimum RPM
* TPS eligibility
* RPM-dependent cut duration
* TPS-dependent cut duration

## 9.5 Responsibility separation

The subsystem shall distinguish between:

* Electrical input acquisition
* Signal conditioning and debounce
* Validated shift request
* Shift eligibility
* Cut-duration selection
* Ignition-cut execution

The physical quick-shifter input shall not directly disable the CDI output.

Re-arm shall occur only after another valid input state change followed by the
configured re-arm timeout. Invalid, bouncing, stale or faulted input state shall
not advance the re-arm timeout, and a held input shall not generate repeated
requests by timer alone.

---

# 10. Map-switch subsystem

## 10.1 General classification

**Input family:** User-controlled digital strategy selection.

**Input type:** Latched digital switch.

**Current function:** Publish the debounced physical request for the primary or
second map.

**Runtime switching:** Runtime map changes are permitted only through the
map-selection service at its safe activation boundary.

**Web UI authority:** Web UI override and effective-map arbitration are outside
the physical map-switch input.

## 10.2 Sensor design matrix

| Property                  | Classification                                                                                 |
| ------------------------- | ---------------------------------------------------------------------------------------------- |
| **Name**                  | Map-selection switch                                                                           |
| **Purpose**               | Publish the stable physical request for the secondary engine-control map                        |
| **Electrical type**       | Single digital latched switch                                                                  |
| **Acquisition model**     | State-change detection or periodic stable-state scan                                           |
| **Sampling requirement**  | Low-rate but reliable detection of deliberate changes                                          |
| **Timestamp requirement** | Sufficient for event logging and safe map activation                                           |
| **Raw representation**    | Digital level                                                                                  |
| **Engineering state**     | Primary-map request or secondary-map request                                                   |
| **Calibration**           | Input polarity and debounce behaviour                                                          |
| **Filtering**             | Debounce and stable-state qualification                                                        |
| **Plausibility**          | Invalid electrical state and rapid repeated changes                                             |
| **Startup behaviour**     | Read the stable switch state before selecting the initial map                                  |
| **Fault behaviour**       | Publish invalid physical-switch state and request the hardcoded safe default through map selection |
| **Consumers**             | Map-selection service, telemetry and diagnostics                                               |
| **Publication model**     | Latest stable physical request plus physical-switch change event                                |
| **Required task context** | Digital-input service                                                                          |
| **Test strategy**         | Both switch states, bounce, disconnection, startup positions and running changes                |

## 10.3 Map-selection ownership boundary

The digital switch does not directly select the effective active map and does
not modify map data. It only publishes the stable physical request.

The following are owned outside the sensor macro-area:

* UI-requested map override
* Effective active map
* Selected-map validation
* Runtime activation boundary
* Override persistence, timeout and cancellation policy
* Reason for current effective selection

---

# 11. Architecture document boundary

This document stops at sensor-domain requirements.

The maintained architecture contract is [sensor_oop.md](sensor_oop.md), which
defines:

* Publication models
* Class and responsibility boundaries
* Hardware acquisition ports
* FreeRTOS execution contexts
* Ownership and communication matrices
* Failure and fallback behavior
* Test seams, acceptance criteria and implementation backlog
* Open decisions that remain outside the sensor requirements
