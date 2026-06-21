import { Page } from "../core/Page.js";
import { PageTopBar } from "../components/PageTopBar/PageTopBar.js";
import { DigitalTwinClient } from "../managers/DigitalTwinClient.js";
import { Paths } from "../utils/paths.js";
import { formatDurationMs, summarizeEvent } from "../utils/telemetryFormat.js";

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
        device: Paths.CONNECTION.DEVICE,
        recordingConfig: Paths.RECORDING.CONFIG,
        digitalTwinEnabled: Paths.DIGITAL_TWIN.ENABLED,
        digitalTwinStatus: Paths.DIGITAL_TWIN.STATUS,
        digitalTwinError: Paths.DIGITAL_TWIN.ERROR,
        activeRunId: Paths.DIGITAL_TWIN.ACTIVE_RUN_ID,
        recordingSource: Paths.DIGITAL_TWIN.RECORDING_SOURCE,
        queuedFrames: Paths.DIGITAL_TWIN.QUEUED_FRAMES,
        lastAckTUs: Paths.DIGITAL_TWIN.LAST_ACK_T_US,
        lastAckBatchSeq: Paths.DIGITAL_TWIN.LAST_ACK_BATCH_SEQ,
        frameTUs: Paths.TELEMETRY.TIMESTAMP,
        gen: Paths.TELEMETRY.GEN,
        overflow: Paths.TELEMETRY.OVERFLOW,
        transport: Paths.TELEMETRY.TRANSPORT,
        events: Paths.TELEMETRY.EVENTS
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

  onBindEvents() {
    const startButton = this.$("#recording-start-btn");
    const stopButton = this.$("#recording-stop-btn");
    const autoToggle = this.$("#recording-auto-toggle");

    if (startButton) {
      this.addEventListener(startButton, "click", () => {
        DigitalTwinClient.startManual();
      });
    }
    if (stopButton) {
      this.addEventListener(stopButton, "click", () => {
        DigitalTwinClient.stopRecording();
      });
    }
    if (autoToggle) {
      this.addEventListener(autoToggle, "change", (event) => {
        DigitalTwinClient.setAutoRecordEnabled(event.currentTarget.checked);
      });
    }
  }

  renderContent() {
    return `
      <div class="telemetry-page diagnostics-page">
        <div id="page-top-bar-container"></div>

        <section class="telemetry-panel">
          <h3>Capabilities</h3>
          <div class="stat-grid" id="capabilities-grid"></div>
        </section>

        <section class="telemetry-panel recording-panel">
          <h3>Digital Twin Recording</h3>
          <div class="stat-grid" id="recording-grid"></div>
          <div class="recording-actions">
            <button class="recording-btn" id="recording-start-btn" type="button">Start</button>
            <button class="recording-btn" id="recording-stop-btn" type="button">Stop</button>
            <label class="recording-toggle">
              <input id="recording-auto-toggle" type="checkbox">
              <span>Auto</span>
            </label>
          </div>
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
      ["hwid", this.data.device?.hwid || "--"],
      ["hardware", this.data.device?.hardware_revision || "--"],
      ["gen", this.data.gen || "--"],
      ["frame_t_us", this.data.frameTUs || "--"]
    ]);

    const recording = this.data.recordingConfig || {};
    renderStats(this.$("#recording-grid"), [
      ["server", this.data.digitalTwinStatus || "--"],
      ["error", this.data.digitalTwinError || "--"],
      ["active_run", this.data.activeRunId || "--"],
      ["source", this.data.recordingSource || "--"],
      ["queued", this.data.queuedFrames ?? 0],
      ["last_ack", this.data.lastAckTUs ?? "--"],
      ["ack_seq", this.data.lastAckBatchSeq ?? "--"],
      ["auto", recording.auto_enabled ? "on" : "off"],
      ["rpm_threshold", recording.rpm_threshold ?? "--"],
      ["start_ms", recording.start_debounce_ms ?? "--"],
      ["stop_ms", recording.stop_debounce_ms ?? "--"]
    ]);
    this._updateRecordingControls();

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
  }

  _updateRecordingControls() {
    const enabled = !!this.data.digitalTwinEnabled;
    const active = !!this.data.activeRunId;
    const hasHwid = !!this.data.device?.hwid;
    const autoEnabled = !!this.data.recordingConfig?.auto_enabled;

    setDisabled(this.$("#recording-start-btn"), !enabled || active || !hasHwid);
    setDisabled(this.$("#recording-stop-btn"), !enabled || !active);

    const autoToggle = this.$("#recording-auto-toggle");
    if (autoToggle) {
      autoToggle.checked = autoEnabled;
      autoToggle.disabled = !enabled;
    }
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

function setDisabled(element, disabled) {
  if (element) element.disabled = !!disabled;
}

