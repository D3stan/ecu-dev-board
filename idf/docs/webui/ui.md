# ECU WebUI UI Implementation Plan

This file replaces the Stitch export with a repo-grounded implementation plan.
It keeps the cockpit direction, but removes generated screen IDs, download
links, hardcoded telemetry examples, and acceptance statuses that are not
implemented in this codebase.

Scope:
- Use the current WebSocket Telemetry V1 contract through the existing adapter
  and Store paths.
- Do not change firmware, websocket contracts, backend routes, or command
  payloads.
- Reuse existing WebUI architecture and components first. Add components only
  where the current repo has no matching implementation.

Related docs:
- `docs/webui/js_architecture.md`
- `docs/webui/websocket.md`
- `docs/webserver/websocket_contract.md`

---

## Current Repo Baseline

Already implemented and usable:
- `webui/src/js/core/Component.js` and `Page.js` for lifecycle, Store bindings,
  event cleanup, and page skeletons.
- `webui/src/js/core/store.js` with V1 telemetry leaves already present.
- `webui/src/js/core/adapter.js` mapping `capabilities` and `telemetry` frames
  into existing and new Store paths.
- `webui/src/js/managers/navigatorManager.js` for bounded SPA navigation.
- `webui/src/js/components/topBar/TopBar.js` for socket status and app actions.
- `webui/src/js/components/Badge/Badge.js` and `Badge.css` for simple
  state-to-label badges.
- `webui/src/js/pages/DashboardPage.js` as the current homepage.
- Simulator override pages for RPM, TPS, and EGT.

Not implemented for the V1 ECU UI:
- A telemetry-specific sensor card.
- Recent event rail.
- Browser-side history manager.
- Signal detail chart page.
- Telemetry diagnostics page.
- Runtime gating that hides simulator override pages outside mock/dev mode.

Important mismatch:
- `components/SensorCard/SensorCard.js` is not a V1 ECU telemetry card. It is a
  parameter/setpoint card from the older FogExtra UI, so it should not be reused
  for RPM/TPS/EGT/water telemetry without a rewrite.

---

## Semantics To Preserve

The UI must not imply behavior that the telemetry contract does not provide:

- `telemetry.map_request` is a physical map switch request, not confirmed active
  map selection.
- `telemetry.egt_request` and `telemetry.water_request` are sensor request
  levels, not final safety or actuator commands.
- `telemetry.knock` is the latest nullable knock summary, not a full revolution
  history stream.
- `telemetry.events` is an ordered, bounded browser log of received events, not
  permanent ECU logging.
- `telemetry.spark_detected` has no V1 source and should not be shown in normal
  ECU mode.
- Simulator override state belongs in mock/dev UI only.

---

## Proposed First Implementation

Start with a practical dashboard refactor before adding new pages.

### 1. Rework `DashboardPage`

Keep `DashboardPage` as the homepage and replace simulator concepts with V1 ECU
latest-state telemetry:

- Bind existing V1 paths through `Paths.TELEMETRY.*` and `Paths.CONNECTION.*`
  rather than string literals.
- Keep the RPM gauge, but drive secondary text from:
  - `RPM_SYNCHRONIZED`
  - `RPM_ACCEL`
  - `RPM_META`
- Replace simulator badges and click targets with read-only ECU telemetry:
  - TPS percent plus fallback and health.
  - EGT temperature plus thermal state/request.
  - Water temperature plus thermal state/request.
  - Quick-shifter active/armed.
  - Map request labeled as physical request.
  - Knock candidate/index/ignition angle only when `KNOCK` is not null.
- Remove the spark card from normal ECU mode.
- Keep quick-shifter trigger out of the normal dashboard unless the frontend
  command is confirmed against the current firmware. Do not invent a new command.
- Add a compact status strip below the top bar area or at the top of dashboard
  content with socket state, schema version, state Hz, generation, frame age,
  dropped frames, and send errors.

For the first pass, this can be done inside `DashboardPage.js` with small local
formatting helpers. Extract components only when duplication appears.

### 2. Add A Telemetry Card Only If Needed

Create a new telemetry-specific card only after the dashboard markup is reused by
another page.

Candidate component:
- `webui/src/js/components/TelemetryCard/TelemetryCard.js`
- `webui/src/css/components/TelemetryCard.css`

Responsibilities:
- Render a label, value, unit, secondary text, and status classes.
- Accept already formatted values from the parent.
- Stay dumb: no direct command sending and no protocol parsing.

Do not extend the old `SensorCard` for this. Its setpoint/parameter behavior is
the wrong abstraction for read-only V1 telemetry.

### 3. Reuse Existing Badge Styling

Use existing `.badge`, `.connection-status-badge`, or simple dashboard badge CSS
for health/quality/fault states first.

Add a new `TelemetryHealthBadge` component only if repeated badge logic becomes
hard to keep readable in pages. If added, it should take a metadata object:

```js
{ valid, health, quality, faultBits }
```

and produce one of a small set of display states:
- `ok`
- `degraded`
- `invalid`
- `fault`
- `unknown`

### 4. Add A Recent Events Rail

There is no existing event rail, so this is a valid new component.

Candidate component:
- `webui/src/js/components/RecentEventsRail/RecentEventsRail.js`
- `webui/src/css/components/RecentEventsRail.css`

Inputs:
- `Paths.TELEMETRY.EVENTS`
- `Paths.TELEMETRY.TIMESTAMP`

Behavior:
- Show the latest 5 to 8 events.
- Preserve received order.
- Format kind, relative time, and a short payload summary.
- Render empty state as a compact "No recent events" row.

This component must not persist data or request new backend support.

---

## Follow-Up Pages

### Sensor Detail Page

Add only after the dashboard is V1-correct.

Candidate page:
- `webui/src/js/pages/SensorDetailPage.js`
- `webui/src/css/pages/SensorDetailPage.css`

Route data:

```js
NavigatorManager.navigateTo("sensorDetailPage", { signal: "rpm" });
```

Contents:
- Header with signal name, latest value, and health badge.
- Canvas chart for recent samples.
- Time range control: 30 s, 2 min, 10 min.
- Event marker toggle.
- Latest metadata table.

Use canvas for the chart. There is no existing chart component for V1 telemetry.

### Telemetry Diagnostics Page

Candidate page:
- `webui/src/js/pages/TelemetryDiagnosticsPage.js`
- `webui/src/css/pages/TelemetryDiagnosticsPage.css`

Contents:
- Capabilities: schema version, state Hz, events per batch.
- Transport counters.
- Overflow counters.
- Full bounded event log.

This page should be read-only and useful for firmware/UI debugging.

### Sensor Table Page

Optional page for dense metadata inspection:
- One row/card per signal.
- Current value.
- Valid, health, quality.
- Sequence and acquisition timestamp.
- Fault bits as raw hex until fault names exist in frontend constants.

This can share card/table formatting with the diagnostics page; avoid a new
component until duplication is visible.

---

## Browser-Side History

Add history as a frontend-only manager. Do not change WebSocket frames and do not
write history to ECU flash.

Candidate manager:
- `webui/src/js/managers/TelemetryHistoryManager.js`

Behavior:
- Subscribe to V1 Store paths after app bootstrap.
- Append samples only when `telemetry.gen` changes.
- Keep capped arrays in memory.
- Keep event markers from `telemetry.events`.
- Expose read methods for detail pages.

Initial signals:
- `rpm`
- `tps`
- `egt`
- `water_temp`
- `rpm_accel`
- `qs_active`
- `qs_armed`
- `knock.normalized_index` when `knock` exists

Suggested cap:
- 10 minutes at 10 Hz: about 6000 samples per numeric signal.
- Make the cap time-based or count-based in the manager, not in protocol.

---

## Navigation And Mode Gating

Normal ECU mode should show:
- Dashboard.
- Sensor details.
- Diagnostics.

Mock/dev mode may show:
- RPM override.
- TPS override.
- EGT override.
- Any explicit simulator controls.

Implementation point:
- Update `Sidebar` to receive a menu model from `SidebarManager` or `App`
  instead of hardcoding simulator-only items.
- Gate override routes using `config.useMockData` or a clearly named dev flag.
- Keep route registration for existing pages if needed, but do not advertise
  simulator pages in normal ECU mode.

---

## Formatting Helpers

Keep formatting small and local at first:
- `formatNumber(value, decimals)`
- `formatTempC(value)`
- `formatRpm(value)`
- `formatFaultBits(value)`
- `formatFrameAge(frameTUs)`
- `formatMetaAge(frameTUs, meta)`

Move helpers to `webui/src/js/utils/telemetryFormat.js` only when multiple pages
need them.

Avoid defensive checks for impossible Store paths. The Store already validates
declared paths. Use null handling where the V1 contract allows null values, such
as `knock` and metadata.

---

## Implementation Order

1. Dashboard cleanup:
   - Remove spark display in ECU mode.
   - Remove override labels/click targets in ECU mode.
   - Add V1 status strip and V1 sensor cards.

2. Event rail:
   - Add `RecentEventsRail` if dashboard code would otherwise duplicate event
     formatting.

3. Mode gating:
   - Stop showing override pages in normal ECU sidebar navigation.

4. History manager:
   - Add browser-only capped buffers.
   - Keep public API small: `getSeries(signal, rangeMs)` and `getEvents(rangeMs)`.

5. Detail and diagnostics pages:
   - Add `SensorDetailPage`.
   - Add `TelemetryDiagnosticsPage`.
   - Register pages in `App.renderSkeleton()` and `NavigatorManager`.

6. CSS pass:
   - Keep the existing theme variables.
   - Do not copy Stitch colors as hardcoded globals unless they are converted
     into repo theme tokens.
   - Keep mobile layout within the existing `app-container` constraints.

---

## Acceptance Criteria

- Dashboard values come from Store paths, not static examples.
- Normal ECU dashboard has no simulator override badges or override navigation.
- Spark detection is not shown as a live V1 signal.
- Map request is labeled as physical request.
- Thermal state/request labels do not imply final actuator control.
- Sensor cards show validity/health/quality/fault status where metadata exists.
- Recent event order is preserved.
- Detail history is browser-memory-only and bounded.
- Existing adapter tests continue to pass.
- No backend, firmware, or websocket contract changes are required.
