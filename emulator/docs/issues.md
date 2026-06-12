# Open Issues

- EGT physical reading is stuck at `1000` and does not respond to the GPIO2 potentiometer. UI override still drives the EGT output correctly.

# Resolved Issues

- TPS output was non-linear on GPIO18/DAC_2 because the LOLIN ESP32-S2 mini pulls that net up. TPS now uses GPIO16 LEDC PWM with an external `1k` + `4.7uF` low-pass filter.
