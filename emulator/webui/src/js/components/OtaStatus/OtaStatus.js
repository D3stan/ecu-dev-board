/**
 * OtaStatus.js
 * =============
 * OTA (Over-The-Air) firmware update status display.
 *
 * Structure:
 *   div.ota-status
 *     div.ota-status__current    → current firmware version
 *     button.ota-status__check   → "Check for Updates"
 *     div.ota-status__available  → shown when update is available
 *       span.ota-status__new-ver → new version string
 *       button.ota-status__apply → "Apply Update"
 *
 * Subscribes to:
 *   - ota.available      → boolean
 *   - ota.newVersion     → version string
 *   - ota.progress       → progress percentage (0-100)
 *   - ota.status         → 'idle' | 'checking' | 'downloading' | 'done' | 'error'
 *   - config.firmwareVersion → current firmware version
 *
 * @author ECU Dev Board
 * @version 1.0.0
 */

import { Component } from '../../core/Component.js';
import { Store } from '../../core/store.js';
import { CommandManager } from '../../managers/commandManager.js';

export class OtaStatus extends Component {
  constructor(options = {}) {
    super(options);

    this._currentVersion = '---';
    this._otaAvailable = false;
    this._newVersion = '';
    this._otaStatus = 'idle';
    this._otaProgress = 0;
  }

  // ── Rendering ──────────────────────────────────────────

  render() {
    const el = document.createElement('div');
    el.className = 'ota-status';

    el.innerHTML = `
      <div class="ota-status__current">
        <span class="ota-status__label">Firmware</span>
        <span class="ota-status__version">---</span>
      </div>
      <button type="button" class="ota-status__check">🔍 Check for Updates</button>
      <div class="ota-status__available" style="display: none;">
        <div class="ota-status__update-info">
          <span>Update available: </span>
          <span class="ota-status__new-ver"></span>
        </div>
        <div class="ota-status__progress-wrap" style="display: none;">
          <div class="ota-status__progress-bar">
            <div class="ota-status__progress-fill"></div>
          </div>
          <span class="ota-status__progress-text">0%</span>
        </div>
        <button type="button" class="ota-status__apply">⬆ Apply Update</button>
      </div>
      <div class="ota-status__message"></div>
    `;

    this.el = el;
    return el;
  }

  // ── Event binding ──────────────────────────────────────

  onBindEvents() {
    if (!this.el) return;

    // Check button
    const checkBtn = this.$('.ota-status__check');
    if (checkBtn) {
      this.addEventListener(checkBtn, 'click', () => {
        this._handleCheck();
      });
    }

    // Apply button
    const applyBtn = this.$('.ota-status__apply');
    if (applyBtn) {
      this.addEventListener(applyBtn, 'click', () => {
        this._handleApply();
      });
    }
  }

  // ── Lifecycle ──────────────────────────────────────────

  onActivate() {
    // Current firmware version
    this.subscribeToStore('config.firmwareVersion', (version) => {
      this._currentVersion = version || '---';
      this._updateDisplay();
    });

    // OTA availability
    this.subscribeToStore('ota.available', (available) => {
      this._otaAvailable = !!available;
      this._updateDisplay();
    });

    // New version string
    this.subscribeToStore('ota.newVersion', (ver) => {
      this._newVersion = ver || '';
      this._updateDisplay();
    });

    // OTA status
    this.subscribeToStore('ota.status', (status) => {
      this._otaStatus = status || 'idle';
      this._updateDisplay();
    });

    // OTA progress
    this.subscribeToStore('ota.progress', (progress) => {
      this._otaProgress = typeof progress === 'number' ? progress : 0;
      this._updateDisplay();
    });
  }

  // ── Display update ─────────────────────────────────────

  /**
   * Update all DOM elements from internal state.
   * @private
   */
  _updateDisplay() {
    if (!this.el) return;

    // Current version
    const versionEl = this.$('.ota-status__version');
    if (versionEl) versionEl.textContent = this._currentVersion;

    // Available section visibility
    const availableEl = this.$('.ota-status__available');
    if (availableEl) {
      availableEl.style.display = this._otaAvailable ? '' : 'none';
    }

    // New version
    const newVerEl = this.$('.ota-status__new-ver');
    if (newVerEl) newVerEl.textContent = this._newVersion;

    // Progress
    const isDownloading = this._otaStatus === 'downloading';
    const progressWrap = this.$('.ota-status__progress-wrap');
    if (progressWrap) {
      progressWrap.style.display = isDownloading ? '' : 'none';
    }

    const progressFill = this.$('.ota-status__progress-fill');
    if (progressFill) {
      progressFill.style.width = `${Math.min(100, this._otaProgress)}%`;
    }

    const progressText = this.$('.ota-status__progress-text');
    if (progressText) {
      progressText.textContent = `${Math.round(this._otaProgress)}%`;
    }

    // Check button state
    const checkBtn = this.$('.ota-status__check');
    if (checkBtn) {
      const isChecking = this._otaStatus === 'checking';
      checkBtn.disabled = isChecking || isDownloading;
      checkBtn.textContent = isChecking ? '⏳ Checking…' : '🔍 Check for Updates';
    }

    // Apply button state
    const applyBtn = this.$('.ota-status__apply');
    if (applyBtn) {
      applyBtn.disabled = isDownloading;
      applyBtn.textContent = isDownloading ? '⏳ Updating…' : '⬆ Apply Update';
    }

    // Status message
    const msgEl = this.$('.ota-status__message');
    if (msgEl) {
      if (this._otaStatus === 'error') {
        msgEl.textContent = '❌ Update failed. Please retry.';
        msgEl.className = 'ota-status__message ota-status__message--error';
      } else if (this._otaStatus === 'done') {
        msgEl.textContent = '✅ Update complete. Restarting…';
        msgEl.className = 'ota-status__message ota-status__message--success';
      } else {
        msgEl.textContent = '';
        msgEl.className = 'ota-status__message';
      }
    }
  }

  // ── Command handlers ───────────────────────────────────

  /** @private */
  _handleCheck() {
    CommandManager.send('OTA_CHECK');
  }

  /** @private */
  _handleApply() {
    CommandManager.send('OTA_APPLY');
  }
}

export default OtaStatus;
