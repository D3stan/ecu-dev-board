# Sensor Subsystem Testing Guide

This guide covers testing the sensor implementation under:

* `idf/components/sensors`
* `idf/components/sensor_drivers`
* `idf/components/sensor_harness`
* `idf/main/main.cpp`

The ESP-IDF app includes a sensor harness. By default every sensor source is
fake, which feeds deterministic samples into the real sensor services and prints
plot-friendly CSV over serial. Each sensor can then be switched to a confirmed
real input through ESP-IDF configuration.

The current sensor-only input binding table is in
[sensor_bindings.md](sensor_bindings.md). That document excludes actuator, CDI,
map authority, shutdown and other ECU-output ownership.

## 1. Host Tests

No ESP-IDF or hardware required. Run from the `idf/` folder.

**Windows (PowerShell)**

```powershell
Remove-Item -Recurse -Force build/sensors-host
cmake -S components/sensors/tests/host -B build/sensors-host
cmake --build build/sensors-host
ctest --test-dir build/sensors-host --output-on-failure
```

**Linux / macOS**

```bash
rm -rf build/sensors-host
cmake -S components/sensors/tests/host -B build/sensors-host
cmake --build build/sensors-host
ctest --test-dir build/sensors-host --output-on-failure
```

Expected: CTest reports `100% tests passed`.

These tests verify the sensor domain, service contracts, fake sources, data
store, CSV formatting and fake harness stimulus path. They also compile
no-ESP helper logic from the driver layer (ADC sample mapping, GPIO queue
behavior, MCPWM capture mapping).

SPI driver-level tests for MAX31856 and TPIC8101 are intentionally deferred;
their behavior is validated here through domain-level injected samples.

> [!TIP]
> Always do a clean `Remove-Item`/`rm -rf` on the build directory before
> rebuilding if tests crash unexpectedly — a stale binary is the most common
> cause of spurious segfaults.

### Compiler not found?

* **Windows**: install Visual Studio 2022 Build Tools (C++ workload), MSYS2 /
  MinGW-w64, or Strawberry Perl (which ships GCC).
* **Linux**: `sudo apt install build-essential cmake` (Debian/Ubuntu) or
  equivalent.
* **Visual Studio generator** (Windows alternative):
  ```powershell
  cmake -S components/sensors/tests/host -B build/sensors-host-vs -G "Visual Studio 17 2022" -A x64
  cmake --build build/sensors-host-vs --config Debug
  ctest --test-dir build/sensors-host-vs -C Debug --output-on-failure
  ```

## 2. Build Default All-Fake Harness

All-fake mode is the default ESP-IDF configuration. It injects synthetic TPS,
water, EGT, pickup, quick-shifter, map-switch and knock samples, then prints
the resulting sensor snapshot.

From the repository root (requires an ESP-IDF shell or sourced `export.ps1`):

```powershell
idf.py -C idf set-target esp32s3
idf.py -C idf build
```

Expected: `Project build complete`.

## 3. Flash And Monitor All-Fake Mode

Connect the ESP32-S3 and find its serial port (`COMx` on Windows, `/dev/ttyUSBx`
or `/dev/cu.usbserialx` on Linux/macOS):

```powershell
idf.py -C idf -p COMx flash monitor
```

Expected startup lines:

```text
# sensor_harness_mode,mixed
# sensor_harness_sources,tps=fake,water=fake,egt=fake,quick=fake,map=fake,pickup=fake,knock=fake
# real_inputs,none
# t_us,tps_permille,tps_valid,rpm,rpm_valid,egt_c,water_c,qs_active,map_secondary,knock_raw,knock_valid
```

Expected sample lines:

```text
1234567,512,1,600.0,1,42.5,31.0,0,0,1180,1
# event,quick_shift,1,500000,0,0
# event,map_switch,1,3000000
```

* One CSV row about every 100 ms.
* `tps_permille` changes over time.
* `rpm_valid` becomes `1` after enough pickup captures.
* `egt_c` and `water_c` change over time when those sources are fake.
* `knock_raw` changes and `knock_valid` should be `1` when knock is fake.
* Event lines start with `# event,...` and can be filtered separately.

Exit the monitor with `Ctrl+]`.

## 4. Reading And Plotting Output

CSV rows are numeric and can be copied into a spreadsheet. Lines beginning with
`#` are comments or events.

To keep only data rows from a captured log:

```powershell
# Windows
Select-String -Path sensor-log.txt -Pattern '^\d' | Set-Content sensor-data.csv
```

```bash
# Linux / macOS
grep '^[0-9]' sensor-log.txt > sensor-data.csv
```

Useful plots: `t_us` vs `tps_permille`, `rpm`, `egt_c`, `water_c`, `knock_raw`.

Event line formats:

```text
# event,quick_shift,<active>,<activated_at>,<released_at>,<duration_us>
# event,map_switch,<secondary>,<acquired_at>
# event,fault,<fault_id>,<health_id>,<first_at>,<last_at>,<count>
```

## 5. Optional Mixed Real/Fake Sources

Each sensor source is compile-time selected through ESP-IDF configuration.
Currently confirmed real inputs:

| Signal | ESP32-S3 pin | Harness channel |
| --- | --- | --- |
| TPS | GPIO7 / ADC1_CH6, calibrated to millivolts | `tps` |
| Quick-shifter | GPIO9 | `quick` |
| Map switch | GPIO14 | `map` |
| Pickup square wave | GPIO21 / MCPWM capture | `pickup` |

```powershell
idf.py -C idf menuconfig
```

Select:

```text
ECU sensor harness
  TPS source → Real ADC1_CH6 / GPIO7
  Quick-shifter source → Real GPIO9 input
  Map-switch source → Real GPIO14 input
  Pickup source → Real GPIO21 MCPWM falling-edge capture
```

Leave water temperature, EGT and knock on fake defaults until their real wiring
is confirmed. Save, exit, then:

```powershell
idf.py -C idf build
idf.py -C idf -p COMx flash monitor
```

Useful mixed configurations:

| Test goal | TPS | Quick | Map | Pickup | Water/EGT/Knock |
| --- | --- | --- | --- | --- | --- |
| TPS physical sweep only | Real ADC | Fake | Fake | Fake | Fake |
| Confirmed simple inputs | Real ADC | Real GPIO | Real GPIO | Fake | Fake |
| Pickup simulator/HITL | Real or fake | Fake | Fake | Real GPIO21 capture | Fake |

> [!WARNING]
> Do not enable `Expose unconfirmed real sensor source options` for normal
> bring-up. Selecting real water, EGT or knock will intentionally stop the
> build with a message listing the missing board binding.

## 6. Sensor-By-Sensor Hardware Checks

Start with one input at a time.

**TPS**: Confirm GPIO7 receives only 0–3.3 V. Sweep from near 0 V to near 3.3 V
and confirm `tps_permille` moves from near `0` to near `1000`.

**Quick shifter**: Confirm the input is active-low. Toggle GPIO9 low/high and
confirm `qs_active` changes and a quick-shift event appears.

**Map switch**: Toggle GPIO14 and confirm `map_secondary` changes and a
map-switch event appears only when the stable requested state changes.

**Pickup**: Wire the signal conditioner output to GPIO21. Feed a 0–3.3 V
push-pull square wave (falling edges only). At 416.667 Hz, confirm `rpm_valid`
becomes `1` and `rpm` is near 25,000. Drop one pulse and confirm RPM becomes
stale before recovering.

**Later stages**:

* EGT: enable MAX31856 SPI after CS/SCK/MISO/MOSI and thermocouple wiring are
  confirmed.
* Water temperature: enable the NTC ADC binding after divider, ADC channel,
  reference voltage and NTC transfer parameters are confirmed.
* Knock: enable TPIC8101 window control after SPI, HOLD/window pin and
  signal-conditioning wiring are confirmed.

Sensor tests verify published readings, events, health, quality and fault bits.
They do not command ignition, actuators, map selection, shutdown or derating.

## 7. Boundary Checks

The sensor domain must stay independent from ESP-IDF drivers and non-sensor
systems. Run from the repository root:

```bash
rg -n '#include\s+[<"](esp_|driver/|freertos/|nvs|esp_http|esp_wifi|mqtt)' idf/components/sensors
```

```bash
rg -n 'webui|telemetry|storage|mqtt|ota|CDI|power_jet|exhaust|actuator|app_main|esp_http|nvs|wifi' idf/components/sensors idf/components/sensor_drivers
```

Expected: no output (`rg` exit code `1` for no matches is normal).

## 8. What To Run Before Committing

Minimum:

```bash
cmake -S components/sensors/tests/host -B build/sensors-host
cmake --build build/sensors-host
ctest --test-dir build/sensors-host --output-on-failure
```

Recommended full check:

```bash
cmake --build build/sensors-host
ctest --test-dir build/sensors-host --output-on-failure
idf.py -C idf build
cd emulator && python -m unittest discover tests
```
