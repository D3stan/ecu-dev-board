import { Page } from "../core/Page.js";
import { CommandManager } from "../managers/commandManager.js";
import { DigitalTwinClient } from "../managers/DigitalTwinClient.js";
import { NavigatorManager } from "../managers/navigatorManager.js";
import { RecentEventsRail } from "../components/RecentEventsRail/RecentEventsRail.js";
import { AppMode, TelemetryUiConfig } from "../utils/telemetryConfig.js";
import { Paths } from "../utils/paths.js";
import {
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
        device: Paths.CONNECTION.DEVICE,
        recordingConfig: Paths.RECORDING.CONFIG,
        digitalTwinEnabled: Paths.DIGITAL_TWIN.ENABLED,
        activeRunId: Paths.DIGITAL_TWIN.ACTIVE_RUN_ID,
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
        knock: Paths.TELEMETRY.KNOCK
      },
      ...options
    });

    this.showDevActions = options.appMode === AppMode.DEVELOPMENT || Boolean(options.showDevActions);
    this.recentEventsRail = null;
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

    const startButton = this.$("#dashboard-recording-start-btn");
    const stopButton = this.$("#dashboard-recording-stop-btn");

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
  }

  onActivate() {
    super.onActivate();
    if (this.recentEventsRail) this.recentEventsRail.activate();
    this.update();
  }

  onDeactivate() {
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

  renderContent() {
    return `
      <div class="dashboard-container ecu-cockpit">
        <section class="recording-bar" aria-label="Telemetry recording">
          <button class="recording-action" id="dashboard-recording-start-btn" type="button">Start</button>
          <button class="recording-action" id="dashboard-recording-stop-btn" type="button">Stop</button>
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

    this._updateRecordingControls();
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

  _updateRecordingControls() {
    const enabled = !!this.data.digitalTwinEnabled;
    const active = !!this.data.activeRunId;
    const hasHwid = !!this.data.device?.hwid;

    setDisabled(this.$("#dashboard-recording-start-btn"), !enabled || active || !hasHwid);
    setDisabled(this.$("#dashboard-recording-stop-btn"), !enabled || !active);
  }

  _updateRpmHero() {
    const rpm = Number(this.data.rpm) || 0;
    setText(this.$("#rpm-gauge-value"), formatRpm(rpm));
    setText(this.$("#rpm-sync"), this.data.rpmSynchronized ? "SYNCHRONIZED" : "NOT SYNCHRONIZED");
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

function setDisabled(element, disabled) {
  if (element) element.disabled = !!disabled;
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
