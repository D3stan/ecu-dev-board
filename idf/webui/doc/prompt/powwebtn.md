# ⚡ Power Button Component + Custom Command Integration

## Overview

The **PowerButton** component provides a visual and functional control for toggling the system’s main pump power state (ON/OFF).  
It behaves similarly to the mode buttons but uses a **custom command** instead of a standard parameter modification.

When the corresponding parameter is disabled (`paramId` value = 0), the button is hidden.  
When enabled, it displays its ON/OFF state and sends a custom command (`CMD_PUMP_STATE`) through the `commandManager` when clicked.

This document also defines the **new command** `powerPump(state)` to be added to the `commandManager`, including the creation of a dedicated constant and strict input validation.

---

## 🧱 Architectural Context

All components follow the same design pattern used throughout the Web UI:

- **Observer Pattern:** listens to store updates in real-time.  
- **Component.js inheritance:** handles lifecycle methods (`mount`, `update`, `unmount`).  
- **i18n integration:** manages label updates when language changes.  
- **Store subscriptions:** dynamically reflect system state.  
- **commandManager integration:** sends encoded commands to the device.  
- **Relative imports:** for all local modules and assets.  
- **CSS modularization:** one file per component, imported into `index.html`.

---

## 📁 Folder Structure

webui/js/components/PowerButton/
├── PowerButton.js # Component definition and subscriptions
├── PowerButton.func.js # Logic helpers, DOM updates, click behavior
webui/css/components/PowerButton.css

arduino
Copia codice

In `index.html`, import the stylesheet:
```html
<link rel="stylesheet" href="./css/components/PowerButton.css">
⚙️ PowerButton Component Specification
Purpose
The PowerButton controls the main pump power state, displaying three visual conditions:

Hidden (disabled)

ON (active)

OFF (inactive)

Inputs (Props)
Prop	Type	Description
iconPath	String	Path to the power icon (e.g. "assets/icons/icon-remote.png").
callback	Function	Custom callback triggered on click — sends a custom command via commandManager.
storePath	String	Path in the store reflecting the current ON/OFF status (boolean).
paramId	Number	ID of the configuration parameter determining if the button should be visible (enabled).

🔄 Reactive Behavior
The PowerButton subscribes to two store sources:

storePath — monitors current ON/OFF state.

config.params[paramId] — determines whether the button should be visible or hidden.

Condition	Visual Result	Behavior
config.params[paramId] == 0	Hidden (display: none)	The component is removed from view.
config.params[paramId] == 1 && storePath == false	OFF	Neutral appearance with “OFF” label.
config.params[paramId] == 1 && storePath == true	ON	Blue background with “ON” label.

🖱️ Click Behavior
When the button is visible and clicked:

Executes the provided callback().

The callback triggers the custom command powerPump(state):

js
Copia codice
commandManager.powerPump(!currentState);
The command sends 1 to turn ON and 0 to turn OFF.

The UI will update only after receiving the updated value from the store.

If the button is hidden (paramId == 0), clicks are ignored.

🧠 Integration with i18n
The PowerButton subscribes to i18n updates.

Labels “ON” and “OFF” are translated automatically if localization provides corresponding keys.

Default fallback values are “ON” and “OFF” (English uppercase).

No units or measurements are localized within this component.

🎨 Visual Design
The PowerButton visually matches all other cards and buttons in the interface.

State	Background	Border	Text	Icon
ON	var(--brand)	none	#FFFFFF	white (inverted filter)
OFF	var(--card)	1px solid var(--border)	var(--text-muted)	dark gray
Hidden	none (display: none)	—	—	—

Design rules:

Full width of container.

Rounded corners (var(--radius)).

Shadow (var(--shadow)).

Centered alignment of icon and label.

🧩 Example HTML Template
html
Copia codice
<div class="power-button-container" id="powerButton">
  <button class="power-button off">
    <img src="assets/icons/icon-remote.png" alt="Power Icon" class="power-icon">
    <span class="power-label">OFF</span>
  </button>
</div>
When active:

html
Copia codice
<button class="power-button on">
  <img src="assets/icons/icon-remote.png" alt="Power Icon">
  <span class="power-label">ON</span>
</button>
When disabled (hidden):

html
Copia codice
<div class="power-button-container" style="display: none;"></div>
💡 PowerButton.css
Do not override global colors or variables.
Place this file in:

bash
Copia codice
webui/css/components/PowerButton.css
Example rules:

css
Copia codice
.power-button-container {
  width: 100%;
  display: flex;
  justify-content: center;
}

.power-button {
  width: 100%;
  padding: 1rem;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  font-size: 1.25rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.15s ease;
}

.power-button img {
  width: 1.25rem;
  height: 1.25rem;
}

.power-button.on {
  background: var(--brand);
  color: white;
  border: none;
}

.power-button.off {
  background: var(--card);
  color: var(--text-muted);
  border: 1px solid var(--border);
}

.power-button:active {
  transform: scale(0.98);
}
⚙️ commandManager Integration
Purpose
The PowerButton uses a new custom command in commandManager called powerPump(state),
which sends a device-level control message for enabling or disabling the main pump.

🔸 New Constant
Add this new constant in the command list:

js
Copia codice
export const CMD_PUMP_STATE = "CMD_PUMP_STATE";
🔸 New Function: powerPump(state)
Create the function inside commandManager.js:

js
Copia codice
/**
 * Toggles the pump power state.
 * @param {boolean} state - true to turn ON, false to turn OFF.
 *
 * Sends: CMD_PUMP_STATE|<value>
 * Where <value> is 1 for ON, 0 for OFF.
 */
export function powerPump(state) {
  if (typeof state !== "boolean") {
    console.error("❌ powerPump: 'state' must be a boolean (true/false). Command aborted.");
    return;
  }

  const value = state ? 1 : 0;
  const message = `${CMD_PUMP_STATE}|${value}`;

  try {
    Socket.send(message);
    console.log(`📤 Power command sent: ${message}`);
  } catch (error) {
    console.error("❌ Error sending powerPump command:", error);
  }
}
Example Usage from PowerButton
js
Copia codice
// Inside PowerButton click handler:
const current = store.get("runtime.power.isActive");
commandManager.powerPump(!current);
🔄 Lifecycle Summary
Phase	Action
mount()	Subscribe to storePath, config.params[paramId], and i18n. Initialize DOM references.
update()	If paramId becomes 0 → hide button. Otherwise, update visuals (ON/OFF).
onClick()	Call commandManager.powerPump() with toggled state.
unmount()	Unsubscribe from all listeners.

✅ Summary
Features Recap:

Three-state logic: Hidden, OFF, ON.

Subscriptions to both store runtime and config parameters.

Sends a custom command (CMD_PUMP_STATE) when toggled.

Input validation ensures state is strictly boolean.

Inherits from Component.js and uses Observer pattern.

i18n-ready labels (“ON” / “OFF”).

Responsive, mobile-friendly layout.

Fully consistent with the rest of the UI’s visual system.

Final Files:

swift
Copia codice
webui/js/components/PowerButton/PowerButton.js
webui/js/components/PowerButton/PowerButton.func.js
webui/css/components/PowerButton.css
And one update to:

bash
Copia codice
webui/js/core/commandManager.js
This implementation provides a robust and extensible power control interface,
compliant with the project’s architecture and visual design principles.

yaml
Copia codice
