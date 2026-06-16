/**
 * EgtSettingsPage.js
 * ==================
 * Settings page for Exhaust Gas Temperature (EGT) manual overrides and faults.
 */

import { Page } from '../core/Page.js';
import { log } from '../utils/logger.js';
import { PageTopBar } from '../components/PageTopBar/PageTopBar.js';
import { CommandManager } from '../managers/commandManager.js';
import { i18n } from '../utils/i18n.js';

export class EgtSettingsPage extends Page {
  constructor(options = {}) {
    super({
      id: 'egtSettingsPage',
      title: 'EGT Configuration',
      showBackButton: true,
      bindings: {
        egt: 'telemetry.egt',
        egtOverrideActive: 'overrides.egt.active',
        egtOverrideValue: 'overrides.egt.value',
        egtFaultActive: 'overrides.egt_fault.active'
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
        title: i18n.t('ui.egtOverrideTitle')
      });
      this.pageTopBar.mount(topBarContainer);
    }

    return skeleton;
  }

  onBindEvents() {
    log.debug('EgtSettingsPage', 'onBindEvents');

    const toggle = this.el.querySelector('#egt-override-toggle');
    const slider = this.el.querySelector('#egt-slider');
    const presets = this.el.querySelectorAll('.preset-badge');
    const faultToggle = this.el.querySelector('#egt-fault-toggle');

    if (toggle) {
      toggle.addEventListener('change', (e) => {
        const active = e.target.checked;
        CommandManager.toggleOverride('egt', active);
        this._updateUIState(active);
        
        // Turn off fault if override is enabled to prevent conflict
        if (active && faultToggle && faultToggle.checked) {
          faultToggle.checked = false;
          CommandManager.injectFault('egt_overheat', false);
        }
      });
    }

    if (slider) {
      slider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this._updateSliderLabel(val);
        CommandManager.setValue('egt', val);
      });
    }

    presets.forEach(badge => {
      badge.addEventListener('click', () => {
        const val = parseFloat(badge.getAttribute('data-value'));
        
        // Auto-enable override if clicking a preset
        if (toggle && !toggle.checked) {
          toggle.checked = true;
          CommandManager.toggleOverride('egt', true);
          this._updateUIState(true);
          
          if (faultToggle && faultToggle.checked) {
            faultToggle.checked = false;
            CommandManager.injectFault('egt_overheat', false);
          }
        }

        if (slider) {
          slider.value = val;
        }
        this._updateSliderLabel(val);
        CommandManager.setValue('egt', val);
      });
    });

    if (faultToggle) {
      faultToggle.addEventListener('change', (e) => {
        const active = e.target.checked;
        CommandManager.injectFault('egt_overheat', active);
        
        // Turn off override if fault is enabled to let fault take precedence
        if (active && toggle && toggle.checked) {
          toggle.checked = false;
          CommandManager.toggleOverride('egt', false);
          this._updateUIState(false);
        }
      });
    }
  }

  onActivate() {
    super.onActivate();
    log.debug('EgtSettingsPage', 'Activated');
    this._syncState();
  }

  onDataChange(key, newValue) {
    if (!this.el) return;

    if (key === 'egtOverrideActive') {
      const toggle = this.el.querySelector('#egt-override-toggle');
      if (toggle) {
        toggle.checked = !!newValue;
      }
      this._updateUIState(!!newValue);
    } 
    else if (key === 'egtOverrideValue') {
      const slider = this.el.querySelector('#egt-slider');
      if (slider && !this._isUserInteractingWithSlider()) {
        slider.value = newValue;
        this._updateSliderLabel(newValue);
      }
    }
    else if (key === 'egtFaultActive') {
      const faultToggle = this.el.querySelector('#egt-fault-toggle');
      if (faultToggle) {
        faultToggle.checked = !!newValue;
      }
      const card = this.el.querySelector('#egt-fault-card');
      if (card) {
        if (newValue) card.classList.add('fault-active');
        else card.classList.remove('fault-active');
      }
    }
    else if (key === 'egt') {
      const liveVal = this.el.querySelector('#egt-live-value');
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
          <p class="description">${i18n.t('ui.egtOverrideDesc')}</p>
        </div>

        <!-- OVERRIDE TOGGLE CARD -->
        <div class="settings-card">
          <div class="toggle-container">
            <div class="toggle-details">
              <span class="toggle-title">${i18n.t('ui.overrideToggle')}</span>
              <span class="toggle-description">Bypasses thermodynamic model updates</span>
            </div>
            <label class="switch">
              <input type="checkbox" id="egt-override-toggle">
              <span class="switch-slider"></span>
            </label>
          </div>
        </div>

        <!-- SLIDER CONTROL CARD -->
        <div class="settings-card slider-card disabled" id="egt-slider-card">
          <div class="slider-header">
            <span class="slider-title">${i18n.t('ui.targetEgt')}</span>
            <span class="slider-value" id="egt-slider-value">20.0</span>
            <span class="slider-unit">°C</span>
          </div>
          <div class="slider-container">
            <input type="range" id="egt-slider" min="20" max="1000" step="10" value="20">
            <div class="slider-ticks">
              <span>20°C</span>
              <span>250°C</span>
              <span>500°C</span>
              <span>750°C</span>
              <span>1000°C</span>
            </div>
          </div>
        </div>

        <!-- QUICK PRESETS CARD -->
        <div class="settings-card">
          <div class="card-header-simple">
            <span class="card-title">${i18n.t('ui.presets')}</span>
          </div>
          <div class="presets-grid">
            <button class="preset-badge" data-value="20">
              <span class="preset-name">Ambient</span>
              <span class="preset-val">20°C</span>
            </button>
            <button class="preset-badge" data-value="200">
              <span class="preset-name">Warm</span>
              <span class="preset-val">200°C</span>
            </button>
            <button class="preset-badge" data-value="500">
              <span class="preset-name">Normal</span>
              <span class="preset-val">500°C</span>
            </button>
            <button class="preset-badge" data-value="750">
              <span class="preset-name">Hot</span>
              <span class="preset-val">750°C</span>
            </button>
            <button class="preset-badge" data-value="900">
              <span class="preset-name">Max</span>
              <span class="preset-val">900°C</span>
            </button>
          </div>
        </div>

        <!-- FAULT INJECTION CARD -->
        <div class="settings-card" id="egt-fault-card">
          <div class="toggle-container">
            <div class="toggle-details">
              <span class="toggle-title">${i18n.t('ui.injectFaultToggle')}</span>
              <span class="toggle-description">Rapidly ramps EGT above the ALARM threshold (850°C) to test fail-safes</span>
            </div>
            <label class="switch warning-switch">
              <input type="checkbox" id="egt-fault-toggle">
              <span class="switch-slider"></span>
            </label>
          </div>
        </div>

        <!-- LIVE TELEMETRY CARD -->
        <div class="settings-card">
          <div class="live-status-container">
            <span class="live-status-title">Live Exhaust Gas Temp</span>
            <div class="live-status-details">
              <span class="live-status-value" id="egt-live-value">20.0</span>
              <span class="live-status-unit">°C</span>
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
    const overrideActive = this.data.egtOverrideActive ?? false;
    const overrideVal = this.data.egtOverrideValue ?? 20.0;
    const faultActive = this.data.egtFaultActive ?? false;
    
    const toggle = this.el.querySelector('#egt-override-toggle');
    const slider = this.el.querySelector('#egt-slider');
    const faultToggle = this.el.querySelector('#egt-fault-toggle');
    const liveVal = this.el.querySelector('#egt-live-value');

    if (toggle) toggle.checked = overrideActive;
    if (slider) {
      slider.value = overrideVal;
      this._updateSliderLabel(overrideVal);
    }
    if (faultToggle) faultToggle.checked = faultActive;
    if (liveVal) {
      liveVal.textContent = Number(this.data.egt || 20.0).toFixed(1);
    }

    this._updateUIState(overrideActive);
    
    const card = this.el.querySelector('#egt-fault-card');
    if (card) {
      if (faultActive) card.classList.add('fault-active');
      else card.classList.remove('fault-active');
    }
  }

  /**
   * Enable/disable slider card styling based on override active state
   * @private
   */
  _updateUIState(active) {
    const card = this.el.querySelector('#egt-slider-card');
    const slider = this.el.querySelector('#egt-slider');
    
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
    const label = this.el.querySelector('#egt-slider-value');
    if (label) {
      label.textContent = Number(val).toFixed(1);
    }
  }

  /**
   * Check if user is currently moving the slider to avoid fighting updates
   * @private
   */
  _isUserInteractingWithSlider() {
    const slider = this.el.querySelector('#egt-slider');
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
