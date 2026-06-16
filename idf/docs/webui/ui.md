# ECU WebUI — Stitch Design Walkthrough

> Project: **ECU Dev Board WebUI**  
> Stitch Project ID: `17258113336033024256`  
> Design System: **ECU Cockpit Dark** (`assets/8566048425146729513`)

---

## Design System

| Token | Value |
|-------|-------|
| Background | `#00110f` (deep dark teal-black) |
| Primary | `#00C9A7` teal — active, healthy, live states |
| Secondary | `#FF6B35` orange — warnings, alerts |
| Tertiary | `#4FC3F7` sky blue — info badges |
| Headline font | Space Grotesk |
| Body font | IBM Plex Sans |
| Label / data font | JetBrains Mono → Public Sans (rendered) |
| Roundness | 8px |
| Mode | Dark · Vibrant |

---

## Screens

### 1 — ECU Live Cockpit Dashboard
**Screen ID:** `047256d8db914162ab246de81743afda`  
**Dimensions:** 780 × 1768 px · MOBILE

> The hero screen — the ECU cockpit replaces all simulator controls.

**Layout implemented:**
- Fixed **top bar**: "ECU" title + teal live dot · WS status pill (green LIVE) · settings icon
- **Status strip**: monospace pills — `WS schema v1 | 10 Hz | gen 482 | frame age 0ms | transport OK`
- **RPM Hero card**: thick teal arc gauge, `8,450 RPM` centered, `SYNCHRONIZED` + `accel +320 rpm/s` sub-lines, GOOD health badge
- **Sensor card 2×grid**: TPS / EGT / Water Temp / Engine Sync / Quick Shifter / Map Request / Knock — each with value, secondary state, health badge
- **Recent Events rail**: 3 color-coded events with kind + relative time + payload summary
- **Bottom nav**: Dashboard (active teal) · Sensors · Diagnostics · Dev

**Screenshot:**
![ECU Live Cockpit Dashboard](https://lh3.googleusercontent.com/aida/AP1WRLvklOv1sa4kF-nbJGQXszISj2F5d_iQshDXrNnNkEzAusOwTgonMWBCREyDaxhgen0sqs0JQnLRwVSXU2U3UHWwcUZ_YH8m25EBThaFgWW3RbCL9UEmRGPo6oCFeV0k0Mog87xTt4jr2BchFo3aflr63DYgik7TBS-Sjrh35C9gu_RpyYZCby3zS-76-w33W92X8VVzfwQ1QjEilFYes8kIq9l_uta6wTs7OWoLyb3J1q0keGaeQgn1SpYT)

[Download HTML](https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzY0M2RiNDIxODY3YTQ2MGY5MTgxZmYxNDFmMTM0NDcyEgsSBxDg_PG05BUYAZIBJAoKcHJvamVjdF9pZBIWQhQxNzI1ODExMzMzNjAzMzAyNDI1Ng&filename=&opi=96797242)

---

### 2 — RPM Sensor Detail / History
**Screen ID:** `8d7904f087c04e67862740790037a609`  
**Dimensions:** 780 × 1992 px · MOBILE

> Opens when the user taps any sensor card on the dashboard.

**Layout implemented:**
- **Top bar**: ← back · "RPM — Engine Speed" · GOOD badge
- **Live value header**: `8,450 RPM` large monospace, sync status, accel, seq, acquisition age
- **Time range pills**: 30s · **2min** · 10min (teal active)
- **Rolling chart**: 0–18k RPM teal line, orange event markers at shift points, LIVE pill, PAUSE button
- **Toggles**: Event Markers ON · Smoothing OFF
- **Metadata table**: valid / health / quality / seq / acquired_at_us / fault_bits / frame_t_us

**Screenshot:**
![RPM Sensor Detail](https://lh3.googleusercontent.com/aida/AP1WRLs1fc0hFb86DZfCqZPu_IBUndP7F6KyqFi3qgcDfbEgaRX-EWkVVCd1lw2GAbm6KSjBi6xqcw98eIPhlQq7KSa2C1DSSKH8D39d0wH6h0s2a66YVgBFprL23d-0Xqd0bR1XfWhaPvD3l5erU1UmFEWRhmnuS8pc8cTVzxb94Zjz8kcfuevW3l2spONVN5iiKfoLndUejk2gAxmUkUeBZhZPkLT9wCdYRhtySvAkNPEESg0HAxONuBP-xbLo)

[Download HTML](https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzYyOGU3NDU2YTAzZTQ3N2FhOGQ5NjIyNWNmZjhlMmI4EgsSBxDg_PG05BUYAZIBJAoKcHJvamVjdF9pZBIWQhQxNzI1ODExMzMzNjAzMzAyNDI1Ng&filename=&opi=96797242)

---

### 3 — Telemetry Diagnostics
**Screen ID:** `a78dcd732f7040d398f71bee12db6421`  
**Dimensions:** 780 × 1768 px · MOBILE

> Advanced diagnostics for dropped frames, overflows, and transport health.

**Layout implemented:**
- **Top bar**: "Diagnostics" · REFRESH button (teal)
- **Capabilities card**: schema v1, 10 Hz, 8 events/batch, ESTABLISHED
- **Transport Health card**: frames_rx / frames_ok (green) / parse_err (amber) / queue_drop
- **Sensor Overflow Counters**: RPM / TPS / EGT / Water — all 0 (green)
- **Full Event Log**: 8 color-coded events — QS_REQUEST / MAP_SWITCH / FAULT_CLEAR / FAULT_SET with timestamps and payloads
- **Bottom nav**: Diagnostics (active teal)

**Screenshot:**
![Telemetry Diagnostics](https://lh3.googleusercontent.com/aida/AP1WRLuxbTbNPfu7_fMswIHMRJdJJGvstUJZtIdo4wlRGNTKet06clNP78TFKY8fotUNrjceADmwdLpgrtAuoWqGRY_9IY9aklkITYA5uR3YqiRSNVoUxFkwrZSoo1FUDkleLkGetERdAo5pdrZqqQpcGxUYuKLg_TVwJZGg8gs0fvoxA3nSp6zz3Mne8ow9EebRMoinhHn9OVkwkbp75CJfp38hlk5gMFAa3A9jQsTOsz2ZgQLyx2N03ZwSujsC)

[Download HTML](https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzJkYjk1OTc0YzM2MDRkYmM4NzViZjljNGIyNjc5OTQzEgsSBxDg_PG05BUYAZIBJAoKcHJvamVjdF9pZBIWQhQxNzI1ODExMzMzNjAzMzAyNDI1Ng&filename=&opi=96797242)

---

### 4 — Sensor Telemetry Table
**Screen ID:** `3360094d0678477097d0a7088488b652`  
**Dimensions:** 780 × 1768 px · MOBILE

> Dense read-only inspection page — all V1 sensors with full metadata.

**Layout implemented:**
- **Top bar**: "Sensor Telemetry" · gen counter amber monospace
- **Frame info bar**: t_us / frame age / gen — horizontal scrollable strip
- **Per-sensor cards** (RPM, TPS, EGT, Water Temp, Quick Shifter, Knock):
  - Header: sensor name + current value right-aligned
  - Metadata table: valid / health / quality / seq / acquired_at_us / age / fault_bits
- **EGT fault example**: DEGRADED amber badge + fault_bits 0x01 amber + amber left border
- **Quick Shifter**: active=false, armed=true, "Digital state only" note
- **Knock**: normalized_idx=0.12, candidate=false, ignition_angle=28.4°, "Summary only" note
- **Bottom nav**: Sensors (active teal)

**Screenshot:**
![Sensor Telemetry](https://lh3.googleusercontent.com/aida/AP1WRLvl74x3nagltXJZR2jbiY9KIcjGqdvp_mathzr7Dr_nZu6PeCg21MjSbFqmazUijVvFveX33s3YAKPDWC7Qj2zdmh45h0ziq8Fg_j4zg91OSOFgi9Z3A4BMs5uF8u5JKWaa02Xc06qEWVkW-tq9zplugenGSzOKs_MEeFsh53V8EGk6kGPgcKQru_fAmkpr0hYSEEuEk09yikMIxOD5xN_HyGic-O570KZUlbeOYfISzmBDsTMI9o_GeUx7)

[Download HTML](https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzhkNWRkNTFiMGNkOTQyNTQ4MmVmYzNiM2Y3NzdjMzBkEgsSBxDg_PG05BUYAZIBJAoKcHJvamVjdF9pZBIWQhQxNzI1ODExMzMzNjAzMzAyNDI1Ng&filename=&opi=96797242)

---

## Proposal Acceptance Criteria — Coverage

| Criterion | Status |
|-----------|--------|
| Homepage shows all V1 latest-state signals | ✅ Dashboard card grid |
| No simulator-only override state in ECU mode | ✅ No VIRTUAL/PHYSICAL override badges |
| Map request labelled as physical request (not active map) | ✅ "physical switch" sub-label |
| Thermal request not labelled as safety command | ✅ "THERMAL OK" informational only |
| Sensor cards show validity, health, quality, fault bits | ✅ Sensor Telemetry table + card badges |
| Recent event order preserved | ✅ Event rail + full event log |
| Clicking sensor card opens rolling graph | ✅ Sensor Detail page with chart |
| Browser-side history bounded, no ECU flash write | ✅ Design intent documented (client ring buffer) |
| Existing WebSocket parser tests continue to pass | ⬜ Not modified — code changes TBD |

---

## Next Steps

1. **Download HTML** files from each screen and adapt them into the existing Vite build
2. **Implement** the `HistoryManager` (ring buffer) as described in the proposal's buffering model
3. **Wire up** new `DashboardPage.js` bindings for: `water_temp`, `rpm_accel`, `rpm_synchronized`, `quick_shifter.*`, `map_switch.request`, `knock.*`, `meta.*`, `events`
4. **Add** `SensorDetailPage`, `TelemetryDiagnosticsPage`, `TelemetrySensorsPage`
5. **Gate** RPM/TPS/EGT override pages behind `config.useMockData`
