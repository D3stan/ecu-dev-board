import { Page } from "../core/Page.js";
import { PageTopBar } from "../components/PageTopBar/PageTopBar.js";
import { Paths } from "../utils/paths.js";
import { formatDurationMs, summarizeEvent } from "../utils/telemetryFormat.js";
import { Store } from "../core/store.js";
import { Socket } from "../core/socket.js";
import { ENABLED, startRun, stopRun } from "../digitalTwin/DigitalTwinClient.js";

export class TelemetryDiagnosticsPage extends Page {
  constructor(options = {}) {
    super({
      id: "telemetryDiagnosticsPage",
      title: "Diagnostics",
      showBackButton: true,
      bindings: {
        socketStatus: Paths.SOCKET.STATE,
        schemaVersion: Paths.CONNECTION.SCHEMA_VERSION,
        stateHz: Paths.CONNECTION.STATE_HZ,
        eventsPerBatch: Paths.CONNECTION.EVENTS_PER_BATCH,
        frameTUs: Paths.TELEMETRY.TIMESTAMP,
        gen: Paths.TELEMETRY.GEN,
        overflow: Paths.TELEMETRY.OVERFLOW,
        transport: Paths.TELEMETRY.TRANSPORT,
        events: Paths.TELEMETRY.EVENTS,
        dtStatus:       Paths.DIGITAL_TWIN.STATUS,
        dtRunId:        Paths.DIGITAL_TWIN.RUN_ID,
        dtEcuRunId:     Paths.DIGITAL_TWIN.ECU_RUN_ID,
        dtSpoolSize:    Paths.DIGITAL_TWIN.SPOOL_SIZE,
        dtInFlight:     Paths.DIGITAL_TWIN.IN_FLIGHT,
        dtLastSeq:      Paths.DIGITAL_TWIN.LAST_COMMITTED_SEQ,
        dtError:        Paths.DIGITAL_TWIN.ERROR,
        device:         Paths.CONNECTION.DEVICE,
        recordingConfig: Paths.CONNECTION.RECORDING_CONFIG,
      },
      ...options
    });

    this.pageTopBar = null;
  }

  createSkeleton() {
    const skeleton = super.createSkeleton();
    const host = this.$("#page-top-bar-container");
    if (host) {
      this.pageTopBar = new PageTopBar({ title: "Diagnostics" });
      this.pageTopBar.mount(host);
    }
    return skeleton;
  }

  renderContent() {
    return `
      <div class="telemetry-page diagnostics-page">
        <div id="page-top-bar-container"></div>

        <section class="telemetry-panel">
          <h3>Capabilities</h3>
          <div class="stat-grid" id="capabilities-grid"></div>
        </section>

        <section class="telemetry-panel">
          <h3>Transport</h3>
          <div class="stat-grid" id="transport-grid"></div>
        </section>

        <section class="telemetry-panel">
          <h3>Overflow Counters</h3>
          <div class="stat-grid" id="overflow-grid"></div>
        </section>

        <section class="telemetry-panel">
          <h3>Event Log</h3>
          <div class="event-log" id="diagnostics-events"></div>
        </section>

        <section class="telemetry-panel" id="dt-recording-panel">
          <h3>Digital Twin Recording</h3>
          <div class="stat-grid" id="dt-status-grid"></div>
          <div class="dt-controls" id="dt-controls" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;"></div>
        </section>
      </div>
    `;
  }

  update() {
    if (!this.el) return;

    renderStats(this.$("#capabilities-grid"), [
      ["socket", this.data.socketStatus || "--"],
      ["schema", `v${this.data.schemaVersion || "--"}`],
      ["state_hz", this.data.stateHz || "--"],
      ["events/batch", this.data.eventsPerBatch || "--"],
      ["gen", this.data.gen || "--"],
      ["frame_t_us", this.data.frameTUs || "--"]
    ]);

    const transport = this.data.transport || {};
    renderStats(this.$("#transport-grid"), [
      ["sent_frames", transport.sent_frames ?? "--"],
      ["dropped_frames", transport.dropped_frames ?? "--"],
      ["send_errors", transport.send_errors ?? "--"]
    ]);

    const overflow = this.data.overflow || {};
    renderStats(this.$("#overflow-grid"), [
      ["quick_shift_events", overflow.quick_shift_events ?? "--"],
      ["map_switch_events", overflow.map_switch_events ?? "--"],
      ["knock_measurements", overflow.knock_measurements ?? "--"],
      ["fault_events", overflow.fault_events ?? "--"]
    ]);

    this._renderEvents();
    this._renderDigitalTwin();
  }

  _renderEvents() {
    const host = this.$("#diagnostics-events");
    if (!host) return;

    const events = Array.isArray(this.data.events) ? this.data.events.slice().reverse() : [];
    if (events.length === 0) {
      host.innerHTML = `<div class="event-log-empty">No events received</div>`;
      return;
    }

    const frameTUs = Number(this.data.frameTUs);
    host.innerHTML = events.map((event) => {
      const age = Number.isFinite(frameTUs) && Number.isFinite(Number(event.at_us))
        ? formatDurationMs((frameTUs - Number(event.at_us)) / 1000)
        : "--";

      return `
        <div class="event-log-row">
          <div>
            <strong>${escapeHtml(event.kind || "Event")}</strong>
            <span>${escapeHtml(summarizeEvent(event) || "received")}</span>
          </div>
          <code>${age}</code>
        </div>
      `;
    }).join("");
  }

  _renderDigitalTwin() {
    const panel = this.$("#dt-recording-panel");
    if (!panel) return;

    const serverUrl = typeof import.meta !== "undefined"
      ? (import.meta.env?.VITE_DIGITAL_TWIN_SERVER_URL || "")
      : "";
    const enabled = ENABLED;
    const status  = this.data.dtStatus || "disabled";
    const device  = this.data.device || {};
    const cfg     = this.data.recordingConfig || {};

    renderStats(this.$("#dt-status-grid"), [
      ["server",      enabled ? escapeHtml(serverUrl) : "disabled"],
      ["status",      escapeHtml(status)],
      ["hwid",        escapeHtml(device.hwid || "--")],
      ["hw_rev",      escapeHtml(device.hardware_revision || "--")],
      ["run_id",      escapeHtml((this.data.dtRunId || "--").slice(0, 8) + "...")],
      ["ecu_run_id",  escapeHtml(this.data.dtEcuRunId || "--")],
      ["spool",       `${this.data.dtSpoolSize ?? 0} frames`],
      ["in_flight",   `${this.data.dtInFlight ?? 0} chunks`],
      ["committed_seq", this.data.dtLastSeq ?? 0],
      ["auto_enabled", cfg.auto_enabled ? "yes" : "no"],
      ["rpm_threshold", cfg.rpm_threshold ?? "--"],
    ]);

    const controls = this.$("#dt-controls");
    if (!controls) return;

    const canStart = enabled && (status === "idle" || status === "ended");
    const canStop  = enabled && (status === "running");
    const isAuto   = cfg.auto_enabled;

    controls.innerHTML = `
      <button id="dt-start-btn" ${!canStart ? "disabled" : ""}
              style="padding:6px 14px;cursor:pointer;">▶ Start</button>
      <button id="dt-stop-btn" ${!canStop ? "disabled" : ""}
              style="padding:6px 14px;cursor:pointer;">■ Stop</button>
      <button id="dt-auto-btn" ${!enabled ? "disabled" : ""}
              style="padding:6px 14px;cursor:pointer;">
        Auto: ${isAuto ? "ON" : "OFF"}
      </button>
    `;

    this.$("#dt-start-btn")?.addEventListener("click", () => {
      const d = Store.get(Paths.CONNECTION.DEVICE);
      startRun(d?.hwid, d?.hardware_revision, null, true);
    });
    this.$("#dt-stop-btn")?.addEventListener("click", () => stopRun());
    this.$("#dt-auto-btn")?.addEventListener("click", () => {
      const newVal = !cfg.auto_enabled;
      Socket.send(JSON.stringify({ type: "recording_config_set", auto_enabled: newVal }));
    });
  }
}

function renderStats(host, rows) {
  if (!host) return;
  host.innerHTML = rows.map(([label, value]) => `
    <div class="stat-cell">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `).join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

