# 🧩 Prompt: Implement `RelayStatusForm` Component

## 🎯 Purpose

Create a modular UI component named **RelayStatusForm** that visually represents the current **relay (fan/dispenser/antibacterial)** status within the *Sensors Form* grid. The component must reuse the same **HTML structure and CSS classes** currently defined in the placeholder inside `SensorsForm.js`, ensuring perfect visual consistency with the existing interface.

This component shows the active relay type (by icon) and its ON/OFF state. It reacts dynamically to both configuration (`relayMode`) and runtime (`outputs.extraRelay`) changes, using the **Observer pattern** inherited from `Component.js`.

---

## 📁 File Structure

The component must follow the established project convention:

```
webui/js/components/RelayStatusForm/
 ├── RelayStatusForm.js        ← main component class (extends Component.js)
 ├── RelayStatusForm.func.js   ← helper logic and mapping functions
webui/css/components/RelayStatusForm.css
```

The stylesheet must be imported explicitly in `index.html`:

```html
<link rel="stylesheet" href="./css/components/RelayStatusForm.css">
```

---

## 🧠 Behavior Summary

### 🟩 Store Subscriptions

The component uses the **Observer pattern**, subscribing to the following store paths:

| Store Path                    | Purpose                              | Behavior                                                  |
| ----------------------------- | ------------------------------------ | --------------------------------------------------------- |
| `config.params[22].relayMode` | Determines relay type and visibility | Updates icon and hides card when `relayMode = 0 (Bypass)` |
| `outputs.extraRelay`          | Indicates ON/OFF relay state         | Updates CSS class (`.on` / `.off`) and displayed label    |
| `i18n.language`               | Tracks active UI language            | Re-renders ON/OFF labels when the language changes        |

All subscriptions are handled in `mount()` and released in `unmount()`.

---

## ⚙️ Functional Details

### Relay Mode → Icon Mapping  (defined in `RelayStatusForm.func.js`)

| relayMode | Icon                     | Behavior                |
| --------- | ------------------------ | ----------------------- |
| `0`       | *(none)*                 | Hidden (`display:none`) |
| `1`       | `icon-dispenser.png`     | Dispenser mode          |
| `2`       | `icon-fan.png`           | Fan mode                |
| `3`       | `icon-antibacterial.png` | Antibacterial mode      |
| *default* | `icon-setting.png`       | Fallback                |

### Relay State → Appearance

* Value from `outputs.extraRelay` (0 or 1)
* When `1` → Add class `.on`, show label `ON`
* When `0` → Add class `.off`, show label `OFF`

Labels are not translated (always “ON” / “OFF”), but the component subscribes to `i18n` so that they re-render when the language changes.

---

## 🧩 Component Responsibilities

### `RelayStatusForm.js`

* Extends `Component.js`
* Subscribes to `config.params[22].relayMode`, `outputs.extraRelay`, and `i18n.language`
* Renders into the same DOM position and structure as the current placeholder card
* Uses **the same HTML and CSS layout already implemented** in the placeholder inside `SensorsForm.js`
* Reactively updates icon, visibility, and label

### `RelayStatusForm.func.js`

Helper functions:

```js
export function getRelayIcon(mode) {
  switch (mode) {
    case 1: return "assets/icons/icon-dispenser.png";
    case 2: return "assets/icons/icon-fan.png";
    case 3: return "assets/icons/icon-antibacterial.png";
    default: return "assets/icons/icon-setting.png";
  }
}

export function getRelayLabel(isOn) {
  return isOn ? "ON" : "OFF";
}
```

---

## 🖼️ HTML Template

The component must **reuse** the same structure as in the existing placeholder:

```html
<!-- Relay Status Card (simple-card, spans 2 columns) -->
<div class="pump-card simple-card relay-card off">
  <div class="pump-card-icon">
    <img src="assets/icons/icon-fan.png" alt="Relay">
  </div>
  <div class="pump-card-label">OFF</div>
</div>
```

### Dynamic updates:

* `.on` / `.off` class toggles depending on `outputs.extraRelay`
* `<img>` source changes based on `relayMode`
* `display:none` applied when `relayMode = 0`

---

## 🎨 Styling — `RelayStatusForm.css`

The component uses **the same styles** already applied in the placeholder within the existing UI. It should therefore replicate the same card design from the sensors form without introducing new colors or spacing.

```css
/* === RELAY STATUS CARD === */
.relay-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  border-radius: var(--radius);
  background: var(--card);
  border: 2px solid var(--border);
  box-shadow: var(--shadow);
  transition: all 150ms ease-in-out;
  grid-column: span 2;
}

.relay-card.hidden { display: none; }

.relay-card .pump-card-icon img {
  width: 48px;
  height: 48px;
}

.relay-card .pump-card-label {
  font-weight: 700;
  font-size: 1rem;
  margin-top: 0.5rem;
  text-transform: uppercase;
}
```

---

## 🧱 Integration

Replace the old placeholder inside `SensorsForm.js` with this component:

```html
<!-- Relay Status Card (simple-card, spans 2 columns) -->
<div id="relay-status-form-container"></div>
```

Mount dynamically:

```js
import RelayStatusForm from './components/RelayStatusForm/RelayStatusForm.js';

const relayForm = new RelayStatusForm();
relayForm.mount(document.getElementById('relay-status-form-container'));
```

---

## ✅ Acceptance Criteria

* Uses **exact same HTML/CSS** from current placeholder.
* Hides via `display:none` when `relayMode = 0`.
* Correct icon shown for each relay mode.
* Correct ON/OFF label updated live via Observer pattern.
* All updates managed through store subscriptions (no DOM event listeners).
* Follows folder/file structure convention.
* Uses only **relative paths** for imports and assets.
* Fully consistent with the existing sensors form layout and theme.
