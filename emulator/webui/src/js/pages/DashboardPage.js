/**
 * DashboardPage.js
 * ================
 * Main telemetry dashboard page for the ECU.
 * Shows real-time RPM, TPS, EGT, FSM state, advance angle,
 * PJ duty, active map, and the Quick Shift button.
 */

import { Page } from '../core/Page.js';
import { Store } from '../core/store.js';
import { Paths } from '../utils/paths.js';
import { RpmGauge } from '../components/RpmGauge/RpmGauge.js';
import { TpsBar } from '../components/TpsBar/TpsBar.js';
import { EgtIndicator } from '../components/EgtIndicator/EgtIndicator.js';
import { FsmBadge } from '../components/FsmBadge/FsmBadge.js';
import { TelemetryValue } from '../components/TelemetryValue/TelemetryValue.js';
import { QsButton } from '../components/QsButton/QsButton.js';

export class DashboardPage extends Page {
  constructor() {
    super({
      id: 'dashboardPage',
      cssClass: 'dashboard-page',
      title: 'Dashboard'
    });

    // Child components
    this.rpmGauge = null;
    this.tpsBar = null;
    this.egtIndicator = null;
    this.fsmBadge = null;
    this.advanceValue = null;
    this.pjDutyValue = null;
    this.activeMapValue = null;
    this.qsButton = null;
  }

  /**
   * Create the page skeleton DOM.
   * @returns {HTMLElement}
   */
  createSkeleton() {
    const el = document.createElement('div');
    el.id = this.pageId;
    el.className = `page left ${this._options.cssClass}`;

    el.innerHTML = `
      <!-- RPM Gauge Section -->
      <div class="dashboard-page__rpm-section" id="dash-rpm-container"></div>

      <!-- FSM State Badge -->
      <div class="dashboard-page__status-row" id="dash-fsm-container"></div>

      <!-- Telemetry Grid -->
      <div class="dashboard-page__grid">
        <div id="dash-tps-container"></div>
        <div id="dash-egt-container"></div>
        <div id="dash-advance-container"></div>
        <div id="dash-pjduty-container"></div>
      </div>

      <!-- Quick Shift Row -->
      <div class="dashboard-page__qs-row">
        <div id="dash-mapinfo-container"></div>
        <div id="dash-qs-container"></div>
      </div>
    `;

    this.el = el;
    this.root = el;
    this.phase = 'rendered';
    this.state.mounted = true;
    this.onMount();
    this._setupI18nBinding();
    return el;
  }

  /**
   * Create and mount child components.
   */
  bindEvents() {
    // RPM Gauge
    this.rpmGauge = new RpmGauge();
    this.rpmGauge.mount(this.root.querySelector('#dash-rpm-container'));

    // FSM Badge
    this.fsmBadge = new FsmBadge();
    this.fsmBadge.mount(this.root.querySelector('#dash-fsm-container'));

    // TPS Bar
    this.tpsBar = new TpsBar();
    this.tpsBar.mount(this.root.querySelector('#dash-tps-container'));

    // EGT Indicator
    this.egtIndicator = new EgtIndicator();
    this.egtIndicator.mount(this.root.querySelector('#dash-egt-container'));

    // Advance angle
    this.advanceValue = new TelemetryValue({
      label: 'Anticipo',
      unit: '°',
      field: 'advance_deg'
    });
    this.advanceValue.mount(this.root.querySelector('#dash-advance-container'));

    // PJ Duty
    this.pjDutyValue = new TelemetryValue({
      label: 'PJ Duty',
      unit: '%',
      field: 'pj_duty'
    });
    this.pjDutyValue.mount(this.root.querySelector('#dash-pjduty-container'));

    // Active Map Info
    this.activeMapValue = new TelemetryValue({
      label: 'Mappa',
      unit: '',
      field: 'active_map',
      formatter: (mapId) => {
        const maps = Store.get(Paths.CONFIG.MAPS.IGNITION);
        if (maps && maps[mapId]) return maps[mapId].name;
        return `Map ${mapId}`;
      }
    });
    this.activeMapValue.mount(this.root.querySelector('#dash-mapinfo-container'));

    // Quick Shift Button
    this.qsButton = new QsButton();
    this.qsButton.mount(this.root.querySelector('#dash-qs-container'));
  }

  /**
   * Activate all child components when page becomes visible.
   */
  onActivate() {
    if (this.rpmGauge)      this.rpmGauge.activate();
    if (this.fsmBadge)      this.fsmBadge.activate();
    if (this.tpsBar)        this.tpsBar.activate();
    if (this.egtIndicator)  this.egtIndicator.activate();
    if (this.advanceValue)  this.advanceValue.activate();
    if (this.pjDutyValue)   this.pjDutyValue.activate();
    if (this.activeMapValue) this.activeMapValue.activate();
    if (this.qsButton)      this.qsButton.activate();
  }

  /**
   * Deactivate all child components when page is hidden.
   */
  onDeactivate() {
    if (this.rpmGauge)      this.rpmGauge.deactivate();
    if (this.fsmBadge)      this.fsmBadge.deactivate();
    if (this.tpsBar)        this.tpsBar.deactivate();
    if (this.egtIndicator)  this.egtIndicator.deactivate();
    if (this.advanceValue)  this.advanceValue.deactivate();
    if (this.pjDutyValue)   this.pjDutyValue.deactivate();
    if (this.activeMapValue) this.activeMapValue.deactivate();
    if (this.qsButton)      this.qsButton.deactivate();
  }
}
