/**
 * PowerButton.js
 * ==============
 * PowerButton component for controlling the main pump power state.
 * 
 * Features:
 * - Three states: Hidden (disabled), OFF (inactive), ON (active)
 * - Reactive to runtime.modes.wireless.isActive and config.params[23]
 * - Sends custom CMD_PUMP_STATE command when clicked
 * - Inherits from Component.js with full lifecycle support
 * - i18n integration for label updates
 * 
 * @extends Component
 * @author FogExtra Team
 * @version 1.0.0
 */

import { Component } from '../../core/Component.js';
import { CommandManager } from '../../managers/commandManager.js';
import { MODE_PARAM_IDS } from '../../utils/constants.js';
import { i18n } from '../../utils/i18n.js';
import { Paths } from '../../utils/paths.js';
import { log } from '../../utils/logger.js';
import { Store } from '../../core/store.js';
import {
  getPowerButtonState,
  isButtonClickable,
  updatePowerButtonDOM,
  createPowerButtonHTML,
  handlePowerButtonClick,
  validatePowerButtonProps
} from './PowerButton.func.js';

export class PowerButton extends Component {
  /**
   * Create PowerButton instance.
   *
   * @param {Object} options - Component configuration
   * @param {string} options.assetKey - Catalog asset key for the power icon (default: "icon-wifi")
   * @param {Function} options.callback - Custom callback for power toggle (default: CommandManager.powerPump)
   * @param {string} options.storePath - Store path for active state (default: "runtime.modes.wireless.isActive")
   * @param {number} options.paramId - Parameter ID for visibility control (default: MODE_PARAM_IDS.WIRELESS)
   */
  constructor(options = {}) {
    super({
      id: options.id || 'power-button',
      ...options
    });

    // Configuration with defaults
    this.assetKey = options.assetKey || 'icon-wifi';
    this.callback = options.callback || CommandManager.powerPump;
    this.storePath = options.storePath || 'runtime.modes.wireless.isActive';
    this.paramId = options.paramId || MODE_PARAM_IDS.WIRELESS;

    // Validate props
    if (!validatePowerButtonProps({
      assetKey: this.assetKey,
      callback: this.callback,
      storePath: this.storePath,
      paramId: this.paramId
    })) {
      log.error('PowerButton', 'Invalid props provided to PowerButton constructor');
      return;
    }

    // Internal state
    this.currentState = 'off';
    this.isActive = false;
    this.param = null;

    // Subscription IDs for cleanup
    this.subscriptions = [];

    // Enable automatic translation updates
    this.enableI18n(() => this._updateLabels());

    log.debug('PowerButton', `Created - storePath: ${this.storePath}, paramId: ${this.paramId}`);
  }

  /**
   * Called when component is created.
   */
  onCreate() {
    super.onCreate();
    log.debug('PowerButton', 'onCreate');
  }

  /**
   * Render component HTML structure.
   * @returns {HTMLElement} Component element
   */
  render() {
    const container = document.createElement('div');
    container.className = 'power-section';
    container.innerHTML = createPowerButtonHTML(this.assetKey);
    return container;
  }

  /**
   * Called when component is mounted to DOM.
   */
  onMount() {
    super.onMount();
    log.debug('PowerButton', 'onMount');

    // Setup click handler
    this._setupClickHandler();

    // Setup store subscriptions
    this._setupSubscriptions();

    // Load initial data from store
    this._loadInitialData();
  }

  /**
   * Called when component becomes active/visible.
   */
  onActivate() {
    super.onActivate();
    log.debug('PowerButton', 'onActivate');
  }

  /**
   * Called when component becomes inactive.
   */
  onDeactivate() {
    super.onDeactivate();
    log.debug('PowerButton', 'onDeactivate');
  }

  /**
   * Called when component is destroyed.
   */
  onDestroy() {
    super.onDestroy();
    log.debug('PowerButton', 'onDestroy');

    // Cleanup subscriptions
    this._cleanupSubscriptions();
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  /**
   * Setup click event handler.
   * @private
   */
  _setupClickHandler() {
    if (!this.el) return;

    const button = this.el.querySelector('.power-button');
    if (!button) {
      log.error('PowerButton', 'Power button element not found');
      return;
    }

    button.addEventListener('click', (e) => {
      e.preventDefault();
      this._handleClick();
    });

    log.debug('PowerButton', 'Click handler setup complete');
  }

  /**
   * Setup store subscriptions.
   * @private
   */
  _setupSubscriptions() {
    // Subscribe to active state (runtime.modes.wireless.isActive)
    const activeStateSub = this.subscribeToStore(this.storePath, (value) => {
      this.isActive = Boolean(value);
      log.debug('PowerButton', `Active state updated: ${this.isActive}`);
      this._updateComponent();
    });
    
    this.subscriptions.push(activeStateSub);

    // Subscribe to config.params array and filter for our parameter
    const paramSub = this.subscribeToStore(Paths.CONFIG.PARAMS, (params) => {
      this._handleParamsChange(params);
    });
    
    this.subscriptions.push(paramSub);

    log.debug('PowerButton', 'Store subscriptions setup complete');
  }

  /**
   * Load initial data from store.
   * @private
   */
  _loadInitialData() {
    // Load initial active state
    const initialActiveState = Store.get(this.storePath);
    if (initialActiveState !== undefined) {
      this.isActive = Boolean(initialActiveState);
      log.debug('PowerButton', `Initial active state loaded: ${this.isActive}`);
    }

    // Load initial params
    const initialParams = Store.get(Paths.CONFIG.PARAMS);
    if (initialParams && Array.isArray(initialParams)) {
      this._handleParamsChange(initialParams);
    }

    // Initial update with loaded data
    this._updateComponent();
    
    log.debug('PowerButton', 'Initial data loaded');
  }

  /**
   * Cleanup store subscriptions.
   * @private
   */
  _cleanupSubscriptions() {
    this.subscriptions.forEach(unsub => {
      if (typeof unsub === 'function') {
        unsub();
      }
    });
    this.subscriptions = [];
    log.debug('PowerButton', 'Subscriptions cleaned up');
  }

  /**
   * Update component state and DOM.
   * @private
   */
  _updateComponent() {
    if (!this.el) return;

    // Determine current state
    const newState = getPowerButtonState(this.param, this.isActive);
    
    if (newState !== this.currentState) {
      this.currentState = newState;
      log.debug('PowerButton', `State changed to: ${newState}`);
    }

    // Update DOM
    updatePowerButtonDOM(this.el, this.currentState, this.assetKey);
  }
    /**
   * @private
   * @param {Array} params - Array of parameters from store
   */
  _handleParamsChange(params) {
    if (!params || !Array.isArray(params)) {
      log.warn('PowerButton', `Invalid params - paramId: ${this.paramId}`);
      return;
    }

    // Find parameter by ID
    const param = params.find(p => p.id === this.paramId);

    if (!param) {
      log.warn('PowerButton', `Parameter not found - paramId: ${this.paramId}`);
      return;
    }

    this.param = param;
    this._updateComponent();

    log.debug('PowerButton', `Param updated - paramId: ${this.paramId}, value: ${param.value}`);
  }

  /**
   * Update labels with current language.
   * @private
   */
  _updateLabels() {
    if (!this.el) return;

    const label = this.el.querySelector('.power-label');
    if (!label) return;

    // Get current label state
    const isOn = this.currentState === 'on';
    const labelKey = isOn ? 'ui.powerON' : 'ui.powerOFF';
    const fallback = isOn ? 'ON' : 'OFF';

    try {
      label.textContent = i18n.t(labelKey) || fallback;
      log.debug('PowerButton', 'Labels updated for current language');
    } catch (e) {
      label.textContent = fallback;
    }
  }

  /**
   * Handle power button click.
   * @private
   */
  _handleClick() {
    // Check if button is clickable
    if (!isButtonClickable(this.param)) {
      log.debug('PowerButton', 'Button click ignored (not clickable)');
      return;
    }

    // Handle click with callback
    handlePowerButtonClick(this.isActive, this.callback);

    // Visual feedback
    this._addClickFeedback();
  }

  /**
   * Add visual click feedback.
   * @private
   */
  _addClickFeedback() {
    if (!this.el) return;

    const button = this.el.querySelector('.power-button');
    if (!button) return;

    // Add scale effect
    button.style.transform = 'scale(0.95)';
    
    setTimeout(() => {
      button.style.transform = '';
    }, 150);
  }
}