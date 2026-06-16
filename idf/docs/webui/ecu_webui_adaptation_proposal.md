# ECU WebUI Adaptation Proposal

This document describes the UI work still needed after the WebSocket Telemetry
V1 migration. The current WebUI is a vanilla JS mobile SPA that was ported from
the emulator dashboard. It now receives ECU-shaped telemetry, but the visible
experience still presents simulator controls and old emulator concepts.

Scope of this document:
- Adapt the current WebUI to the current `basic_sensor_telemetry_core.md`
  telemetry state.
- Focus on the onboard WebUI served by the ECU.
- Keep this as proposed UI/application work; the implemented code change remains
  limited to websocket parsing and mock V1 emission.

---

## Current State

The WebUI shell is already useful:
- `App.js` builds a top bar, sidebar, and page skeletons.
- `DashboardPage.js` is the homepage.
- `RpmSettingsPage.js`, `TpsSettingsPage.js`, and `EgtSettingsPage.js` are
  simulator override pages.
- Components bind to the central Store via path strings.
- The layout is mobile-first, constrained to a phone-like max width.

The visible homepage is still emulator-oriented:
- Large RPM gauge.
- TPS card.
- EGT card.
- Ignition advance card.
- Spark detected card.
- Quick-shift trigger button.
- Clicks on RPM/TPS/EGT navigate to override pages.

After the websocket migration, the Store can now receive:
- RPM, TPS, EGT, water temperature.
- TPS fallback state.
- RPM acceleration and synchronization state.
- Quick-shifter `active` and `armed`.
- Physical map-switch request.
- Latest knock summary, when available.
- Per-sensor metadata: acquisition time, sequence, validity, health, quality,
  fault bits.
- Ordered events: quick-shift requests, map-switch changes, fault transitions.
- Sensor overflow counters.
- WebSocket transport counters.
- Connection capabilities: schema version, nominal state rate, events per batch.

---

## Important ECU Semantics

The UI should not carry over simulator assumptions where the telemetry core is
more precise:

- `state.map_switch.request` is the physical switch request, not the effective
  active map.
- `state.egt.request` and `state.water.request` are sensor-side request levels,
  not final safety or actuator commands.
- `state.knock` is a latest summary only. It is not a revolution history stream.
- Events are ordered observability records. They are not a complete run log.
- Staleness is not computed by telemetry; the UI should derive it from
  `t_us`, `meta.acquired_at_us`, `meta.seq`, `meta.valid`, `health`, and
  `quality`.
- Spark detection has no V1 equivalent and should be removed from the ECU UI.

---

## Proposed Homepage

The homepage should become a live ECU cockpit, not a simulator override panel.

### Top Status Strip

Place a compact status strip below the top bar:
- WebSocket status and schema version.
- Telemetry cadence from `connection.state_hz`.
- Current generation `telemetry.gen`.
- Frame age derived from the latest `telemetry.t_us`.
- Transport health from `telemetry.transport`.

This gives immediate confidence that the browser is receiving current ECU data.

### Primary RPM Panel

Keep RPM as the dominant first-viewport element, but adapt it to engine-speed
telemetry:
- Large RPM number and arc gauge.
- Secondary line for synchronized/not synchronized.
- Small acceleration value (`rpm_accel`) where useful.
- Health badge from `rpm_meta`.
- Do not navigate to RPM override on tap in ECU mode. Tapping should open an RPM
  history/detail view.

### Sensor Card Grid

Replace the current emulator metric grid with ECU sensor cards:

| Card | Primary value | Secondary state |
| --- | --- | --- |
| TPS | `telemetry.tps` percent | fallback used, health/quality |
| EGT | `telemetry.egt` C | thermal state/request, max if later exposed |
| Water | `telemetry.water_temp` C | thermal state/request |
| Engine Sync | `telemetry.rpm_synchronized` | RPM acceleration |
| Quick Shifter | active/armed | last quick-shift event marker |
| Map Request | Primary/Secondary | label clearly as physical request |
| Knock | normalized index or candidate flag when present | ignition angle only when knock exists |

Each card should include:
- A compact validity/health badge.
- A stale indicator if acquisition time lags behind the frame time.
- A fault marker when `faultBits` is non-zero.
- Click action opening the detail/history view for that signal.

### Event Rail

Add a small "recent events" rail below the sensor grid:
- Last 5 to 8 events from `telemetry.events`.
- Kind, relative time, and relevant payload summary.
- Use it for quick-shift requests, map-switch changes, and fault transitions.

This should not replace a diagnostics page; it is a quick situational feed.

### Remove or Move Simulator Controls

The current override affordances should not be first-class ECU controls:
- RPM/TPS/EGT override badges should be removed from the ECU homepage.
- The three override pages should be hidden behind a development/simulator mode
  or removed from the ECU build.
- The quick-shift trigger may remain only if the ECU command contract supports
  `{"cmd":"qs_trigger"}` in the current firmware. Otherwise show QS state only.

---

## Other Pages

### Telemetry Details Page

Add a read-only telemetry details page for advanced inspection:
- Table of all sensors.
- Current value.
- `valid`, `health`, `quality`.
- `seq`, `acquired_at_us`, and derived age.
- `fault_bits` shown as raw hex/decimal until fault names are mapped.

This page is the best place for dense metadata that would overload the homepage.

### Events and Diagnostics Page

Add a diagnostics page showing:
- Full bounded event log.
- Overflow counters.
- Transport counters.
- Capabilities frame details.

Use this page to debug dropped frames, source queue overflows, and state gaps.

### Development Overrides Page

If local/mock development remains important, keep RPM/TPS/EGT override pages but
gate them behind `config.useMockData` or a "Developer" sidebar section. They
should not be visible in normal ECU mode because the V1 telemetry core is
read-only and does not expose those override commands.

---

## Logging Over Time Feature

The useful near-term feature is browser-side rolling history for live signals.
This does not require ECU RAM or protocol changes.

### Behavior

- Every telemetry frame appends samples to an in-browser rolling buffer.
- Each sensor card is clickable.
- Clicking a card opens a detail view with that signal plotted over time.
- Event markers are overlaid on the graph.
- The graph follows live data by default and can pause when the user pans or
  inspects a point.

### Suggested Initial Signals

Start with:
- RPM.
- TPS percent.
- EGT.
- Water temperature.
- RPM acceleration.
- Quick-shifter active/armed as a stepped digital trace.
- Knock normalized index when `state.knock` exists.

### Buffering Model

Use a client-only ring buffer:

```js
{
  rpm: [{ tUs, value, meta }],
  tps: [{ tUs, value, meta }],
  egt: [{ tUs, value, meta }],
  water: [{ tUs, value, meta }],
  qsActive: [{ tUs, value }],
  events: [{ at_us, kind, ...payload }]
}
```

At 10 Hz, 10 minutes is about 6000 samples per signal. This is reasonable in
the browser if capped and stored in memory only. Do not persist to ECU flash.
IndexedDB export can be a later browser-only enhancement.

### UI Shape

Use a `SensorDetailPage` or modal:
- Header with sensor name, latest value, and health badge.
- Main chart using canvas for performance.
- Time range selector: 30 s, 2 min, 10 min.
- Toggle event markers.
- Table of last metadata values below the chart.

This complements, but does not replace, the future MQTT session logging path
described in `elaborato.md`.

---

## Implementation Phases

1. Create ECU-specific display components:
   - `TelemetryCard`.
   - `HealthBadge`.
   - `RecentEventsRail`.
   - `MiniSparkline` or `SensorHistoryChart`.

2. Add a history manager:
   - Subscribe to telemetry paths.
   - Maintain bounded per-signal buffers.
   - Keep it browser-memory-only.

3. Rework `DashboardPage`:
   - Bind all V1 telemetry paths.
   - Replace override navigation with detail navigation.
   - Remove spark card.
   - Add water, quick-shifter, map request, metadata health, and event rail.

4. Add detail/diagnostic pages:
   - `SensorDetailPage` for per-sensor graphing.
   - `TelemetryDiagnosticsPage` for events, overflow, transport, and schema.

5. Gate emulator pages:
   - Sidebar shows override pages only in mock/development mode.
   - Normal ECU mode shows dashboard, sensor details, diagnostics, and future
     map/OTA pages when their contracts exist.

---

## Acceptance Criteria

- Homepage shows all V1 latest-state signals currently available from
  `basic_sensor_telemetry_core.md`.
- No homepage element presents simulator-only override state in normal ECU mode.
- No UI label treats physical map request as the active map.
- No UI label treats thermal request as a final safety command.
- Sensor cards visibly reflect validity, health, quality, and fault bits.
- Recent event order is preserved.
- Clicking a sensor card opens a rolling graph of that signal.
- Browser-side history is bounded and does not write to ECU flash.
- Existing WebSocket parser tests continue to pass.
