/**
 * TimerForm.js
 * ============
 * Timer control card component for the Sensors section.
 * 
 * Features:
 * - Displays ON/OFF timer values from store
 * - Auto-updates on store changes (reactive)
 * - Navigates to TimerEditorPage on click
 * - Expands to 6 columns when relay mode is Bypass
 * - Automatic subscription cleanup on unmount
 * 
 * Store Subscriptions:
 * - timers.mode.on - Updates ON timer value
 * - timers.mode.off - Updates OFF timer value
 * - config.params[22].relayMode - Controls card width expansion
 * 
 * Navigation:
 * - ON click → timerEditorPage with paramId: 8
 * - OFF click → timerEditorPage with paramId: 9
 * 
 * @author FogExtra Team
 * @version 1.0.0
 */

import { Component } from '../../core/Component.js';
import { Store } from '../../core/store.js';
import { NavigatorManager } from '../../managers/navigatorManager.js';
import { Paths } from '../../utils/paths.js';
import { log } from '../../utils/logger.js';
import { RELAY_MODE_PARAM_ID } from '../../utils/constants.js';
import { formatTime, isHideMode } from './TimerForm.func.js';

// Timer parameter IDs (constants)
const TIMER_ON_PARAM_ID = 8;
const TIMER_OFF_PARAM_ID = 9;

export class TimerForm extends Component {
  /**
   * Create TimerForm instance.
   * 
   * @param {Object} options - Component configuration
   */
  constructor(options = {}) {
    super({
      id: options.id || 'timer-form',
      ...options
    });

    this.assetKey = options.assetKey || 'icon-timer';

    // Store subscription handlers
    this.subscriptions = [];
    
    // Cached DOM references
    this.$onValue = null;
    this.$offValue = null;
    this.$onGroup = null;
    this.$offGroup = null;

    log.debug('TimerForm', 'Created');
  }

  /**
   * Called when component is created.
   */
  onCreate() {
    super.onCreate();
    log.debug('TimerForm', 'onCreate');
  }

  /**
   * Render component HTML structure.
   * Uses existing placeholder markup from SensorsForm.
   * 
   * @returns {HTMLElement} Component element
   */
  render() {
    const container = document.createElement('div');
    container.className = 'pump-card timer-card';
    container.dataset.component = 'TimerForm';

    container.innerHTML = `
      <div class="pump-card-icon">
        <img data-asset-key="${this.assetKey}" alt="Timer">
      </div>
      <div class="timer-value-group" data-role="on">
        <div class="timer-label">ON</div>
        <div class="timer-value">00:30</div>
      </div>
      <div class="timer-value-group" data-role="off">
        <div class="timer-label">OFF</div>
        <div class="timer-value">00:00</div>
      </div>
    `;

    return container;
  }

  /**
   * Called when component is mounted to DOM.
   * Cache DOM references and bind event listeners.
   */
  onMount() {
    super.onMount();
    
    // Cache DOM elements
    this._cacheDom();
    
    // Bind click events
    this._bindEvents();

    log.debug('TimerForm', 'onMount - Component mounted');
  }

  /**
   * Called when component becomes active/visible.
   * Setup reactive subscriptions to Store.
   */
  onActivate() {
    super.onActivate();
    
    // Subscribe to store changes
    this._subscribeToStore();

    log.debug('TimerForm', 'onActivate - Component activated');
  }

  /**
   * Cache DOM element references.
   * 
   * @private
   */
  _cacheDom() {
    if (!this.el) {
      log.error('TimerForm', 'Cannot cache DOM: this.el is null');
      return;
    }

    this.$onGroup = this.el.querySelector('[data-role="on"]');
    this.$offGroup = this.el.querySelector('[data-role="off"]');
    this.$onValue = this.el.querySelector('[data-role="on"] .timer-value');
    this.$offValue = this.el.querySelector('[data-role="off"] .timer-value');

    log.debug('TimerForm', 'DOM elements cached');
  }

  /**
   * Bind click event listeners.
   * 
   * @private
   */
  _bindEvents() {
    if (!this.$onGroup || !this.$offGroup) {
      log.error('TimerForm', 'Cannot bind events: timer groups not found');
      return;
    }

    // Navigate to TimerEditorPage on ON click
    this.$onGroup.addEventListener('click', () => {
      log.debug('TimerForm', 'ON timer clicked, navigating to editor');
      
      // Get the full parameter object from Store (like ParameterItem does)
      const params = Store.get(Paths.CONFIG.PARAMS);
      const timerOnParam = params.find(p => p.id === TIMER_ON_PARAM_ID);
      
      if (timerOnParam) {
        NavigatorManager.navigateTo('timerEditorPage', { param: timerOnParam });
      } else {
        log.error('TimerForm', `Timer ON parameter (id: ${TIMER_ON_PARAM_ID}) not found in store`);
      }
    });

    // Navigate to TimerEditorPage on OFF click
    this.$offGroup.addEventListener('click', () => {
      log.debug('TimerForm', 'OFF timer clicked, navigating to editor');
      
      // Get the full parameter object from Store (like ParameterItem does)
      const params = Store.get(Paths.CONFIG.PARAMS);
      const timerOffParam = params.find(p => p.id === TIMER_OFF_PARAM_ID);
      
      if (timerOffParam) {
        NavigatorManager.navigateTo('timerEditorPage', { param: timerOffParam });
      } else {
        log.error('TimerForm', `Timer OFF parameter (id: ${TIMER_OFF_PARAM_ID}) not found in store`);
      }
    });

    // Add cursor pointer style to make clickable areas obvious
    this.$onGroup.style.cursor = 'pointer';
    this.$offGroup.style.cursor = 'pointer';

    log.debug('TimerForm', 'Events bound');
  }

  /**
   * Subscribe to store changes.
   * 
   * @private
   */
  _subscribeToStore() {
    try {
      // Subscribe to ON timer updates (use canonical path)
      const unsubOn = Store.subscribe(Paths.RUNTIME.TIMERS.MODE_ON, (value) => {
        this._updateOnTimer(value);
      });
      this.subscriptions.push(unsubOn);

      // Subscribe to OFF timer updates
      const unsubOff = Store.subscribe(Paths.RUNTIME.TIMERS.MODE_OFF, (value) => {
        this._updateOffTimer(value);
      });
      this.subscriptions.push(unsubOff);
    } catch (err) {
      // If subscribe fails, log and continue — component will attempt to initialize values below
      log.warn('TimerForm', 'Unable to subscribe to timers paths immediately:', err && err.message);
    }

    // Subscribe to config.params array to detect relay mode changes
    try {
      const unsubParams = Store.subscribe(Paths.CONFIG.PARAMS, (params) => {
        if (!Array.isArray(params)) return;
        
        const relayParam = params.find(p => p.id === RELAY_MODE_PARAM_ID);
        const relayMode = (relayParam && relayParam.value !== undefined) ? relayParam.value : undefined;
        
        this._updateCardWidth(relayMode);
      });
      this.subscriptions.push(unsubParams);
    } catch (err) {
      log.warn('TimerForm', 'Unable to subscribe to config.params:', err && err.message);
    }

    // Initialize current values (best-effort, protected by try/catch)
    try {
      const onVal = Store.get(Paths.RUNTIME.TIMERS.MODE_ON);
      this._updateOnTimer(onVal);
    } catch (e) {
      // ignore - will update when subscription triggers
    }

    try {
      const offVal = Store.get(Paths.RUNTIME.TIMERS.MODE_OFF);
      this._updateOffTimer(offVal);
    } catch (e) {
      // ignore
    }

    try {
      const params = Store.get(Paths.CONFIG.PARAMS);
      if (Array.isArray(params)) {
        const relayParam = params.find(p => p.id === RELAY_MODE_PARAM_ID);
        const relayMode = (relayParam && relayParam.value !== undefined) ? relayParam.value : undefined;
        this._updateCardWidth(relayMode);
      }
    } catch (e) {
      // ignore
    }

    log.debug('TimerForm', 'Store subscriptions created (or deferred)');
  }

  /**
   * Update ON timer display value.
   * 
   * @param {number|string} value - Timer value (seconds or MM:SS string)
   * @private
   */
  _updateOnTimer(value) {
    if (!this.$onValue) return;

    const formattedTime = formatTime(value);
    this.$onValue.textContent = formattedTime;
    
    log.debug('TimerForm', `ON timer updated: ${formattedTime}`);
  }

  /**
   * Update OFF timer display value.
   * 
   * @param {number|string} value - Timer value (seconds or MM:SS string)
   * @private
   */
  _updateOffTimer(value) {
    if (!this.$offValue) return;

    const formattedTime = formatTime(value);
    this.$offValue.textContent = formattedTime;
    
    log.debug('TimerForm', `OFF timer updated: ${formattedTime}`);
  }

  /**
   * Update card width based on relay mode.
   * When relay is in Bypass mode (0), expand to 6 columns.
   * 
   * @param {number} relayMode - Relay mode value (0=Bypass, 1=Dispenser, 2=Fan)
   * @private
   */
  _updateCardWidth(relayMode) {
    if (!this.el) return;

    const shouldExpand = isHideMode(relayMode);
    this.el.classList.toggle('extend-timer-form', shouldExpand);
    
    log.debug('TimerForm', `Card width updated - Bypass mode: ${shouldExpand}`);
  }

  /**
   * Called when component is deactivated.
   * Cleanup all store subscriptions.
   */
  onDeactivate() {
    // Unsubscribe from all store listeners
    this.subscriptions.forEach(unsubscribe => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    });
    this.subscriptions = [];

    log.debug('TimerForm', 'onDeactivate - Store subscriptions cleaned up');

    super.onDeactivate();
  }

  /**
   * Called when component is destroyed.
   * Final cleanup.
   */
  onDestroy() {
    // Clear DOM references
    this.$onValue = null;
    this.$offValue = null;
    this.$onGroup = null;
    this.$offGroup = null;

    super.onDestroy();
    log.debug('TimerForm', 'onDestroy');
  }
}
