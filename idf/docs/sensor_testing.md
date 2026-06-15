# Sensor Subsystem Testing Guide

This guide covers testing the sensor implementation under:

* `idf/components/sensors`
* `idf/components/sensor_drivers`
* `idf/components/sensor_harness`
* `idf/main/main.cpp`

The ESP-IDF app now includes a small sensor harness. By default it runs in
fake mode, which feeds deterministic samples into the real sensor services and
prints plot-friendly CSV over serial. Real mode can be compiled separately for
the currently confirmed ESP32-S3 inputs: TPS, quick-shifter and map switch.

## 1. Host Tests First

Run these from the repository root in PowerShell:

```powershell
cmake -S idf/components/sensors/tests/host -B build/sensors-host
cmake --build build/sensors-host
ctest --test-dir build/sensors-host --output-on-failure
```

Expected result:

* CMake configures the host test project.
* `sensor_domain_tests` builds and runs.
* CTest reports `100% tests passed`.

These tests do not require ESP-IDF or an ESP32-S3. They verify the sensor
domain, service contracts, fake sources, data store behavior, CSV formatting
and fake harness stimulus path.

If CMake cannot find a compiler, install one of:

* Visual Studio 2022 Build Tools with the C++ workload.
* MSYS2 or MinGW-w64.
* Ninja, if your CMake installation defaults to Ninja.

With Visual Studio generator explicitly:

```powershell
cmake -S idf/components/sensors/tests/host -B build/sensors-host-vs -G "Visual Studio 17 2022" -A x64
cmake --build build/sensors-host-vs --config Debug
ctest --test-dir build/sensors-host-vs -C Debug --output-on-failure
```

## 2. ESP-IDF Environment

Use an ESP-IDF PowerShell or CMD shortcut. If you are in a normal PowerShell
and ESP-IDF is installed at `C:\esp\v5.5.4\esp-idf`, activate it with:

```powershell
$env:IDF_PATH = "C:\esp\v5.5.4\esp-idf"
. "$env:IDF_PATH\export.ps1"
```

Check that `idf.py` works:

```powershell
idf.py --version
```

Expected result:

* `idf.py` prints the ESP-IDF version.
* If `idf.py` is not found, open the ESP-IDF shell or run the matching
  `export.ps1` for your local ESP-IDF installation.

## 3. Build Fake Harness Mode

Fake mode is the default. It compiles `idf/main/main.cpp` with
`SENSOR_HARNESS_FAKE_MODE=1`, injects synthetic TPS, water, EGT, pickup,
quick-shifter, map-switch and knock samples, and prints the resulting sensor
snapshot.

From the repository root:

```powershell
idf.py -C idf set-target esp32s3
idf.py -C idf build
```

Expected result:

* The project configures for `esp32s3`.
* `sensors`, `sensor_drivers`, `sensor_harness` and `main.cpp` compile.
* The final message says `Project build complete`.

## 4. Flash And Monitor Fake Mode

Connect the ESP32-S3 and find its serial port. On Windows, this is usually
`COM3`, `COM4`, or another `COMx` device.

```powershell
idf.py -C idf -p COMx flash monitor
```

Replace `COMx` with the actual serial port.

Expected startup lines:

```text
# sensor_harness_mode,fake
# t_us,tps_permille,tps_valid,rpm,rpm_valid,egt_c,water_c,qs_active,map_secondary,knock_raw,knock_valid
```

Expected sample lines:

```text
1234567,512,1,600.0,1,42.5,31.0,0,0,1180,1
# event,quick_shift,1,500000,0,0
# event,map_switch,1,3000000
```

The exact numbers will differ, but the shape should remain:

* One CSV row about every 100 ms.
* `tps_permille` changes over time.
* `rpm_valid` becomes `1` after enough pickup captures.
* `egt_c` and `water_c` change over time in fake mode.
* `knock_raw` changes and `knock_valid` should be `1` in fake mode.
* Event lines start with `# event,...` and can be filtered separately.

Exit the monitor with `Ctrl+]`.

## 5. Reading And Plotting Output

For quick inspection, use `idf.py monitor` directly. CSV rows are numeric and
can be copied into a spreadsheet. Lines beginning with `#` are comments or
events.

To log monitor output to a file, use the terminal capture feature or redirect
from your serial tool. Keep only data rows for a simple plot:

```powershell
Select-String -Path sensor-log.txt -Pattern '^\d' | Set-Content sensor-data.csv
```

Useful plots:

* `t_us` vs `tps_permille`
* `t_us` vs `rpm`
* `t_us` vs `egt_c`
* `t_us` vs `water_c`
* `t_us` vs `knock_raw`

Event lines are useful for checking discrete inputs:

```text
# event,quick_shift,<active>,<activated_at>,<released_at>,<duration_us>
# event,map_switch,<secondary>,<acquired_at>
# event,fault,<fault_id>,<health_id>,<first_at>,<last_at>,<count>
```

## 6. Optional Real-Input Mode

Real mode is compile-time selected and currently enables only the confirmed
simple inputs:

| Signal | ESP32-S3 pin | Harness channel |
| --- | --- | --- |
| TPS | GPIO7 / ADC1_CH6 | `tps` |
| Quick-shifter digital output | GPIO9 | `quick` |
| Map switch | GPIO14 | `map` |

Build real mode into a separate build directory so it does not disturb the
default fake-mode build:

```powershell
idf.py -C idf -B build-real -DIDF_TARGET=esp32s3 "-DCMAKE_CXX_FLAGS=-DSENSOR_HARNESS_FAKE_MODE=0" build
```

Flash and monitor real mode:

```powershell
idf.py -C idf -B build-real -p COMx flash monitor
```

Expected startup lines:

```text
# sensor_harness_mode,real
# real_inputs,tps_gpio7_adc1_ch6,quick_gpio9,map_gpio14
# t_us,tps_permille,tps_valid,rpm,rpm_valid,egt_c,water_c,qs_active,map_secondary,knock_raw,knock_valid
```

In real mode:

* Move a potentiometer or known 0-3.3 V source on GPIO7 and watch
  `tps_permille`.
* Toggle the quick-shifter input on GPIO9 and watch `qs_active` plus
  `# event,quick_shift,...` lines.
* Toggle the map switch on GPIO14 and watch `map_secondary` plus
  `# event,map_switch,...` lines.
* `rpm`, `egt_c`, `water_c` and `knock_raw` are not expected to validate in
  this first real-mode pass because pickup, MAX31856, NTC and TPIC/knock
  hardware wiring are still intentionally disabled.

## 7. Sensor-By-Sensor Hardware Checks

Start with one input at a time. Do not connect all uncertain hardware at once.

TPS:

* Confirm GPIO7 receives only 0-3.3 V.
* Sweep from near 0 V to near 3.3 V.
* Confirm `tps_permille` moves from near `0` to near `1000`.
* Short-to-ground or over-range tests should be done only through safe test
  fixtures, not by directly abusing the ESP32 pin.

Quick shifter:

* Confirm the input is active-low before testing.
* Toggle GPIO9 low and high.
* Confirm `qs_active` changes and a quick-shift event appears.
* Test bounce and long-hold behavior after basic toggling works.

Map switch:

* Toggle GPIO14 between the two switch states.
* Confirm `map_secondary` changes.
* Confirm a map-switch event appears only when the stable requested state
  changes.

Later hardware stages:

* Pickup: add an ISR-safe capture path before high-RPM testing.
* EGT: enable MAX31856 SPI only after CS/SCK/MISO/MOSI and thermocouple wiring
  are confirmed.
* Water temperature: enable the NTC ADC binding only after the divider and ADC
  channel are confirmed.
* Knock: enable TPIC8101 window control only after SPI, HOLD/window pin and
  signal-conditioning wiring are confirmed.

Important: sensor tests should verify published readings, events, health,
quality and fault bits. They should not expect sensors to command ignition,
actuators, map selection, shutdown or final derating.

## 8. Boundary Checks

The sensor domain should stay independent from ESP-IDF drivers and non-sensor
systems. Run these from the repository root:

```powershell
rg -n '#include\s+[<"](esp_|driver/|freertos/|nvs|esp_http|esp_wifi|mqtt)' idf/components/sensors
```

Expected result:

* No output.
* `rg` may return exit code `1`; that is normal for "no matches".

Check that sensor components do not reference Web UI, storage, telemetry, OTA,
actuators, or main ECU wiring:

```powershell
rg -n 'webui|telemetry|storage|mqtt|ota|CDI|power_jet|exhaust|actuator|app_main|esp_http|nvs|wifi' idf/components/sensors idf/components/sensor_drivers
```

Expected result:

* No output.
* Exit code `1` is acceptable for "no matches".

## 9. Existing Emulator Regression Tests

These are not the main sensor-domain tests, but they confirm the existing
emulator/web-builder checks still pass.

Run from the `emulator` folder:

```powershell
cd emulator
python -m unittest discover tests
```

Expected result:

* All Python tests pass.

Run from `emulator`, not the repository root, because one test imports
`web_builder.py` from that folder.

## 10. What To Run Before Committing Sensor Changes

Minimum local check:

```powershell
cmake -S idf/components/sensors/tests/host -B build/sensors-host
cmake --build build/sensors-host
ctest --test-dir build/sensors-host --output-on-failure
```

Recommended ESP-IDF checks, from an ESP-IDF shell:

```powershell
idf.py -C idf build
idf.py -C idf -B build-real -DIDF_TARGET=esp32s3 "-DCMAKE_CXX_FLAGS=-DSENSOR_HARNESS_FAKE_MODE=0" build
```

Recommended full local check:

```powershell
cmake --build build/sensors-host
ctest --test-dir build/sensors-host --output-on-failure
idf.py -C idf build
cd emulator
python -m unittest discover tests
```
