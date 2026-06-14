C1: A
C2: see below
C2b: A	
C3: A
C4: see below
C5: A
C6: A
C7: B

Your version is much cleaner than the token-heavy model I suggested earlier. For this engine, I would use the `revolutionId` directly. The key is to place ownership correctly.

**Design Idea**
Do not make the TPIC/knock sensor “discover” the revolution. The **crank timing path** owns the revolution counter. The knock acquisition path only borrows that ID when it schedules the window.

I would model it like this:

```text
Pickup edge ISR / crank timing
  owns edge timestamp, revolutionId, revolution period prediction

Knock window scheduler
  uses revolutionId + predicted period + angle config
  schedules INT/HOLD open/close

TPIC8101 driver
  only toggles INT/HOLD and reads SPI
  knows nothing about revolutions, TDC, combustion, or cylinders

Knock acquisition service
  combines scheduled revolution context + TPIC result
  publishes KnockWindowMeasurement

Knock strategy
  interprets the measurement and decides any ignition/protection response
```

So yes: revolution association is ECU-side logic. More precisely, it belongs to the **real-time crank timing / scheduling side**, not the low-level sensor driver and not the later knock strategy.

I would rename `KnockEventRecord` to something less vague, for example:

```cpp
struct KnockWindowMeasurement {
  RevolutionId revolution_id;

  TimestampUs pickup_edge_at;
  TimestampUs window_opened_at;
  TimestampUs window_closed_at;
  TimestampUs read_at;

  uint16_t raw_count;

  SensorValidity validity;
  SensorHealthState health;
  SensorQuality quality;
  SensorFaultBits faults;
};
```

For your current assumption, this is enough. Single-cylinder two-stroke, one pickup edge per revolution, one combustion event per revolution, one knock window per revolution. No token is needed unless you later add multiple windows per revolution, multiple cylinders, or more complex scheduling. If that happens, add `window_id`; do not redesign the whole model.

The flow becomes:

```text
Pickup edge n:
  revolutionId++
  capture pickup_edge_at
  compute predicted T_rev
  compute start/end delays
  validate window duration and timing
  schedule INT/HOLD for revolutionId n

Timer at start delay:
  INT/HOLD HIGH

Timer at end delay:
  INT/HOLD LOW
  notify SPI-read task

SPI read:
  read TPIC held result
  publish KnockWindowMeasurement { revolution_id = n, raw_count = ... }
```

This is elegant because the revolution ID is assigned when the measurement is scheduled, not inferred when SPI is read. That matches your statement: the SPI read time does not determine the revolution.

For C2, this means Option A should be refined to:

```text
Knock does not use SensorReading<T>.
Knock publishes a crank-synchronous KnockWindowMeasurement.
The measurement carries the same metadata vocabulary as other sensor outputs,
but its primary identity is revolution_id.
```

Parallel with TPS:

```text
TPS:
  "What is the latest throttle position?"
  -> SensorReading<ThrottlePosition>

Knock:
  "What was the TPIC result for revolution n?"
  -> KnockWindowMeasurement
```

And the fault behavior becomes straightforward:

```text
No valid crank sync:
  do not schedule knock window; publish or count knock unavailable

Predicted window outside TPIC 0.5-10 ms range:
  skip measurement for that revolution with WindowOutOfRange fault

INT/HOLD timing missed:
  mark revolution measurement invalid

SPI read too late or fails:
  mark that revolution measurement failed; do not silently reuse old value
```

So my recommendation: use your revolution-ID model, but keep the low-level TPIC driver dumb. Put `revolutionId` assignment in the crank-synchronous scheduler, then publish a dedicated `KnockWindowMeasurement` as a sibling contract to `SensorReading<T>`.

My opinion: choose **Option B as the architectural grouping**, but word it with **Option A’s hardware precision**.

So the decision should read something like:

> EGT and water temperature are both owned by `ThermalSensorService` because they are slow thermal-domain measurements with shared trend, maximum, stale, recovery and protection-state logic. Their acquisition paths are different: EGT uses `ISpiMeasurementSource` for the MAX31856 thermocouple converter, while water temperature uses `IAnalogSampleSource` for the analog NTC path. `AnalogSensorService` owns TPS and future non-thermal ADC inputs, not EGT.

Why: the docs already lean this way. The original roadmap still has older wording that groups EGT with periodic analog examples, such as TPS/EGT/battery voltage in [roadmap.md](C:/Users/puddu/Documents/Github/ecu-dev-board/idf/docs/roadmap.md:31). But the later roadmap section explicitly corrects that: EGT is a MAX31856 SPI converter path and “not owned by the generic analogue ADC path” [roadmap.md](C:/Users/puddu/Documents/Github/ecu-dev-board/idf/docs/roadmap.md:964).

The sensor spec is also clear that EGT is an AiM K-type thermocouple through MAX31856 over SPI [sensors.md](C:/Users/puddu/Documents/Github/ecu-dev-board/idf/docs/sensors.md:319), with “Periodic SPI acquisition” [sensors.md](C:/Users/puddu/Documents/Github/ecu-dev-board/idf/docs/sensors.md:354). Water temperature, by contrast, is explicitly an analog NTC path [sensors.md](C:/Users/puddu/Documents/Github/ecu-dev-board/idf/docs/sensors.md:504).

The important distinction is:

- **Hardware acquisition family:** EGT is SPI converter data; water temp and TPS are ADC/analog paths.
- **Domain family:** EGT and water temp are thermal measurements.
- **Execution/service owner:** `ThermalSensorService` can own both thermal sensors without pretending they use the same hardware path.
- **Tasking detail:** `ThermalSensorService` may share a FreeRTOS task with analog processing if blocking/rate behavior allows, but that is runtime scheduling, not ownership.

I would avoid Option A if it means “EGT becomes a separate service path outside thermal.” That would preserve hardware accuracy but lose useful thermal-domain cohesion. I would avoid a loose Option B if it says only “thermal service” and hides the SPI-vs-ADC distinction. The correct version is **B with explicit ports**.

Suggested cleanup:

- Replace “Thermal/analogue sensor service” with just `ThermalSensorService`.
- Keep `AnalogSensorService` scoped to TPS and future medium-rate ADC inputs.
- In matrices, add or preserve columns for both `Domain owner` and `Acquisition port`.
- For EGT faults, always mention MAX31856/SPI/open-thermocouple/cold-junction diagnostics, not ADC range faults.
- For water temp faults, mention NTC open/short, ADC acquisition, pull-up/reference diagnostics.

That matches the newer OOP docs, where `ThermalSensorService` depends on both `IAnalogSampleSource` and `ISpiMeasurementSource` [roadmap.md](C:/Users/puddu/Documents/Github/ecu-dev-board/idf/docs/roadmap.md:1128), and the hardware ports explicitly separate ADC samples from SPI converter results [sensor_oop.md](C:/Users/puddu/Documents/Github/ecu-dev-board/idf/docs/sensor_oop.md:124).