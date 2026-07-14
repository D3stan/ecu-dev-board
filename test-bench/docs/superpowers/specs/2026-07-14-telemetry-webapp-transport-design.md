# Test-Bench Telemetry and Web Application Transport Design

## Goal

Add the working telemetry, HTTP/WebSocket server, hosted WebUI, and browser-side
Digital Twin bridge from `../idf` to the ESP32-S2 test-bench firmware without
disturbing the existing C ignition-control timing path.

The transported WebUI remains visually and behaviorally unchanged. The firmware
adapts the test bench to the WebUI's existing `ecu.telemetry.v1` contract,
publishes every real value currently available from the bench, and supplies
deterministic simulated values for the sensors that are not fitted to this
hardware.

## Scope

The work includes:

- A transport-neutral telemetry collector.
- Wi-Fi station startup and reconnect handling.
- An HTTP server on port 80 by default.
- A `/ws` WebSocket endpoint with one active client and newest-client-wins
  replacement.
- `ecu.telemetry.v1` capabilities and telemetry frames.
- Static WebUI delivery from a dedicated SPIFFS partition.
- NVS persistence for the existing automatic Digital Twin recording flag.
- Device identity and firmware revision in the capabilities frame.
- The existing browser-owned Digital Twin forwarding and recording workflow.
- Deterministic simulated EGT, water temperature, quick-shifter, map-switch,
  and knock values.
- An additive `state.test_bench` JSON object carrying the bench-specific
  ignition diagnostics that the unchanged UI does not display.

The work does not include:

- Any visual, navigation, interaction, or data-model change in the WebUI.
- New ECU control commands.
- Runtime Wi-Fi provisioning.
- TLS termination on the ESP32.
- New automated test files.
- Hardware or browser test execution as a completion requirement.
- Importing the reference project's generic sensor, sensor-driver, or sensor-
  harness components.

## Approved approach

Use a mixed C/C++ compatibility bridge.

The existing button, TPS, pickup, ignition-map, status-LED, and engine-control
modules remain C. Their ISR ownership and timing behavior do not move into C++.
New portable telemetry types, collection, simulation, JSON serialization, and
server orchestration use C++17 so the working reference implementation can be
transported with focused changes.

The boundary between the two languages is a plain C header. It exposes only
fixed-layout C structures, a callback plus context pointer, a server
configuration structure, and a C-callable start function. The boundary does
not expose STL types, C++ references, exceptions, or engine-domain headers.

## System architecture

```text
Pickup/TPS/button hardware
        |
        v
Existing C control modules and ISRs
        |
        | bounded read-only snapshots
        v
main/telemetry_bridge.c
        |
        | telemetry_source_read_fn + void *context
        v
C++17 telemetry collector and simulation model
        |
        | typed TelemetryBatch
        v
JSON serializer and backpressure-aware telemetry pump
        |
        v
ESP-IDF HTTP/WebSocket server
        |------------------------------|
        v                              v
     GET /ws                         GET /*
        |                              |
        v                              v
Unchanged WebUI adapter        WebUI files from SPIFFS
        |
        | optional browser-owned forwarding
        v
Digital Twin service at ecu.0xpuddu.com
```

The ESP32-S2 is single-core, so the reference ESP32-S3 division between a
control core and a networking core cannot be preserved. The telemetry pump and
HTTP task use priorities lower than the application control tasks. The existing
IRAM GPIO and GPTimer interrupt path continues to own pickup capture and pulse
scheduling, so network or filesystem work never enters an ISR.

## Source structure

### `components/telemetry`

This component is transport-neutral and has no dependency on Wi-Fi, HTTP,
SPIFFS, NVS, or the test-bench engine headers.

- `include/telemetry/telemetry_source.h`
  - C-compatible engine-state enum.
  - `telemetry_real_sample_t` with real bench values and metadata.
  - `telemetry_source_read_fn` and `telemetry_source_t`.
- `include/telemetry/telemetry_types.hpp`
  - V1 metadata, state, event, overflow, bench-extension, and batch types.
- `include/telemetry/telemetry_collector.hpp`
  - Single-owner collector interface.
- `src/telemetry_collector.cpp`
  - Calls the C source callback.
  - Maintains frame generation and transport-facing sequences.
  - Calculates RPM acceleration.
  - Advances the deterministic simulation.
  - Detects simulated state transitions and real diagnostic-counter changes.
  - Maintains a bounded event backlog and emits at most the configured event
    count per batch.
- `CMakeLists.txt`
  - Registers the source and enables C++17.

### `components/telemetry_server`

This component adapts typed batches to the network and static application.
Unlike the 915-line reference runtime file, the transported runtime is divided
by responsibility.

- `include/telemetry_server/telemetry_server.h`
  - C-callable configuration and start API.
- `include/telemetry_server/telemetry_transport.hpp`
  - Send-capable transport abstraction and counters.
- `include/telemetry_server/telemetry_pump.hpp`
  - Backpressure-aware collection and send policy.
- `include/telemetry_server/telemetry_json_serializer.hpp`
  - Capabilities, recording configuration, and telemetry serialization.
- `include/telemetry_server/static_file_resolver.hpp`
  - Portable safe static-path resolution.
- `src/wifi_station.cpp`
  - NVS/network/event-loop/Wi-Fi STA initialization and reconnect handling.
- `src/static_file_resolver.cpp`
  - URI normalization, MIME selection, gzip lookup, SPA fallback, and traversal
    rejection.
- `src/static_file_server.cpp`
  - SPIFFS mounting and bounded chunked file responses.
- `src/websocket_transport.cpp`
  - One-client session ownership, asynchronous-send lifetime, replacement, and
    transport counters.
- `src/recording_settings.cpp`
  - NVS load/save for the automatic-recording flag and strict JSON command
    parsing.
- `src/telemetry_json_serializer.cpp`
  - Wire-contract serialization.
- `src/telemetry_pump.cpp`
  - Does not collect when disconnected or while a send is pending.
- `src/device_identity.cpp`
  - ESP32-S2 HWID, hardware revision, flash size, chip model, and git-derived
    firmware version.
- `src/telemetry_server.cpp`
  - Application composition, handler registration, task creation, and the
    public C API.
- `CMakeLists.txt`
  - Component dependencies and SPIFFS image creation from root `data/`.

### `main`

- Create `main/telemetry_bridge.h` and `main/telemetry_bridge.c`.
  - Read engine and TPS snapshots.
  - Populate `telemetry_real_sample_t`.
  - Build `telemetry_server_config_t` exclusively from
    `main/test-bench_config.h` macros.
  - Start the server and return its error to `app_main()`.
- Modify `main/test-bench.c`.
  - Initialize telemetry last, after all engine tasks and the button input are
    operational.
  - Log a telemetry-start error without stopping engine control.
  - Remove the old log-only telemetry task or retain it under the separate
    `TELEMETRY_UART_LOG_ENABLED` switch, which defaults to disabled.
- Modify `main/CMakeLists.txt`.
  - Add the bridge source and explicit `telemetry_server` dependency.

### Existing real-time modules

- Extend `engine_snapshot_t` with a revolution sequence and reference
  timestamp suitable for task-context telemetry.
- Record the GPTimer-to-boot-monotonic epoch during controller initialization
  and derive accepted-reference timestamps without calling wall-clock or
  network APIs from the pickup ISR.
- Add `tps_snapshot_t` and `tps_get_snapshot()` for task-context telemetry.
  The snapshot contains percent, acquisition time, sequence, and validity.
- Preserve the current lock-free `IRAM_ATTR tps_get_percent()` because the
  pickup ISR uses it for ignition-map lookup.
- Protect the wider task-context TPS snapshot with a short critical section;
  do not add that lock to the ISR read path.

## C compatibility interface

The C sample contains only real observations:

```c
typedef struct {
    uint64_t observed_at_us;
    uint64_t rpm_acquired_at_us;
    uint64_t tps_acquired_at_us;
    uint64_t revolution_id;
    uint32_t rpm;
    uint32_t period_us;
    uint32_t fire_delay_us;
    uint32_t rejected_edge_count;
    uint32_t late_fire_count;
    uint32_t schedule_error_count;
    uint32_t tps_sequence;
    uint16_t advance_tenths;
    uint8_t tps_percent;
    telemetry_engine_state_t engine_state;
    bool tps_valid;
} telemetry_real_sample_t;

typedef bool (*telemetry_source_read_fn)(void *context,
                                         telemetry_real_sample_t *sample);

typedef struct {
    telemetry_source_read_fn read;
    void *context;
} telemetry_source_t;
```

The server copies its configuration and source descriptor during start. The
source callback and its context must remain valid for the firmware lifetime.
The callback performs bounded snapshot reads only and never blocks on the
network or filesystem.

## Wire contract

The unchanged WebUI remains the fixed consumer. Firmware therefore preserves:

- WebSocket path `/ws`.
- UTF-8 JSON text frames.
- Schema identity `ecu.telemetry.v1` and schema version `1`.
- One `capabilities` frame when a client connects.
- Periodic `telemetry` frames at 10 Hz by default.
- `recording_config` responses after accepted setting changes.
- Existing state object names, metadata keys, events, source-overflow object,
  and transport counters.
- Unknown-field compatibility.

The capabilities frame includes the current fields expected by the WebUI:

- Schema, version, paths, state rate, and events-per-batch.
- Device HWID, hardware revision, chip model, flash size, and firmware version.
- Automatic-recording enabled state and its RPM/start/stop thresholds.

The HWID prefix uses `esp32s2`, not the reference implementation's hard-coded
`esp32s3` prefix.

## Real telemetry mapping

### RPM and synchronization

- `state.rpm.rpm` is the controller RPM.
- `state.rpm.period_us` is the last accepted pickup period.
- `state.rpm.accel_rpm_per_s` is calculated from consecutive collected real RPM
  values and their observation times. It is zero when the interval is invalid
  or the engine is not synchronized.
- `state.rpm.synchronized` is true only in
  `ENGINE_STATE_SYNCHRONIZED`.
- `state.rpm.crank_reference_trusted` has the same value as synchronized for
  this one-reference-per-revolution bench.
- `state.rpm.revolution_id` is the controller's accepted-revolution sequence.
- `state.rpm.reference_at_us` is the accepted pickup-reference timestamp.
- RPM metadata sequence uses the accepted-revolution sequence. Acquisition time
  uses the accepted reference timestamp.
- RPM validity/health is `false/Stale` for no signal,
  `false/Stabilizing` during acquisition, and `true/Valid` while synchronized.

### TPS

- `state.tps.permille` is the filtered TPS percent multiplied by ten.
- `state.tps.pct` is the equivalent percentage serialized for compatibility.
- `state.tps.fallback_permille` equals the current real value because this
  bench has no separate TPS fallback policy.
- `state.tps.fallback_used` is false.
- TPS metadata uses the sample task's timestamp, sequence, and validity.

### Ignition and diagnostics

The unchanged UI currently obtains ignition angle from the knock-summary
object. `state.knock.ignition_angle_deg` therefore carries the real
`advance_tenths / 10.0` value while the rest of the knock record remains
simulated.

Every frame also includes this additive object inside `state`:

```json
"test_bench": {
  "engine_state": "synchronized",
  "advance_tenths": 280,
  "fire_delay_us": 833,
  "rejected_edges": 0,
  "late_fires": 0,
  "schedule_errors": 0
}
```

The current UI ignores this unknown object. The Digital Twin bridge forwards
the raw frame and retains it.

## Deterministic simulation

Simulation state belongs to the telemetry collector and never feeds engine
control. It advances only from real sample values and ECU monotonic time. Given
the same initial state and sequence of timestamped real samples, it produces
the same output.

Each simulated object includes an additive `"origin":"simulated"` field.
Real objects use `"origin":"measured"` or `"origin":"derived"`. The current
adapter ignores origin; raw Digital Twin recordings preserve it.

### EGT

- Ambient/start value: 20 degrees Celsius.
- When unsynchronized, target: 20 degrees Celsius.
- When synchronized, target:
  `200 + 0.025 * rpm + 3.0 * tps_percent` degrees Celsius.
- Target clamp: 20 through 900 degrees Celsius.
- Maximum heating rate: 80 degrees Celsius per second.
- Maximum cooling rate: 30 degrees Celsius per second.
- Thermal state thresholds: Cold below 100, Warming below 300, Normal below
  750, High below 850, and Critical at or above 850 degrees Celsius.
- Request is Normal through Normal state, Warning in High state, and
  CriticalProtectionRequested in Critical state.

### Water temperature

- Ambient/start value: 20 degrees Celsius.
- When unsynchronized, target: 20 degrees Celsius.
- When synchronized, target:
  `45 + 0.002 * rpm + 0.25 * tps_percent` degrees Celsius.
- Target clamp: 20 through 115 degrees Celsius.
- Maximum heating rate: 5 degrees Celsius per second.
- Maximum cooling rate: 2 degrees Celsius per second.
- Thermal state thresholds: Cold below 40, Warming below 70, Normal below 100,
  High below 110, and Critical at or above 110 degrees Celsius.
- Request is Normal through Normal state, Warning in High state, and
  CriticalProtectionRequested in Critical state.

### Quick-shifter

- Armed when the engine is synchronized and RPM is at least 1,500.
- While armed, active for the first 100 milliseconds of each eight-second ECU
  monotonic-time window.
- Inactive and unarmed after synchronization loss.
- Active-state transitions produce the existing `QuickShiftRequest` event.

### Physical map request

- Primary below 70 percent TPS.
- Secondary at or above 70 percent TPS.
- Request changes produce the existing `MapSwitchChange` event.

### Knock summary

- Always present so the existing interface retains its current populated
  sensor card.
- Uses the real revolution ID, pickup time, RPM, TPS, and ignition advance.
- Window-open, window-close, and read timestamps are deterministic offsets of
  100, 600, and 700 microseconds from the pickup reference.
- Normalized index is
  `0.5 + rpm / 5000.0 + tps_percent / 100.0`.
- Candidate knock is true when the normalized index is at least 4.0.
- `raw_integrator_count` is the normalized index multiplied by 100 and rounded.
- Background estimate is 100.
- Validity follows engine synchronization.

The simulation constants are defined in `main/test-bench_config.h`, not buried
inside UI or serializer code.

## Events and congestion

The collector owns a bounded event backlog with a capacity of 32 records and
emits at most eight records per telemetry batch by default.

- Quick-shifter transitions use `QuickShiftRequest`.
- Map transitions use `MapSwitchChange`.
- A rejected-edge counter increase produces an aggregate `FaultTransition`
  with fault `Noise`.
- A late-fire counter increase produces an aggregate `FaultTransition` with
  fault `WindowTiming`.
- A schedule-error counter increase produces an aggregate `FaultTransition`
  with fault `DeviceFault`.

Counter events report the increase since the previous collected real sample.
They therefore preserve aggregate evidence across a disconnect even though
intermediate latest-state frames are replaceable. Simulated transitions that
occur entirely while no client is connected are not reconstructed on
reconnect; the next frame still reports the correct latest simulated state.

The telemetry pump applies the reference backpressure rule:

- Do not call the collector when no WebSocket client is connected.
- Do not call the collector while the previous asynchronous send is pending.
- Count a pump tick skipped for a pending send as a transport drop.
- Serialize and send only after the transport reports ready.
- On an asynchronous send error, increment the send-error counter and close
  the active telemetry session.

The engine-control path never waits for telemetry completeness.

## Wi-Fi, server, and recording behavior

Wi-Fi uses station mode. Credentials come from `main/test-bench_config.h`.
Runtime provisioning is outside this scope.

- Empty SSID while the server is enabled returns `ESP_ERR_INVALID_ARG` from
  telemetry startup.
- Password-empty configuration uses open-network authentication.
- Non-empty passwords require WPA2-PSK or stronger access points.
- Credentials are copied with bounds, never logged, and never serialized.
- Wi-Fi reconnect is requested after station disconnect.
- The network event loop and station netif are initialized once.

The HTTP server registers `/ws` before the wildcard static handler. It uses an
explicit stack size, priority, socket limit, and LRU-purge setting from the C
configuration. Static responses use a fixed 2,048-byte chunk buffer.

The WebSocket transport tracks one active client. Accepting a different client
closes the old session. Each asynchronous send owns its payload until the ESP-
IDF completion callback returns. Ping receives pong, close receives close, and
unknown text messages cause no state change.

`recording_config_set` accepts only a valid JSON object whose `type` is exactly
`recording_config_set` and whose `auto_enabled` member is a JSON boolean. A
valid update is written to the `digital_twin` NVS namespace, committed, applied
in memory, and acknowledged with the current `recording_config` frame. Invalid
input is ignored without altering NVS.

The browser continues to own external Digital Twin communication. The firmware
does not make outbound connections to `ecu.0xpuddu.com`; it only supplies the
identity, telemetry frames, and persisted recording configuration expected by
the unchanged WebUI.

## Configuration

`main/test-bench_config.h` remains the single application configuration source.
It gains these groups of macros:

- Compile-time enable and optional UART-log enable.
- Wi-Fi station SSID and password.
- HTTP port, stack, priority, socket count, and LRU purge.
- WebSocket path `/ws`.
- Telemetry state rate, events-per-batch, backlog capacity, task stack, and
  task priority.
- Maximum serialized frame size, 8,192 bytes by default.
- SPIFFS mount path `/www`, partition label `www`, and maximum open files.
- Hardware revision string.
- Digital Twin RPM threshold plus start/stop debounce durations.
- The approved deterministic simulation constants.
- Optional heap-integrity diagnostics.

Configuration assertions cover:

- Telemetry enable values are zero or one.
- State rate is from 1 through 50 Hz.
- Event batch count does not exceed backlog capacity.
- HTTP and telemetry priorities remain below the control-task priority.
- All stack sizes meet their component minimums.
- Simulation thresholds and temperature/rate ranges are ordered and positive.

## Startup and failure behavior

Application startup order is:

1. Status LED.
2. Shared GPIO ISR service.
3. TPS sampler.
4. Engine controller.
5. Button and engine-service tasks.
6. Manual-fire button input.
7. Telemetry bridge and server.

Existing hardware/control initialization retains `ESP_ERROR_CHECK` fail-fast
behavior. Telemetry startup does not use `ESP_ERROR_CHECK`: a failure is logged
once and engine operation continues without remote telemetry.

- Wi-Fi, SPIFFS, HTTP, WebSocket, or telemetry-task startup failure disables
  the remote path without changing CDI outputs.
- NVS read failure uses the configured automatic-recording default.
- NVS write failure retains the previous in-memory setting and returns an error
  for that command.
- Static traversal attempts return HTTP 400.
- Missing static assets return HTTP 404.
- `index.html` uses no-store caching.
- Versioned JS/CSS and image assets use long immutable caching.
- No allocation, serialization, logging, filesystem call, or network call is
  made from the GPIO or GPTimer ISR.

All firmware-side queues are bounded. C++ allocation failure is handled at the
public startup and asynchronous-send object boundaries with `std::nothrow` and
an ESP error or transport-error count. The serializer writes into a buffer with
the configured 8,192-byte default capacity. A frame that cannot fit is rejected
and counted as a send error; serialization does not grow a string without a
fixed upper bound.

## WebUI and SPIFFS packaging

Copy these reference WebUI inputs into this project without changing their
interface or behavior:

- `webui/package.json`
- `webui/package-lock.json`
- `webui/vite.config.js`
- `webui/src/`
- `webui/test/`
- `webui/doc/`

Generated `webui/dist/` and legacy `webui/data/` files are not firmware inputs.
The unchanged Vite build copies production `index.html`, compressed JS/CSS, and
images to root `data/`. `components/telemetry_server/CMakeLists.txt` requires
`data/index.html` and creates a flash-in-project SPIFFS image named `www`.

The custom 2 MB partition table is:

| Name | Type | Offset | Size |
| --- | --- | ---: | ---: |
| `nvs` | data/nvs | `0x9000` | `0x6000` |
| `phy_init` | data/phy | `0xf000` | `0x1000` |
| `factory` | app/factory | `0x10000` | `0x177000` |
| `www` | data/spiffs | `0x187000` | `0x79000` |

The layout ends exactly at `0x200000`. The frontend output and firmware binary
must fit their partitions.

`sdkconfig.defaults` selects ESP32-S2, 2 MB flash, the custom partition table,
WebSocket support, SPIFFS object-name length 64, and the existing GPIO/GPTimer
IRAM options.

The root `CMakeLists.txt` derives `PROJECT_VER` from `git describe` with
`0.0.0-unknown` fallback so capabilities report the firmware revision expected
by the Digital Twin.

## Verification constraints

No new automated test files are implemented for this work. Completion evidence
is limited to build/static verification requested by the user.

1. Build the unchanged WebUI production bundle:

   ```sh
   cd webui
   npm ci
   npm run build
   ```

2. Load the ESP-IDF environment before every `idf.py` command and perform a
   clean firmware build:

   ```sh
   zsh -ic 'idf; idf.py fullclean; idf.py build'
   ```

3. Confirm the build generated the firmware and `www` SPIFFS images and that
   neither exceeds its partition.
4. Run `git diff --check`.
5. Request a static subagent review of the specification and implementation
   diff. The review must cover:
   - C/C++ ABI safety.
   - Preservation of the unchanged WebUI contract and files.
   - Real versus simulated data mapping.
   - Bounded memory and backpressure behavior.
   - ESP32-S2 single-core priority implications.
   - ISR isolation and ignition-timing safety.
   - Configuration and partition coverage.
   - Digital Twin identity and recording-setting behavior.
6. Address every critical or important static-review finding before declaring
   implementation complete.

Hardware timing tests, browser tests, new host tests, and new frontend tests are
not part of the approved verification scope.

## Acceptance criteria

- Existing ignition, TPS, button, RGB status, and manual/automatic fire
  behaviors remain owned by the existing C modules.
- The WebUI source and interface are transported without modification.
- Firmware serves the WebUI from SPIFFS and exposes `/ws`.
- The existing WebUI receives compatible capabilities, recording configuration,
  and 10 Hz V1 telemetry frames.
- Real RPM, TPS, synchronization, advance, period, delay, and diagnostic
  counters originate from the current bench modules.
- EGT, water, quick-shifter, map request, and knock remain populated by the
  deterministic simulation and never influence engine control.
- Raw frames distinguish real, derived, and simulated origins.
- Digital Twin manual/automatic recording logic remains available through the
  unchanged browser application.
- Wi-Fi and server settings come from `main/test-bench_config.h`.
- A telemetry startup failure leaves engine control running.
- All queues and per-frame buffers are bounded.
- The frontend production build, clean ESP-IDF build, `git diff --check`, and
  static subagent review complete successfully.
