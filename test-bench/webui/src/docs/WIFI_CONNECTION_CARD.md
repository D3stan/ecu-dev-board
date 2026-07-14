# Wi-Fi Connection Card — Implementation Documentation

## Summary

This document describes the implementation of the **Wi-Fi Connection Card** UI component
for the FogExtra WebApp. The card displays the current Wi-Fi connection status,
a list of available networks, and allows connecting to networks (open, known,
or password-protected) via an inline accordion form.

All UI is **reactive to the central Store** — no optimistic UI.

---

## New Components (created)

```
webui/src/js/components/WifiConnectionCard/
├── WifiConnectionCard.js      ← Main card component (extends Component)
├── WifiConnectionCard.css     ← (in css/components/)
├── WifiConnectInlineForm.js   ← Password form sub-component (extends Component)
├── WifiSignalBars.js          ← Static signal bars renderer (pure function)
└── wifiIcons.js               ← Icon mapping module (constants + helper)
```

### CSS location

`webui/src/css/components/WifiConnectionCard.css` — imported via `styles.css`.

---

## Modified Files

| File | Change |
|------|--------|
| `webui/src/js/pages/WifiPage.js` | Replaced placeholder HTML with `#wifi-connection-card-container`; mounts `WifiConnectionCard`; cleans up on destroy |
| `webui/src/js/utils/paths.js` | Removed `NETWORKS_UPDATED_AT` and `UI_WAITING` |
| `webui/src/js/core/store.js` | Removed `networksUpdatedAtMs` and `isWaitingConnectionResult` from initial state & `reset()` |
| `webui/src/js/core/adapter.js` | Removed `Store.set(Paths.WIFI.NETWORKS_UPDATED_AT, ...)` from `parseNetworksList()` |
| `webui/src/js/utils/i18n.js` | Added `wifi.*` translation keys to all 5 languages (EN, IT, FR, DE, ES) |
| `webui/src/css/styles.css` | Added `@import url('./components/WifiConnectionCard.css')` |

---

## Store Paths Used

| Path constant | Store path | Purpose |
|---------------|-----------|---------|
| `Paths.WIFI.NETWORKS` | `wifi.networks` | Array of scanned networks |
| `Paths.WIFI.CONNECTION.STATUS` | `wifi.connection.status` | wifiStatus enum string |
| `Paths.WIFI.CONNECTION.CONNECTED_SSID` | `wifi.connection.connectedNetwork.ssid` | Connected network name |
| `Paths.WIFI.CONNECTION.CONNECTED_SIGNAL` | `wifi.connection.connectedNetwork.signalLevel` | Connected signal 0–4 |
| `Paths.WIFI.CONNECTION.CONNECTING_SSID` | `wifi.connection.connectingNetwork.ssid` | Network being connected |
| `Paths.WIFI.CONNECTION.CONNECTING_BSSID` | `wifi.connection.connectingNetwork.bssid` | BSSID of connecting net |
| `Paths.WIFI.CONNECTION.CONNECTING_SIGNAL` | `wifi.connection.connectingNetwork.signalLevel` | Connecting signal 0–4 |

---

## UI States Mapping

| `wifi.connection.status` | Card behavior | Current row | Available list | Scan button |
|--------------------------|---------------|-------------|----------------|-------------|
| `disconnected` | Normal | "No network" + badge "Not connected" | Clickable rows | Enabled |
| `scanning` | Normal | Unchanged | Rows visible, connect disabled | Disabled |
| `connecting` | **Disabled (opacity)** | Unchanged | All rows disabled; matched row highlighted with spinner + "Connecting…" (full opacity) | Disabled |
| `connected` | Normal | SSID + badge "Connected" + signal bars | Clickable rows | Enabled |
| `failed` / `auth_failed` / `backoff` / `stopped` | Normal (same as disconnected) | "No network" | Clickable rows | Enabled |

---

## Interaction Flows

### Scan Flow
1. User clicks **Scan** button.
2. `WifiConnectionCard._onScanClick()` checks status ≠ scanning/connecting.
3. Calls `CommandManager.sendWifiScan()`.
4. ESP responds → adapter updates `Store(wifi.networks)`.
5. Card subscription fires → `_renderAvailableList()` rebuilds the list.

### Connect Flow — Open / Known Network
1. User clicks a network row where `isOpen === true` OR `isKnown === true`.
2. `_onNetworkRowClick()` calls `CommandManager.sendWifiConnect({ ssid, psw: "", channel, bssid })` immediately.
3. No accordion opens.
4. ESP processes → Store updates `status → connecting` → Card disables + highlights row.
5. ESP completes → Store updates `status → connected` → Card re-enables.

### Connect Flow — Protected (Unknown) Network
1. User clicks a protected network row.
2. Accordion toggles open → `WifiConnectInlineForm` mounts with password input.
3. User types password, clicks **Connect**.
4. `_handleFormConnect()` calls `CommandManager.sendWifiConnect({ ssid, psw, channel, bssid })`.
5. Same reactive flow as above.

### Connecting State Behavior
- Entire card gets `opacity: 0.55` + `pointer-events: none`.
- The **connecting row** is matched by BSSID (fallback: SSID) and keeps `opacity: 1`.
- Connecting row shows a CSS spinner + "Connecting…" label.
- Accordion is force-closed.
- Scan button is disabled.

---

## Debug Log Tags

All logs use `log.debug('WifiConnectionCard', ...)` or `log.debug('WifiConnectionCard', ...)`.

| Event | Example log |
|-------|-------------|
| Scan clicked | `scan button clicked` |
| Scan blocked | `scan ignored: status=scanning` |
| Network clicked | `network clicked: id="...", ssid="...", isOpen=..., isKnown=...` |
| Expand accordion | `expand network: id="..."` |
| Collapse accordion | `collapse network: id="..."` |
| Force collapse | `collapse forced: connecting, was expanded=...` |
| Password toggle | `password visibility toggled: visible=true` |
| Connect clicked | `connect clicked: ssid="...", channel=..., bssid="..."` |
| Connect blocked | `connect ignored: status=connecting` |
| Status change | `status changed: disconnected -> connecting` |
| Networks update | `networks updated: 5 items` |
| Connected SSID | `connected SSID changed: "Office_5G"` |
| Connecting BSSID | `connecting BSSID changed: "AA:BB:CC:DD:EE:FF"` |

---

## Removed Paths & Why

| Removed | Location | Reason |
|---------|----------|--------|
| `wifi.networksUpdatedAtMs` | Store initial state, reset(), Paths.WIFI.NETWORKS_UPDATED_AT, adapter `parseNetworksList()` | Unused timestamp — no UI consumer |
| `wifi.isWaitingConnectionResult` | Store initial state, reset(), Paths.WIFI.UI_WAITING | Optimistic UI flag — replaced by reactive status subscription |

---

## i18n Keys Added

Namespace: `wifi.*`

| Key | EN | IT |
|-----|----|----|
| `wifi.card.title` | Wi-Fi Connection | Connessione Wi-Fi |
| `wifi.card.scan` | Scan | Scansiona |
| `wifi.section.current` | Current Network | Rete Attuale |
| `wifi.section.available` | Available Networks | Reti Disponibili |
| `wifi.section.foundCount` | {count} networks found | {count} reti trovate |
| `wifi.badge.connected` | Connected | Connesso |
| `wifi.badge.disconnected` | Not connected | Non connesso |
| `wifi.badge.saved` | Saved | Salvata |
| `wifi.label.open` | Open | Aperta |
| `wifi.label.noNetwork` | No network | Nessuna rete |
| `wifi.label.unknownNetwork` | Unknown network | Rete sconosciuta |
| `wifi.state.connecting` | Connecting… | Connessione… |
| `wifi.form.passwordRequired` | Password required | Password richiesta |
| `wifi.form.connect` | Connect | Connetti |
| `wifi.form.showPassword` | Show password | Mostra password |
| `wifi.form.hidePassword` | Hide password | Nascondi password |

All 5 languages (EN, IT, FR, DE, ES) are populated.

---

## Icon Mapping

Icons are defined in `wifiIcons.js`. Current placeholder paths:

| Variable | Path | Notes |
|----------|------|-------|
| `WIFI_OPEN_ICON` | `./assets/icons/wifi-open.svg` | Place real SVG here |
| `WIFI_LOCK_ICON` | `./assets/icons/wifi-lock.svg` | Place real SVG here |
| `WIFI_OFF_ICON` | `./assets/icons/wifi-off.svg` | Place real SVG here |
| `EYE_ICON` | `./assets/icons/eye.svg` | (Currently CSS-only eye is used) |
| `EYE_OFF_ICON` | `./assets/icons/eye-off.svg` | (Currently CSS-only eye is used) |

**CSS-only icons** (no asset file needed):
- **Chevron**: `.wifi-icon-chevron` — rotates 90° when expanded
- **Spinner**: `.wifi-icon-spinner` — CSS border animation
- **Signal Bars**: `.wifi-signal-bars` — 4 divs with height steps
- **Refresh**: `.wifi-icon-refresh` — Unicode ⟳ character
- **Eye toggle**: `.wifi-icon-eye` — CSS shapes for eye + pupil

If an icon asset fails to load, the `renderIcon()` helper hides the `<img>` and
injects a `.wifi-icon--missing` placeholder (gray circle) to preserve layout.
