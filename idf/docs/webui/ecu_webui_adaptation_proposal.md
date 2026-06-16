# ECU WebUI Adaptation Proposal

This proposal covers the WebUI work that remains after the WebSocket Telemetry
V1 migration.

The parser, Store paths, mock V1 telemetry, and adapter tests already exist.
Do not repeat that work as part of the UI adaptation unless the firmware
contract changes. The next step is to replace the simulator-facing experience
with an ECU-facing dashboard, diagnostics view, and browser-only rolling
history.

Sources:
- `docs/webui/js_architecture.md`
- `docs/webui/websocket.md`
- `docs/webserver/websocket_contract.md`
- `docs/telemetry/basic_sensor_telemetry_core.md`

---

## Current State

The application shell is already usable:
- `App.js` creates the page skeletons and wires `Socket`, `NavigatorManager`,
  `SidebarManager`, `ModalManager`, and `CommandManager`.
- `adapter.js` consumes `capabilities` and `telemetry` frames.
- `paths.js` and `store.js` expose V1 telemetry paths.
- `mockData.js` emits V1-shaped telemetry for local development.
- Parser behavior is covered by `adapter.test.js` and
  `test/adapter-contract.test.mjs`.

The visible UI is still simulator-oriented:
- `DashboardPage.js` binds old dashboard fields directly with string paths.
- RPM, TPS, and EGT taps navigate to override pages.
- The homepage shows spark detection, which V1 does not expose.
- The quick-shift button sends a command even though the V1 WebSocket contract
  only defines ECU-to-UI telemetry frames.
- `Sidebar.js` renders a fixed simulator menu.
- The RPM gauge scale is embedded in the page implementation.

---

## Design Constraints

- Keep `adapter.js` as the WebSocket boundary. UI code should consume Store
  paths, not raw WebSocket frames.
- Use `Paths` constants when touching UI code. Do not add new literal Store
  path strings inside pages or components.
- Preserve V1 semantics:
  - `map_switch.request` is a physical switch request, not the effective active
    map.
  - `egt.request` and `water.request` are sensor-side request levels, not final
    safety commands.
  - `knock` is only the latest summary. It is not a revolution log.
  - Events are ordered observability records, not a complete recorded run.
  - Spark detection has no V1 equivalent and should not appear in the ECU UI.
- Any display-only constants, such as RPM gauge scale or history retention,
  should live in a small config module. Do not bury them inside component
  update methods.
- Browser history must stay in memory only. Do not write telemetry samples to
  ECU flash.

---

## Implementation Approach

### 1. Add an ECU UI Mode Boundary

The app needs an explicit split between normal ECU mode and local simulator
mode.

Implementation:
- Add a small app mode value derived from the existing config:
  - ECU mode when `useMockData` is false.
  - Development mode when `useMockData` is true.
- Pass the mode into page registration and sidebar menu construction.
- Keep override pages available only in development mode.
- Keep `CommandManager.triggerQs()` out of the normal ECU homepage until a
  command contract documents that command.

Recommended files:
- `webui/src/js/core/App.js`
- `webui/src/js/components/Sidebar/Sidebar.js`
- `webui/src/js/managers/sidebarManager.js`

The sidebar should receive menu items as data from the manager or app setup.
The component should render the provided items instead of owning a fixed list
of simulator routes.

### 2. Add Telemetry View Model Helpers

Before rewriting `DashboardPage`, add small pure helpers that turn Store values
into display-ready objects.

Recommended file:
- `webui/src/js/utils/telemetryViewModel.js`

Responsibilities:
- Build status-strip data from:
  - `Paths.SOCKET.STATE`
  - `Paths.CONNECTION.SCHEMA_VERSION`
  - `Paths.CONNECTION.STATE_HZ`
  - `Paths.TELEMETRY.GEN`
  - `Paths.TELEMETRY.TIMESTAMP`
  - `Paths.TELEMETRY.TRANSPORT`
- Build sensor-card data from a signal definition and current Store values.
- Derive age from `telemetry.t_us` and each signal's `meta.acquiredAtUs`.
- Derive health display from `valid`, `health`, `quality`, and `faultBits`.
- Format values and units consistently.

Keep the signal list as data, not as repeated card markup:

```js
export const TELEMETRY_SIGNALS = [
  { id: "rpm", valuePath: Paths.TELEMETRY.RPM, metaPath: Paths.TELEMETRY.RPM_META, unit: "rpm" },
  { id: "tps", valuePath: Paths.TELEMETRY.TPS, metaPath: Paths.TELEMETRY.TPS_META, unit: "%" },
  { id: "egt", valuePath: Paths.TELEMETRY.EGT, metaPath: Paths.TELEMETRY.EGT_META, unit: "C" },
  { id: "water", valuePath: Paths.TELEMETRY.WATER_TEMP, metaPath: Paths.TELEMETRY.WATER_META, unit: "C" },
  { id: "qs", valuePath: Paths.TELEMETRY.QS_ACTIVE, metaPath: Paths.TELEMETRY.QS_META },
  { id: "mapRequest", valuePath: Paths.TELEMETRY.MAP_REQUEST, metaPath: Paths.TELEMETRY.MAP_META },
  { id: "knock", valuePath: Paths.TELEMETRY.KNOCK }
];
```

This is still explicit, but it keeps labels, paths, units, and detail routing
in one place instead of spreading them across dashboard markup, sidebar code,
and chart code.

### 3. Add a Browser-Only History Manager

Add a manager that keeps bounded per-signal buffers in memory.

Recommended file:
- `webui/src/js/managers/TelemetryHistoryManager.js`

Important implementation detail: do not append history samples directly from
each individual Store subscription callback. `adapter.js` updates several paths
one after another for the same frame. Sampling each path callback would produce
partial samples.

Instead:
- Subscribe to the relevant telemetry paths.
- On the first change in a JavaScript turn, schedule one `queueMicrotask()`.
- In the microtask, read all current Store values.
- Append one sample per generation, using `telemetry.gen` or `telemetry.t_us` to
  deduplicate.

Suggested API:

```js
TelemetryHistoryManager.init({ Store, Paths, signals, maxSeconds });
TelemetryHistoryManager.getSeries(signalId, rangeSeconds);
TelemetryHistoryManager.getEvents(rangeSeconds);
TelemetryHistoryManager.clear();
TelemetryHistoryManager.stop();
```

Retention should be derived from `connection.state_hz` when available:

```js
maxSamples = Math.ceil(stateHz * maxSeconds);
```

Use a default when capabilities have not arrived yet. Keep the default in a
config module, not inside chart or page code.

### 4. Replace the Dashboard Content

Once the mode boundary and view helpers exist, rework `DashboardPage` around
V1 telemetry.

Homepage layout:
- Compact status strip below the top bar.
- Dominant RPM panel:
  - RPM value.
  - Sync state.
  - RPM acceleration.
  - RPM health badge.
- Sensor grid:
  - TPS, including fallback state.
  - EGT, including thermal state and request.
  - Water temperature, including thermal state and request.
  - Engine sync.
  - Quick-shifter active and armed state.
  - Physical map request.
  - Latest knock summary when present.
- Recent events rail:
  - Most recent events from `Paths.TELEMETRY.EVENTS`.
  - Preserve Store order.
  - Show concise payload summaries for quick-shift, map-switch, and fault
    transition events.

Remove from normal ECU mode:
- Spark card.
- Override badges.
- RPM/TPS/EGT tap-to-override navigation.
- Quick-shift trigger button unless a command contract exists.

For detail navigation, clicking a sensor card should navigate to a read-only
detail page with the selected signal id in the route data.

### 5. Add Read-Only Detail Pages

Add two pages rather than overloading the homepage.

`SensorDetailPage`:
- Receives a signal id through `NavigatorManager.navigateTo(pageId, data)`.
- Uses `TelemetryHistoryManager.getSeries()` for the chart.
- Shows latest value, health, quality, validity, fault bits, sequence, and age.
- Uses a canvas chart for live samples and stepped traces for boolean signals.
- Overlays event markers when they apply to the selected signal.

`TelemetryDiagnosticsPage`:
- Shows the bounded event log.
- Shows overflow counters.
- Shows WebSocket transport counters.
- Shows capabilities fields.
- Shows raw fault bits until a fault-bit label map is added from firmware
  constants.

Recommended files:
- `webui/src/js/pages/SensorDetailPage.js`
- `webui/src/js/pages/TelemetryDiagnosticsPage.js`

### 6. Keep Components Small

Add components only where they remove repetition:
- `StatusStrip`
- `RpmPanel`
- `TelemetryCard`
- `HealthBadge`
- `RecentEventsRail`
- `SensorHistoryChart`

Do not create a large abstraction layer around every metric. The existing
`Component` and `Page` lifecycle is enough.

Recommended files:
- `webui/src/js/components/StatusStrip/StatusStrip.js`
- `webui/src/js/components/RpmPanel/RpmPanel.js`
- `webui/src/js/components/TelemetryCard/TelemetryCard.js`
- `webui/src/js/components/HealthBadge/HealthBadge.js`
- `webui/src/js/components/RecentEventsRail/RecentEventsRail.js`
- `webui/src/js/components/SensorHistoryChart/SensorHistoryChart.js`

### 7. Verification

Keep the existing parser tests and add focused tests for the new non-visual
logic.

Tests to add:
- View-model helper formats map request and thermal request without changing
  their meaning.
- Health helper marks invalid, degraded, stale, and faulted states correctly.
- History manager appends one sample per frame even when many Store paths
  change in one adapter dispatch.
- History manager keeps bounded buffers when `state_hz` changes.
- Recent events preserve order.

Manual checks:
- `npm test`
- `npm run build`
- Mock mode still shows development override routes.
- ECU mode does not show simulator controls.

---

## Acceptance Criteria

- Normal ECU mode homepage shows V1 latest-state signals available from
  `basic_sensor_telemetry_core.md`.
- No normal ECU homepage element exposes simulator-only override state.
- No label treats physical map request as active map.
- No label treats thermal request as a final safety command.
- Spark detection is absent from the ECU UI.
- Sensor cards show value, validity, health, quality, age, and fault state.
- Event order is preserved.
- Sensor-card navigation opens a read-only rolling-history view.
- Browser-side history is bounded and memory-only.
- Existing WebSocket parser tests still pass.
