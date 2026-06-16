/**
 * ModeStateButton.js
 * ==================
 * Componente pulsante per visualizzare lo stato di una modalità operativa.
 * 
 * Stati:
 * - DISABLED: parametro value = 0, icona dimmed con slash diagonale
 * - ENABLED-INACTIVE: parametro value = 1, isActive = false, outline blu
 * - ENABLED-ACTIVE: parametro value = 1, isActive = true, background blu
 * 
 * Features:
 * - Reactive: sottoscrizione a config.params[paramId] e runtime.modes.xxx.isActive
 * - Click behavior: se isEditable, chiama callback per toggle parametro
 * - Visual feedback: transizioni smooth, hover effects
 * 
 * @extends Component
 * @author FogExtra Team
 * @version 1.0.0
 */

import { Component } from '../../core/Component.js';
import { Store } from '../../core/store.js';
import { Paths } from '../../utils/paths.js';
import { log } from '../../utils/logger.js';
import { i18n } from '../../utils/i18n.js';
import { getModeButtonState, isButtonClickable, toggleParameterValue } from './ModeStateButton.func.js';

export class ModeStateButton extends Component {
  /**
   * Create ModeStateButton instance.
   *
   * @param {Object} options - Component configuration
   * @param {string} options.assetKey - Chiave asset catalogo per l'icona (es: "icon-thermo")
   * @param {string} options.storePath - Store path per isActive (es: "runtime.modes.temperature.isActive")
   * @param {number} options.paramId - ID del parametro nello store config.params
   * @param {Function} options.callback - Callback chiamata on click (es: commandManager.modifyParameter)
   * @param {boolean} options.isEditable - Se true, abilita il click (default: false)
   * @param {string} options.labelKey - Chiave i18n per la label (es: "ui.modeTemperature")
   */
  constructor(options = {}) {
    super({
      id: options.id || `mode-button-${options.paramId}`,
      ...options
    });

    // Validate required props
    if (!options.assetKey) {
      log.error('ModeStateButton', 'assetKey is required');
      throw new Error('ModeStateButton: assetKey is required');
    }

    if (!options.storePath) {
      log.error('ModeStateButton', 'storePath is required');
      throw new Error('ModeStateButton: storePath is required');
    }

    if (typeof options.paramId !== 'number') {
      log.error('ModeStateButton', 'paramId must be a number');
      throw new Error('ModeStateButton: paramId must be a number');
    }

    // Configuration
    this.assetKey = options.assetKey;
    this.storePath = options.storePath;
    this.paramId = options.paramId;
    this.callback = options.callback || null;
    this.isEditable = options.isEditable || false;
    this.labelKey = options.labelKey || null;

    // State
    this.param = null;        // Parametro da config.params
    this.isActive = false;    // Stato attivo/inattivo da runtime.modes
    this.currentState = 'disabled'; // Stato visuale corrente

    // Enable automatic translation updates for label
    this.enableI18n(() => this._updateLabel());

    log.debug('ModeStateButton', `Created - paramId: ${this.paramId}, isEditable: ${this.isEditable}`);
  }

  /**
   * Called when component is created.
   */
  onCreate() {
    super.onCreate();
    log.debug('ModeStateButton', `onCreate - paramId: ${this.paramId}`);
  }

  /**
   * Render button HTML structure.
   * @returns {HTMLElement} Button element
   */
  render() {
    const container = document.createElement('div');
    container.className = `mode-item ${this.currentState}`;
    container.setAttribute('data-param-id', this.paramId);

    // Get translated label
    const labelText = this.labelKey ? i18n.t(this.labelKey) : '';

    container.innerHTML = `
      <button class="mode-btn" aria-label="Mode ${this.paramId}">
        <img data-asset-key="${this.assetKey}" alt="">
      </button>
      <span class="mode-label">${labelText}</span>
    `;

    return container;
  }

  /**
   * Called when component is mounted to DOM.
   */
  onMount() {
    super.onMount();
    log.debug('ModeStateButton', `onMount - paramId: ${this.paramId}`);

    // Setup click listener
    this._setupClickListener();

    // Subscribe to config.params for enable/disable state
    this.subscribeToStore(Paths.CONFIG.PARAMS, (params) => {
      this._handleParamsChange(params);
    });

    // Subscribe to runtime.modes.xxx.isActive for active/inactive state
    this.subscribeToStore(this.storePath, (isActive) => {
      this._handleActiveStateChange(isActive);
    });

    // Read initial values from store
    this._readInitialValues();
  }

  /**
   * Called when component becomes active/visible.
   */
  onActivate() {
    super.onActivate();
    log.debug('ModeStateButton', `onActivate - paramId: ${this.paramId}`);
  }

  /**
   * Called when component becomes inactive.
   */
  onDeactivate() {
    super.onDeactivate();
    log.debug('ModeStateButton', `onDeactivate - paramId: ${this.paramId}`);
  }

  /**
   * Called when component is destroyed.
   */
  onDestroy() {
    super.onDestroy();
    log.debug('ModeStateButton', `onDestroy - paramId: ${this.paramId}`);
  }

  /**
   * Update button display based on current state.
   */
  update() {
    if (!this.el) return;

    // Calculate new state
    const newState = getModeButtonState(this.param, this.isActive);

    // Update only if state changed
    if (newState !== this.currentState) {
      this.currentState = newState;

      // Update CSS class
      this.el.className = `mode-item ${this.currentState}`;

      log.debug('ModeStateButton', `Updated - paramId: ${this.paramId}, state: ${this.currentState}`);
    }
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  /**
   * Update label with translated text.
   * @private
   */
  _updateLabel() {
    if (!this.el || !this.labelKey) return;

    const labelElement = this.el.querySelector('.mode-label');
    if (labelElement) {
      labelElement.textContent = i18n.t(this.labelKey);
      log.debug('ModeStateButton', `Label updated - paramId: ${this.paramId}`);
    }
  }

  /**
   * Read initial values from Store.
   * @private
   */
  _readInitialValues() {
    try {
      // Read params array
      const params = Store.get(Paths.CONFIG.PARAMS);
      this._handleParamsChange(params);

      // Read isActive state
      const isActive = Store.get(this.storePath);
      this._handleActiveStateChange(isActive);

      log.debug('ModeStateButton', `Initial values loaded - paramId: ${this.paramId}, param:`, this.param, ', isActive:', this.isActive);
    } catch (error) {
      log.warn('ModeStateButton', `Failed to read initial values - paramId: ${this.paramId}`, error);
    }
  }

  /**
   * Handle config.params change.
   * @private
   * @param {Array} params - Array of parameters from store
   */
  _handleParamsChange(params) {
    if (!params || !Array.isArray(params)) {
      log.warn('ModeStateButton', `Invalid params - paramId: ${this.paramId}`);
      return;
    }

    // Find parameter by ID
    const param = params.find(p => p.id === this.paramId);

    if (!param) {
      log.warn('ModeStateButton', `Parameter not found - paramId: ${this.paramId}`);
      return;
    }

    this.param = param;
    this.update();

    log.debug('ModeStateButton', `Param updated - paramId: ${this.paramId}, value: ${param.value}`);
  }

  /**
   * Handle runtime.modes.xxx.isActive change.
   * @private
   * @param {boolean} isActive - New active state
   */
  _handleActiveStateChange(isActive) {
    this.isActive = !!isActive;
    this.update();

    log.debug('ModeStateButton', `Active state updated - paramId: ${this.paramId}, isActive: ${this.isActive}`);
  }

  /**
   * Setup click event listener.
   * @private
   */
  _setupClickListener() {
    if (!this.el) return;

    const button = this.el.querySelector('.mode-btn');
    if (!button) return;

    button.addEventListener('click', (e) => {
      e.stopPropagation();
      this._handleClick();
    });

    log.debug('ModeStateButton', `Click listener setup - paramId: ${this.paramId}`);
  }

  /**
   * Handle button click.
   * @private
   */
  _handleClick() {
    log.debug('ModeStateButton', `Button clicked - paramId: ${this.paramId}, isEditable: ${this.isEditable}`);

    // Se non è editabile, ignora il click
    if (!this.isEditable) {
      log.debug('ModeStateButton', `Click ignored - button not editable`);
      return;
    }

    // Se non c'è callback, ignora
    if (!this.callback || typeof this.callback !== 'function') {
      log.warn('ModeStateButton', `No callback provided - paramId: ${this.paramId}`);
      return;
    }

    // Calcola il nuovo valore (toggle)
    const newValue = toggleParameterValue(this.param);

    log.info('ModeStateButton', `Toggling parameter - paramId: ${this.paramId}, oldValue: ${this.param.value}, newValue: ${newValue}`);

    // Chiama il callback
    this.callback(this.paramId, newValue);
  }
}
