/**
 * RpmSettingsPage.js
 * ==================
 * Settings page for virtual RPM manual override controls.
 */

import { Page } from '../core/Page.js';
import { log } from '../utils/logger.js';
import { PageTopBar } from '../components/PageTopBar/PageTopBar.js';
import { CommandManager } from '../managers/commandManager.js';
import { i18n } from '../utils/i18n.js';

export class RpmSettingsPage extends Page {
  constructor(options = {}) {
    super({
      id: 'rpmSettingsPage',
      title: 'RPM Configuration',
      showBackButton: true,
      bindings: {
        rpm: 'telemetry.rpm',
        rpmOverrideActive: 'overrides.rpm.active',
        rpmOverrideValue: 'overrides.rpm.value'
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
        title: i18n.t('ui.rpmOverrideTitle')
      });
      this.pageTopBar.mount(topBarContainer);
    }

    return skeleton;
  }

  onBindEvents() {
    log.debug('RpmSettingsPage', 'onBindEvents');

    const toggle = this.el.querySelector('#rpm-override-toggle');
    const slider = this.el.querySelector('#rpm-slider');
    const presets = this.el.querySelectorAll('.preset-badge');

    if (toggle) {
      toggle.addEventListener('change', (e) => {
        const active = e.target.checked;
        CommandManager.toggleOverride('rpm', active);
        this._updateUIState(active);
      });
    }

    if (slider) {
      slider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        this._updateSliderLabel(val);
        CommandManager.setValue('rpm', val);
      });
    }

    presets.forEach(badge => {
      badge.addEventListener('click', () => {
        const val = parseInt(badge.getAttribute('data-value'));
        
        // Auto-enable override if clicking a preset
        if (toggle && !toggle.checked) {
          toggle.checked = true;
          CommandManager.toggleOverride('rpm', true);
          this._updateUIState(true);
        }

        if (slider) {
          slider.value = val;
        }
        this._updateSliderLabel(val);
        CommandManager.setValue('rpm', val);
      });
    });
  }

  onActivate() {
    super.onActivate();
    log.debug('RpmSettingsPage', 'Activated');
    this._syncState();
  }

  onDataChange(key, newValue) {
    if (!this.el) return;

    if (key === 'rpmOverrideActive') {
      const toggle = this.el.querySelector('#rpm-override-toggle');
      if (toggle) {
        toggle.checked = !!newValue;
      }
      this._updateUIState(!!newValue);
    } 
    else if (key === 'rpmOverrideValue') {
      const slider = this.el.querySelector('#rpm-slider');
      if (slider && !this._isUserInteractingWithSlider()) {
        slider.value = newValue;
        this._updateSliderLabel(newValue);
      }
    }
    else if (key === 'rpm') {
      const liveVal = this.el.querySelector('#rpm-live-value');
      if (liveVal) {
        liveVal.textContent = Math.round(newValue).toLocaleString();
      }
    }
  }

  renderContent() {
    return `
      <div id="page-top-bar-container"></div>

      <div class="settings-content">
        <div class="info-card">
          <p class="description">${i18n.t('ui.rpmOverrideDesc')}</p>
        </div>

        <!-- OVERRIDE TOGGLE CARD -->
        <div class="settings-card">
          <div class="toggle-container">
            <div class="toggle-details">
              <span class="toggle-title">${i18n.t('ui.overrideToggle')}</span>
              <span class="toggle-description">Bypasses the physical potentiometer TPS kinematics</span>
            </div>
            <label class="switch">
              <input type="checkbox" id="rpm-override-toggle">
              <span class="switch-slider"></span>
            </label>
          </div>
        </div>

        <!-- SLIDER CONTROL CARD -->
        <div class="settings-card slider-card disabled" id="rpm-slider-card">
          <div class="slider-header">
            <span class="slider-title">${i18n.t('ui.targetRpm')}</span>
            <span class="slider-value" id="rpm-slider-value">1,200</span>
            <span class="slider-unit">RPM</span>
          </div>
          <div class="slider-container">
            <input type="range" id="rpm-slider" min="0" max="18000" step="100" value="1200">
            <div class="slider-ticks">
              <span>0</span>
              <span>4.5k</span>
              <span>9k</span>
              <span>13.5k</span>
              <span>18k</span>
            </div>
          </div>
        </div>

        <!-- QUICK PRESETS CARD -->
        <div class="settings-card">
          <div class="card-header-simple">
            <span class="card-title">${i18n.t('ui.presets')}</span>
          </div>
          <div class="presets-grid">
            <button class="preset-badge" data-value="1200">
              <span class="preset-name">Idle</span>
              <span class="preset-val">1.2k RPM</span>
            </button>
            <button class="preset-badge" data-value="3000">
              <span class="preset-name">Cruising</span>
              <span class="preset-val">3k RPM</span>
            </button>
            <button class="preset-badge" data-value="6000">
              <span class="preset-name">High</span>
              <span class="preset-val">6k RPM</span>
            </button>
            <button class="preset-badge" data-value="12000">
              <span class="preset-name">Racing</span>
              <span class="preset-val">12k RPM</span>
            </button>
            <button class="preset-badge" data-value="18000">
              <span class="preset-name">Redline</span>
              <span class="preset-val">18k RPM</span>
            </button>
          </div>
        </div>

        <!-- LIVE TELEMETRY CARD -->
        <div class="settings-card">
          <div class="live-status-container">
            <span class="live-status-title">Live Engine Speed</span>
            <div class="live-status-details">
              <span class="live-status-value" id="rpm-live-value">0</span>
              <span class="live-status-unit">RPM</span>
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
    const overrideActive = this.data.rpmOverrideActive ?? false;
    const overrideVal = this.data.rpmOverrideValue ?? 1200;
    
    const toggle = this.el.querySelector('#rpm-override-toggle');
    const slider = this.el.querySelector('#rpm-slider');
    const liveVal = this.el.querySelector('#rpm-live-value');

    if (toggle) toggle.checked = overrideActive;
    if (slider) {
      slider.value = overrideVal;
      this._updateSliderLabel(overrideVal);
    }
    if (liveVal) {
      liveVal.textContent = Math.round(this.data.rpm || 0).toLocaleString();
    }

    this._updateUIState(overrideActive);
  }

  /**
   * Enable/disable slider card styling based on override active state
   * @private
   */
  _updateUIState(active) {
    const card = this.el.querySelector('#rpm-slider-card');
    const slider = this.el.querySelector('#rpm-slider');
    
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
    const label = this.el.querySelector('#rpm-slider-value');
    if (label) {
      label.textContent = Math.round(val).toLocaleString();
    }
  }

  /**
   * Check if user is currently moving the slider to avoid fighting updates
   * @private
   */
  _isUserInteractingWithSlider() {
    const slider = this.el.querySelector('#rpm-slider');
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
