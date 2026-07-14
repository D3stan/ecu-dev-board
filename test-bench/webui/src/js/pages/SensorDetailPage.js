import { Page } from "../core/Page.js";
import { Store } from "../core/store.js";
import { PageTopBar } from "../components/PageTopBar/PageTopBar.js";
import { TelemetryHistoryManager } from "../managers/TelemetryHistoryManager.js";
import { Paths } from "../utils/paths.js";
import {
  formatFaultBits,
  formatMetaAge,
  formatMicroseconds,
  formatNumber,
  formatPercent,
  formatRpm,
  formatSigned,
  formatTemp,
  healthState
} from "../utils/telemetryFormat.js";

const RANGES = {
  "15s": 15,
  "30s": 30,
  "1m": 60
};

const SIGNALS = {
  rpm: {
    title: "RPM - Engine Speed",
    history: "rpm",
    unit: "RPM",
    read: () => Store.get(Paths.TELEMETRY.RPM),
    meta: () => Store.get(Paths.TELEMETRY.RPM_META),
    format: formatRpm,
    yMin: 0,
    yMax: 18000
  },
  tps: {
    title: "TPS - Throttle",
    history: "tps",
    unit: "%",
    read: () => Store.get(Paths.TELEMETRY.TPS),
    meta: () => Store.get(Paths.TELEMETRY.TPS_META),
    format: formatPercent,
    yMin: 0,
    yMax: 100
  },
  egt: {
    title: "EGT",
    history: "egt",
    unit: "C",
    read: () => Store.get(Paths.TELEMETRY.EGT),
    meta: () => Store.get(Paths.TELEMETRY.EGT_META),
    format: formatTemp
  },
  water: {
    title: "Water Temperature",
    history: "water",
    unit: "C",
    read: () => Store.get(Paths.TELEMETRY.WATER_TEMP),
    meta: () => Store.get(Paths.TELEMETRY.WATER_META),
    format: formatTemp
  },
  rpmAccel: {
    title: "RPM Acceleration",
    history: "rpmAccel",
    unit: "rpm/s",
    read: () => Store.get(Paths.TELEMETRY.RPM_ACCEL),
    meta: () => Store.get(Paths.TELEMETRY.RPM_META),
    format: (value) => formatSigned(value, 0)
  },
  qsActive: {
    title: "Quick Shifter",
    history: "qsActive",
    unit: "",
    read: () => Store.get(Paths.TELEMETRY.QS_ACTIVE),
    meta: () => Store.get(Paths.TELEMETRY.QS_META),
    format: (value) => (value ? "ACTIVE" : "IDLE"),
    yMin: 0,
    yMax: 1
  },
  mapRequest: {
    title: "Physical Map Request",
    history: "mapRequest",
    unit: "",
    read: () => Store.get(Paths.TELEMETRY.MAP_REQUEST),
    meta: () => Store.get(Paths.TELEMETRY.MAP_META),
    format: (value) => value || "--",
    yMin: 0,
    yMax: 1
  },
  knock: {
    title: "Knock Index",
    history: "knock",
    unit: "",
    read: () => Store.get(Paths.TELEMETRY.KNOCK)?.normalized_index ?? null,
    meta: () => {
      const knock = Store.get(Paths.TELEMETRY.KNOCK);
      return knock
        ? { valid: knock.valid, health: knock.health, quality: knock.quality, faultBits: knock.fault_bits }
        : null;
    },
    format: (value) => (value == null ? "none" : formatNumber(value, 2)),
    yMin: 0
  }
};

export class SensorDetailPage extends Page {
  constructor(options = {}) {
    super({
      id: "sensorDetailPage",
      title: "Signal Detail",
      showBackButton: true,
      bindings: {
        gen: Paths.TELEMETRY.GEN,
        frameTUs: Paths.TELEMETRY.TIMESTAMP
      },
      ...options
    });

    this.signal = "rpm";
    this.rangeKey = "30s";
    this.showEventMarkers = true;
    this.showYAxisLabels = true;
    this.paused = false;
    this.pageTopBar = null;
  }

  createSkeleton() {
    const skeleton = super.createSkeleton();
    const host = this.$("#page-top-bar-container");
    if (host) {
      this.pageTopBar = new PageTopBar({ title: SIGNALS[this.signal].title });
      this.pageTopBar.mount(host);
    }
    return skeleton;
  }

  onBindEvents() {
    this.$$("[data-range]").forEach((button) => {
      this.addEventListener(button, "click", () => {
        this.rangeKey = button.getAttribute("data-range") || "30s";
        this.paused = false;
        this._refresh();
      });
    });

    const markerToggle = this.$("#event-markers-toggle");
    if (markerToggle) {
      this.addEventListener(markerToggle, "change", () => {
        this.showEventMarkers = markerToggle.checked;
        this._drawChart();
      });
    }

    const yAxisToggle = this.$("#y-axis-toggle");
    if (yAxisToggle) {
      this.addEventListener(yAxisToggle, "change", () => {
        this.showYAxisLabels = yAxisToggle.checked;
        this._drawChart();
      });
    }

    const pauseButton = this.$("#history-pause-btn");
    if (pauseButton) {
      this.addEventListener(pauseButton, "click", () => {
        this.paused = !this.paused;
        pauseButton.textContent = this.paused ? "Resume" : "Pause";
        this._refresh();
      });
    }
  }

  onActivate(data = {}) {
    if (data.signal && SIGNALS[data.signal]) {
      this.signal = data.signal;
    }

    this.title = SIGNALS[this.signal].title;
    super.onActivate(data);
    this.pageTopBar?.setTitle(this.title);
    this._refresh();
  }

  onDataChange() {
    if (!this.paused) this._refresh();
  }

  update() {
    if (!this.paused) this._refresh();
  }

  renderContent() {
    return `
      <div class="telemetry-page sensor-detail-page">
        <div id="page-top-bar-container"></div>

        <section class="detail-live-panel">
          <div>
            <div class="detail-label">Live Value</div>
            <div class="detail-value">
              <span id="detail-value">--</span>
              <span id="detail-unit"></span>
            </div>
          </div>
          <span class="telemetry-badge unknown" id="detail-health">NO META</span>
        </section>

        <section class="history-chart-card">
          <div class="chart-toolbar">
            <div class="range-tabs">
              <button type="button" data-range="15s">15s</button>
              <button type="button" data-range="30s" class="active">30s</button>
              <button type="button" data-range="1m">1m</button>
            </div>
            <button type="button" class="chart-pause-btn" id="history-pause-btn">Pause</button>
          </div>

          <canvas class="history-chart" id="history-chart"></canvas>

          <div class="chart-toggles">
            <label class="chart-toggle">
              <input type="checkbox" id="event-markers-toggle" checked>
              <span>Event markers</span>
            </label>
            <label class="chart-toggle">
              <input type="checkbox" id="y-axis-toggle" checked>
              <span>Y-axis labels</span>
            </label>
          </div>
        </section>

        <section class="telemetry-panel">
          <h3>Metadata</h3>
          <div class="metadata-grid" id="metadata-grid"></div>
        </section>
      </div>
    `;
  }

  _refresh() {
    if (!this.el) return;

    const config = SIGNALS[this.signal];
    this.$$("[data-range]").forEach((button) => {
      button.classList.toggle("active", button.getAttribute("data-range") === this.rangeKey);
    });

    const value = config.read();
    const meta = config.meta();
    const state = healthState(meta);

    setText(this.$("#detail-value"), config.format(value));
    setText(this.$("#detail-unit"), config.unit);
    const badge = this.$("#detail-health");
    if (badge) {
      badge.textContent = state.label;
      badge.className = `telemetry-badge ${state.className}`;
    }

    this._renderMetadata(meta);
    this._drawChart();
  }

  _renderMetadata(meta) {
    const grid = this.$("#metadata-grid");
    if (!grid) return;

    const frameTUs = Store.get(Paths.TELEMETRY.TIMESTAMP);
    const rows = [
      ["valid", meta ? String(Boolean(meta.valid)) : "--"],
      ["health", meta?.health || "--"],
      ["quality", meta?.quality || "--"],
      ["seq", meta?.seq ?? "--"],
      ["acquired_at_us", meta?.acquiredAtUs != null ? formatMicroseconds(meta.acquiredAtUs) : "--"],
      ["age", formatMetaAge(frameTUs, meta)],
      ["fault_bits", meta ? formatFaultBits(meta.faultBits) : "--"],
      ["frame_t_us", frameTUs != null ? formatMicroseconds(frameTUs) : "--"]
    ];

    grid.innerHTML = rows.map(([label, value]) => `
      <div class="metadata-row">
        <span>${label}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `).join("");
  }

  _drawChart() {
    const canvas = this.$("#history-chart");
    if (!canvas) return;

    const config = SIGNALS[this.signal];
    const rangeSeconds = RANGES[this.rangeKey] || RANGES["30s"];
    const samples = TelemetryHistoryManager.getSeries(config.history, rangeSeconds);
    const context = prepareCanvas(canvas);

    drawChartFrame(context, canvas);

    if (samples.length < 2) {
      drawEmptyChart(context, canvas, "Waiting for samples");
      return;
    }

    const points = samples
      .map((sample) => ({ ...sample, plotValue: toPlotValue(sample.value, this.signal) }))
      .filter((sample) => Number.isFinite(sample.plotValue));

    if (points.length < 2) {
      drawEmptyChart(context, canvas, "No numeric trace");
      return;
    }

    const minTime = points[0].tUs;
    const maxTime = points[points.length - 1].tUs;
    const values = points.map((sample) => sample.plotValue);
    const yMin = Number.isFinite(config.yMin) ? config.yMin : Math.min(...values);
    const yMaxRaw = Number.isFinite(config.yMax) ? config.yMax : Math.max(...values);
    const yMax = yMaxRaw === yMin ? yMin + 1 : yMaxRaw;

    drawSeries(context, canvas, points, minTime, maxTime, yMin, yMax);

    if (this.showEventMarkers) {
      drawEventMarkers(context, canvas, TelemetryHistoryManager.getEvents(rangeSeconds), minTime, maxTime);
    }

    if (this.showYAxisLabels) {
      drawYAxisLabels(context, canvas, yMin, yMax, config.unit);
    }
  }
}

function prepareCanvas(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return context;
}

function drawChartFrame(context, canvas) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  context.clearRect(0, 0, width, height);
  context.fillStyle = getCss("--bg", "#0d1117");
  context.fillRect(0, 0, width, height);
  context.strokeStyle = getCss("--border", "#30363d");
  context.lineWidth = 1;

  for (let i = 1; i < 4; i += 1) {
    const y = (height / 4) * i;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
}

function drawEmptyChart(context, canvas, label) {
  context.fillStyle = getCss("--text-muted", "#8b949e");
  context.font = "700 13px sans-serif";
  context.textAlign = "center";
  context.fillText(label, canvas.clientWidth / 2, canvas.clientHeight / 2);
}

function drawSeries(context, canvas, points, minTime, maxTime, yMin, yMax) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const timeSpan = Math.max(1, maxTime - minTime);

  context.strokeStyle = getCss("--accent", "#00c9a7");
  context.lineWidth = 2;
  context.beginPath();

  points.forEach((point, index) => {
    const x = ((point.tUs - minTime) / timeSpan) * width;
    const y = height - ((point.plotValue - yMin) / (yMax - yMin)) * height;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });

  context.stroke();
}

function drawEventMarkers(context, canvas, events, minTime, maxTime) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const timeSpan = Math.max(1, maxTime - minTime);

  context.strokeStyle = getCss("--accent-warning", "#ff6b35");
  context.lineWidth = 1;

  events.forEach((event) => {
    if (!Number.isFinite(event.tUs) || event.tUs < minTime || event.tUs > maxTime) return;
    const x = ((event.tUs - minTime) / timeSpan) * width;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  });
}

// Minimal Y-axis labels overlaid at the inner gridlines (25/50/75% of the range).
// The 0% / 100% bounds are implied by the chart edges. Unit is shown on the top label only.
function drawYAxisLabels(context, canvas, yMin, yMax, unit) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const span = yMax - yMin;
  if (!Number.isFinite(span) || span <= 0) return;

  context.fillStyle = getCss("--text-muted", "#8b949e");
  context.font = `600 10px ${getCss("--font-sans", "sans-serif")}`;
  context.textAlign = "left";
  context.textBaseline = "alphabetic";

  for (let i = 1; i < 4; i += 1) {
    const y = (height / 4) * i;
    const value = yMax - span * (i / 4);
    const suffix = i === 1 && unit ? (unit === "%" ? unit : ` ${unit}`) : "";
    context.fillText(`${formatNumber(value, 0)}${suffix}`, 4, y - 3);
  }
}

function toPlotValue(value, signal) {
  if (signal === "qsActive") return value ? 1 : 0;
  if (signal === "mapRequest") return value === "Secondary" ? 1 : 0;
  return Number(value);
}

function setText(element, value) {
  if (element) element.textContent = String(value ?? "--");
}

function getCss(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
