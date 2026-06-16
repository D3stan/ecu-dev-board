import { Page } from "../core/Page.js";
import { PageTopBar } from "../components/PageTopBar/PageTopBar.js";
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

