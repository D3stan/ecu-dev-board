# 🧭 Mode Selector System — Full Implementation Guide

## Overview

This document provides a complete and detailed specification for implementing the **Mode Selector System**, which manages six operational modes and a pump status badge within the device interface.

The system is composed of three primary components:

1. **ModeSelector** — the main container responsible for displaying all six mode buttons and the pump badge.  
2. **ModeStateButton** — the reusable three-state button component representing each individual mode (Temperature, Humidity, Timer, Calendar, AUX, Wireless).  
3. **PumpBadge** — the already implemented badge displaying pump state and connection status.

All components must follow the same architectural principles as the rest of the application:
- Use of the **Observer Pattern** for reactivity via the centralized `store`.
- Integration with **i18n** for multilingual text.
- Inheritance from the base `Component.js` for standardized lifecycle management.
- Strict **relative imports** for all paths and assets.
- Separation of **logic (`.func.js`)**, **component definition (`.js`)**, and **styling (`.css`)** files.

---

## 🧱 Application Architecture Recap

### Store and Observer Pattern
All components communicate exclusively through the global `store`.  
Each component subscribes to one or more store paths using the observer mechanism (`store.subscribe(path, callback)`).  
When the observed data changes, the component automatically receives the update and re-renders its relevant parts.

### i18n Integration
The **i18n module** provides dynamic language updates.  
Components subscribe to language changes via `i18n.subscribe(callback)` and re-render localized labels when triggered.  
The `ModeSelector` subscribes to update the section title (“Mode Selector”), while the buttons and pump badge remain language-independent.

### Component Inheritance
Every component extends `Component.js`, inheriting the lifecycle methods:
- `mount()` → subscribe to store and i18n events.
- `update()` → refresh DOM elements when observed data changes.
- `unmount()` → remove listeners when the component is replaced.

### Responsive Layout
All mode buttons are displayed in a responsive grid:
- Default layout: 1 row × 6 buttons.  
- If space is limited: 2 rows × 3.  
- If still insufficient: 3 rows × 2.  
- On small screens: stacked vertically (6 rows × 1).

CSS uses `display: flex; flex-wrap: wrap; justify-content: space-between;` to automatically manage the transitions.

---

## 📁 Folder Structure

All components must reside under the following structure:

webui/js/components/ModeSelector/
├── ModeSelector.js
├── ModeSelector.func.js
webui/js/components/ModeStateButton/
├── ModeStateButton.js
├── ModeStateButton.func.js
webui/css/components/ModeSelector.css

bash
Copia codice

The stylesheet must be linked in the main `index.html` file:

```html
<link rel="stylesheet" href="./css/components/ModeSelector.css">
All paths are relative.

⚙️ Components Overview
1️⃣ ModeSelector Component
Purpose
The ModeSelector component acts as the top-level container for:

The six mode state buttons (ModeStateButton components).

The PumpBadge component displayed on the right side of the title.

It subscribes to i18n for live title translation and uses the store to manage reactive updates.

Responsibilities
Instantiate and render six ModeStateButton components.

Display the existing PumpBadge on the header.

Subscribe to i18n to update the “Mode Selector” title dynamically.

Handle layout responsiveness.

Dependencies
Component.js — base class for Observer pattern integration.

i18n.js — language management module.

store.js — central data store.

commandManager.js — used by each button to send parameter modification commands.

NavigatorManager.js — for potential navigation actions.

PumpBadge.js — existing component integrated inside header.

Mode Configuration
Each ModeStateButton is configured as follows:

Mode	Icon	Store Path	Param ID
Temperature	icon-thermo.png	runtime.modes.temperature.isActive	3
Humidity	icon-humidity.png	runtime.modes.humidity.isActive	7
Timer	icon-timer.png	runtime.modes.timer.isActive	10
Calendar	icon-calendar.png	runtime.modes.calendar.isActive	11
AUX	icon-aux.png	runtime.modes.aux.isActive	14
Wireless	icon-wireless.png	runtime.modes.wireless.isActive	23

Each button:

Subscribes to storePath for its active/inactive status.

Subscribes to config.params[paramId] for disable/enable state.

Uses commandManager.modifyParameter(paramId, newValue) on click if isEditable = true.

2️⃣ ModeStateButton Component
Purpose
The ModeStateButton represents a single operational mode button.
It visualizes and manages three distinct states — disabled, active, inactive — and handles user input when editable.

Props
Property	Type	Description
iconPath	String	Path to button icon (e.g. assets/icons/icon-timer.png).
storePath	String	Store path for the runtime active status (e.g. runtime.modes.timer.isActive).
paramId	Number	ID of the parameter controlling enable/disable.
callback	Function	Callback invoked when clicked (usually commandManager.modifyParameter).
isEditable	Boolean	Enables or disables click behavior.

Behavior Logic
Each button subscribes to two data sources:

storePath → determines if the mode is Active or Inactive.

config.params[paramId] → determines if the mode is Disabled (value 0) or Enabled (value 1).

Visual State	Conditions	CSS Class	Description
Disabled	config.params[paramId] == 0	.mode-item.disabled	Icon dimmed, diagonal slash overlay.
Enabled – Inactive	param == 1 && isActive == false	.mode-item.enabled-inactive	White background, blue outline.
Enabled – Active	param == 1 && isActive == true	.mode-item.enabled-active	Solid blue background, white icon.

Click Handling
If isEditable = false, the component ignores clicks but maintains normal visuals.

If isEditable = true, clicking toggles the parameter value by invoking the callback:

js
Copia codice
commandManager.modifyParameter(paramId, toggledValue);
The UI updates after receiving the store event confirming the new state.

Folder Structure
swift
Copia codice
webui/js/components/ModeStateButton/
 ├── ModeStateButton.js
 ├── ModeStateButton.func.js
Example HTML Snippet (as rendered)
html
Copia codice
<div class="mode-item enabled-active" data-mode="temperature">
  <button class="mode-btn" aria-label="Temperature">
    <img src="assets/icons/icon-thermo.png" alt="Temperature">
  </button>
</div>
3️⃣ PumpBadge Component
Purpose
The PumpBadge is a previously implemented component used to display the pump’s operational and connection state.
It subscribes to:

outputs.pumpState → operational status.

socket.state → connection status.

Visual States
State	Class	Color
on	.on	Green
off	.off	Neutral gray
low pressure	.warning	Yellow
blocked	.error	Red
testing	.testing	Blue

Behavior
Displays both an icon (optional) and a text label.

If no store data is available, shows a default label provided as prop.

The badge is static in layout but dynamic in content, reacting automatically to store updates.

🧩 HTML Structure (Final Layout)
The following HTML replaces the current placeholder code in the UI:

html
Copia codice
<!-- Mode Selector -->
<div class="mode-section">
  <div class="mode-header">
    <div class="mode-title-left">Mode Selector</div>
    <button class="pump-badge off" id="pumpStateBadge" type="button" aria-label="Pump state">
      <img src="assets/icons/icon-pump.png" alt="" class="pump-badge-icon" />
      <span class="pump-badge-text">Off</span>
    </button>
  </div>
  <div class="mode-grid">
    <!-- ModeStateButton components dynamically generated here -->
  </div>
</div>
🎨 CSS Styling
Use the same CSS rules already implemented in the placeholder.
Do not modify color values, paddings, or structure — they are already optimized for the application’s design system.

Place the CSS in:

bash
Copia codice
webui/css/components/ModeSelector.css
and import it via:

html
Copia codice
<link rel="stylesheet" href="./css/components/ModeSelector.css">
The CSS manages:

.mode-section, .mode-header, .mode-grid

.mode-item, .mode-btn

.enabled-active, .enabled-inactive, .disabled

Responsive wrapping (1×6 → 2×3 → 3×2 → stacked)

✅ Summary
The Mode Selector System provides a fully reactive and mobile-optimized interface for managing operational modes.

Key characteristics:

Observer-based reactivity for store updates.

i18n-based title updates.

Clean separation of logic (.func.js), behavior (.js), and presentation (.css).

Responsive design that adapts dynamically to all screen sizes.

Consistent color and style scheme aligned with the rest of the UI.

All assets and imports use relative paths.

Final files to include:

swift
Copia codice
webui/js/components/ModeSelector/ModeSelector.js
webui/js/components/ModeSelector/ModeSelector.func.js
webui/js/components/ModeStateButton/ModeStateButton.js
webui/js/components/ModeStateButton/ModeStateButton.func.js
webui/css/components/ModeSelector.css
Once implemented, this system will replace the existing static HTML while maintaining the exact structure, layout, and style, ensuring seamless integration with the rest of the application.