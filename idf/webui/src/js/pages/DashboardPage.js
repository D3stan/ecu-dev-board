/**
 * DashboardPage.js
 * ================
 * Redesigned Main Dashboard Page for the ECU Simulator.
 * Features a large centered RPM arc gauge, spark indicator,
 * telemetry metrics grid, and Quick-Shift trigger.
 */

import { Page } from '../core/Page.js';
import { log } from '../utils/logger.js';
import { NavigatorManager } from '../managers/navigatorManager.js';
import { CommandManager } from '../managers/commandManager.js';

export class DashboardPage extends Page {
  constructor(options = {}) {
    super({
      id: 'dashboardPage',
      title: 'ECU Dashboard',
      showBackButton: false,
      bindings: {
        rpm: 'telemetry.rpm',
        tps: 'telemetry.tps',
        egt: 'telemetry.egt',
        ecu_advance: 'telemetry.ecu_advance',
        spark_detected: 'telemetry.spark_detected',
        tpsOverrideActive: 'overrides.tps.active',
        egtOverrideActive: 'overrides.egt.active',
        rpmOverrideActive: 'overrides.rpm.active',
        egtFaultActive: 'overrides.egt_fault.active'
      },
      ...options
    });
  }

  onBindEvents() {
    log.debug('DashboardPage', 'onBindEvents');

    // Click handlers for navigating to override pages
    const rpmTrigger = this.el.querySelector('#rpm-gauge-trigger');
    if (rpmTrigger) {
      rpmTrigger.addEventListener('click', () => {
        NavigatorManager.navigateTo('rpmSettingsPage');
      });
    }

    const tpsCard = this.el.querySelector('#tps-card');
    if (tpsCard) {
      tpsCard.addEventListener('click', () => {
        NavigatorManager.navigateTo('tpsSettingsPage');
      });
    }

    const egtCard = this.el.querySelector('#egt-card');
    if (egtCard) {
      egtCard.addEventListener('click', () => {
        NavigatorManager.navigateTo('egtSettingsPage');
      });
    }

    // Quick-shift trigger button click handler
    const qsBtn = this.el.querySelector('#qs-trigger-btn');
    if (qsBtn) {
      qsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Visual button trigger effect
        qsBtn.classList.add('active');
        setTimeout(() => qsBtn.classList.remove('active'), 150);

        CommandManager.triggerQs();
      });
    }
  }

  onActivate() {
    super.onActivate();
    log.debug('DashboardPage', 'Activated');
    this._updateAll();
  }

  onDataChange(key, newValue) {
    if (!this.el) return;

    switch (key) {
      case 'rpm':
        this._updateRpmGauge(newValue);
        break;
      case 'tps':
        this._updateTpsCard(newValue);
        break;
      case 'egt':
        this._updateEgtCard(newValue);
        break;
      case 'ecu_advance':
        this._updateIgnitionAdvance(newValue);
        break;
      case 'spark_detected':
        this._updateSparkStatus(newValue);
        break;
      case 'tpsOverrideActive':
        this._updateTpsOverrideState(newValue);
        break;
      case 'egtOverrideActive':
        this._updateEgtOverrideState(newValue);
        break;
      case 'rpmOverrideActive':
        this._updateRpmOverrideState(newValue);
        break;
      case 'egtFaultActive':
        this._updateEgtFaultState(newValue);
        break;
    }
  }

  renderContent() {
    return `
      <div class="dashboard-container">
        
        <!-- RPM HERO SECTION -->
        <div class="hero-section">
          <div class="rpm-gauge-wrapper interactive" id="rpm-gauge-trigger" title="Configure RPM Overrides">
            <div class="rpm-gauge-container">
              <svg class="rpm-gauge-svg" viewBox="0 0 200 200">
                <!-- Gauge track -->
                <path class="gauge-track" d="M 40 160 A 80 80 0 1 1 160 160" fill="none" stroke-linecap="round"/>
                <!-- Gauge active fill -->
                <path class="gauge-fill" id="rpm-gauge-fill" d="M 40 160 A 80 80 0 1 1 160 160" fill="none" stroke-linecap="round" stroke-dasharray="377" stroke-dashoffset="377"/>
              </svg>
              <div class="gauge-text-container">
                <div class="gauge-value" id="rpm-gauge-value">0</div>
                <div class="gauge-unit">RPM</div>
                <div class="gauge-badge" id="rpm-override-badge">PHYSICAL</div>
              </div>
            </div>
          </div>
        </div>

        <!-- QUICK-SHIFT TRIGGER SECTION -->
        <div class="qs-trigger-section">
          <button class="qs-btn" id="qs-trigger-btn">
            <span class="qs-icon">⚡</span>
            <span class="qs-text">TRIGGER QUICK-SHIFT</span>
          </button>
        </div>

        <!-- METRICS GRID -->
        <div class="metrics-grid">
          
          <!-- TPS CARD -->
          <div class="metric-card interactive" id="tps-card" title="Configure TPS Overrides">
            <div class="metric-header">
              <span class="metric-title">Throttle Position (TPS)</span>
              <span class="status-indicator" id="tps-override-indicator">PHYSICAL</span>
            </div>
            <div class="metric-body">
              <span class="metric-value" id="tps-value">0.0</span>
              <span class="metric-unit">%</span>
            </div>
            <div class="metric-footer" id="tps-card-footer">Physical Sensor</div>
          </div>

          <!-- EGT CARD -->
          <div class="metric-card interactive" id="egt-card" title="Configure EGT Overrides">
            <div class="metric-header">
              <span class="metric-title">Exhaust Gas Temp (EGT)</span>
              <span class="status-indicator" id="egt-override-indicator">PHYSICAL</span>
            </div>
            <div class="metric-body">
              <span class="metric-value" id="egt-value">20.0</span>
              <span class="metric-unit">°C</span>
            </div>
            <div class="metric-footer" id="egt-card-footer">Ambient Temp</div>
          </div>

          <!-- IGNITION ADVANCE CARD -->
          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-title">Ignition Advance</span>
            </div>
            <div class="metric-body">
              <span class="metric-value" id="advance-value">0.00</span>
              <span class="metric-unit">° BTDC</span>
            </div>
            <div class="metric-footer">Computed Timing Angle</div>
          </div>

          <!-- SPARK DETECTED CARD -->
          <div class="metric-card" id="spark-card">
            <div class="metric-header">
              <span class="metric-title">Spark Detected</span>
            </div>
            <div class="spark-status-body">
              <span class="spark-led" id="spark-led"></span>
              <span class="spark-text" id="spark-status-text">NO SPARK</span>
            </div>
            <div class="metric-footer">Live CDI Pulse Capture</div>
          </div>

        </div>

      </div>
    `;
  }

  /**
   * Helper to update all items on activation
   * @private
   */
  _updateAll() {
    this._updateRpmGauge(this.data.rpm || 0);
    this._updateTpsCard(this.data.tps || 0);
    this._updateEgtCard(this.data.egt || 20);
    this._updateIgnitionAdvance(this.data.ecu_advance || 0);
    this._updateSparkStatus(this.data.spark_detected);
    this._updateTpsOverrideState(this.data.tpsOverrideActive);
    this._updateEgtOverrideState(this.data.egtOverrideActive);
    this._updateRpmOverrideState(this.data.rpmOverrideActive);
    this._updateEgtFaultState(this.data.egtFaultActive);
  }

  /**
   * Update RPM gauge fill and center text
   * @private
   */
  _updateRpmGauge(rpm) {
    const valueEl = this.el.querySelector('#rpm-gauge-value');
    const fillEl = this.el.querySelector('#rpm-gauge-fill');
    
    if (valueEl) {
      valueEl.textContent = Math.round(rpm).toLocaleString();
    }

    if (fillEl) {
      const maxRpm = 18000.0;
      const percentage = Math.min(Math.max(rpm / maxRpm, 0.0), 1.0);
      const strokeLength = 377; // length of the arc
      const offset = strokeLength * (1.0 - percentage);
      fillEl.style.strokeDashoffset = offset;
    }
  }

  /**
   * Update TPS card display
   * @private
   */
  _updateTpsCard(tps) {
    const valEl = this.el.querySelector('#tps-value');
    if (valEl) {
      valEl.textContent = Number(tps).toFixed(1);
    }
  }

  /**
   * Update EGT card display
   * @private
   */
  _updateEgtCard(egt) {
    const valEl = this.el.querySelector('#egt-value');
    if (valEl) {
      valEl.textContent = Number(egt).toFixed(1);
    }
  }

  /**
   * Update ignition advance timing display
   * @private
   */
  _updateIgnitionAdvance(adv) {
    const valEl = this.el.querySelector('#advance-value');
    if (valEl) {
      valEl.textContent = Number(adv).toFixed(2);
    }
  }

  /**
   * Update spark detection status display
   * @private
   */
  _updateSparkStatus(hasSpark) {
    const ledEl = this.el.querySelector('#spark-led');
    const textEl = this.el.querySelector('#spark-status-text');
    
    if (ledEl) {
      if (hasSpark) {
        ledEl.className = 'spark-led active pulsing';
      } else {
        ledEl.className = 'spark-led inactive';
      }
    }

    if (textEl) {
      textEl.textContent = hasSpark ? 'SPARK ACTIVE' : 'NO SPARK';
    }
  }

  /**
   * Update TPS card override status badges
   * @private
   */
  _updateTpsOverrideState(active) {
    const indEl = this.el.querySelector('#tps-override-indicator');
    const footerEl = this.el.querySelector('#tps-card-footer');
    const cardEl = this.el.querySelector('#tps-card');

    if (indEl) {
      indEl.textContent = active ? 'VIRTUAL' : 'PHYSICAL';
      indEl.className = active ? 'status-indicator active' : 'status-indicator';
    }

    if (footerEl) {
      footerEl.textContent = active ? 'Manual Override Active' : 'Physical Sensor';
    }

    if (cardEl) {
      if (active) cardEl.classList.add('override-active');
      else cardEl.classList.remove('override-active');
    }
  }

  /**
   * Update EGT card override status badges
   * @private
   */
  _updateEgtOverrideState(active) {
    const indEl = this.el.querySelector('#egt-override-indicator');
    const footerEl = this.el.querySelector('#egt-card-footer');
    const cardEl = this.el.querySelector('#egt-card');

    if (indEl) {
      indEl.textContent = active ? 'VIRTUAL' : 'PHYSICAL';
      indEl.className = active ? 'status-indicator active' : 'status-indicator';
    }

    if (footerEl) {
      // If fault is active, EgtFaultState takes precedence for text
      if (!this.data.egtFaultActive) {
        footerEl.textContent = active ? 'Manual Override Active' : 'Physics Superloop';
      }
    }

    if (cardEl) {
      if (active) cardEl.classList.add('override-active');
      else cardEl.classList.remove('override-active');
    }
  }

  /**
   * Update RPM Gauge override status badges
   * @private
   */
  _updateRpmOverrideState(active) {
    const badgeEl = this.el.querySelector('#rpm-override-badge');
    const wrapperEl = this.el.querySelector('#rpm-gauge-trigger');

    if (badgeEl) {
      badgeEl.textContent = active ? 'OVERRIDDEN' : 'PHYSICAL';
      badgeEl.className = active ? 'gauge-badge active' : 'gauge-badge';
    }

    if (wrapperEl) {
      if (active) wrapperEl.classList.add('override-active');
      else wrapperEl.classList.remove('override-active');
    }
  }

  /**
   * Update EGT overheat fault display
   * @private
   */
  _updateEgtFaultState(active) {
    const footerEl = this.el.querySelector('#egt-card-footer');
    const cardEl = this.el.querySelector('#egt-card');

    if (cardEl) {
      if (active) {
        cardEl.classList.add('fault-active');
        if (footerEl) {
          footerEl.textContent = 'FAULT: OVERHEAT INJECTED';
        }
      } else {
        cardEl.classList.remove('fault-active');
        if (footerEl) {
          footerEl.textContent = this.data.egtOverrideActive ? 'Manual Override Active' : 'Physics Superloop';
        }
      }
    }
  }
}
