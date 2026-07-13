# Pickup-Driven CDI Control Design

## Goal

Extend the ESP32 test-bench firmware into a representative single-event-per-
revolution ignition controller. A falling edge from a MAX9924 establishes the
crankshaft reference, the latest revolution period determines RPM, a filtered
TPS input and an RPM/TPS map determine ignition advance, and a hardware timer
schedules the existing CDI output pulse.

The firmware remains a test-bench application for the custom CDI ECU PCB. It
does not add engine-specific calibration or production ECU functions.

## Platform and configuration

The current target is ESP32-S2 with ESP-IDF 5.5.4. All board pins and tunable
parameters live in `main/test-bench_config.h`.

### ESP32-S2 pins

| Function | GPIO | Electrical behavior |
|---|---:|---|
| Manual fire button | GPIO0 | Active-low with internal pull-up |
| TPS potentiometer | GPIO1 | ADC1 input, nominally 0 V to 3.3 V |
| MAX9924 pickup | GPIO2 | Falling-edge input, externally pulled up |
| CDI fire output | GPIO4 | Active-high, idle low |
| Fire mirror LED | GPIO15 | Active-high, idle low |
| RGB red | GPIO21 | Active-high |
| RGB green | GPIO33 | Active-high |
| RGB blue | GPIO34 | Active-high |

The pin section is selected with ESP-IDF target macros. An ESP32-S3 branch is
present but intentionally fails compilation with a precise error until its pin
assignments are provided.

### Tunable values

- Pickup reference: 40.0 degrees BTDC.
- Valid RPM range: 200 to 20,000 RPM.
- Pickup inactivity timeout: 500 milliseconds.
- CDI pulse width: 500 microseconds.
- TPS sampling rate: 30 Hz.
- TPS filter window: five readings.
- TPS endpoints: 0 mV and 3300 mV.
- Telemetry: compile-time enabled or disabled, with a 200 millisecond period
  when enabled.

Angles use tenths of a degree. Integer arithmetic is used in the timing path.

## Source structure

### `main/test-bench.c`

Owns application initialization and the manual button task. It initializes the
status LED, TPS sampler, engine controller, button input, and telemetry in an
order that keeps all ignition outputs low until setup is complete.

### `main/engine_control.h` and `main/engine_control.c`

Own the real-time state and hardware timing path:

- Free-running 1 MHz GPTimer.
- GPIO2 falling-edge ISR and pickup timestamps.
- Period validation and latest-period RPM calculation.
- Advance lookup and pickup-to-fire delay calculation.
- GPTimer alarm state machine for pulse start and pulse end.
- Simultaneous GPIO4/GPIO15 writes through a dedicated GPIO bundle.
- Pickup inactivity handling and manual-fire gating.
- Read-only telemetry snapshot API.

The controller exposes initialization, manual-fire request, periodic timeout
service, and snapshot functions. Internal state shared with ISRs is protected
by one interrupt-safe critical section.

### `main/ignition_map.h` and `main/ignition_map.c`

Contain the RPM axis, TPS axis, advance table, validation, and bilinear lookup.
The lookup accepts RPM and TPS percent and returns advance in tenths of a
degree. Inputs outside the axes are clamped to the nearest boundary.

### `main/tps.h` and `main/tps.c`

Own ADC1 initialization and a task that samples GPIO1 at 30 Hz. The module
converts the reading to 0 through 100 percent, clamps it to the configured
endpoints, retains the latest five samples, and publishes their median.

### `main/status_led.h` and `main/status_led.c`

Own the three active-high RGB outputs. The engine controller publishes its
current state, while task-context code applies the corresponding LED levels.

### `main/CMakeLists.txt`

Lists all application sources and the explicit GPIO, GPTimer, ADC, timer, and
FreeRTOS-related component dependencies.

### `sdkconfig.defaults`

Keeps GPIO and GPTimer control paths available from internal memory while the
flash cache is disabled. The GPIO ISR service and both timing callbacks use
the same level-one interrupt priority so neither timing ISR can preempt the
other while the shared controller lock is held.

## Controller states

| State | Meaning | RGB output | Manual firing |
|---|---|---|---|
| No signal | No pickup edge has been observed for 500 ms | Red | Allowed |
| Acquisition | Pickup activity exists but no valid period is available | Yellow | Blocked |
| Synchronized | Consecutive edges form a valid period | Green | Blocked |

Yellow is produced by enabling red and green together. Blue remains off in all
three current states.

The status LED is updated outside interrupt context. The desired state is an
atomic snapshot published by the controller.

## Pickup and RPM handling

The MAX9924 COUT signal is open-drain and uses an external pull-up, so GPIO2 is
configured without an internal pull. Only falling edges generate pickup events.
Rising edges are ignored.

A future diagnostic input mode could also timestamp the rising edge to measure
pickup pulse width and duty cycle. Those values can help detect wiring faults,
signal-interface saturation, or abnormal waveform changes, but they are not
needed for the current one-reference-per-revolution ignition timing model.

The free-running GPTimer count provides a microsecond timestamp for each edge.
The first observed edge enters acquisition and establishes the previous-edge
timestamp without firing.

For subsequent falling edges:

- Periods shorter than 3,000 microseconds imply more than 20,000 RPM. They are
  treated as noise and do not replace the previous accepted timestamp.
- Periods from 3,000 through 300,000 microseconds represent 20,000 through 200
  RPM and are accepted.
- Periods longer than 300,000 microseconds are outside the operating range.
  The current edge becomes a new acquisition timestamp and no firing is
  scheduled.

An accepted period produces RPM using the latest revolution only:

`rpm = 60,000,000 / period_us`

No rev limiter or RPM smoothing is applied.

If no physical pickup edge is observed for 500 milliseconds, periodic service
returns the controller to no-signal state, clears RPM and synchronization,
cancels any alarm, forces both fire outputs low, and permits manual firing.

## TPS handling

GPIO1 is sampled through ADC1 at 30 Hz. The configured endpoints initially map
0 mV to 0 percent and 3300 mV to 100 percent. Values are clamped before the
percentage conversion.

The initial 3300 mV endpoint follows the bench potentiometer specification,
but the ESP32-S2 ADC may saturate before that voltage even at maximum
attenuation. The endpoints are compile-time calibration values and must be
adjusted to the measured reachable voltages, or the potentiometer input must be
scaled externally, before treating the reported TPS percentage as calibrated.

The module stores five percentage samples. Their median is the published TPS
value. Until five samples exist, the buffer is initialized from the first
valid sample so startup does not temporarily bias TPS toward zero.

## Advance map

The RPM and TPS axes are monotonically increasing. Advance values are degrees
BTDC in this table and are stored as tenths of a degree in C.

| RPM / TPS | 0% | 20% | 40% | 60% | 80% | 100% |
|---:|---:|---:|---:|---:|---:|---:|
| 200 | 5 | 5 | 5 | 5 | 5 | 5 |
| 500 | 8 | 8 | 8 | 7 | 7 | 7 |
| 1,000 | 12 | 12 | 11 | 10 | 9 | 8 |
| 2,000 | 20 | 19 | 17 | 15 | 13 | 12 |
| 3,000 | 28 | 26 | 24 | 22 | 20 | 18 |
| 5,000 | 35 | 34 | 32 | 29 | 27 | 24 |
| 8,000 | 35 | 34 | 33 | 31 | 29 | 27 |
| 12,000 | 34 | 33 | 32 | 30 | 29 | 28 |
| 16,000 | 32 | 32 | 31 | 30 | 29 | 28 |
| 20,000 | 30 | 30 | 29 | 28 | 27 | 26 |

The lookup finds the bounding RPM and TPS cells and applies bilinear
interpolation with rounded integer arithmetic. Initialization validates both
axes and verifies that no advance value exceeds the configured pickup
reference angle.

## Ignition scheduling

For each accepted period, the controller reads the current median TPS and map
advance. The pickup-to-fire delay is:

`delay_us = period_us * (pickup_angle_tenths - advance_tenths) / 3600`

The target alarm count is the captured pickup timestamp plus the rounded delay,
so calculation time does not accumulate into the commanded angle.

The GPTimer alarm callback has two phases:

1. Pulse start sets GPIO4 and GPIO15 high together and schedules pulse end.
2. Pulse end sets both pins low; the one-shot alarm is already disabled by the
   timer hardware.

If the calculated target has already passed, the controller starts the pulse
immediately and increments a late-fire counter. Static and runtime checks
ensure a valid 500 microsecond pulse completes before the next accepted pickup
at 20,000 RPM.

## Manual firing

GPIO0 keeps the existing active-low press and stable-release debounce. A button
press requests one immediate pulse from the engine controller. The request is
accepted only when no pickup edge has been observed for at least 500
milliseconds and no pulse is active. Holding the button does not retrigger.

Manual and automatic pulses use the same output state machine, preventing
overlap and keeping GPIO4 and GPIO15 behavior identical.

## Telemetry

When enabled in `main/test-bench_config.h`, a task emits one snapshot every 200
milliseconds. The snapshot includes controller state, RPM, TPS percent,
advance, accepted period, calculated delay, rejected-edge count, and late-fire
count. Logging never occurs in GPIO or GPTimer interrupt context.

When telemetry is disabled, the logging task and its format code are excluded
at compile time.

## Runtime failure behavior

- Initialization failures stop startup through `ESP_ERROR_CHECK`.
- Implausibly short pickup periods increment the rejected-edge counter and are
  ignored.
- Below-range periods return the controller to acquisition without firing.
- Signal loss forces both CDI-related outputs low and clears synchronization.
- A map configuration that violates its axes or pickup-angle constraint stops
  initialization.
- Concurrent manual and automatic fire requests are serialized by the engine
  controller state.

## Verification

No automated test files are added. Verification consists of:

- A clean ESP-IDF 5.5.4 build for ESP32-S2.
- Compiler warnings and linker errors treated as implementation failures.
- `git diff --check` and focused source inspection for ISR safety, target pin
  guards, configuration coverage, and accidental blocking work in ISRs.
- Independent subagent review against this design and the resulting diff.
- On-bench observation with an oscilloscope or logic analyzer remains the
  operator verification for actual pickup-to-fire angle and pulse timing.
