import { Component } from "../../core/Component.js";
import { Paths } from "../../utils/paths.js";
import { buildRecentEventsModel } from "../../utils/telemetryViewModel.js";

export class RecentEventsRail extends Component {
  constructor(options = {}) {
    super({
      id: options.id || "recent-events-rail",
      bindings: {
        events: Paths.TELEMETRY.EVENTS,
        frameTUs: Paths.TELEMETRY.TIMESTAMP
      },
      ...options
    });
  }

  render() {
    const container = document.createElement("section");
    container.className = "recent-events-rail";
    container.innerHTML = `
      <div class="recent-events-header">
        <h3>Recent Events</h3>
        <span data-ref="count">0</span>
      </div>
      <div class="recent-events-list" data-ref="events"></div>
    `;
    return container;
  }

  update() {
    if (!this.el) return;

    const events = buildRecentEventsModel(this.data.events, this.data.frameTUs, 6).reverse();
    const list = this.$('[data-ref="events"]');
    const count = this.$('[data-ref="count"]');

    if (count) count.textContent = String(events.length);
    if (!list) return;

    if (events.length === 0) {
      list.innerHTML = `<div class="recent-event-empty">No recent events</div>`;
      return;
    }

    list.innerHTML = events.map((event) => this._renderEvent(event)).join("");
  }

  _renderEvent(event) {
    const kind = event.kind || event.title || "Event";
    const age = event.ageLabel || "--";
    const summary = event.summary;
    const className = kindToClass(kind);

    return `
      <div class="recent-event ${className}">
        <div class="recent-event-dot"></div>
        <div class="recent-event-main">
          <div class="recent-event-kind">${escapeHtml(kind)}</div>
          <div class="recent-event-summary">${escapeHtml(summary || "received")}</div>
        </div>
        <div class="recent-event-age">${age}</div>
      </div>
    `;
  }

}

function kindToClass(kind) {
  if (String(kind).includes("Fault")) return "fault";
  if (String(kind).includes("Map")) return "map";
  if (String(kind).includes("Quick")) return "quick-shift";
  return "info";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
