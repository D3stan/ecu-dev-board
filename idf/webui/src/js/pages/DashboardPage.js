import { Page } from "../core/Page.js";
import { CommandManager } from "../managers/commandManager.js";
import { NavigatorManager } from "../managers/navigatorManager.js";
import { RecentEventsRail } from "../components/RecentEventsRail/RecentEventsRail.js";
import { AppMode, TelemetryUiConfig } from "../utils/telemetryConfig.js";
import { Paths } from "../utils/paths.js";
import {
  formatDurationMs,
  formatFaultBits,
  formatMetaAge,
  formatNumber,
  formatPercent,
  formatRpm,
  formatSigned,
  formatTemp,
  healthState
} from "../utils/telemetryFormat.js";

const MAX_RPM = TelemetryUiConfig.rpmGaugeMax;
const GAUGE_STROKE = 377;

export class DashboardPage extends Page {
  constructor(options = {}) {
    super({
      id: "dashboardPage",
      title: "ECU Dashboard",
      showBackButton: false,
      bindings: {
        socketStatus: Paths.SOCKET.STATE,
        schemaVersion: Paths.CONNECTION.SCHEMA_VERSION,
        stateHz: Paths.CONNECTION.STATE_HZ,
        eventsPerBatch: Paths.CONNECTION.EVENTS_PER_BATCH,
        frameTUs: Paths.TELEMETRY.TIMESTAMP,
        gen: Paths.TELEMETRY.GEN,
        rpm: Paths.TELEMETRY.RPM,
        rpmAccel: Paths.TELEMETRY.RPM_ACCEL,
        rpmSynchronized: Paths.TELEMETRY.RPM_SYNCHRONIZED,
        rpmMeta: Paths.TELEMETRY.RPM_META,
        tps: Paths.TELEMETRY.TPS,
        tpsFallbackUsed: Paths.TELEMETRY.TPS_FALLBACK_USED,
        tpsMeta: Paths.TELEMETRY.TPS_META,
        egt: Paths.TELEMETRY.EGT,
        egtState: Paths.TELEMETRY.EGT_STATE,
        egtRequest: Paths.TELEMETRY.EGT_REQUEST,
        egtMeta: Paths.TELEMETRY.EGT_META,
        waterTemp: Paths.TELEMETRY.WATER_TEMP,
        waterState: Paths.TELEMETRY.WATER_STATE,
        waterRequest: Paths.TELEMETRY.WATER_REQUEST,
        waterMeta: Paths.TELEMETRY.WATER_META,
        qsActive: Paths.TELEMETRY.QS_ACTIVE,
        qsArmed: Paths.TELEMETRY.QS_ARMED,
        qsMeta: Paths.TELEMETRY.QS_META,
        mapRequest: Paths.TELEMETRY.MAP_REQUEST,
        mapMeta: Paths.TELEMETRY.MAP_META,
        knock: Paths.TELEMETRY.KNOCK,
        transport: Paths.TELEMETRY.TRANSPORT,
        overflow: Paths.TELEMETRY.OVERFLOW
      },
      ...options
    });

    this.showDevActions = options.appMode === AppMode.DEVELOPMENT || Boolean(options.showDevActions);
    this.recentEventsRail = null;
    this.lastFrameReceivedMs = null;
    this.ageTimerId = null;
  }

  onMount() {
    const railHost = this.$("#recent-events-root");
    if (!railHost) return;

    this.recentEventsRail = new RecentEventsRail();
    this.recentEventsRail.mount(railHost);
    this.recentEventsRail.bindEvents();
  }

  onBindEvents() {
    this.$$("[data-signal]").forEach((element) => {
      this.addEventListener(element, "click", () => {
        const signal = element.getAttribute("data-signal");
        NavigatorManager.navigateTo("sensorDetailPage", { signal });
      });
    });

    const qsButton = this.$("#qs-trigger-btn");
    if (qsButton && this.showDevActions) {
      this.addEventListener(qsButton, "click", (event) => {
        event.stopPropagation();
        qsButton.classList.add("active");
        setTimeout(() => qsButton.classList.remove("active"), 150);
        CommandManager.triggerQs();
      });
    }
  }

  onActivate() {
    super.onActivate();
    if (this.data.gen) this.lastFrameReceivedMs = Date.now();
    if (this.recentEventsRail) this.recentEventsRail.activate();

    this.ageTimerId = setInterval(() => this._updateFrameAge(), 1000);
    this.update();
  }

  onDeactivate() {
    if (this.ageTimerId) {
      clearInterval(this.ageTimerId);
      this.ageTimerId = null;
    }

    if (this.recentEventsRail) this.recentEventsRail.deactivate();
    super.onDeactivate();
  }

  onDestroy() {
    if (this.recentEventsRail) {
      this.recentEventsRail.destroy();
      this.recentEventsRail = null;
    }
    super.onDestroy();
  }

  onDataChange(key) {
    if (key === "gen") {
      this.lastFrameReceivedMs = Date.now();
    }
  }

  renderContent() {
    return `
      <div class="dashboard-container ecu-cockpit">
        <section class="telemetry-status-strip" aria-label="Telemetry status">
          <span class="status-pill" id="status-socket">WS --</span>
          <span class="status-pill">schema v<span id="status-schema">--</span></span>
          <span class="status-pill"><span id="status-hz">--</span> Hz</span>
          <span class="status-pill">gen <span id="status-gen">--</span></span>
          <span class="status-pill">rx <span id="status-age">--</span></span>
          <span class="status-pill" id="status-transport">transport --</span>
        </section>

        <section class="rpm-hero" data-signal="rpm" title="Open RPM history">
          <div class="rpm-gauge-container">
            <svg class="rpm-gauge-svg" viewBox="0 0 200 200" aria-hidden="true">
              <path class="gauge-track" d="M 40 160 A 80 80 0 1 1 160 160" fill="none" stroke-linecap="round"/>
              <path class="gauge-fill" id="rpm-gauge-fill" d="M 40 160 A 80 80 0 1 1 160 160" fill="none" stroke-linecap="round" stroke-dasharray="${GAUGE_STROKE}" stroke-dashoffset="${GAUGE_STROKE}"/>
            </svg>
            <div class="gauge-text-container">
              <div class="gauge-value" id="rpm-gauge-value">--</div>
              <div class="gauge-unit">RPM</div>
              <div class="rpm-subline" id="rpm-sync">NOT SYNCHRONIZED</div>
              <div class="rpm-subline muted" id="rpm-accel">accel -- rpm/s</div>
              <div class="telemetry-badge unknown" id="rpm-health">NO META</div>
            </div>
          </div>
        </section>

        <section class="metrics-grid" aria-label="ECU telemetry">
          ${this._renderMetricCard("tps", "Throttle", "tps-value", "%", "tps-badge", "tps-footer")}
          ${this._renderMetricCard("egt", "EGT", "egt-value", "C", "egt-badge", "egt-footer")}
          ${this._renderMetricCard("water", "Water Temp", "water-value", "C", "water-badge", "water-footer")}
          ${this._renderMetricCard("rpmAccel", "Engine Sync", "sync-value", "", "sync-badge", "sync-footer")}
          ${this._renderMetricCard("qsActive", "Quick Shifter", "qs-value", "", "qs-badge", "qs-footer")}
          ${this._renderMetricCard("mapRequest", "Map Request", "map-value", "", "map-badge", "map-footer")}
          ${this._renderMetricCard("knock", "Knock", "knock-value", "", "knock-badge", "knock-footer", "wide")}
        </section>

        ${this.showDevActions ? `
          <section class="dev-actions">
            <button class="qs-btn" id="qs-trigger-btn" type="button">
              <span class="qs-text">Trigger Quick Shift</span>
            </button>
          </section>
        ` : ""}

        <div id="recent-events-root"></div>
      </div>
    `;
  }

  update() {
    if (!this.el) return;

    this._updateStatusStrip();
    this._updateRpmHero();
    this._updateSensorCards();
  }

  _renderMetricCard(signal, title, valueId, unit, badgeId, footerId, extraClass = "") {
    return `
      <button class="metric-card telemetry-card ${extraClass}" type="button" data-signal="${signal}">
        <div class="metric-header">
          <span class="metric-title">${title}</span>
          <span class="telemetry-badge unknown" id="${badgeId}">NO META</span>
        </div>
        <div class="metric-body">
          <span class="metric-value" id="${valueId}">--</span>
          ${unit ? `<span class="metric-unit">${unit}</span>` : ""}
        </div>
        <div class="metric-footer" id="${footerId}">--</div>
      </button>
    `;
  }

  _updateStatusStrip() {
    setText(this.$("#status-socket"), `WS ${String(this.data.socketStatus || "--").toUpperCase()}`);
    this.$("#status-socket")?.setAttribute("data-state", String(this.data.socketStatus || "unknown").toLowerCase());
    setText(this.$("#status-schema"), this.data.schemaVersion || "--");
    setText(this.$("#status-hz"), this.data.stateHz || "--");
    setText(this.$("#status-gen"), this.data.gen || "--");
    this._updateFrameAge();

    const transport = this.data.transport || {};
    const hasTransportIssue = Number(transport.dropped_frames) > 0 || Number(transport.send_errors) > 0;
    const label = hasTransportIssue
      ? `transport drop ${transport.dropped_frames || 0} err ${transport.send_errors || 0}`
      : "transport OK";

    const transportEl = this.$("#status-transport");
    setText(transportEl, label);
    transportEl?.classList.toggle("warning", hasTransportIssue);
  }

  _updateFrameAge() {
    const ageEl = this.$("#status-age");
    if (!ageEl) return;
    if (!this.lastFrameReceivedMs) {
      ageEl.textContent = "--";
      return;
    }
    ageEl.textContent = formatDurationMs(Date.now() - this.lastFrameReceivedMs);
  }

  _updateRpmHero() {
    const rpm = Number(this.data.rpm) || 0;
    setText(this.$("#rpm-gauge-value"), formatRpm(rpm));
    setText(this.$("#rpm-sync"), this.data.rpmSynchronized ? "SYNCHRONIZED" : "NOT SYNCHRONIZED");
    setText(this.$("#rpm-accel"), `accel ${formatSigned(this.data.rpmAccel, 0)} rpm/s`);
    setBadge(this.$("#rpm-health"), this.data.rpmMeta);

    const fill = this.$("#rpm-gauge-fill");
    if (fill) {
      const percent = Math.max(0, Math.min(rpm / MAX_RPM, 1));
      fill.style.strokeDashoffset = String(GAUGE_STROKE * (1 - percent));
    }
  }

  _updateSensorCards() {
    setText(this.$("#tps-value"), formatPercent(this.data.tps));
    setBadge(this.$("#tps-badge"), this.data.tpsMeta);
    setText(
      this.$("#tps-footer"),
      this.data.tpsFallbackUsed ? "fallback active" : `age ${formatMetaAge(this.data.frameTUs, this.data.tpsMeta)}`
    );
    setCardFault(this.$('[data-signal="tps"]'), this.data.tpsMeta);

    setText(this.$("#egt-value"), formatTemp(this.data.egt));
    setBadge(this.$("#egt-badge"), this.data.egtMeta);
    setText(this.$("#egt-footer"), `${this.data.egtState || "--"} / ${this.data.egtRequest || "--"}`);
    setCardFault(this.$('[data-signal="egt"]'), this.data.egtMeta);

    setText(this.$("#water-value"), formatTemp(this.data.waterTemp));
    setBadge(this.$("#water-badge"), this.data.waterMeta);
    setText(this.$("#water-footer"), `${this.data.waterState || "--"} / ${this.data.waterRequest || "--"}`);
    setCardFault(this.$('[data-signal="water"]'), this.data.waterMeta);

    setText(this.$("#sync-value"), this.data.rpmSynchronized ? "SYNC" : "OPEN");
    setBadge(this.$("#sync-badge"), this.data.rpmMeta);
    setText(this.$("#sync-footer"), `${formatSigned(this.data.rpmAccel, 0)} rpm/s`);

    setText(this.$("#qs-value"), this.data.qsActive ? "ACTIVE" : "IDLE");
    setBadge(this.$("#qs-badge"), this.data.qsMeta);
    setText(this.$("#qs-footer"), this.data.qsArmed ? "armed" : "not armed");
    setCardFault(this.$('[data-signal="qsActive"]'), this.data.qsMeta);

    setText(this.$("#map-value"), this.data.mapRequest || "--");
    setBadge(this.$("#map-badge"), this.data.mapMeta);
    setText(this.$("#map-footer"), "physical switch request");
    setCardFault(this.$('[data-signal="mapRequest"]'), this.data.mapMeta);

    const knock = this.data.knock;
    const knockMeta = knock
      ? { valid: knock.valid, health: knock.health, quality: knock.quality, faultBits: knock.fault_bits }
      : null;

    setText(this.$("#knock-value"), knock ? formatNumber(knock.normalized_index, 2) : "none");
    setBadge(this.$("#knock-badge"), knockMeta);
    setText(
      this.$("#knock-footer"),
      knock ? `${knock.candidate_knock ? "candidate" : "quiet"} / ignition ${formatNumber(knock.ignition_angle_deg, 1)} deg` : "latest summary unavailable"
    );
    setCardFault(this.$('[data-signal="knock"]'), knockMeta);
  }
}

function setText(element, value) {
  if (element) element.textContent = String(value);
}

function setBadge(element, meta) {
  if (!element) return;
  const state = healthState(meta);
  element.textContent = state.label;
  element.className = `telemetry-badge ${state.className}`;
  if (meta?.faultBits) {
    element.title = formatFaultBits(meta.faultBits);
  } else {
    element.removeAttribute("title");
  }
}

function setCardFault(element, meta) {
  if (!element) return;
  element.classList.toggle("fault-active", Boolean(meta?.faultBits));
  element.classList.toggle("invalid", Boolean(meta && !meta.valid));
}
