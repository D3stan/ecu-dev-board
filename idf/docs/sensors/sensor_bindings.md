# Sensor Input Bindings

This document records only sensor-subsystem input bindings for the current
ESP32-S3 harness. It does not assign ECU output pins, actuator pins, CDI
signals, map-selection authority, shutdown behavior or safety policy.

## Confirmed Harness Inputs

| Sensor input | ESP32-S3 binding | Peripheral path | Harness channel |
| --- | --- | --- | --- |
| TPS | GPIO7 / ADC1_CH6 | ADC1 oneshot with ESP-IDF ADC calibration to millivolts | `tps` |
| Quick-shifter digital output | GPIO9 | GPIO input with pull-up, active-low domain normalization | `quick` |
| Physical map switch | GPIO14 | GPIO input with pull-up and debounce/domain state validation | `map` |
| Conditioned pickup square wave | GPIO21 | MCPWM falling-edge capture | `pickup` |

## Blocked Real Inputs

These inputs remain fake by default and intentionally fail the build if their
unconfirmed real source is selected.

| Sensor input | Blocker before real enablement |
| --- | --- |
| Water temperature | Confirm ADC channel, divider topology, reference voltage, protection/front-end and NTC transfer parameters. |
| EGT | Confirm MAX31856 SPI SCK/MISO/MOSI/CS pins, thermocouple wiring and converter configuration. |
| Knock | Confirm TPIC8101 SPI pins, HOLD/window pin, signal conditioning and crank-window timing path. |

## Boundary Rule

Sensor bindings stop at acquisition and publication. The sensor subsystem
publishes readings, events, health and faults; it does not command final
ignition, RPM/load limits, power-jet targets, exhaust-valve targets, map
activation, rider alerts, latching, acknowledgement or shutdown.
