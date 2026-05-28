YOU ARE A CODING ASSISTANT.
Generate a **parametric and dynamic Gantt Chart component** using **HTML, CSS, and JavaScript**.
The chart represents weekly working time slots visually, divided into multiple time-range slides (morning / afternoon / evening).
The component must be modular, reusable, and updatable by calling a single update function with a structured list of time slots.

# GOAL
Create a responsive, minimal, and elegant Gantt Chart similar to the provided mockup (horizontal time axis, daily rows, bars representing working slots).
Each day (L, M, M, G, V, S, D) has its own row.
The component must visually switch between **3 slides**:
- Slide 1 → 00:00–07:59 (morning)
- Slide 2 → 08:00–15:59 (afternoon)
- Slide 3 → 16:00–23:59 (evening)

The carousel supports both:
- dot navigation (click on dots)
- touch/swipe navigation on mobile

---

## 🔧 COMPONENT STRUCTURE

### 1️⃣ HTML TEMPLATE
Use the following basic structure (can be generated dynamically):
```html
<div class="gantt-section">
  <div class="gantt-carousel">
    <div class="gantt-carousel-inner" id="ganttCarousel">
      <!-- 3 slides -->
      <div class="gantt-slide" data-range="00-07"></div>
      <div class="gantt-slide" data-range="08-15"></div>
      <div class="gantt-slide" data-range="16-23"></div>
    </div>
  </div>

  <div class="carousel-dots gantt-dots">
    <div class="carousel-dot gantt-dot active" data-slide="0"></div>
    <div class="carousel-dot gantt-dot" data-slide="1"></div>
    <div class="carousel-dot gantt-dot" data-slide="2"></div>
  </div>
</div>
Each .gantt-slide contains a .gantt-container with:

.gantt-header → time axis (00–07, 08–15, 16–23)

.gantt-body → 7 .gantt-row (L–D), each containing:

.gantt-day-label

.gantt-timeline → container for .gantt-bar elements

Each .gantt-bar is absolutely positioned inside .gantt-timeline with:
<div class="gantt-bar" style="left: {percent_start}%; width: {percent_width}%;">
  <span class="bar-time">text label</span>
</div>
The position and width are computed based on time intervals relative to the current slide (each slide covers 8 hours = 480 minutes).
DATA STRUCTURE

The chart receives a list of time slots:

[
  {
    id: 1,
    start: "17:30",
    stop: "20:45",
    days: { mon:true, tue:false, wed:false, thu:true, fri:false, sat:false, sun:false }
  },
  ...
]

Step 1 – Merge overlapping slots

Before rendering, merge time intervals for each day. The resulting structure is:

{
  mon: [{minStart:180, minStop:270}, {minStart:630,minStop:750}],
  tue: [],
  wed: [{minStart:630,minStop:750}],
  thu: [{minStart:180, minStop:270}],
  fri: [{minStart:180,minStop:750}],
  sat: [],
  sun: [{minStart:900, minStop:1020}]
}

Step 2 – Split into slides

For each interval, determine which slide it belongs to:

Slide 1 → minutes [0–479]

Slide 2 → minutes [480–959]

Slide 3 → minutes [960–1439]

Step 3 – Determine label text

Follow these exact rules from gantt_chart.md:

If duration < 90 min → display total duration in minutes (e.g., "15m" or "80m").

If duration ≥ 90 min → display "HH:MM - HH:MM".

If the slot crosses two slides:

If portion within a slide < 45 min → show total duration (e.g. "30m").

If 45 ≤ portion < 90 → show only the start or end hour depending on the side.

If ≥ 90 → show full "start - stop".

This ensures consistent formatting for split bars like "07:45 - 08:15" → each slide shows "30m".

📐 POSITIONING LOGIC

For each .gantt-bar:

left% = ((minStart - slideStart) / 480) × 100

width% = ((minStop - minStart) / 480) × 100
Example: 01:30–03:45 in slide 00–07
→ (90–225)/480 = left: 18.75%, width: 28.12%.

🪄 JS INTERACTION
Carousel navigation:

Clicking .gantt-dot updates state.ganttSlide and shifts .gantt-carousel-inner via:

const offset = -state.ganttSlide * 100;
elements.ganttCarousel.style.transform = `translateX(${offset}%)`;


Swipe gesture (mobile): detect horizontal swipe (≥50px) to change slide.

Update function:

Implement updateGanttChart(timeSlots) that:

Parses and merges slots.

Builds mergedDayMap structure.

Regenerates inner HTML for all .gantt-slide elements.

Computes left, width, and label based on above logic.

Updates carousel position and dots.

🎨 CSS REQUIREMENTS
Base Layout

.gantt-section: white rounded container with subtle shadow and inner padding.

.gantt-carousel: overflow hidden, width 100%.

.gantt-carousel-inner: display flex, transition transform .4s ease, width = 300% (3 slides).

Gantt Container

.gantt-container: flex column.

.gantt-header: horizontal grid showing time markers (00–07 / 08–15 / 16–23).

.gantt-day-label: fixed-width left column (L–D), bold text.

.gantt-body: column with 7 .gantt-row.

Rows

.gantt-row: display flex; align-items center; margin-bottom: .5rem; background #f9fbfd; border-radius: 8px.

.gantt-timeline: flex-grow: 1; position relative; height: 36px; border-radius: 8px; background: rgba(0,0,0,0.02).

Bars

.gantt-bar: position absolute; height: 70%; top: 15%; background: #0b3d63; border-radius: 20px; display:flex; justify-content:center; align-items:center; color:#fff; font-weight:500; font-size:12px; transition:all .2s ease.

.gantt-bar:hover: transform:scale(1.05); box-shadow:0 2px 8px rgba(0,0,0,0.15).

Carousel Dots

.gantt-dots: display flex; justify-content:center; gap:10px; margin-top:10px.

.gantt-dot: width:10px; height:10px; border-radius:50%; background:#cfd8e3; cursor:pointer; transition:.3s;

.gantt-dot.active: background:#0b3d63; width:24px; border-radius:8px;

Responsive

At ≤600px:

Reduce font size and row height.

Allow horizontal scroll for wide time labels.

Increase bar label font size slightly for readability.

✅ ACCEPTANCE CRITERIA

Single function updateGanttChart(slots) rebuilds the component dynamically.

The chart accurately applies the time-label logic (<45m, <90m, ≥90m) for both normal and cross-slide slots.

Each day row correctly renders all bars with proper left and width percentages.

The 3-slide carousel navigation (dots + swipe) works seamlessly.

Layout matches the reference image: clean, rounded, minimal, with blue accent color.

No external libraries or frameworks. Pure HTML/CSS/JS only.

Code must be readable, modular, and commented for maintainability.

Generate now:

gantt.html — static base markup.

gantt.css — full responsive styling.

gantt.js — logic for slot parsing, label formatting, merging, rendering, and carousel behavior.
All must integrate into a single component that updates dynamically via updateGanttChart(slots).
