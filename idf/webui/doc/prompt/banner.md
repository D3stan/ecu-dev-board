Prompt – Refactor and Extend Banner Component
## COMPONENT: Banner (Refactor and Enhancement)

**Goal:**  
Refactor the existing `Banner` component to make it a fully reactive, store-driven alert banner that displays status messages such as *maintenance reminders, low pressure warnings,* and *pump blocked errors*.  
The banner must subscribe to specific paths in the `Store` and update its content, style, and visibility dynamically. It must always render **inside the current page’s `.content-area` container**, directly beneath the `TopBarPage` element if present.

---

### 🔹 Folder Structure

The existing files should be updated, not replaced:



webui/js/components/Banner/
├── Banner.js // main component logic (extends Component)
├── func.js // helper functions for color, validation, mapping
webui/css/components/Banner.css


The stylesheet must be imported in `index.html`:
```html
<link rel="stylesheet" href="./css/components/Banner.css">

🔹 Design and Behavior Overview

The Banner is a reusable observer-based UI component that:

Reacts to changes in the Store (Observer pattern)

Can subscribe to multiple store paths at once

Supports different types: "info", "warning", "error", "success"

Supports title, text label, and optional icon

Supports both closable and non-closable variants

Updates text automatically when language changes through i18n

🔹 Technical Requirements
1. Class Structure

The Banner must extend Component.js.

It uses the Observer pattern for automatic UI updates.

It defines the standard lifecycle methods:

onCreate() → create and initialize DOM structure

onMount() → attach subscriptions to store and i18n

onDestroy() → remove listeners and cleanup

2. Rendering

The banner is always appended inside the page’s .content-area container, right below .top-bar-page if it exists.

If .top-bar-page is not found, append it directly to the top of .content-area.

Example insertion logic:

const contentArea = document.querySelector('.content-area');
const topBar = contentArea?.querySelector('.top-bar-page');
if (contentArea) {
  contentArea.insertBefore(this.el, topBar?.nextSibling || contentArea.firstChild);
}

3. Configuration Parameters

The Banner constructor accepts a configuration object:

Option	Type	Description
title	string	Title text displayed above the label
label	string	Main text of the banner
icon	string	Optional icon path (e.g., "assets/icons/icon-wrench.png")
type	string	One of "info", "warning", "error", "success"
isClosable	boolean	Whether the banner can be closed manually
subscriptions	array	List of { path, cb } objects used for store subscriptions
🔹 4. Store Subscription Logic (Observer Pattern)

Each subscription links a Store path to a callback function that updates the banner dynamically.
This pattern ensures the banner reacts immediately to changes.

_setupSubscriptions() {
  this._unsubList = [];

  for (const { path, cb } of this._subscriptions) {
    if (!path || typeof cb !== "function") {
      console.warn(`[Banner] Invalid subscription`, path);
      continue;
    }

    const unsubscribe = Store.subscribe(path, val => 
      Promise.resolve(cb(val, this)).catch(console.error)
    );

    this._unsubList.push(unsubscribe);

    const initial = Store.get(path);
    if (initial !== undefined) cb(initial, this);
  }
}


This method must be called automatically in onMount() and unsubscribed in onDestroy().

🔹 5. Public Methods
Method	Description
open()	Shows the banner (adds visible class)
close()	Hides the banner (removes visible class)
updateLabel(newText)	Updates the main text dynamically
updateTitle(newTitle)	Updates the title text
updateType(newType)	Changes color and styling dynamically
updateIcon(newPath)	Changes the banner icon
setClosable(isClosable)	Toggles the close button
🔹 6. HTML Layout

Keep the existing placeholder structure as the base template:

<div class="banner banner-info">
  <div class="banner-left">
    <img class="banner-icon" src="assets/icons/icon-wrench.png" alt="Banner Icon">
  </div>
  <div class="banner-body">
    <div class="banner-title">Maintenance</div>
    <div class="banner-label">Next maintenance in 340h</div>
  </div>
  <button class="banner-close" aria-label="Close banner">×</button>
</div>

🔹 7. CSS Styling (already implemented)

Do not replace the existing design — reuse the current style system from the placeholder Banner.css.
The visual variations (info, warning, error, success) must be handled by adding and removing modifier classes:

.banner-info

.banner-warning

.banner-error

.banner-success

🔹 8. Integration with i18n

The banner must subscribe to the i18n language change listener so that the title and label are updated dynamically when the language changes.

Example:

i18n.subscribe(() => {
  this.updateTitle(i18n.t(this._titleKey));
  this.updateLabel(i18n.t(this._labelKey));
});

🔹 9. Specific Banners to Implement
(1) Maintenance Banner

Paths:

runtime.timers.maintenance.timeLeft

runtime.timers.maintenance.isMaintenance

Logic:

if (val <= 0 || !isMaintenance) {
  self.updateType("error");
  self.updateLabel("Maintenance required");
  self.setClosable(false);
  self.open();
} else if (val <= 500) {
  self.updateType("warning");
  self.updateLabel(`Maintenance due in ${val} hours`);
  self.setClosable(true);
  self.open();
} else {
  self.updateType("info");
  self.updateLabel(`Next maintenance in ${val} hours`);
  self.setClosable(true);
  self.open();
}

(2) Pressure and Pump Banners

Paths:

outputs.lowPressure

outputs.pumpBlocked

Logic:

if (pumpBlocked) {
  self.updateType("error");
  self.updateLabel("Pump blocked after 5 attempts");
  self.setClosable(false);
  self.open();
} else if (lowPressure) {
  self.updateType("warning");
  self.updateLabel("Low pressure detected");
  self.setClosable(true);
  self.open();
} else {
  self.close();
}


Priority rule:
pumpBlocked overrides lowPressure.

🔹 10. Helper Functions (func.js)

Extend func.js with helpers like:

export function mapTypeToClass(type) {
  const types = {
    info: 'banner-info',
    warning: 'banner-warning',
    error: 'banner-error',
    success: 'banner-success'
  };
  return types[type] || '';
}

🔹 11. Lifecycle Management

On component creation → DOM built and inserted under .content-area.

On mount → all subscriptions to store and i18n set up.

On destroy → all listeners removed.

The close() method removes the banner but does not destroy it, allowing reopening via open().

✅ Implementation Guidelines

Do not change CSS or HTML placeholder structure.
Reuse existing markup from the current Banner implementation.

Refactor existing Banner.js and func.js instead of replacing them.

All imports must be relative paths.

Use the existing Component class and the store’s Observer pattern.

Render only inside the page’s .content-area.

Ensure banner text updates dynamically with i18n.

Add smooth fade-in/out transitions for open/close.

Closable banners must remove themselves visually, not destroy the instance.

🎯 Expected Result

After this refactor, Banner becomes a fully reactive UI component that:

Automatically shows and updates maintenance and pressure alerts in real time,

Integrates seamlessly with the store and i18n,

Maintains the existing style and placement,

Supports multiple simultaneous banner types with minimal configuration.