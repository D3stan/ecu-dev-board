/**
 * TpsSettingsPage.js
 * ==================
 * Settings page for Throttle Position Sensor (TPS) manual overrides.
 */

import { Page } from '../core/Page.js';
import { log } from '../utils/logger.js';
import { PageTopBar } from '../components/PageTopBar/PageTopBar.js';
import { CommandManager } from '../managers/commandManager.js';
import { i18n } from '../utils/i18n.js';

export class TpsSettingsPage extends Page {
  constructor(options = {}) {
    super({
      id: 'tpsSettingsPage',
      title: 'TPS Configuration',
      showBackButton: true,
      bindings: {
        tps: 'telemetry.tps',
        tpsOverrideActive: 'overrides.tps.active',
        tpsOverrideValue: 'overrides.tps.value'
      },
      ...options
    });

    this.pageTopBar = null;
  }

  createSkeleton() {
    const skeleton = super.createSkeleton();
    
    // Mount PageTopBar
    const topBarContainer = this.el.querySelector('#page-top-bar-container');
    if (topBarContainer) {
      this.pageTopBar = new PageTopBar({
        title: i18n.t('ui.tpsOverrideTitle')
      });
      this.pageTopBar.mount(topBarContainer);
    }

    return skeleton;
  }

  onBindEvents() {
    log.debug('TpsSettingsPage', 'onBindEvents');

    const toggle = this.el.querySelector('#tps-override-toggle');
    const slider = this.el.querySelector('#tps-slider');
    const presets = this.el.querySelectorAll('.preset-badge');

    if (toggle) {
      toggle.addEventListener('change', (e) => {
        const active = e.target.checked;
        CommandManager.toggleOverride('tps', active);
        this._updateUIState(active);
      });
    }

    if (slider) {
      slider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this._updateSliderLabel(val);
        CommandManager.setValue('tps', val);
      });
    }

    presets.forEach(badge => {
      badge.addEventListener('click', () => {
        const val = parseFloat(badge.getAttribute('data-value'));
        
        // Auto-enable override if clicking a preset
        if (toggle && !toggle.checked) {
          toggle.checked = true;
          CommandManager.toggleOverride('tps', true);
          this._updateUIState(true);
        }

        if (slider) {
          slider.value = val;
        }
        this._updateSliderLabel(val);
        CommandManager.setValue('tps', val);
      });
    });
  }

  onActivate() {
    super.onActivate();
    log.debug('TpsSettingsPage', 'Activated');
    this._syncState();
  }

  onDataChange(key, newValue) {
    if (!this.el) return;

    if (key === 'tpsOverrideActive') {
      const toggle = this.el.querySelector('#tps-override-toggle');
      if (toggle) {
        toggle.checked = !!newValue;
      }
      this._updateUIState(!!newValue);
    } 
    else if (key === 'tpsOverrideValue') {
      const slider = this.el.querySelector('#tps-slider');
      if (slider && !this._isUserInteractingWithSlider()) {
        slider.value = newValue;
        this._updateSliderLabel(newValue);
      }
    }
    else if (key === 'tps') {
      const liveVal = this.el.querySelector('#tps-live-value');
      if (liveVal) {
        liveVal.textContent = Number(newValue).toFixed(1);
      }
    }
  }

  renderContent() {
    return `
      <div id="page-top-bar-container"></div>

      <div class="settings-content">
        <div class="info-card">
          <p class="description">${i18n.t('ui.tpsOverrideDesc')}</p>
        </div>

        <!-- OVERRIDE TOGGLE CARD -->
        <div class="settings-card">
          <div class="toggle-container">
            <div class="toggle-details">
              <span class="toggle-title">${i18n.t('ui.overrideToggle')}</span>
              <span class="toggle-description">Bypasses the physical potentiometer inputs</span>
            </div>
            <label class="switch">
              <input type="checkbox" id="tps-override-toggle">
              <span class="switch-slider"></span>
            </label>
          </div>
        </div>

        <!-- SLIDER CONTROL CARD -->
        <div class="settings-card slider-card disabled" id="tps-slider-card">
          <div class="slider-header">
            <span class="slider-title">${i18n.t('ui.targetTps')}</span>
            <span class="slider-value" id="tps-slider-value">0.0</span>
            <span class="slider-unit">%</span>
          </div>
          <div class="slider-container">
            <input type="range" id="tps-slider" min="0" max="100" step="1" value="0">
            <div class="slider-ticks">
              <span>0% (Idle)</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100% (WOT)</span>
            </div>
          </div>
        </div>

        <!-- QUICK PRESETS CARD -->
        <div class="settings-card">
          <div class="card-header-simple">
            <span class="card-title">${i18n.t('ui.presets')}</span>
          </div>
          <div class="presets-grid">
            <button class="preset-badge" data-value="0">
              <span class="preset-name">0%</span>
              <span class="preset-val">Closed</span>
            </button>
            <button class="preset-badge" data-value="25">
              <span class="preset-name">25%</span>
              <span class="preset-val">Low</span>
            </button>
            <button class="preset-badge" data-value="50">
              <span class="preset-name">50%</span>
              <span class="preset-val">Half</span>
            </button>
            <button class="preset-badge" data-value="75">
              <span class="preset-name">75%</span>
              <span class="preset-val">High</span>
            </button>
            <button class="preset-badge" data-value="100">
              <span class="preset-name">100%</span>
              <span class="preset-val">WOT</span>
            </button>
          </div>
        </div>

        <!-- LIVE TELEMETRY CARD -->
        <div class="settings-card">
          <div class="live-status-container">
            <span class="live-status-title">Live Throttle Position</span>
            <div class="live-status-details">
              <span class="live-status-value" id="tps-live-value">0.0</span>
              <span class="live-status-unit">%</span>
            </div>
          </div>
        </div>

      </div>
    `;
  }

  /**
   * Sync UI elements with current Store values
   * @private
   */
  _syncState() {
    const overrideActive = this.data.tpsOverrideActive ?? false;
    const overrideVal = this.data.tpsOverrideValue ?? 0.0;
    
    const toggle = this.el.querySelector('#tps-override-toggle');
    const slider = this.el.querySelector('#tps-slider');
    const liveVal = this.el.querySelector('#tps-live-value');

    if (toggle) toggle.checked = overrideActive;
    if (slider) {
      slider.value = overrideVal;
      this._updateSliderLabel(overrideVal);
    }
    if (liveVal) {
      liveVal.textContent = Number(this.data.tps || 0).toFixed(1);
    }

    this._updateUIState(overrideActive);
  }

  /**
   * Enable/disable slider card styling based on override active state
   * @private
   */
  _updateUIState(active) {
    const card = this.el.querySelector('#tps-slider-card');
    const slider = this.el.querySelector('#tps-slider');
    
    if (card) {
      if (active) card.classList.remove('disabled');
      else card.classList.add('disabled');
    }

    if (slider) {
      slider.disabled = !active;
    }
  }

  /**
   * Update the numerical value label above the slider
   * @private
   */
  _updateSliderLabel(val) {
    const label = this.el.querySelector('#tps-slider-value');
    if (label) {
      label.textContent = Number(val).toFixed(1);
    }
  }

  /**
   * Check if user is currently moving the slider to avoid fighting updates
   * @private
   */
  _isUserInteractingWithSlider() {
    const slider = this.el.querySelector('#tps-slider');
    return slider && document.activeElement === slider;
  }

  onDestroy() {
    super.onDestroy();
    if (this.pageTopBar) {
      this.pageTopBar.destroy();
      this.pageTopBar = null;
    }
  }
}
