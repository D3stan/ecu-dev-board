# CDI Test-Bench Firmware Context

## Project purpose

This ESP32-S2 project runs the test bench for a custom capacitive-discharge
ignition (CDI) ECU intended for motorsport applications. The bench includes the
custom ECU PCB and its associated hardware. The CDI circuit has already been
tested and is working.

## Current objective

The next firmware step is to replace the manual fire-pulse behavior with a
simplified but representative ignition-control flow. The firmware must cover
three core responsibilities:

1. Detect and process the engine pickup signal.
2. Calculate ignition advance from engine speed and throttle position.
3. Fire the CDI at the calculated crankshaft angle.

## Inputs

### Engine pickup

The pickup signal comes from a MAX9924 variable-reluctance sensor interface.
Its output is a square wave. A falling edge represents the pickup signal's zero
crossing and is the timing reference that the firmware must capture. The
falling-edge crankshaft reference angle will be a compile-time setting in
`main/test-bench_config.h`, with an initial value of 40 degrees before top dead
center (BTDC). There is one falling-edge pickup event per crankshaft
revolution.

### Throttle position

For the test bench, throttle position is represented by a potentiometer. The
ESP32-S2 samples the potentiometer through an ADC input and converts the reading
to a throttle-position value from 0% to 100%.

## Ignition calculation

The ignition advance is selected from a three-dimensional map whose axes are:

- Engine speed in revolutions per minute (RPM).
- Throttle position in percent (TPS%).
- Ignition advance in crankshaft degrees as the map value.

The exact map breakpoints, values, and interpolation behavior remain design
decisions.

## Output

The firmware commands the existing CDI firing circuit. The current project
already generates a hardware-timed active-high fire pulse on the fire output
and mirrors it on an LED. The pickup-driven logic will reuse or adapt that
output mechanism after the timing and safety requirements are defined.

## Confirmed bench requirements

- The CDI fires once per crankshaft revolution.
- On ESP32-S2, GPIO2 receives the externally pulled-up, open-drain MAX9924
  output. Only falling edges are ignition timing references.
- ESP32-S3 support must have a separate target-specific pin section whose pin
  assignments remain intentionally unimplemented until the board is defined.
- The intended operating range is 200 RPM to 20,000 RPM. Intervals that imply
  an RPM above the maximum are rejected as noise. No rev limiter is required.
- The first pickup event after startup is suppressed because no revolution
  period is available yet. Each later RPM value uses the latest valid
  revolution period without RPM filtering.
- Pickup signal loss uses a fixed 500 millisecond timeout.
- On ESP32-S2, GPIO1 samples a potentiometer spanning 0 V to 3.3 V. TPS is
  sampled at 30 Hz, and the median of the latest five samples is the current
  TPS value.
- The advance map is a separate C module rather than part of the main
  application source. It uses RPM and TPS axes, stores advance in tenths of a
  degree, and applies bilinear interpolation with input clamping.
- Advance may not exceed the configured pickup reference angle.
- The existing GPIO4 fire output, GPIO15 mirror LED, and configurable active-high
  trigger pulse are retained. The initial pulse width is 500 microseconds.
- GPIO0 manual firing remains available only while the pickup signal is stopped.
- Rate-limited serial telemetry is enabled by a compile-time setting in
  `main/test-bench_config.h` so it is easy to disable.
- The onboard RGB status LED uses GPIO21 for red, GPIO33 for green, and GPIO34
  for blue. No pickup activity displays red, pickup acquisition displays yellow
  by combining red and green, and synchronized running displays green. Blue is
  off in these states. All three LED channels are active-high.
