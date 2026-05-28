YOU ARE A CODING ASSISTANT.

Generate a full implementation of a **parametric, reactive GanttChart component** for the ESP32-S3 web UI.
The component must integrate into an existing app framework that already has:
- `runtime.scheduler`: an array of time-slot objects
- `runtime.rtc.time` and `runtime.rtc.day`: current time and day
- `localization.lang`: current UI language, handled via `i18n`
- A reactive `Store` system that supports `.subscribe(path, callback)` for runtime updates

# GOAL
Render a weekly Gantt chart showing all time slots grouped by day of the week (L, M, M, G, V, S, D),
distributed across **three slides (morning, afternoon, evening)**.
The chart must visually update whenever the scheduler, current time, or UI language changes.

---

## 🧩 DATA SOURCE

`runtime.scheduler` is an array like:
```js
[
  {
    id: 1,
    start: "17:30",
    stop: "20:45",
    days: { mon:true, tue:false, wed:false, thu:true, fri:false, sat:false, sun:false }
  },
  ...
]
Time strings are in "HH:MM" 24h format.

Each slot may overlap with another on the same day (e.g., 08:00–12:00 and 10:00–19:00).
→ The chart must merge overlapping intervals visually (but must NOT modify runtime.scheduler).

⚙️ BEHAVIOR REQUIREMENTS
🧠 Reactive updates
The component must:

Subscribe to changes in:

runtime.scheduler

runtime.rtc.time

runtime.rtc.day

localization.lang

Re-render itself whenever any of them change.

🗓️ Weekly layout
7 rows → one per weekday.

The day labels (L, M, M, G, V, S, D) must be read dynamically from i18n, using the current language.

Highlight the current day (from runtime.rtc.day) by:

increasing scale (CSS transform: scale(1.5))

changing text color to a bright cyan accent.

🕓 Time slots
Each slide covers an 8-hour range:

00–07

08–15

16–23

Bars are positioned as percentages:

left = ((startMin - slideStartMin) / 480) * 100

width = ((stopMin - startMin) / 480) * 100

Use the previously defined formatting logic:

duration < 45min → show "30m"

45–90min → show "07:45" (or "08:15" if in end zone)

≥90min → show "07:45 - 09:15"

If a slot crosses two slides, split it visually into two partial bars per slide.

🔵 Active slot highlight
Determine “active” slot based on current time and day:

js
Copia codice
if (currentDay === slotDay && currentMinutes >= startMin && currentMinutes < stopMin)
Only that active slot should change color (use .active CSS class).

🖱️ Navigation (slides)
Implement 3 slides horizontally inside a .gantt-carousel.

Support touch drag/swipe navigation (already provided code may be integrated).

Each slide transition updates state.ganttSlide and moves .gantt-carousel-inner via CSS transform.

Include dots (.gantt-dot) below for manual navigation.

🧱 COMPONENT STRUCTURE
HTML (rendered via template literal in JS)
html
Copia codice
<div class="gantt-section">
  <div class="gantt-carousel">
    <div class="gantt-carousel-inner" id="ganttCarousel">
      <!-- slide 00–07 -->
      <div class="gantt-slide" data-range="00-07"> ... </div>
      <!-- slide 08–15 -->
      <div class="gantt-slide" data-range="08-15"> ... </div>
      <!-- slide 16–23 -->
      <div class="gantt-slide" data-range="16-23"> ... </div>
    </div>
  </div>
  <div class="carousel-dots gantt-dots">
    <div class="gantt-dot" data-slide="0"></div>
    <div class="gantt-dot" data-slide="1"></div>
    <div class="gantt-dot" data-slide="2"></div>
  </div>
</div>
Each .gantt-slide contains a .gantt-container with:

.gantt-header → time axis markers (00,01,02,03,...)

.gantt-body → 7 .gantt-row (days)

.gantt-day-label

.gantt-timeline (bars container)

.gantt-bar elements

JS Structure
Provide:

js
Copia codice
class GanttChart {
  constructor() { ... }         // setup, subscriptions
  mergeOverlaps(slots) { ... }  // merge intervals visually only
  buildSlides() { ... }         // compute DOM per time window
  render() { ... }              // output HTML template
  updateActive() { ... }        // update day/slot highlighting
  destroy() { ... }             // unsubscribe from Store
}
Use Store.subscribe(Paths.RUNTIME.SCHEDULER, this.render.bind(this)),
Store.subscribe(Paths.RUNTIME.RTC.TIME, this.updateActive.bind(this)),
Store.subscribe(Paths.RUNTIME.RTC.DAY, this.render.bind(this)),
Store.subscribe(Paths.LOCALIZATION.CURRENT_LANG, this.render.bind(this)).

🎨 CSS (GanttChart.css)
Clean, modern design; soft light background.

.gantt-day-label column fixed width (bold text).

.gantt-bar: rounded dark blue background (#0b3d63), white text.

.gantt-bar.active: brighter cyan (#2ecfff) background.

.gantt-dot.active: width: 24px; border-radius: 8px; background: #0b3d63.

.current-day: transform: scale(1.5); color: #2ecfff.

.gantt-timeline: background: rgba(0,0,0,0.03); height: 36px; border-radius: 8px; position: relative.

.gantt-carousel-inner: display: flex; transition: transform .4s ease.

Include responsive behavior (<600px): smaller fonts, narrower bars.

🚀 OUTPUT FILES
Generate:

gantt.js – full class implementation with observer subscriptions, slot merging, rendering, and slide logic.

gantt.css – complete styling including active states, current-day highlight, and responsive rules.

⚖️ ACCEPTANCE CRITERIA
Fully reactive to runtime updates (scheduler, time, day, language).

Merges overlapping intervals per day visually only.

Highlights only the active slot and current day.

Preserves runtime data integrity (no writeback to scheduler).

Swipe/drag and dot navigation work fluidly.

Clean visual output identical to provided screenshots.

Generate the code now, with sections:

cpp
Copia codice
/* start gantt.js */
/* end gantt.js */
/* start gantt.css */
/* end gantt.css */
and include inline comments explaining reactive logic and CSS class meanings.

yaml
Copia codice
