# Open Issues

- EGT physical reading is stuck at `1000` and does not respond to the GPIO2 potentiometer. UI override still drives the EGT output correctly.
- TPS output is non-linear at low input values: it follows TPS correctly in the upper half, but below about `1.5V` input the output rises back from about `1.75V` to `2.0V` and stays there even when TPS input is `0V`. The same behavior appears with UI manual override.
