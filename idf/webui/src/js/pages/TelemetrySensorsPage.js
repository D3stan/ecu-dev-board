import { Page } from "../core/Page.js";
import { Store } from "../core/store.js";
import { PageTopBar } from "../components/PageTopBar/PageTopBar.js";
import { Paths } from "../utils/paths.js";
import {
  formatFaultBits,
  formatMetaAge,
  formatNumber,
  formatPercent,
  formatRpm,
  formatTemp,
  healthState
} from "../utils/telemetryFormat.js";

const SENSOR_ROWS = [
  {
    id: "rpm",
    label: "RPM",
    value: () => `${formatRpm(Store.get(Paths.TELEMETRY.RPM))} RPM`,
    meta: () => Store.get(Paths.TELEMETRY.RPM_META)
  },
  {
    id: "tps",
    label: "TPS",
    value: () => `${formatPercent(Store.get(Paths.TELEMETRY.TPS))} %`,
    meta: () => Store.get(Paths.TELEMETRY.TPS_META)
  },
  {
    id: "egt",
    label: "EGT",
    value: () => `${formatTemp(Store.get(Paths.TELEMETRY.EGT))} C`,
    meta: () => Store.get(Paths.TELEMETRY.EGT_META)
  },
  {
    id: "water",
    label: "Water Temp",
    value: () => `${formatTemp(Store.get(Paths.TELEMETRY.WATER_TEMP))} C`,
    meta: () => Store.get(Paths.TELEMETRY.WATER_META)
  },
  {
    id: "qs",
    label: "Quick Shifter",
    value: () => `${Store.get(Paths.TELEMETRY.QS_ACTIVE) ? "active" : "idle"} / ${Store.get(Paths.TELEMETRY.QS_ARMED) ? "armed" : "not armed"}`,
    meta: () => Store.get(Paths.TELEMETRY.QS_META)
  },
  {
    id: "map",
    label: "Map Request",
    value: () => `${Store.get(Paths.TELEMETRY.MAP_REQUEST)} request`,
    meta: () => Store.get(Paths.TELEMETRY.MAP_META)
  },
  {
    id: "knock",
    label: "Knock",
    value: () => {
      const knock = Store.get(Paths.TELEMETRY.KNOCK);
      return knock ? `${formatNumber(knock.normalized_index, 2)} / ${knock.candidate_knock ? "candidate" : "quiet"}` : "none";
    },
    meta: () => {
      const knock = Store.get(Paths.TELEMETRY.KNOCK);
      return knock
        ? { valid: knock.valid, health: knock.health, quality: knock.quality, faultBits: knock.fault_bits, seq: knock.config_generation, acquiredAtUs: knock.read_at_us }
        : null;
    }
  }
];

export class TelemetrySensorsPage extends Page {
  constructor(options = {}) {
    super({
      id: "telemetrySensorsPage",
      title: "Sensor Telemetry",
      showBackButton: true,
      bindings: {
        gen: Paths.TELEMETRY.GEN,
        frameTUs: Paths.TELEMETRY.TIMESTAMP
      },
      ...options
    });

    this.pageTopBar = null;
  }

  createSkeleton() {
    const skeleton = super.createSkeleton();
    const host = this.$("#page-top-bar-container");
    if (host) {
      this.pageTopBar = new PageTopBar({ title: "Sensor Telemetry" });
      this.pageTopBar.mount(host);
    }
    return skeleton;
  }

  renderContent() {
    return `
      <div class="telemetry-page telemetry-sensors-page">
        <div id="page-top-bar-container"></div>
        <section class="frame-info-strip">
          <span>t_us <strong id="sensor-frame-time">--</strong></span>
          <span>gen <strong id="sensor-frame-gen">--</strong></span>
        </section>
        <section class="sensor-table-list" id="sensor-table-list"></section>
      </div>
    `;
  }

  update() {
    if (!this.el) return;

    setText(this.$("#sensor-frame-time"), this.data.frameTUs || "--");
    setText(this.$("#sensor-frame-gen"), this.data.gen || "--");

    const host = this.$("#sensor-table-list");
    if (!host) return;

    host.innerHTML = SENSOR_ROWS.map((row) => this._renderSensorRow(row)).join("");
  }

  _renderSensorRow(row) {
    const meta = row.meta();
    const state = healthState(meta);
    const faultClass = meta?.faultBits ? "fault-active" : "";

    return `
      <article class="sensor-table-card ${faultClass}">
        <div class="sensor-table-header">
          <h3>${escapeHtml(row.label)}</h3>
          <strong>${escapeHtml(row.value())}</strong>
        </div>
        <div class="sensor-table-meta">
          ${metadataItem("status", state.label)}
          ${metadataItem("valid", meta ? String(Boolean(meta.valid)) : "--")}
          ${metadataItem("health", meta?.health || "--")}
          ${metadataItem("quality", meta?.quality || "--")}
          ${metadataItem("seq", meta?.seq ?? "--")}
          ${metadataItem("age", formatMetaAge(this.data.frameTUs, meta))}
          ${metadataItem("fault_bits", meta ? formatFaultBits(meta.faultBits) : "--")}
        </div>
      </article>
    `;
  }
}

function metadataItem(label, value) {
  return `
    <div>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function setText(element, value) {
  if (element) element.textContent = String(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

