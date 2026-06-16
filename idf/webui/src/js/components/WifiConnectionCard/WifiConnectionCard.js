/**
 * WifiConnectionCard.js
 * ======================
 * Main Wi-Fi Connection Card component.
 *
 * Reactive to Store paths:
 *   - wifi.networks
 *   - wifi.connection.status
 *   - wifi.connection.connectedNetwork.*
 *   - wifi.connection.connectingNetwork.*
 *
 * Displays:
 *   1) Header with title + Scan button
 *   2) "Current Network" section
 *   3) "Available Networks" section (scrollable, accordion)
 *
 * Local UI state (not in Store):
 *   - expandedNetworkId (accordion)
 *   - password input / visibility
 *
 * @author FogExtra Team
 * @version 1.0.0
 */

import { Component } from '../../core/Component.js';
import { Store } from '../../core/store.js';
import { Paths } from '../../utils/paths.js';
import { wifiStatus, wifiOp, wifiError, ConnectionMode } from '../../utils/constants.js';
import { i18n } from '../../utils/i18n.js';
import { log } from '../../utils/logger.js';
import { CommandManager } from '../../managers/commandManager.js';
import { renderSignalBars } from './WifiSignalBars.js';
import { renderIcon, WIFI_OPEN_ICON, WIFI_LOCK_ICON, WIFI_OFF_ICON } from './wifiIcons.js';
import { WifiConnectInlineForm } from './WifiConnectInlineForm.js';

export class WifiConnectionCard extends Component {

  constructor(options = {}) {
    super({ id: 'wifi-connection-card', ...options });

    // Local UI state
    this._expandedNetworkId = null;
    this._inlineForm = null;
    this._connectingNetId = null;            // Which network is actively being connected to
    this._connectionAttemptInProgress = false; // Track if we're trying to connect
    // Copy IP UX state (must survive rerenders)
    this._copyIpFeedback = 'idle';
    this._copyIpFeedbackTimer = null;
    this._copyIpInFlight = false;

    // Cached store data
    this._status = wifiStatus.DISCONNECTED;
    this._networks = [];
    this._connectedSsid = '';
    this._connectedSignal = 0;
    this._staIp = ''; // IPv4 address when in STA mode
    this._operation = wifiOp.NONE;
    this._errorType = wifiError.OK;
    this._errorSeenByUser = true;
    this._connectionMode = ConnectionMode.UNKNOWN; // HELLO handshake mode (AP/STA/UNKNOWN)
    this._storeSubscriptionsReady = false;

    // Enable i18n
    this.enableI18n(() => this._refreshAll());

    log.debug('WifiConnectionCard', 'Created');
  }

  // ============================
  // RENDER
  // ============================

  render() {
    this.el = document.createElement('div');
    this.el.className = 'wifi-card';
    this.el.innerHTML = this._generateHTML();
    return this.el;
  }

  _generateHTML() {
    return `
      <!-- Header -->
      <div class="wifi-card__header">
        <h3 class="wifi-card__title">${i18n.t('wifi.card.title')}</h3>
        <button class="wifi-card__scan-btn" type="button">
          <span class="wifi-icon-refresh"></span>
          <span class="wifi-card__scan-label">${i18n.t('wifi.card.scan')}</span>
        </button>
      </div>

      <!-- Current Network -->
      <div class="wifi-card__section">
        <div class="wifi-card__section-title">${i18n.t('wifi.section.current')}</div>
        <div class="wifi-card__current-row" id="wifi-current-row"></div>
      </div>

      <!-- STA mode note (hidden by default, shown when connected via STA - below current network) -->
      <div class="wifi-card__sta-note" id="wifi-sta-note" style="display:none;">
        <span class="wifi-card__sta-note-text">${i18n.t('wifi.note.staMobile', { fallback: 'For WiFi network operations (scan, connect), connect to the device access point' })}</span>
      </div>

      <!-- Error Banner (hidden by default) -->
      <div class="wifi-error-alert" id="wifi-error-banner" style="display:none;">
        <span class="wifi-error-alert__icon"></span>
        <span class="wifi-error-alert__text" id="wifi-error-text"></span>
        <button class="wifi-error-alert__dismiss" id="wifi-error-dismiss" type="button" aria-label="Close error">
          <svg class="close_wifi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <!-- Scanning Banner (hidden by default) -->
      <div class="wifi-scanning-banner" id="wifi-scanning-banner" style="display:none;">
        <span class="wifi-scanning-banner__spinner"></span>
        <span class="wifi-scanning-banner__text" id="wifi-scanning-text">${i18n.t('wifi.state.scanning', { fallback: 'Scanning networks…' })}</span>
      </div>

      <!-- Available Networks (hidden in STA mode) -->
      <div class="wifi-card__section" id="wifi-available-section">
        <div class="wifi-card__section-title-row">
          <span class="wifi-card__section-title">${i18n.t('wifi.section.available')}</span>
          <span class="wifi-card__count" id="wifi-networks-count"></span>
        </div>
        <div class="wifi-card__available-list" id="wifi-available-list"></div>
      </div>
    `;
  }

  // ============================
  // LIFECYCLE
  // ============================

  onMount() {
    super.onMount();
    this._cacheRefs();
    this._ensureReactiveSetup();
    log.debug('WifiConnectionCard', 'Mounted');
  }

  onBindEvents() {
    if (this._scanBtn) {
      this.addEventListener(this._scanBtn, 'click', this._onScanClick.bind(this));
    }
    const dismissBtn = this.$('#wifi-error-dismiss');
    if (dismissBtn) {
      this.addEventListener(dismissBtn, 'click', () => {
        // Reset connection attempt flag when user dismisses error
        this._connectionAttemptInProgress = false;
        Store.set(Paths.WIFI.CONNECTION.ERROR_SEEN_BY_USER, true);
      });
    }
  }

  onActivate() {
    super.onActivate();

    // Keep compatibility when component lifecycle uses activate()
    this._ensureReactiveSetup();

    log.debug('WifiConnectionCard', 'Activated');
  }

  _ensureReactiveSetup() {
    if (this._storeSubscriptionsReady) {
      return;
    }

    this._storeSubscriptionsReady = true;

    // Read initial values from Store
    this._readInitialValues();

    // Subscribe to Store paths
    this.subscribeToStore(Paths.WIFI.CONNECTION.STATUS, (v) => {
      log.debug('WifiConnectionCard', `status changed: ${this._status} -> ${v}`);
      this._status = v;
      this._onStatusChange();
    });

    this.subscribeToStore(Paths.WIFI.NETWORKS, (v) => {
      log.debug('WifiConnectionCard', `networks updated: ${v?.length || 0} items`);
      this._networks = v || [];
      this._renderAvailableList();
      this._updateCount();
    });

    this.subscribeToStore(Paths.WIFI.CONNECTION.CONNECTED_SSID, (v) => {
      log.debug('WifiConnectionCard', `connected SSID changed: "${v}"`);
      this._connectedSsid = v || '';
      this._renderCurrentRow();
    });

    this.subscribeToStore(Paths.WIFI.CONNECTION.CONNECTED_SIGNAL, (v) => {
      log.debug('WifiConnectionCard', `connected signal changed: ${v}`);
      this._connectedSignal = v || 0;
      this._renderCurrentRow();
    });

    this.subscribeToStore(Paths.WIFI.STA_IP, (v) => {
      log.debug('WifiConnectionCard', `STA IP changed: "${v}"`);
      this._staIp = v || '';
      this._renderCurrentRow();
    });

    this.subscribeToStore(Paths.WIFI.CONNECTION.OPERATION, (v) => {
      log.debug('WifiConnectionCard', `operation changed: ${v}`);
      this._operation = v || wifiOp.NONE;
      
      // Track if we're attempting to connect
      if (this._operation === wifiOp.CONNECT) {
        log.debug('WifiConnectionCard', 'Connection attempt started - will show errors only for this attempt');
        this._connectionAttemptInProgress = true;
        Store.set(Paths.WIFI.CONNECTION.ERROR_SEEN_BY_USER, true);
      } else if (this._operation === wifiOp.NONE) {
        // Operation completed (success or failure) — remove per-row connecting highlight
        this._connectingNetId = null;
      }

      this._onStatusChange();
    });

    this.subscribeToStore(Paths.WIFI.CONNECTION.ERROR_TYPE, (v) => {
      log.debug('WifiConnectionCard', `error type changed: ${v}`);
      this._errorType = v || wifiError.OK;
      this._renderErrorBanner();
    });

    this.subscribeToStore(Paths.WIFI.CONNECTION.ERROR_SEEN_BY_USER, (v) => {
      log.debug('WifiConnectionCard', `error seen by user: ${v}`);
      this._errorSeenByUser = v !== false; // default true
      this._renderErrorBanner();
    });

    // Subscribe to connection mode (AP/STA/UNKNOWN) for UI gating
    this.subscribeToStore(Paths.WIFI.CONNECTION_MODE, (v) => {
      log.debug('WifiConnectionCard', `connectionMode changed: ${this._connectionMode} -> ${v}`);
      this._connectionMode = v || ConnectionMode.UNKNOWN;
      this._applyModeGating();
    });
  }

  onDeactivate() {
    super.onDeactivate();
    this._clearCopyIpFeedbackTimer();
    this._destroyInlineForm();
    log.debug('WifiConnectionCard', 'Deactivated');
  }

  onDestroy() {
    super.onDestroy();
    this._clearCopyIpFeedbackTimer();
    this._destroyInlineForm();
    log.debug('WifiConnectionCard', 'Destroyed');
  }

  // ============================
  // INITIAL READ
  // ============================

  _readInitialValues() {
    try {
      this._status = Store.get(Paths.WIFI.CONNECTION.STATUS) || wifiStatus.DISCONNECTED;
      this._networks = Store.get(Paths.WIFI.NETWORKS) || [];
      this._connectedSsid = Store.get(Paths.WIFI.CONNECTION.CONNECTED_SSID) || '';
      this._connectedSignal = Store.get(Paths.WIFI.CONNECTION.CONNECTED_SIGNAL) || 0;
      this._staIp = Store.get(Paths.WIFI.STA_IP) || '';
      this._operation = Store.get(Paths.WIFI.CONNECTION.OPERATION) || wifiOp.NONE;
      this._errorType = Store.get(Paths.WIFI.CONNECTION.ERROR_TYPE) || wifiError.OK;
      this._errorSeenByUser = Store.get(Paths.WIFI.CONNECTION.ERROR_SEEN_BY_USER) !== false;
      this._connectionMode = Store.get(Paths.WIFI.CONNECTION_MODE) || ConnectionMode.UNKNOWN;
    } catch (e) {
      log.warn('WifiConnectionCard', 'Error reading initial values', e);
    }

    // Render initial state
    this._renderCurrentRow();
    this._renderAvailableList();
    this._updateCount();
    this._applyDisabledState();
    this._applyModeGating();
    this._renderErrorBanner();
    this._renderScanningBanner();
  }

  // ============================
  // DOM REFS
  // ============================

  _cacheRefs() {
    this._scanBtn = this.$('.wifi-card__scan-btn');
    this._scanLabel = this.$('.wifi-card__scan-label');
    this._currentRowEl = this.$('#wifi-current-row');
    this._availableListEl = this.$('#wifi-available-list');
    this._availableSectionEl = this.$('#wifi-available-section');
    this._countEl = this.$('#wifi-networks-count');
    this._titleEl = this.$('.wifi-card__title');
    this._sectionTitles = this.$$('.wifi-card__section-title');
    this._errorBannerEl = this.$('#wifi-error-banner');
    this._errorTextEl = this.$('#wifi-error-text');
    this._scanningBannerEl = this.$('#wifi-scanning-banner');
    this._scanningTextEl = this.$('#wifi-scanning-text');
    this._staNoteEl = this.$('#wifi-sta-note');
  }

  // ============================
  // STATUS CHANGE
  // ============================

  _onStatusChange() {
    const isBusy = this._isBusy();

    // Force close accordion when busy (connecting/scanning)
    if (isBusy && this._expandedNetworkId !== null) {
      log.debug('WifiConnectionCard', `collapse forced: busy, was expanded=${this._expandedNetworkId}`);
      this._expandedNetworkId = null;
      this._destroyInlineForm();
    }

    this._applyDisabledState();
    this._renderCurrentRow();
    this._renderAvailableList();
    this._updateScanButton();
    this._renderScanningBanner();
  }

  /**
   * Returns true if the Wi-Fi subsystem is busy (connecting or scanning).
   * Uses operation field from WIFI snapshot for fine-grained detection.
   */
  _isBusy() {
    return this._operation === wifiOp.SCAN || this._operation === wifiOp.CONNECT
      || this._status === wifiStatus.CONNECTING || this._status === wifiStatus.SCANNING;
  }

  /**
   * Returns true if the client is connected via AP (WiFi config allowed).
   * UNKNOWN defaults to false (safe: no config until HELLO arrives).
   */
  _isApMode() {
    return this._connectionMode === ConnectionMode.AP;
  }

  /**
   * Apply mode gating: hide scan button and available section when in STA mode.
   * Shows STA mode note below current network.
   */
  _applyModeGating() {
    const isAp = this._isApMode();

    // Show/hide STA mode note (below current network in STA mode)
    if (this._staNoteEl) {
      this._staNoteEl.style.display = isAp ? 'none' : '';
    }

    // Hide scan button in STA mode
    if (this._scanBtn) {
      this._scanBtn.style.display = isAp ? '' : 'none';
    }

    // Hide entire "Available Networks" section in STA mode
    if (this._availableSectionEl) {
      this._availableSectionEl.style.display = isAp ? '' : 'none';
    }

    // Disable available list interactions when not AP (for safety, even if hidden)
    if (this._availableListEl) {
      this._availableListEl.classList.toggle('wifi-card__available-list--disabled', !isAp);
    }
  }

  _applyDisabledState() {
    if (!this.el) return;
    const isConnecting = this._operation === wifiOp.CONNECT || this._status === wifiStatus.CONNECTING;
    const isScanning   = this._operation === wifiOp.SCAN   || this._status === wifiStatus.SCANNING;
    // Full visual disable (opacity + no clicks) only while scanning
    this.el.classList.toggle('wifi-card--disabled', isScanning && !isConnecting);
    // While connecting: block clicks but no card-level opacity — per-row classes handle visuals
    this.el.classList.toggle('wifi-card--connecting', isConnecting);
    this._updateScanButton();
  }

  _updateScanButton() {
    if (!this._scanBtn) return;
    this._scanBtn.disabled = this._isBusy() || !this._isApMode();
  }

  // ============================
  // CURRENT NETWORK
  // ============================

  _renderCurrentRow() {
    if (!this._currentRowEl) return;

    const isConnected = this._status === wifiStatus.CONNECTED;

    // Keep feedback only while button can exist (connected + STA IP)
    if (!isConnected || !this._staIp) {
      this._clearCopyIpFeedbackTimer();
      this._copyIpFeedback = 'idle';
      this._copyIpInFlight = false;
    }

    if (isConnected) {
      const ssid = this._connectedSsid || i18n.t('wifi.label.unknownNetwork');
      const ipSection = this._staIp ? `
        <div class="wifi-current__divider"></div>
        <div class="wifi-current__ip-section">
          <div class="wifi-current__ip-info">
            <span class="wifi-current__ip-label">${i18n.t('wifi.label.ipAddress', { fallback: 'IPv4 della rete' })}</span>
            <span class="wifi-current__ip-value">${this._escapeHtml(this._staIp)}</span>
          </div>
          <button class="wifi-current__ip-copy-btn ${this._getCopyIpButtonStateClass()}" type="button" title="${this._escapeHtml(this._getCopyIpTitle())}" ${this._copyIpInFlight ? 'disabled' : ''}>
            <span class="wifi-icon-copy"></span>
            <span class="wifi-current__ip-copy-label">${this._escapeHtml(this._getCopyIpLabel())}</span>
          </button>
        </div>
      ` : '';

      this._currentRowEl.innerHTML = `
        <div class="wifi-current wifi-current--connected">
          <div class="wifi-current__main-row">
            <div class="wifi-current__left">
              <div class="wifi-current__icon wifi-current__icon--connected">
                ${renderIcon(WIFI_OPEN_ICON, 'Wi-Fi', 'wifi-icon--current')}
              </div>
              <div class="wifi-current__info">
                <div class="wifi-current__ssid">${this._escapeHtml(ssid)}</div>
                <span class="wifi-badge wifi-badge--connected">${i18n.t('wifi.badge.connected')}</span>
              </div>
            </div>
            <div class="wifi-current__right">
              ${renderSignalBars(this._connectedSignal, 'green')}
            </div>
          </div>
          ${ipSection}
        </div>
      `;

      // Current row subtree recreated: rescan deferred image bridge
      this.refreshDeferredImages();

      // Attach copy button handler
      if (this._staIp) {
        const copyBtn = this._currentRowEl.querySelector('.wifi-current__ip-copy-btn');
        if (copyBtn) {
          this.addEventListener(copyBtn, 'click', this._onCopyIpClick.bind(this));
        }
      }

      this._applyCopyIpFeedbackToDom();
    } else {
      this._currentRowEl.innerHTML = `
        <div class="wifi-current wifi-current--disconnected">
          <div class="wifi-current__left">
            <div class="wifi-current__icon wifi-current__icon--disconnected">
              ${renderIcon(WIFI_OFF_ICON, 'Wi-Fi off', 'wifi-icon--off')}
            </div>
            <div class="wifi-current__info">
              <div class="wifi-current__ssid wifi-current__ssid--muted">${i18n.t('wifi.label.noNetwork')}</div>
              <span class="wifi-badge wifi-badge--disconnected">${i18n.t('wifi.badge.disconnected')}</span>
            </div>
          </div>
        </div>
      `;

      // Current row subtree recreated: rescan deferred image bridge
      this.refreshDeferredImages();
    }
  }

  // Multi-level copy strategy:
  // A) Clipboard API in secure context
  // B) textarea + execCommand fallback (HTTP/mobile friendly)
  // C) Visible error feedback + best-effort manual text selection
  async _onCopyIpClick() {
    const text = this._staIp;

    if (!text) {
      log.warn('WifiConnectionCard', 'Copy IP requested but no STA IP is available');
      this._showCopyIpFeedback('error');
      return;
    }

    // Guard against rapid multi-click race conditions
    if (this._copyIpInFlight) {
      log.debug('WifiConnectionCard', 'Copy IP ignored: copy already in progress');
      return;
    }

    this._copyIpInFlight = true;
    this._showCopyIpFeedback('copying');

    try {
      const copied = await this._copyTextToClipboard(text);
      if (copied) {
        this._showCopyIpFeedback('success');
      } else {
        this._showCopyIpFeedback('error');
        this._selectIpTextIfPossible();
      }
    } catch (err) {
      log.warn('WifiConnectionCard', 'Unexpected copy failure', err);
      this._showCopyIpFeedback('error');
      this._selectIpTextIfPossible();
    } finally {
      this._copyIpInFlight = false;
      this._applyCopyIpFeedbackToDom();
    }
  }

  async _copyTextToClipboard(text) {
    const canUseClipboardApi = typeof navigator !== 'undefined'
      && !!navigator.clipboard
      && typeof navigator.clipboard.writeText === 'function'
      && typeof window !== 'undefined'
      && window.isSecureContext === true;

    if (canUseClipboardApi) {
      try {
        await navigator.clipboard.writeText(text);
        log.debug('WifiConnectionCard', 'Copy IP success via Clipboard API');
        return true;
      } catch (err) {
        log.warn('WifiConnectionCard', 'Clipboard API copy failed, falling back', err);
      }
    }

    return this._fallbackCopyText(text);
  }

  _fallbackCopyText(text) {
    if (typeof document === 'undefined' || !document.body) {
      log.warn('WifiConnectionCard', 'Fallback copy failed: document body not available');
      return false;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'readonly');
    textarea.setAttribute('aria-hidden', 'true');
    textarea.style.position = 'fixed';
    textarea.style.top = '-1000px';
    textarea.style.left = '-1000px';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';

    document.body.appendChild(textarea);

    let copied = false;
    try {
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, text.length);

      if (typeof document.execCommand === 'function') {
        copied = document.execCommand('copy') === true;
      }
    } catch (err) {
      log.warn('WifiConnectionCard', 'Fallback copy failed', err);
      copied = false;
    } finally {
      textarea.remove();
    }

    if (copied) {
      log.debug('WifiConnectionCard', 'Copy IP success via fallback execCommand');
    } else {
      log.warn('WifiConnectionCard', 'Fallback execCommand copy failed');
    }

    return copied;
  }

  _showCopyIpFeedback(state) {
    this._copyIpFeedback = state;

    // Only success/error auto-reset to idle
    this._clearCopyIpFeedbackTimer();
    if (state === 'success' || state === 'error') {
      this._copyIpFeedbackTimer = setTimeout(() => {
        this._copyIpFeedback = 'idle';
        this._copyIpFeedbackTimer = null;
        this._applyCopyIpFeedbackToDom();
      }, 1800);
    }

    this._applyCopyIpFeedbackToDom();
  }

  _clearCopyIpFeedbackTimer() {
    if (this._copyIpFeedbackTimer) {
      clearTimeout(this._copyIpFeedbackTimer);
      this._copyIpFeedbackTimer = null;
    }
  }

  _getCopyIpLabel() {
    switch (this._copyIpFeedback) {
      case 'success':
        return i18n.t('wifi.label.copiedIp', { fallback: 'Copiato!' });
      case 'error':
        return i18n.t('wifi.label.copyIpFailed', { fallback: 'Copia fallita' });
      case 'copying':
        return i18n.t('wifi.label.copyingIp', { fallback: 'Copio…' });
      case 'idle':
      default:
        return i18n.t('wifi.label.copyIp', { fallback: 'Copia IP' });
    }
  }

  _getCopyIpTitle() {
    switch (this._copyIpFeedback) {
      case 'success':
        return i18n.t('wifi.label.copiedIpTitle', { fallback: 'Copiato!' });
      case 'error':
        return i18n.t('wifi.label.copyIpFailedTitle', { fallback: 'Copia fallita' });
      case 'copying':
        return i18n.t('wifi.label.copyingIpTitle', { fallback: 'Copio…' });
      case 'idle':
      default:
        return i18n.t('wifi.label.copyIpTitle', { fallback: 'Copia IP' });
    }
  }

  _getCopyIpButtonStateClass() {
    switch (this._copyIpFeedback) {
      case 'copying':
        return 'is-copying';
      case 'success':
        return 'is-success';
      case 'error':
        return 'is-error';
      case 'idle':
      default:
        return 'is-idle';
    }
  }

  // Keep visual feedback aligned after state changes / rerenders
  _applyCopyIpStateClasses(btnEl) {
    if (!btnEl) return;
    btnEl.classList.remove('is-idle', 'is-copying', 'is-success', 'is-error');
    btnEl.classList.add(this._getCopyIpButtonStateClass());
    btnEl.title = this._getCopyIpTitle();
  }

  _applyCopyIpFeedbackToDom() {
    const label = this._getCopyIpLabel();
    const isDisabled = this._copyIpInFlight;

    const currentLabelEl = this._currentRowEl?.querySelector('.wifi-current__ip-copy-label');
    if (currentLabelEl) {
      currentLabelEl.textContent = label;
    }
    const currentBtnEl = this._currentRowEl?.querySelector('.wifi-current__ip-copy-btn');
    if (currentBtnEl) {
      currentBtnEl.disabled = isDisabled;
      this._applyCopyIpStateClasses(currentBtnEl);
    }
  }

  _selectIpTextIfPossible() {
    try {
      const ipValueEl = this._currentRowEl?.querySelector('.wifi-current__ip-value');
      if (!ipValueEl) return;

      const selection = window.getSelection ? window.getSelection() : null;
      if (!selection || !document.createRange) return;

      const range = document.createRange();
      range.selectNodeContents(ipValueEl);
      selection.removeAllRanges();
      selection.addRange(range);
    } catch (err) {
      log.debug('WifiConnectionCard', 'Manual IP text selection unavailable', err);
    }
  }

  // ============================
  // AVAILABLE NETWORKS LIST
  // ============================

  _renderAvailableList() {
    if (!this._availableListEl) return;

    // Destroy previous inline form
    this._destroyInlineForm();

    const busy = this._isBusy();
    const isConnecting = this._operation === wifiOp.CONNECT || this._status === wifiStatus.CONNECTING;

    let html = '';
    for (const net of this._networks) {
      const isActiveConnecting = isConnecting && this._connectingNetId !== null && net.id === this._connectingNetId;
      const isDimmed           = isConnecting && this._connectingNetId !== null && net.id !== this._connectingNetId;
      html += this._renderNetworkRow(net, isActiveConnecting, isDimmed);
    }

    this._availableListEl.innerHTML = html;

    // Available list subtree recreated: rescan deferred image bridge
    this.refreshDeferredImages();

    // Re-attach click handlers (only on main area, not on form)
    const rows = this._availableListEl.querySelectorAll('.wifi-net-row');
    rows.forEach((rowEl) => {
      const netId = rowEl.dataset.netId;
      const mainArea = rowEl.querySelector('.wifi-net-row__main');
      if (mainArea) {
        this.addEventListener(mainArea, 'click', () => this._onNetworkRowClick(netId));
      }
    });

    // If a row is expanded, mount inline form
    if (this._expandedNetworkId !== null && !busy) {
      this._mountInlineFormForExpanded();
    }
  }

  _renderNetworkRow(net, isActiveConnecting = false, isDimmed = false) {
    const isExpanded = this._expandedNetworkId === net.id;
    const icon = net.isOpen ? WIFI_OPEN_ICON : WIFI_LOCK_ICON;
    const chevronClass = isExpanded ? 'wifi-icon-chevron--open' : '';

    let badgeHtml = '';
    if (net.isKnown) {
      badgeHtml = `<span class="wifi-badge wifi-badge--saved">${i18n.t('wifi.badge.saved')}</span>`;
    } else if (net.isOpen) {
      badgeHtml = `<span class="wifi-badge wifi-badge--open">${i18n.t('wifi.label.open')}</span>`;
    }

    // Build row CSS class
    let rowClasses = 'wifi-net-row';
    if (isActiveConnecting) {
      rowClasses += ' wifi-net-row--active-connecting';
    } else if (isDimmed) {
      rowClasses += ' wifi-net-row--dimmed';
    } else if (isExpanded) {
      rowClasses += ' wifi-net-row--expanded';
    }

    // Right side: ring spinner for the connecting network, signal+chevron otherwise
    const rightHtml = isActiveConnecting
      ? `${renderSignalBars(net.signalLevel, 'blue')}<span class="wifi-icon-connecting-spinner"></span>`
      : `${renderSignalBars(net.signalLevel, '')}<span class="wifi-icon-chevron ${chevronClass}"></span>`;

    return `
      <div class="${rowClasses}" data-net-id="${this._escapeAttr(net.id)}">
        <div class="wifi-net-row__main">
          <div class="wifi-net-row__left">
            <div class="wifi-net-row__icon">
              ${renderIcon(icon, net.isOpen ? 'Open' : 'Secured')}
            </div>
            <div class="wifi-net-row__info">
              <span class="wifi-net-row__ssid">${this._escapeHtml(net.ssid)}</span>
              ${badgeHtml}
            </div>
          </div>
          <div class="wifi-net-row__right">
            ${rightHtml}
          </div>
        </div>
        ${isExpanded && !isActiveConnecting ? '<div class="wifi-net-row__form-slot" id="wifi-inline-form-slot"></div>' : ''}
      </div>
    `;
  }

  _updateCount() {
    if (!this._countEl) return;
    const count = this._networks.length;
    this._countEl.textContent = i18n.t('wifi.section.foundCount', { count });
  }

  // ============================
  // ACCORDION LOGIC
  // ============================

  _onNetworkRowClick(netId) {
    const busy = this._isBusy();

    const network = this._networks.find(n => n.id === netId);
    if (!network) return;

    log.debug('WifiConnectionCard', `network clicked: id="${netId}", ssid="${network.ssid}", isOpen=${network.isOpen}, isKnown=${network.isKnown}`);

    // Block all interactions while busy or not in AP mode
    if (busy || !this._isApMode()) {
      log.debug('WifiConnectionCard', 'click ignored: wifi busy or not AP mode');
      return;
    }

    // Open or Known → connect immediately, no dropdown
    if (network.isOpen || network.isKnown) {
      log.debug('WifiConnectionCard', `auto-connect: ssid="${network.ssid}", channel=${network.channel}, bssid="${network.bssid}"`);
      // Show connecting state immediately for this specific row
      this._connectingNetId = netId;
      this._expandedNetworkId = null;
      this._renderAvailableList();
      CommandManager.sendWifiConnect({
        ssid: network.ssid,
        psw: '',
        channel: network.channel,
        bssid: network.bssid
      });
      return;
    }

    // Protected + not known → toggle accordion
    if (this._expandedNetworkId === netId) {
      // Close
      log.debug('WifiConnectionCard', `collapse network: id="${netId}"`);
      this._expandedNetworkId = null;
    } else {
      // Open this, close others
      log.debug('WifiConnectionCard', `expand network: id="${netId}"`);
      this._expandedNetworkId = netId;
    }

    this._renderAvailableList();
  }

  // ============================
  // INLINE FORM
  // ============================

  _mountInlineFormForExpanded() {
    const network = this._networks.find(n => n.id === this._expandedNetworkId);
    if (!network) return;

    const slot = this._availableListEl.querySelector('#wifi-inline-form-slot');
    if (!slot) return;

    const isDisabled = this._isBusy();

    this._inlineForm = new WifiConnectInlineForm({
      props: {
        network,
        disabled: isDisabled,
        onConnect: (params) => this._handleFormConnect(params)
      }
    });

    this._inlineForm.mount(slot);
    this._inlineForm.bindEvents();
    this.addChild(this._inlineForm);
    this._inlineForm.focus();
  }

  _handleFormConnect({ ssid, psw, channel, bssid }) {
    if (this._isBusy() || !this._isApMode()) {
      log.debug('WifiConnectionCard', 'connect ignored: wifi busy or not AP mode');
      return;
    }

    log.debug('WifiConnectionCard', `connect clicked: ssid="${ssid}", channel=${channel}, bssid="${bssid}"`);

    // Immediately collapse form and highlight this network as connecting
    const connectingId = this._expandedNetworkId;
    this._connectingNetId = connectingId;
    this._expandedNetworkId = null;
    this._destroyInlineForm();
    this._renderAvailableList();

    CommandManager.sendWifiConnect({ ssid, psw, channel, bssid });
  }

  _destroyInlineForm() {
    if (this._inlineForm) {
      this.removeChild(this._inlineForm);
      this._inlineForm = null;
    }
  }

  // ============================
  // ERROR BANNER
  // ============================

  /**
   * Renders (shows/hides) the error banner based on current error state
   * Shows error ONLY if:
   * - There was a connection attempt in progress (CONNECT operation)
   * - An error occurred (errorType != OK)
   * - User hasn't dismissed it yet (seenByUser = false)
   */
  _renderErrorBanner() {
    if (!this._errorBannerEl || !this._errorTextEl) return;

    const hasError = this._errorType !== wifiError.OK 
                   && !this._errorSeenByUser 
                   && this._connectionAttemptInProgress;

    if (hasError) {
      this._errorTextEl.textContent = this._errorCodeToText(this._errorType);
      this._errorBannerEl.style.display = '';
      log.debug('WifiConnectionCard', `Error banner shown: ${this._errorCodeToText(this._errorType)}`);
    } else {
      this._errorBannerEl.style.display = 'none';
    }
  }

  /**
   * Maps wifiError code to user-readable text
   */
  _errorCodeToText(code) {
    switch (code) {
      case wifiError.TIMEOUT:      return i18n.t('wifi.error.timeout');
      case wifiError.NO_AP_FOUND:  return i18n.t('wifi.error.noApFound');
      case wifiError.AUTH_FAIL:    return i18n.t('wifi.error.authFail');
      case wifiError.DHCP_FAIL:    return i18n.t('wifi.error.dhcpFail');
      case wifiError.UNKNOWN:      return i18n.t('wifi.error.unknown');
      default:                     return '';
    }
  }

  // ============================
  // SCANNING BANNER
  // ============================

  /**
   * Renders (shows/hides) the scanning banner based on current operation
   * Shows banner ONLY when actively scanning
   */
  _renderScanningBanner() {
    if (!this._scanningBannerEl) return;

    const isScanning = this._operation === wifiOp.SCAN || this._status === wifiStatus.SCANNING;

    if (isScanning) {
      this._scanningBannerEl.style.display = '';
      log.debug('WifiConnectionCard', 'Scanning banner shown');
    } else {
      this._scanningBannerEl.style.display = 'none';
    }
  }

  // ============================
  // SCAN
  // ============================

  _onScanClick() {
    if (this._isBusy() || !this._isApMode()) {
      log.debug('WifiConnectionCard', 'scan ignored: wifi busy or not AP mode');
      return;
    }
    log.debug('WifiConnectionCard', 'scan button clicked');
    CommandManager.sendWifiScan();
  }

  // ============================
  // I18N REFRESH
  // ============================

  _refreshAll() {
    if (this._titleEl) this._titleEl.textContent = i18n.t('wifi.card.title');
    if (this._scanLabel) this._scanLabel.textContent = i18n.t('wifi.card.scan');
    if (this._staNoteEl) {
      const staNoteText = this._staNoteEl.querySelector('.wifi-card__sta-note-text');
      if (staNoteText) {
        staNoteText.textContent = i18n.t('wifi.note.staMobile', { fallback: 'For WiFi network operations (scan, connect), connect to the device access point' });
      }
    }
    if (this._sectionTitles && this._sectionTitles.length >= 2) {
      this._sectionTitles[0].textContent = i18n.t('wifi.section.current');
      this._sectionTitles[1].textContent = i18n.t('wifi.section.available');
    }
    this._renderCurrentRow();
    this._renderAvailableList();
    this._updateCount();
    this._applyModeGating();
    this._renderErrorBanner();
  }

  // ============================
  // HELPERS
  // ============================

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  _escapeAttr(str) {
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
}
