# Firmware Version and Engine Map UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record the running ESP-IDF application's Git-derived version with each engine run and remove Engine Map from the two server frontend views.

**Architecture:** Extend the ECU capabilities `device` object with `firmware_version`, sourced from `esp_app_get_description()->version`. Carry that field through the embedded WebUI's connection store into the server's existing `firmware_version` run-start field; leave `map_version` intact in the API and database while removing only its frontend presentation.

**Tech Stack:** ESP-IDF 5.5.4/C++17, CMake/CTest, browser JavaScript/Node test runner, FastAPI existing API contract, Vue 3/Vitest.

## Global Constraints

- Build date is out of scope and must not be read, stored, sent, or displayed.
- The existing `map_version` database column, domain fields, API fields, OpenAPI schema, and generated client property remain unchanged.
- An absent or empty ECU firmware version is sent to the server as `null`.
- Dirty firmware builds retain ESP-IDF's `-dirty` suffix; no clean-worktree build policy is added.
- Preserve unrelated changes already present in `C:/Users/puddu/Documents/Github/ecu-dev-board`; stage only files named by each task.
- Do not modify generated API files because the server API contract is unchanged.

## File Structure

### ECU worktree: `C:/Users/puddu/Documents/Github/ecu-dev-board/idf`

- `components/telemetry_server/include/telemetry_server/telemetry_json_serializer.hpp`: defines the capabilities device metadata contract.
- `components/telemetry_server/src/telemetry_json_serializer.cpp`: serializes `firmware_version` into capabilities JSON.
- `components/telemetry_server/src/telemetry_server.cpp`: reads the running app descriptor and passes its version to the serializer.
- `components/telemetry_server/CMakeLists.txt`: declares the ESP app-format dependency.
- `components/telemetry_server/tests/host/telemetry_server_tests.cpp`: covers the serialized contract.
- `webui/src/js/core/store.js`: declares the normalized connection-device state.
- `webui/src/js/core/adapter.js`: normalizes `device.firmware_version` from capabilities.
- `webui/src/js/managers/DigitalTwinClient.js`: posts the version through the existing run-start API field.
- `webui/src/js/utils/mockData.js`: keeps mock capabilities representative of the production contract.
- `webui/test/adapter-contract.test.mjs`: covers capabilities-to-store propagation.
- `webui/test/digital-twin-client.test.mjs`: covers store-to-run-start propagation.

### Server worktree: `C:/Users/puddu/Documents/Github/ecu-server/server`

- `frontend/src/features/runs/pages/RunsPage.vue`: removes the Engine Map table column.
- `frontend/src/features/runs/pages/RunsPage.test.ts`: covers the Runs presentation contract.
- `frontend/src/features/telemetry/pages/TelemetryPage.vue`: removes the Engine Map metadata card.
- `frontend/src/features/telemetry/pages/TelemetryPage.test.ts`: covers the Telemetry Viewer presentation contract.

---

### Task 1: Publish ESP-IDF firmware version in ECU capabilities

**Files:**
- Modify: `C:/Users/puddu/Documents/Github/ecu-dev-board/idf/components/telemetry_server/include/telemetry_server/telemetry_json_serializer.hpp:12`
- Modify: `C:/Users/puddu/Documents/Github/ecu-dev-board/idf/components/telemetry_server/src/telemetry_json_serializer.cpp:330`
- Modify: `C:/Users/puddu/Documents/Github/ecu-dev-board/idf/components/telemetry_server/src/telemetry_server.cpp:18`
- Modify: `C:/Users/puddu/Documents/Github/ecu-dev-board/idf/components/telemetry_server/CMakeLists.txt:9`
- Test: `C:/Users/puddu/Documents/Github/ecu-dev-board/idf/components/telemetry_server/tests/host/telemetry_server_tests.cpp:227`

**Interfaces:**
- Consumes: `const esp_app_desc_t *esp_app_get_description(void)` from ESP-IDF 5.5.4.
- Produces: capabilities field `device.firmware_version: string`.

- [ ] **Step 1: Write the failing serializer contract test**

In `test_capabilities_frame_declares_contract`, require the new field with its safe empty default in the exact serialized device object:

```cpp
EXPECT_CONTAINS(
    json,
    R"("device":{"hwid":"esp32s3-010203040506","hardware_revision":"ESP32-S3FH4R2","chip_model":"ESP32-S3","flash_size_bytes":4194304,"firmware_version":""})"
);
```

- [ ] **Step 2: Build and run the focused test to verify RED**

Run from `C:/Users/puddu/Documents/Github/ecu-dev-board/idf`:

```powershell
cmake -S components/telemetry_server/tests/host -B build/telemetry-server-host
cmake --build build/telemetry-server-host
ctest --test-dir build/telemetry-server-host --output-on-failure
```

Expected: the test executable builds, then `telemetry_server_tests` fails because capabilities JSON does not contain `firmware_version`.

- [ ] **Step 3: Extend the serializer contract**

Add the field to `TelemetryDeviceIdentity`:

```cpp
struct TelemetryDeviceIdentity {
    const char *hwid{""};
    const char *hardware_revision{"unknown"};
    const char *chip_model{"unknown"};
    std::uint32_t flash_size_bytes{0};
    const char *firmware_version{""};
};
```

Serialize it after `flash_size_bytes`:

```cpp
out << ",\"flash_size_bytes\":" << config_.device.flash_size_bytes
    << ",\"firmware_version\":";
write_string(out, config_.device.firmware_version);
out << "},\"recording\":{";
```

- [ ] **Step 4: Read the running application descriptor**

Add the header:

```cpp
#include "esp_app_desc.h"
```

Extend `RuntimeDeviceIdentity`:

```cpp
struct RuntimeDeviceIdentity {
    std::string hwid{"esp32s3-unknown"};
    std::string hardware_revision{"unknown"};
    std::string chip_model{"unknown"};
    std::uint32_t flash_size_bytes{0};
    std::string firmware_version{};
};
```

Inside `read_device_identity`, before returning the identity, read the version without blocking telemetry startup when it is empty:

```cpp
const esp_app_desc_t *app_description = esp_app_get_description();
if (app_description != nullptr) {
    identity.firmware_version = app_description->version;
}
```

Pass it through `make_serializer_config`:

```cpp
serializer_config.device.firmware_version = identity.firmware_version.c_str();
```

Add `esp_app_format` to the component requirements:

```cmake
REQUIRES telemetry sensors esp_app_format esp_event esp_http_server esp_netif esp_timer esp_wifi esp_hw_support nvs_flash spi_flash spiffs
```

- [ ] **Step 5: Run the focused test to verify GREEN**

```powershell
cmake --build build/telemetry-server-host
ctest --test-dir build/telemetry-server-host --output-on-failure
```

Expected: `100% tests passed, 0 tests failed`.

- [ ] **Step 6: Strengthen the serializer test with a real version value**

Set the field in `test_capabilities_frame_declares_contract`:

```cpp
config.device.firmware_version = "1.0.0-125-gfb81dde";
```

Change the expected device JSON suffix from `"firmware_version":""` to:

```cpp
"firmware_version":"1.0.0-125-gfb81dde"
```

Run:

```powershell
cmake --build build/telemetry-server-host
ctest --test-dir build/telemetry-server-host --output-on-failure
```

Expected: `100% tests passed, 0 tests failed`, proving non-empty versions are serialized unchanged.

- [ ] **Step 7: Verify the ESP-IDF target compiles**

```powershell
idf.py build
```

Expected: build exits zero and links the telemetry server with `esp_app_get_description` resolved.

- [ ] **Step 8: Commit only the ECU capability files**

```powershell
git add -- idf/components/telemetry_server/CMakeLists.txt idf/components/telemetry_server/include/telemetry_server/telemetry_json_serializer.hpp idf/components/telemetry_server/src/telemetry_json_serializer.cpp idf/components/telemetry_server/src/telemetry_server.cpp idf/components/telemetry_server/tests/host/telemetry_server_tests.cpp
git commit -m "feat: expose firmware version in ECU capabilities"
```

### Task 2: Forward the capabilities firmware version when starting runs

**Files:**
- Modify: `C:/Users/puddu/Documents/Github/ecu-dev-board/idf/webui/src/js/core/store.js:50`
- Modify: `C:/Users/puddu/Documents/Github/ecu-dev-board/idf/webui/src/js/core/adapter.js:170`
- Modify: `C:/Users/puddu/Documents/Github/ecu-dev-board/idf/webui/src/js/managers/DigitalTwinClient.js:109`
- Modify: `C:/Users/puddu/Documents/Github/ecu-dev-board/idf/webui/src/js/utils/mockData.js:16`
- Test: `C:/Users/puddu/Documents/Github/ecu-dev-board/idf/webui/test/adapter-contract.test.mjs:12`
- Test: `C:/Users/puddu/Documents/Github/ecu-dev-board/idf/webui/test/digital-twin-client.test.mjs:80`

**Interfaces:**
- Consumes: capabilities field `device.firmware_version: string` from Task 1.
- Produces: `POST /api/runs/start` body field `firmware_version: string | null`.

- [ ] **Step 1: Write the failing adapter contract assertion**

Add this property to the capabilities fixture and expected connection device in `adapter-contract.test.mjs`:

```js
firmware_version: "1.0.0-125-gfb81dde"
```

The expected object must be:

```js
assert.deepEqual(Store.get(Paths.CONNECTION.DEVICE), {
  hwid: "esp32s3-010203040506",
  hardware_revision: "ESP32-S3FH4R2",
  chip_model: "ESP32-S3",
  flash_size_bytes: 4194304,
  firmware_version: "1.0.0-125-gfb81dde"
});
```

- [ ] **Step 2: Write the failing bridge request assertion**

Add the same `firmware_version` to `seedDevice()` and change the expected run-start request:

```js
assert.deepEqual(JSON.parse(calls[0].options.body), {
  hwid: "esp32s3-010203040506",
  hardware_revision: "ESP32-S3FH4R2",
  firmware_version: "1.0.0-125-gfb81dde",
  map_version: null
});
```

- [ ] **Step 3: Run the focused WebUI tests to verify RED**

Run from `C:/Users/puddu/Documents/Github/ecu-dev-board/idf/webui`:

```powershell
node --test test/adapter-contract.test.mjs test/digital-twin-client.test.mjs
```

Expected: adapter deep equality fails because normalization drops `firmware_version`, and the bridge assertion reports `firmware_version: null`.

- [ ] **Step 4: Implement capabilities normalization and run-start forwarding**

Add the field to the initial connection device in `store.js`:

```js
device: {
  hwid: "",
  hardware_revision: "",
  chip_model: "",
  flash_size_bytes: 0,
  firmware_version: ""
}
```

Return it from `normalizeDevice` in `adapter.js`:

```js
function normalizeDevice(device) {
  return {
    hwid: String(device.hwid ?? ""),
    hardware_revision: String(device.hardware_revision ?? ""),
    chip_model: String(device.chip_model ?? ""),
    flash_size_bytes: Number(device.flash_size_bytes ?? 0),
    firmware_version: String(device.firmware_version ?? "")
  };
}
```

Use it in `DigitalTwinClient.js` without changing `map_version`:

```js
body: JSON.stringify({
  hwid: device.hwid,
  hardware_revision: device.hardware_revision || null,
  firmware_version: device.firmware_version || null,
  map_version: null
})
```

Add a representative value to the mock capabilities device in `mockData.js`:

```js
firmware_version: "1.0.2-mock"
```

- [ ] **Step 5: Run the focused WebUI tests to verify GREEN**

```powershell
node --test test/adapter-contract.test.mjs test/digital-twin-client.test.mjs
```

Expected: both files pass with zero failures.

- [ ] **Step 6: Run the complete embedded WebUI suite and build**

```powershell
npm test
npm run build
```

Expected: Node tests and Vite build exit zero.

- [ ] **Step 7: Commit only the embedded WebUI data-flow files**

```powershell
git add -- idf/webui/src/js/core/store.js idf/webui/src/js/core/adapter.js idf/webui/src/js/managers/DigitalTwinClient.js idf/webui/src/js/utils/mockData.js idf/webui/test/adapter-contract.test.mjs idf/webui/test/digital-twin-client.test.mjs
git commit -m "feat: attach ECU firmware version to recorded runs"
```

### Task 3: Remove Engine Map from server frontend views

**Files:**
- Modify: `C:/Users/puddu/Documents/Github/ecu-server/server/frontend/src/features/runs/pages/RunsPage.vue:159`
- Modify: `C:/Users/puddu/Documents/Github/ecu-server/server/frontend/src/features/runs/pages/RunsPage.test.ts:11`
- Modify: `C:/Users/puddu/Documents/Github/ecu-server/server/frontend/src/features/telemetry/pages/TelemetryPage.vue:364`
- Modify: `C:/Users/puddu/Documents/Github/ecu-server/server/frontend/src/features/telemetry/pages/TelemetryPage.test.ts:10`

**Interfaces:**
- Consumes: existing `RunDetailResponse.firmware_version?: string | null`.
- Produces: Engine Runs and Telemetry Viewer presentation containing Firmware but no Engine Map label or value.

- [ ] **Step 1: Write failing Runs presentation assertions**

Set the Runs fixture value:

```ts
firmware_version: '1.0.0-125-gfb81dde',
```

In `passes the run UUID directly when ending a recording`, after the first `await flushPromises()`, add:

```ts
expect(wrapper.text()).toContain('Firmware');
expect(wrapper.text()).toContain('1.0.0-125-gfb81dde');
expect(wrapper.text()).not.toContain('Engine Map');
```

- [ ] **Step 2: Write failing Telemetry Viewer presentation assertions**

Set the Telemetry fixture value:

```ts
firmware_version: '1.0.0-125-gfb81dde',
```

In `requests telemetry with the UUID route parameter and selected limit`, after `await flushPromises()`, add:

```ts
expect(wrapper.text()).toContain('FIRMWARE');
expect(wrapper.text()).toContain('1.0.0-125-gfb81dde');
expect(wrapper.text()).not.toContain('ENGINE MAP');
```

- [ ] **Step 3: Run both focused frontend tests to verify RED**

Run from `C:/Users/puddu/Documents/Github/ecu-server/server/frontend`:

```powershell
npm test -- src/features/runs/pages/RunsPage.test.ts src/features/telemetry/pages/TelemetryPage.test.ts
```

Expected: both presentation assertions fail because the components still render Engine Map.

- [ ] **Step 4: Remove only the Engine Map presentation blocks**

Delete this column from `RunsPage.vue`:

```vue
<Column field="map_version" header="Engine Map">
  <template #body="{ data }">
    <span class="font-mono text-xs">{{ data.map_version || 'N/A' }}</span>
  </template>
</Column>
```

Delete this card from `TelemetryPage.vue`:

```vue
<div class="meta-card">
  <span class="meta-label">ENGINE MAP</span>
  <span class="meta-val font-mono">{{ runDetail.map_version || 'N/A' }}</span>
</div>
```

Do not edit backend models, migrations, router schemas, OpenAPI JSON, or generated clients.

- [ ] **Step 5: Run both focused frontend tests to verify GREEN**

```powershell
npm test -- src/features/runs/pages/RunsPage.test.ts src/features/telemetry/pages/TelemetryPage.test.ts
```

Expected: both test files pass with zero failures.

- [ ] **Step 6: Run the complete server frontend suite and build**

```powershell
npm test
npm run build
```

Expected: Vitest and Vite exit zero.

- [ ] **Step 7: Commit the server frontend presentation change**

```powershell
git add -- server/frontend/src/features/runs/pages/RunsPage.vue server/frontend/src/features/runs/pages/RunsPage.test.ts server/frontend/src/features/telemetry/pages/TelemetryPage.vue server/frontend/src/features/telemetry/pages/TelemetryPage.test.ts
git commit -m "fix: show firmware without engine map metadata"
```

### Task 4: Cross-worktree verification

**Files:**
- Verify: all files modified by Tasks 1-3.

**Interfaces:**
- Consumes: the complete ECU-to-server firmware metadata path.
- Produces: verification evidence for the approved acceptance criteria.

- [ ] **Step 1: Re-run ECU verification from a fresh command invocation**

From `C:/Users/puddu/Documents/Github/ecu-dev-board/idf`:

```powershell
cmake --build build/telemetry-server-host
ctest --test-dir build/telemetry-server-host --output-on-failure
Push-Location webui
npm test
npm run build
Pop-Location
idf.py build
git diff --check
```

Expected: every command exits zero. Unrelated pre-existing worktree changes may remain listed by Git but must not be staged or modified by this work.

- [ ] **Step 2: Re-run server frontend verification from a fresh command invocation**

From `C:/Users/puddu/Documents/Github/ecu-server/server/frontend`:

```powershell
npm test
npm run build
git -C .. diff --check
```

Expected: every command exits zero.

- [ ] **Step 3: Verify UI removal and backend compatibility explicitly**

From `C:/Users/puddu/Documents/Github/ecu-server/server`:

```powershell
$uiMatches = rg -n "Engine Map|ENGINE MAP|runDetail\.map_version|field=\"map_version\"" frontend/src/features/runs/pages/RunsPage.vue frontend/src/features/telemetry/pages/TelemetryPage.vue
if ($LASTEXITCODE -eq 0) { throw "Engine Map presentation remains: $uiMatches" }
rg -n "map_version" backend/app/db/models.py backend/app/routers/runs.py frontend/src/api/generated/models/RunDetailResponse.ts
```

Expected: the first check finds no UI presentation references; the second command confirms `map_version` remains in persistence, API response, and generated client compatibility surfaces.

- [ ] **Step 4: Inspect final scoped diffs**

```powershell
git -C C:/Users/puddu/Documents/Github/ecu-dev-board diff --stat HEAD~2..HEAD -- idf/components/telemetry_server idf/webui/src/js/core/store.js idf/webui/src/js/core/adapter.js idf/webui/src/js/managers/DigitalTwinClient.js idf/webui/src/js/utils/mockData.js idf/webui/test/adapter-contract.test.mjs idf/webui/test/digital-twin-client.test.mjs
git -C C:/Users/puddu/Documents/Github/ecu-server diff --stat HEAD~1..HEAD -- server/frontend
```

Expected: only the contract, data-flow, tests, and two requested frontend views are included.
