# Sensor Subsystem Testing Guide

This guide covers testing the sensor-only implementation added under:

* `idf/components/sensors`
* `idf/components/sensor_drivers`

The sensor subsystem is not wired into `idf/main/main.c` yet. Current testing is
therefore split into host-domain tests, build-boundary checks and later ESP32
adapter/HITL checks.

## 1. Host Domain Tests On Windows 11

Run these from the repository root in PowerShell.

```powershell
cmake -S idf/components/sensors/tests/host -B build/sensors-host
cmake --build build/sensors-host
ctest --test-dir build/sensors-host --output-on-failure
```

Expected result:

* CMake configures the host test project.
* The `sensor_domain` static library and `sensor_domain_tests` executable build.
* CTest reports `100% tests passed`.

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

## 2. Host Domain Tests In WSL

From WSL, install the basic toolchain once:

```bash
sudo apt update
sudo apt install -y build-essential cmake ninja-build
```

Then run from the repository root mounted in WSL:

```bash
cmake -S idf/components/sensors/tests/host -B build/sensors-host
cmake --build build/sensors-host
ctest --test-dir build/sensors-host --output-on-failure
```

These tests do not require ESP-IDF. They verify the C++ domain contracts,
sensor objects, fake ports, service phases and `SensorDataStore` behavior.

## 3. Existing Emulator Regression Tests

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

## 4. Boundary Checks

The sensor domain must stay independent from ESP-IDF drivers and non-sensor
systems. Run these from the repository root.

```powershell
rg -n '#include\s+[<"](esp_|driver/|freertos/|nvs|esp_http|esp_wifi|mqtt)' idf/components/sensors
```

Expected result:

* No output.
* `rg` may return exit code `1`; that is normal for "no matches".

Check that the new sensor components do not reference Web UI, storage,
telemetry, OTA, actuators, or main ECU wiring:

```powershell
rg -n 'webui|telemetry|storage|mqtt|ota|CDI|power_jet|exhaust|actuator|app_main|esp_http|nvs|wifi' idf/components/sensors idf/components/sensor_drivers
```

Expected result:

* No output.
* Exit code `1` is acceptable for "no matches".

## 5. ESP-IDF Build On PC

Use an ESP-IDF environment shell, not a generic PowerShell, unless your PATH and
`IDF_PATH` are already configured.

On Windows, open the ESP-IDF PowerShell or CMD shortcut installed by Espressif.
Then run:

```powershell
idf.py -C idf set-target esp32s3
idf.py -C idf build
```

Expected result:

* The project configures with ESP-IDF.
* `idf/components/sensors` and `idf/components/sensor_drivers` compile.
* `idf/main/main.c` still builds as the empty app entrypoint.

If you see an error like:

```text
include could not find requested file: /tools/cmake/project.cmake
```

then ESP-IDF is not active in that shell. Open the ESP-IDF shell or export
`IDF_PATH` before building.

## 6. Later ESP32 Hardware Testing

After the sensor subsystem is wired into runtime code, use the normal ESP-IDF
flash and monitor flow:

```powershell
idf.py -C idf -p COMx flash monitor
```

Replace `COMx` with the ESP32-S3 serial port.

Initial hardware validation should be sensor-by-sensor:

* TPS: ADC sweep, rapid closure, disconnect, short to ground and short to supply.
* Pickup: falling-edge capture, RPM ramps, duplicate edges, missing edges and high-RPM operation.
* EGT: MAX31856 SPI read, open thermocouple, converter fault and controlled heating.
* Water temperature: NTC cold value, gradual heating, open/short and stale sample.
* Quick shifter: active-low press/release, bounce, long hold and startup-active state.
* Map switch: both physical states, bounce and startup state.
* Knock: TPIC8101 configuration, integration-window timing, valid result, missing result, saturation and SPI fault.

Important: sensor tests should verify published readings, events, health,
quality and fault bits. They should not expect sensors to command ignition,
actuators, map selection, shutdown or final derating.

## 7. What To Run Before Committing Sensor Changes

Minimum local check:

```powershell
cmake -S idf/components/sensors/tests/host -B build/sensors-host
cmake --build build/sensors-host
ctest --test-dir build/sensors-host --output-on-failure
```

Recommended full local check:

```powershell
cmake --build build/sensors-host
ctest --test-dir build/sensors-host --output-on-failure
cd emulator
python -m unittest discover tests
```

Recommended ESP-IDF check, from an ESP-IDF shell:

```powershell
idf.py -C idf build
```
