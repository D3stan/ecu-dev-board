# ECU Sensor Reading and Handling Implementation Plan

## Summary

Implement the full sensor subsystem plan from `B1` through `B15` in native ESP-IDF, targeting `idf/` only. The old `code/` PlatformIO/Arduino tree stays untouched except as historical reference. The native `idf/main/main.c` remains a thin C entrypoint that calls a new C-compatible ECU runtime API; all sensor domain logic is implemented in C++ classes behind ESP-IDF C driver adapters.

Create these main components:

- `idf/components/sensors`: C++ domain contracts, ports, policies, sensor objects, services, `SensorDataStore`, health aggregation, and host tests.
- `idf/components/sensor_drivers`: ESP-IDF adapters for ADC, GPIO, SPI/MAX31856, timer capture, TPIC8101, and common time.
- `idf/components/ecu_app`: runtime wiring, service lifecycle, config generation handoff, telemetry/config projection, and integration with `app_main`.
- `idf/components/safety_boundary`: minimal sensor-consumer boundary for inhibit/limit requests without putting final actuator authority inside sensors.

## Key Interfaces And Public Contracts

- Define common domain types in `idf/components/sensors/include/sensors/domain/`:
  - `TimestampUs = uint64_t`, `RevolutionId = uint64_t`, `SensorSequence = uint32_t`.
  - `SensorHealthState`: `Uninitialized`, `Stabilizing`, `Valid`, `Degraded`, `Stale`, `Failed`, `Disabled`.
  - `SensorQuality`, typed fault bitsets, and typed units such as `ThrottlePositionPermille`, `TemperatureCelsius`, `EngineSpeedState`.
  - `SensorReading<T>` and `SensorEvent<T>` with value/event, `acquired_at`, sequence, `valid_for_control`, health, quality, and faults.
  - `KnockWindowMeasurement` keyed by `revolution_id`, with pickup/window/read timestamps, TPIC count, RPM, TPS/load, ignition angle, config identity, health, quality, validity, and faults.

- Define hardware ports in `idf/components/sensors/include/sensors/ports/`:
  - `IAnalogSampleSource`, `ISpiMeasurementSource`, `IDigitalInputSource`, `IEdgeCaptureSource`, `IKnockWindowDevice`, `ITimeSource`.
  - Ports expose raw timestamped facts only. They must not contain calibration, throttle percent, thermal state, RPM, map logic, or ignition decisions.

- Define service/domain classes in `idf/components/sensors/include/sensors/`:
  - `TpsSensor`, `EgtSensor`, `WaterTemperatureSensor`, `PickupSensor`, `EngineStateEstimator`, `QuickShifterInput`, `MapSwitchInput`, `KnockSensor`, `KnockFeatureExtractor`.
  - `AnalogSensorService`, `ThermalSensorService`, `DigitalInputService`, `PickupAcquisitionService`, `KnockAcquisitionService`, `KnockSignalProcessingService`, `SensorHealthService`.
  - `SensorDataStore` publishes coherent snapshots with generation counters, latest-value overwrite semantics, bounded event queues, overflow counters, and fault transition coalescing.

- Define configuration as staged generations:
  - Runtime receives Web UI/diagnostic/storage requests, validates them, assigns a generation, and only the owning sensor service applies them at its safe boundary.
  - Configurable values include TPS endpoints/fallback/filter/stale settings, pickup trigger/polarity/RPM plausibility/recovery values, EGT thresholds/delays/hysteresis, water-temperature transfer/thresholds, quick-shifter debounce/re-arm/cut map/eligibility, map-switch polarity/debounce, and TPIC/knock window/background settings.
  - Numeric values explicitly marked open in the docs are not production constants. They are either configurable development defaults or blockers before production driver enablement.

- Preserve existing Web UI telemetry compatibility:
  - Continue publishing flat `rpm`, `tps`, `egt`, `fsm`, `advance_deg`, `pj_duty`, and `active_map` fields for existing dashboard components.
  - Add nested `sensors` and `health` objects for valid/health/quality/fault/timestamp/sequence data.
  - Add JSON commands such as `set_sensor_config`, `get_sensor_config`, and `ack` responses using the existing `CommandManager`/adapter pattern.

## Implementation Phases

- **B1-B3 Foundation**
  - Add `sensors` C++ component with C++17, no exceptions/RTTI dependency, no ESP-IDF includes in domain headers.
  - Add deterministic fake time, fake hardware sources, replay source, fault injector, bounded queues, and `SensorDataStore`.
  - Add host CMake/CTest harness under `idf/components/sensors/tests/host`.

- **B4-B8 Core Sensor Slices**
  - Implement TPS with manual calibration endpoints, low-latency filtering, validation, explicit invalid status, and fixed 70 percent fallback.
  - Implement EGT and water-temperature domain logic with trends, max tracking, thermal request levels, and failure behavior that never claims unconfirmed overheating.
  - Implement quick-shifter and map-switch input handling with polarity normalization, debounce, startup-active handling, stuck detection, re-arm, request queues, and physical map request publication only.
  - Implement pickup validation and `EngineStateEstimator` with RPM, sync confidence, revolution counter, and untrusted-crank behavior.
  - Implement `SensorHealthService` after vertical slices so aggregate health and fault history are authoritative.

- **B9-B13 Consumer, Knock, Config, And Observability**
  - Add the safety/engine-control consumption boundary so consumers read only snapshots/events and sensors never command CDI, actuators, effective map, shutdown, or final derating.
  - Add knock acquisition after pickup/revolution context is stable, then add feature extraction separately. Knock publishes measurements/features/health only.
  - Add staged configuration transactions, persistence handoff, Web UI config payloads, telemetry snapshot streaming, event draining, diagnostics, and replay observability.
  - Keep telemetry/diagnostics best-effort and unable to block engine-critical producers.

- **B14-B15 Drivers, HITL, And Scheduler Validation**
  - Add ESP-IDF adapters behind ports: ADC one-shot/continuous as selected, GPIO edge/state, timer capture, SPI/MAX31856, TPIC8101 window device, and `esp_timer` time source.
  - Use the existing `emulator/` as HITL stimulus for pickup, TPS, EGT, and quick-shifter, then extend it only where needed for water temperature, map switch, and TPIC/knock fault injection.
  - Measure and set FreeRTOS task priorities, queue depths, stack sizes, core affinity, watchdog behavior, ISR work budget, and overload behavior only after domain tests and adapter contracts are stable.

## Test Plan

- Host CTest domain tests:
  - Contract tests for sequence increments, timestamps, validity, health states, quality, fault bits, stale/recovery transitions, and `SensorDataStore` torn-read retry.
  - TPS sweep, rapid closure, noise, disconnect/short simulation, invalid calibration, stale timeout, and 70 percent fallback.
  - Pickup RPM ramps to 25,000 RPM, false edges, duplicates, missing edges, timer wraparound, overflow, sync loss, and recovery.
  - EGT and water cold start, heating, threshold crossing, open/short, converter loss, frozen value, rapid heating, hysteresis, and recovery.
  - Quick-shifter bounce, short pulse, long hold, startup-active state, repeated request rejection, and re-arm blocking.
  - Map-switch startup states, debounce, invalid state, coalesced changes, and safe-default request.
  - Knock missing/stuck/saturated/mistimed result, communication fault, background rebuild, backlog drop counter, and no ignition-authority publication.

- Integration and static boundary tests:
  - Build check that domain code does not include ESP-IDF driver headers.
  - Verify engine/safety consumers use `SensorDataStore` snapshots/events only.
  - Verify ISRs/adapters allocate no memory, log nothing, and perform no calibration/filtering/control decisions.
  - Verify telemetry and diagnostics overload cannot block sensor publication paths.

- Build/HITL verification:
  - `cmake -S idf/components/sensors/tests/host -B build/sensors-host && cmake --build build/sensors-host && ctest --test-dir build/sensors-host --output-on-failure`
  - `idf.py -C idf build`
  - `python -m unittest discover emulator/tests`
  - HITL runs for pickup ramp, TPS sweep, EGT converter/open fault, NTC open/short, quick-shifter bounce/hold, map-switch startup/runtime changes, and TPIC fault/window timing when hardware is available.

## Assumptions And Defaults

- The implementation target is `idf/`; `code/` remains non-target because it uses Arduino/PlatformIO.
- Use C++ domain objects with C-compatible runtime/adapter boundaries.
- Use host CTest for deterministic domain testing, then ESP-IDF build/HITL for adapters and scheduler behavior.
- Battery voltage is out of scope.
- Optional sensors are nonblocking by default unless a later operating profile makes them mandatory.
- Pickup is the only baseline mandatory input for trusted ignition scheduling.
- Production driver enablement must not hardcode values listed as open decisions in `sensor_oop.md`; those values stay configurable or blocked until validated.
