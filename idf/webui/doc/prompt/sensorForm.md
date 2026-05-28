# 🧩 Prompt: Implement `SensorCard` Component

## 🎯 Purpose

Develop a reusable UI component named **SensorCard** that visually represents the live reading of a physical sensor (e.g., temperature or humidity) together with its configurable setpoint range.
Each card displays:

* The **current sensor value** (real-time reading).
* The **setpoint value** (target, coming from a parameter).
* A **horizontal progress bar** showing both the live reading and the setpoint position.
* The **min** and **max** range of the parameter.

The component must reproduce **exactly the same HTML and CSS layout** as the current placeholder cards inside `SensorsForm.js`. Existing styles and HTML from the placeholder are correct and must be reused without modifications.

---

## 📁 File Structure

Follow the standard project convention:

```
webui/js/components/SensorCard/
 ├── SensorCard.js        ← main component class (extends Component.js)
 ├── SensorCard.func.js   ← helper logic and calculations
webui/css/components/SensorCard.css
```

The stylesheet must be explicitly linked in `index.html`:

```html
<link rel="stylesheet" href="./css/components/SensorCard.css">
```

---

## 🧠 Behavior Overview

The component uses the **Observer pattern** via the store’s subscription mechanism and inherits lifecycle behavior from `Component.js`.

### 🟩 Subscriptions

The component subscribes to:

| Store Path          | Purpose                                            | Update Action                                                      |
| ------------------- | -------------------------------------------------- | ------------------------------------------------------------------ |
| `sensors.<type>`    | Real-time sensor reading (temperature or humidity) | Updates the main value label and bar fill width                    |
| `config.params`     | Parameter setpoint + min/max range                 | Updates setpoint marker position, numeric labels, and bottom range |
| *(no subscription)* | i18n (not needed for this card)                    | Units and text remain constant across all languages                |

All subscriptions are attached in `mount()` and released automatically in `unmount()` by inheritance from `Component.js`.

---

## ⚙️ Functional Details

### Inputs

Each `SensorCard` instance receives three arguments:

1. **`sensorPath`** → Store path to subscribe for real-time value (e.g. `"sensors.temperature"` or `"sensors.humidity"`).
2. **`iconPath`** → Relative path to the icon image (e.g. `"assets/icons/icon-thermo.png"`).
3. **`paramId`** → Parameter ID representing the setpoint and its min/max limits.

### Display Logic

| Element                                    | Source                                             | Behavior                                       |
| ------------------------------------------ | -------------------------------------------------- | ---------------------------------------------- |
| **Main value (center label)**              | from `sensors.<type>`                              | Displays real-time reading with unit (°C / %)  |
| **Progress bar**                           | from `sensors.<type>` and `config.params[paramId]` | Fills proportionally from min to current value |
| **Vertical marker**                        | from `config.params[paramId]`                      | Indicates the setpoint position                |
| **Min / Max labels**                       | from `config.params[paramId]`                      | Show absolute range limits                     |
| **Setpoint numeric label (bottom center)** | from `config.params[paramId]`                      | Shows target setpoint value numerically        |

### Progress Bar Calculation

The bar’s **filled width** represents the ratio `(value - min) / (max - min)`.
The **setpoint marker** position represents `(setpoint - min) / (max - min)`.
The colored fill must always use the CSS variable `--brand-light`.

Example helper in `SensorCard.func.js`:

```js
export function getPercentage(value, min, max) {
  return ((value - min) / (max - min)) * 100;
}

export function updateBar(sensorValue, setpoint, min, max, elements) {
  const valuePercent = getPercentage(sensorValue, min, max);
  const setpointPercent = getPercentage(setpoint, min, max);

  elements.fill.style.width = `${valuePercent}%`;
  elements.fill.style.marginLeft = `0%`;
  elements.marker.style.left = `${setpointPercent}%`;
}
```

---

## 🖼️ HTML Structure

The rendered HTML must reuse the **exact same structure** from the existing placeholder in `SensorsForm.js`. No visual or structural modification is allowed. Example:

```html
<!-- Temperature Sensor Card -->
<div class="pump-card sensor-card">
  <div class="sensor-card-top">
    <div class="pump-card-icon">
      <img src="assets/icons/icon-thermo.png" alt="Temperature">
    </div>
    <div class="sensor-value-container">
      <div class="pump-card-value">24.4°C</div>
    </div>
  </div>
  <div class="sensor-bar-container">
    <div class="sensor-bar-track">
      <div class="sensor-bar-fill temperature" style="width: 27.1%; margin-left: 11.1%;"></div>
      <div class="sensor-setpoint-marker" style="left: 41.4%;"></div>
    </div>
    <div class="sensor-bar-labels">
      <span class="sensor-bar-label">-10°</span>
      <span class="sensor-setpoint">27.3°</span>
      <span class="sensor-bar-label">80°</span>
    </div>
  </div>
</div>
```

The same structure is valid for humidity sensors, replacing the icon and class `.temperature` with `.humidity`.

---

## 🧭 Interactivity

* When the user **clicks anywhere** on the card (or on the main value label), the component triggers a navigation to **`parameterEditorPage`** using `navigatorManager`.
* The navigation receives the `paramId` passed to the constructor, so the correct parameter is shown for editing.

Example:

```js
this.element.addEventListener('click', () => {
  navigatorManager.navigate('parameterEditorPage', { paramId: this.paramId });
});
```

---

## 🧱 Integration

In `SensorsForm.js`, replace the old static HTML card placeholders with dynamic mount points:

```html
<div id="sensor-card-temperature"></div>
<div id="sensor-card-humidity"></div>
```

Mount dynamically in JavaScript:

```js
import SensorCard from './components/SensorCard/SensorCard.js';

const tempCard = new SensorCard('sensors.temperature', 'assets/icons/icon-thermo.png', PARAM_ID_TEMPERATURE);
const humCard = new SensorCard('sensors.humidity', 'assets/icons/icon-humidity.png', PARAM_ID_HUMIDITY);

tempCard.mount(document.getElementById('sensor-card-temperature'));
humCard.mount(document.getElementById('sensor-card-humidity'));
```

---

## ✅ Acceptance Criteria

* Uses **exact HTML and CSS** from current placeholders.
* Subscribes to `sensors.<type>` and `config.params` using the Observer pattern.
* Dynamically updates sensor reading, progress fill, setpoint marker, and numeric labels.
* Progress bar uses `--brand-light`.
* Clicking navigates to the correct `parameterEditorPage`.
* Follows folder/file structure convention (with `Component.js` inheritance, separated `.func.js` logic, linked `.css`).
* Uses only **relative paths** for imports and assets.
* Fully consistent with the current `SensorsForm` layout and theme.
