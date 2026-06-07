/**
 * Badge.js
 * ========
 * Reusable badge component for displaying system states (connection, pump, etc.).
 * Subscribes to store changes and updates display based on mapping function.
 * 
 * @author FogExtra Team
 * @version 1.0.0
 */

import { Component } from '../../core/Component.js';
import { Store } from '../../core/store.js';
import { i18n } from '../../utils/i18n.js';
import { log } from '../../utils/logger.js';

export class Badge extends Component {
  /**
   * Create Badge instance.
   * 
   * @param {Object} config - Configuration object
   * @param {string} config.storePath - Store path to subscribe to (e.g., 'socket.state')
   * @param {Function} config.mapFunction - Function that maps store value to { label, class }
   * @param {string} [config.assetKey] - Optional catalog key for deferred image bridge
   * @param {string} [config.icon] - Optional legacy icon path (deprecated)
   * @param {Object} config.defaultState - Default state before data is available
   * @param {string} config.defaultState.label - i18n key for default label
   * @param {string} config.defaultState.class - CSS class for default state
   * 
   * @example
   * new Badge({
   *   storePath: 'socket.state',
   *   mapFunction: mapSocketStateToBadge,
   *   defaultState: { label: 'ui.disconnected', class: 'error' }
   * })
   */
  constructor(config = {}) {
    super();

    // Validate required parameters
    if (!config.storePath) {
      log.error('Badge', 'storePath is required');
      throw new Error('Badge: storePath is required');
    }

    if (!config.mapFunction || typeof config.mapFunction !== 'function') {
      log.error('Badge', 'mapFunction is required and must be a function');
      throw new Error('Badge: mapFunction is required and must be a function');
    }

    if (!config.defaultState || !config.defaultState.label || !config.defaultState.class) {
      log.error('Badge', 'defaultState with label and class is required');
      throw new Error('Badge: defaultState with label and class is required');
    }

    // Store configuration
    this.storePath = config.storePath;
    this.mapFunction = config.mapFunction;
    this.assetKey = config.assetKey || null;
    this.icon = config.icon || null;
    this.defaultState = config.defaultState;

    // Current state
    this.currentState = { ...this.defaultState };

    log.debug('Badge', 'Created', {
      storePath: this.storePath,
      hasAssetKey: !!this.assetKey,
      hasLegacyIcon: !!this.icon
    });
  }

  /**
   * Called when component is created.
   */
  onCreate() {
    super.onCreate();
    log.debug('Badge', 'onCreate');
  }

  /**
   * Render badge HTML structure.
   * @returns {HTMLElement} Badge element
   */
  render() {
    this.el = document.createElement('div');
    this.el.className = `badge ${this.currentState.class}`;

    // Add icon if provided (assetKey preferred; legacy src kept for compatibility)
    if (this.assetKey || this.icon) {
      const iconEl = document.createElement('img');
      iconEl.alt = 'Badge icon';
      iconEl.className = 'badge-icon';

      if (this.assetKey) {
        iconEl.setAttribute('data-asset-key', this.assetKey);
      } else if (this.icon) {
        iconEl.src = this.icon;
      }

      this.el.appendChild(iconEl);
    }

    // Add label
    this.labelEl = document.createElement('span');
    this.labelEl.className = 'badge-label';
    this.labelEl.textContent = i18n.t(this.currentState.label);
    this.el.appendChild(this.labelEl);

    log.debug('Badge', 'Rendered', { state: this.currentState });

    return this.el;
  }

  /**
   * Called when component is mounted to DOM.
   */
  onMount() {
    super.onMount();
    log.debug('Badge', 'onMount');

    // Subscribe to store changes
    this.subscribeToStore(this.storePath, (value) => {
      this._handleStateChange(value);
    });

    // Subscribe to language changes for label translation
    this.enableI18n(() => {
      this._updateLabel();
    });

    // 🔥 CRITICAL: Read initial value from Store immediately
    // subscribeToStore only fires on CHANGES, not initial value
    this._readInitialValue();
  }

  /**
   * Called when component becomes active/visible.
   */
  onActivate() {
    super.onActivate();
    log.debug('Badge', 'onActivate');
  }

  /**
   * Called when component becomes inactive.
   */
  onDeactivate() {
    super.onDeactivate();
    log.debug('Badge', 'onDeactivate');
  }

  /**
   * Called when component is destroyed.
   */
  onDestroy() {
    super.onDestroy();
    log.debug('Badge', 'onDestroy');
  }

  /**
   * Update badge display with current state.
   */
  update() {
    if (!this.el) return;

    // Update CSS class
    this.el.className = `badge ${this.currentState.class}`;

    // Update label text
    this._updateLabel();

    log.debug('Badge', 'Updated', { state: this.currentState });
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  /**
   * Read initial value from Store.
   * Called once on mount to sync with current Store state.
   * @private
   */
  _readInitialValue() {
    try {
      // Use Store.get() directly (not this.store)
      const currentValue = Store.get(this.storePath);
      log.debug('Badge', '📖 Read initial value from Store', { path: this.storePath, value: currentValue });
      
      // Handle the initial state
      this._handleStateChange(currentValue);
    } catch (error) {
      log.warn('Badge', '⚠️ Failed to read initial value from Store', { path: this.storePath, error: error.message });
      // Keep default state if Store read fails
    }
  }

  /**
   * Handle store value change.
   * @private
   * @param {*} value - New value from store
   */
  _handleStateChange(value) {
    log.debug('Badge', '🔄 State changed', { path: this.storePath, value });

    // Map value to display state using provided function
    const newState = this.mapFunction(value);

    if (!newState || !newState.label || !newState.class) {
      log.warn('Badge', '⚠️ mapFunction returned invalid state', { value, newState });
      return;
    }

    log.debug('Badge', '✅ Mapped to new state', { label: newState.label, class: newState.class });

    // Update current state
    this.currentState = newState;

    // Update display
    this.update();
  }

  /**
   * Update label text with current translation.
   * @private
   */
  _updateLabel() {
    if (!this.labelEl) return;

    this.labelEl.textContent = i18n.t(this.currentState.label);
  }
}
