# SensorsForm.md

## 🧩 Overview

The **Sensors Form** represents the main section of the Home page responsible for displaying real-time information about the system: pump status, sensor readings, timers, and (optionally) the relay fan state.
All components follow the **Observer pattern**, updating their UI reactively in response to changes in the global store (`runtime`, `outputs`, `config`, `sensors`, `socket`).

The section is composed of the following core components:

1. **Badge** – Generic status indicator (used for connection and pump state).
2. **SensorCard** – Displays temperature or humidity readings.
3. **TimerForm** – Displays and manages ON/OFF timers.
4. **RelayForm** – Optional card for the extra relay or fan state.
5. **SensorsForm** – The parent container that arranges and coordinates all the above.

---

## 🧱 Layout structure

The form layout is based on a **6-column × 2-row grid**. It ensures consistent spacing and alignment with other dashboard sections.

```css
display: grid;
grid-template-columns: repeat(6, calc((100% - 5 * 0.75rem) / 6));
gap: 0.75rem;
width: 100%;
```

| Component                | Columns                       | Notes                |
| ------------------------ | ----------------------------- | -------------------- |
| TimerForm                | 4 (→ 6 when RelayForm hidden) | Top row              |
| SensorCard (Temperature) | 2                             | Top row              |
| SensorCard (Humidity)    | 2                             | Bottom row           |
| RelayForm                | 2                             | Bottom row, optional |

At the top of the form:

* **Section title** → displays “Sensors”, updated dynamically by `i18n`.
* **Connection badge** → shows socket connection state.
* **Pump badge** → shows the pump’s operational state.

---

## 🔸 1. Badge Component

### Description

Reusable status indicator capable of showing either textual or icon-enhanced labels. Used for both the pump state and the connection state.

### Props

| Property       | Type                | Description                                                             |
| -------------- | ------------------- | ----------------------------------------------------------------------- |
| `event`        | `string`            | Store path to subscribe to (e.g., `outputs.pumpState`, `socket.state`). |
| `callback`     | `function(value)`   | Logic used to map store values to label text and CSS classes.           |
| `defaultLabel` | `string`            | Text displayed before the first update.                                 |
| `icon`         | `string` (optional) | Image or SVG icon shown on the left.                                    |

### Store subscriptions

| Store key           | Description                                                     | Effect                    |
| ------------------- | --------------------------------------------------------------- | ------------------------- |
| `outputs.pumpState` | Pump state (`off`, `on`, `low_pressure`, `blocked`, `testing`). | Updates color and text.   |
| `socket.state`      | Connection state (`disconnected`, `connecting`, `connected`).   | Updates color and text.   |
| `i18n.language`     | Language change.                                                | Updates translated label. |

### Visual behavior

* With icon → padding `0.25rem 0.75rem 0.25rem 0.5rem`
  Without icon → padding `0.5rem 1rem`
* Color mapping:

  * **on** → green
  * **off** → neutral grey
  * **low_pressure** → yellow (warning)
  * **blocked** → red (error)
  * **testing** → blue (active/test)
  * **disconnected** → red, **connecting** → yellow, **connected** → blue

### Pseudocode

```js
class Badge extends Component {
  mount() {
    Store.subscribe(this.event, this.update.bind(this));
    Store.subscribe('i18n.language', this.updateLabel.bind(this));
  }

  update(value) {
    const { label, cssClass } = this.callback(value);
    this.el.className = `badge ${cssClass}`;
    this.el.querySelector('.label').textContent = label;
  }
}
```

---

## 🔸 2. SensorCard Component

### Description

Displays temperature or humidity data, showing current value, min/max range, and setpoint indicator.

### Props

| Property     | Type     | Description                                               |
| ------------ | -------- | --------------------------------------------------------- |
| `paramId`    | `number` | ID of the parameter from `config.params`.                 |
| `sensorPath` | `string` | Store path (`sensors.temperature` or `sensors.humidity`). |
| `icon`       | `string` | Path to the icon displayed on the left.                   |
| `title`      | `string` | Static title of the sensor.                               |

### Store subscriptions

| Store key                                  | Description                                              |
| ------------------------------------------ | -------------------------------------------------------- |
| `config.params`                            | Updates setpoint/min/max if the bound parameter changes. |
| `sensors.temperature` / `sensors.humidity` | Updates live sensor value.                               |

### Behavior

* Displays a vertical bar marking the setpoint position within the range.
* The horizontal track color is fixed (`--brand-light`).
* Clicking anywhere on the card navigates to the **ParameterEditorPage** for its corresponding parameter.

### Pseudocode

```js
onClick() {
  navigateToPage('ParameterEditorPage', { paramId: this.paramId });
}
```

---

## 🔸 3. TimerForm Component

### Description

Displays the ON/OFF timers. Each timer block is individually clickable and opens its respective TimeSlot editor.

### Store subscriptions

| Store key                     | Description                                   |
| ----------------------------- | --------------------------------------------- |
| `timers.mode.on`              | Updates the ON timer value.                   |
| `timers.mode.off`             | Updates the OFF timer value.                  |
| `config.params[22].relayMode` | If `bypass`, expands card width to 6 columns. |

### Interactions

* Clicking the **ON** timer block opens `TimeSlotEditorPage` for `timerOn`.
* Clicking the **OFF** timer block opens `TimeSlotEditorPage` for `timerOff`.

### Visual

* Two adjacent blocks (`timer-value-group`) each with label and value.
* Values formatted as `mm:ss`.
* Labels "ON" and "OFF" are static and not localized.

---

## 🔸 4. RelayForm Component

### Description

Optional component that displays the state of the auxiliary relay (e.g., fan).

### Internal logic

The component is self-contained and does not receive props.

### Store subscriptions

| Store key                     | Description                          |
| ----------------------------- | ------------------------------------ |
| `config.params[22].relayMode` | Determines visibility and icon type. |
| `outputs.extraRelay`          | Updates ON/OFF state color.          |
| `i18n.language`               | Updates static label (if present).   |

### Behavior

* Hidden when `relayMode = 0 (Bypass)`.
* Displays different icons:

  | relayMode | Mode      | Icon                 |
  | --------- | --------- | -------------------- |
  | 0         | Bypass    | — (hidden)           |
  | 1         | Dispenser | `icon-dispenser.svg` |
  | 2         | Fan       | `icon-fan.svg`       |
* ON → green, OFF → neutral grey.

---

## 🔸 5. SensorsForm Container

### Description

Parent container coordinating all sub-components. Handles layout, creation, and high-level subscriptions.

### Store subscriptions

| Store key       | Description                  |
| --------------- | ---------------------------- |
| `i18n.language` | Updates the title “Sensors”. |

### DOM structure

```html
<div class="sensors-form">
  <div class="sensors-header">
    <h2 class="section-title">Sensors</h2>
    <Badge event="socket.state" />
  </div>

  <div class="badges-row">
    <Badge event="outputs.pumpState" icon="icon-pump.png" />
  </div>

  <div class="grid">
    <TimerForm />
    <SensorCard id="temp" />
    <SensorCard id="hum" />
    <RelayForm />
  </div>
</div>
```

### Lifecycle

```js
class SensorsForm extends Component {
  mount() {
    this.connectionBadge = new Badge({ event: 'socket.state' });
    this.pumpBadge = new Badge({ event: 'outputs.pumpState', icon: 'icon-pump.png' });
    this.tempCard = new SensorCard({ paramId: 10, sensorPath: 'sensors.temperature' });
    this.humCard = new SensorCard({ paramId: 11, sensorPath: 'sensors.humidity' });
    this.timer = new TimerForm();
    this.relay = new RelayForm();

    this.append(this.connectionBadge, this.pumpBadge, this.timer, this.tempCard, this.humCard, this.relay);
    Store.subscribe('i18n.language', this.updateLabels.bind(this));
  }

  updateLabels(lang) {
    this.el.querySelector('.section-title').textContent = i18n.t('sensors.title');
  }

  unmount() {
    this.connectionBadge.unmount();
    this.pumpBadge.unmount();
    this.tempCard.unmount();
    this.humCard.unmount();
    this.timer.unmount();
    this.relay.unmount();
  }
}
```

---

## 🧩 Store subscription summary

| Store key                            | Components           | Purpose                                     |
| ------------------------------------ | -------------------- | ------------------------------------------- |
| `socket.state`                       | Badge (connection)   | Update connection badge color and label.    |
| `outputs.pumpState`                  | Badge (pump)         | Update pump status label and color.         |
| `outputs.extraRelay`                 | RelayForm            | Update relay ON/OFF state.                  |
| `config.params[22].relayMode`        | RelayForm, TimerForm | Show/hide relay and adjust TimerForm width. |
| `sensors.temperature`                | SensorCard (temp)    | Update temperature value.                   |
| `sensors.humidity`                   | SensorCard (hum)     | Update humidity value.                      |
| `config.params`                      | SensorCard           | Update setpoint, min, max.                  |
| `timers.mode.on` / `timers.mode.off` | TimerForm            | Update timer values.                        |
| `i18n.language`                      | All                  | Update translated labels.                   |

---

## ✅ Expected user behavior

* Title **Sensors** and badge texts change dynamically with language.
* **Connection badge** reflects real socket connection status.
* **Pump badge** color and label follow the pump’s runtime state.
* **SensorCards** show updated readings and open the editor on click.
* **TimerForm** displays two independent clickable timer blocks.
* **RelayForm** appears only when `relayMode ≠ Bypass` and updates in real-time.
* All components cleanly unsubscribe from store events when the page unmounts.

---

## 📦 File structure

```
app/
 ├── js/components/Sensors/
 │    ├── SensorsForm.js
 │    ├── Badge.js
 │    ├── SensorCard.js
 │    ├── TimerForm.js
 │    ├── RelayForm.js
 │    └── Sensors.css
 └── doc/components/SensorsForm.md
```
