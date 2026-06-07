/**
 * SettingsPage.js
 * ===============
 * Settings page showing firmware info, OTA status,
 * ECU configuration summary, and connection info.
 */

import { Page } from '../core/Page.js';
import { Store } from '../core/store.js';
import { Paths } from '../utils/paths.js';
import { OtaStatus } from '../components/OtaStatus/OtaStatus.js';
import { ConnectionBadge } from '../components/ConnectionBadge/ConnectionBadge.js';

export class SettingsPage extends Page {
  constructor() {
    super({
      pageId: 'settingsPage',
      cssClass: 'settings-page',
      title: 'Impostazioni'
    });

    this.otaStatus = null;
    this.connectionBadge = null;
    this._subscriptions = [];
  }

  /**
   * Create the page skeleton DOM.
   * @returns {HTMLElement}
   */
  createSkeleton() {
    const el = document.createElement('div');
    el.id = this.pageId;
    el.className = `page ${this.options.cssClass}`;
    el.style.display = 'none';

    el.innerHTML = `
      <!-- Page Header -->
      <div class="settings-page__header">
        <button class="settings-page__back-btn" id="settings-back-btn">← Dashboard</button>
        <h2 class="settings-page__title">Impostazioni</h2>
      </div>

      <!-- Firmware & OTA Section -->
      <div class="settings-page__section">
        <div class="settings-page__section-title">Firmware</div>
        <div id="settings-ota-container"></div>
      </div>

      <!-- ECU Config Section -->
      <div class="settings-page__section">
        <div class="settings-page__section-title">Configurazione ECU</div>
        <div class="card">
          <div class="settings-page__info-row">
            <span class="settings-page__info-label">Impulsi sync</span>
            <span class="settings-page__info-value" id="settings-sync-pulses">—</span>
          </div>
          <div class="settings-page__info-row">
            <span class="settings-page__info-label">Soglia allarme EGT</span>
            <span class="settings-page__info-value" id="settings-egt-alarm">—</span>
          </div>
          <div class="settings-page__info-row">
            <span class="settings-page__info-label">Mappe accensione</span>
            <span class="settings-page__info-value" id="settings-ignition-count">—</span>
          </div>
          <div class="settings-page__info-row">
            <span class="settings-page__info-label">Mappe Power Jet</span>
            <span class="settings-page__info-value" id="settings-pj-count">—</span>
          </div>
        </div>
      </div>

      <!-- Connection Section -->
      <div class="settings-page__section">
        <div class="settings-page__section-title">Connessione</div>
        <div class="card">
          <div class="settings-page__info-row">
            <span class="settings-page__info-label">WebSocket</span>
            <span id="settings-connection-container"></span>
          </div>
        </div>
      </div>
    `;

    this.root = el;
    return el;
  }

  /**
   * Bind DOM events and create child components.
   */
  bindEvents() {
    // Back button
    const backBtn = this.root.querySelector('#settings-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        if (window.__ecuNavigator) {
          window.__ecuNavigator.navigateTo('dashboardPage');
        }
      });
    }

    // OTA Status component
    this.otaStatus = new OtaStatus();
    this.otaStatus.mount(this.root.querySelector('#settings-ota-container'));

    // Connection Badge
    this.connectionBadge = new ConnectionBadge();
    this.connectionBadge.mount(this.root.querySelector('#settings-connection-container'));
  }

  onActivate() {
    if (this.otaStatus) this.otaStatus.activate();
    if (this.connectionBadge) this.connectionBadge.activate();

    // Subscribe to config for ECU info section
    this._subscriptions.push(
      Store.subscribe(Paths.CONFIG.SYNC_PULSES, (val) => {
        const el = this.root.querySelector('#settings-sync-pulses');
        if (el) el.textContent = val ?? '—';
      }),
      Store.subscribe(Paths.CONFIG.EGT_ALARM, (val) => {
        const el = this.root.querySelector('#settings-egt-alarm');
        if (el) el.textContent = val ? `${val}°C` : '—';
      }),
      Store.subscribe(Paths.CONFIG.MAPS.IGNITION, (maps) => {
        const el = this.root.querySelector('#settings-ignition-count');
        if (el) el.textContent = maps ? `${maps.length}` : '—';
      }),
      Store.subscribe(Paths.CONFIG.MAPS.POWER_JET, (maps) => {
        const el = this.root.querySelector('#settings-pj-count');
        if (el) el.textContent = maps ? `${maps.length}` : '—';
      })
    );

    // Trigger initial values
    this._updateConfigDisplay();
  }

  onDeactivate() {
    if (this.otaStatus) this.otaStatus.deactivate();
    if (this.connectionBadge) this.connectionBadge.deactivate();

    // Cleanup subscriptions
    this._subscriptions.forEach(unsub => unsub());
    this._subscriptions = [];
  }

  /**
   * Read current config values and display them.
   * @private
   */
  _updateConfigDisplay() {
    const syncPulses = Store.get(Paths.CONFIG.SYNC_PULSES);
    const egtAlarm = Store.get(Paths.CONFIG.EGT_ALARM);
    const ignMaps = Store.get(Paths.CONFIG.MAPS.IGNITION);
    const pjMaps = Store.get(Paths.CONFIG.MAPS.POWER_JET);

    const syncEl = this.root.querySelector('#settings-sync-pulses');
    const egtEl = this.root.querySelector('#settings-egt-alarm');
    const ignEl = this.root.querySelector('#settings-ignition-count');
    const pjEl = this.root.querySelector('#settings-pj-count');

    if (syncEl) syncEl.textContent = syncPulses ?? '—';
    if (egtEl) egtEl.textContent = egtAlarm ? `${egtAlarm}°C` : '—';
    if (ignEl) ignEl.textContent = ignMaps ? `${ignMaps.length}` : '—';
    if (pjEl) pjEl.textContent = pjMaps ? `${pjMaps.length}` : '—';
  }
}
