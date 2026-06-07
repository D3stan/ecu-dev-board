/**
 * WifiConnectInlineForm.js
 * =========================
 * Inline password form rendered below an expanded network row.
 * Extends Component for lifecycle + event cleanup.
 *
 * Props expected:
 *   network   – { ssid, channel, bssid }
 *   disabled  – boolean (connecting state)
 *   onConnect – callback({ ssid, psw, channel, bssid })
 *
 * @author FogExtra Team
 * @version 1.0.0
 */

import { Component } from '../../core/Component.js';
import { i18n } from '../../utils/i18n.js';
import { log } from '../../utils/logger.js';

export class WifiConnectInlineForm extends Component {

  constructor(options = {}) {
    super({ id: `wifi-inline-form-${Date.now()}`, ...options });

    this.network = options.props?.network || {};
    this.disabled = options.props?.disabled || false;
    this.onConnectCallback = options.props?.onConnect || (() => {});
    this._passwordVisible = false;

    this.enableI18n(() => this._updateLabels());
  }

  // ---- render ----
  render() {
    this.el = document.createElement('div');
    this.el.className = 'wifi-inline-form';
    this.el.innerHTML = this._html();
    return this.el;
  }

  _html() {
    return `
      <label class="wifi-inline-form__label">${i18n.t('wifi.form.passwordRequired')}</label>
      <div class="wifi-inline-form__input-wrap">
        <input
          class="wifi-inline-form__input"
          type="password"
          placeholder=""
          autocomplete="off"
        />
        <button
          class="wifi-inline-form__toggle-vis"
          type="button"
          aria-label="${i18n.t('wifi.form.showPassword')}"
        >
          <span class="wifi-icon-eye"></span>
        </button>
      </div>
      <div class="wifi-inline-form__actions">
        <button class="wifi-inline-form__connect-btn" ${this.disabled ? 'disabled' : ''}>
          ${i18n.t('wifi.form.connect')}
        </button>
      </div>
    `;
  }

  // ---- lifecycle ----
  onMount() {
    super.onMount();
    this._cacheRefs();
  }

  onBindEvents() {
    if (this._toggleBtn) {
      this.addEventListener(this._toggleBtn, 'click', this._onToggleVisibility.bind(this));
    }
    if (this._connectBtn) {
      this.addEventListener(this._connectBtn, 'click', this._onConnect.bind(this));
    }
    // Allow Enter key in input
    if (this._input) {
      this.addEventListener(this._input, 'keydown', (e) => {
        if (e.key === 'Enter') this._onConnect();
      });
    }
  }

  _cacheRefs() {
    this._input = this.$('.wifi-inline-form__input');
    this._toggleBtn = this.$('.wifi-inline-form__toggle-vis');
    this._connectBtn = this.$('.wifi-inline-form__connect-btn');
    this._label = this.$('.wifi-inline-form__label');
    this._eyeSpan = this.$('.wifi-icon-eye');
  }

  // ---- actions ----
  _onToggleVisibility() {
    this._passwordVisible = !this._passwordVisible;
    log.debug('WifiConnectionCard', `password visibility toggled: visible=${this._passwordVisible}`);

    if (this._input) {
      this._input.type = this._passwordVisible ? 'text' : 'password';
    }
    if (this._toggleBtn) {
      this._toggleBtn.setAttribute(
        'aria-label',
        this._passwordVisible ? i18n.t('wifi.form.hidePassword') : i18n.t('wifi.form.showPassword')
      );
    }
    if (this._eyeSpan) {
      this._eyeSpan.classList.toggle('wifi-icon-eye--visible', this._passwordVisible);
    }
  }

  _onConnect() {
    if (this.disabled) {
      log.debug('WifiConnectionCard', 'connect ignored: status=connecting');
      return;
    }
    const psw = this._input ? this._input.value : '';
    const { ssid, channel, bssid } = this.network;
    log.debug('WifiConnectionCard', `connect clicked: ssid="${ssid}", channel=${channel}, bssid="${bssid}"`);
    this.onConnectCallback({ ssid, psw, channel, bssid });
  }

  // ---- public ----
  setDisabled(flag) {
    this.disabled = flag;
    if (this._connectBtn) {
      this._connectBtn.disabled = flag;
    }
  }

  focus() {
    if (this._input) {
      setTimeout(() => this._input.focus(), 50);
    }
  }

  // ---- i18n ----
  _updateLabels() {
    if (this._label) this._label.textContent = i18n.t('wifi.form.passwordRequired');
    if (this._connectBtn) this._connectBtn.textContent = i18n.t('wifi.form.connect');
    if (this._toggleBtn) {
      this._toggleBtn.setAttribute(
        'aria-label',
        this._passwordVisible ? i18n.t('wifi.form.hidePassword') : i18n.t('wifi.form.showPassword')
      );
    }
  }
}
