/**
 * ModeSelector.js
 * ===============
 * Componente container per la sezione Mode Selector.
 * 
 * Features:
 * - Mostra 6 pulsanti mode (Temperature, Humidity, Timer, Calendar, Wireless, AUX)
 * - Integra PumpBadge nell'header
 * - Responsive layout con flex-wrap
 * - Titolo tradotto con i18n
 * 
 * Child Components:
 * - ModeStateButton × 6 (uno per ogni modalità)
 * - PumpBadge (stato pompa nell'header)
 * 
 * @extends Component
 * @author FogExtra Team
 * @version 1.0.0
 */

import { Component } from '../../core/Component.js';
import { Badge } from '../Badge/Badge.js';
import { mapPumpStateToBadge } from '../Badge/BadgeFunctions.js';
import { ModeStateButton } from '../ModeStateButton/ModeStateButton.js';
import { MODE_CONFIGURATIONS } from './ModeSelector.func.js';
import { MODE_PARAM_IDS } from '../../utils/constants.js';
import { CommandManager } from '../../managers/commandManager.js';
import { i18n } from '../../utils/i18n.js';
import { Paths } from '../../utils/paths.js';
import { log } from '../../utils/logger.js';

export class ModeSelector extends Component {
  /**
   * Create ModeSelector instance.
   * 
   * @param {Object} options - Component configuration
   * @param {boolean} options.isEditable - Se true, i pulsanti sono editabili (default: false)
   */
  constructor(options = {}) {
    super({
      id: options.id || 'mode-selector',
      ...options
    });

    // Configuration
    this.isEditable = options.isEditable || false;

    // Child components
    this.pumpBadge = null;
    this.modeButtons = [];

    // Enable automatic translation updates for title
    this.enableI18n(() => this._updateTitle());

    log.debug('ModeSelector', `Created - isEditable: ${this.isEditable}`);
  }

  /**
   * Called when component is created.
   */
  onCreate() {
    super.onCreate();
    log.debug('ModeSelector', 'onCreate');
  }

  /**
   * Render component HTML structure.
   * @returns {HTMLElement} Component element
   */
  render() {
    const container = document.createElement('div');
    container.className = 'mode-section';

    container.innerHTML = `
      <!-- Mode Header with Title and Pump Badge -->
      <div class="mode-header">
        <div class="mode-title-left">${i18n.t('ui.modeSelector')}</div>
        <div id="pump-badge-container"></div>
      </div>

      <!-- Mode Grid (4 buttons) -->
      <div class="mode-grid"></div>

      <!-- Instruction card under buttons -->
      <div class="mode-instruction-card">
        <span class="mode-instruction">${i18n.t('ui.modeSelectorInstruction')}</span>
      </div>
    `;

    return container;
  }

  /**
   * Called when component is mounted to DOM.
   */
  onMount() {
    super.onMount();
    log.debug('ModeSelector', 'onMount');

    // Mount pump badge
    this._mountPumpBadge();

    // Mount mode buttons
    this._mountModeButtons();
  }

  /**
   * Called when component becomes active/visible.
   */
  onActivate() {
    super.onActivate();
    log.debug('ModeSelector', 'onActivate');
  }

  /**
   * Called when component becomes inactive.
   */
  onDeactivate() {
    super.onDeactivate();
    log.debug('ModeSelector', 'onDeactivate');
  }

  /**
   * Called when component is destroyed.
   */
  onDestroy() {
    log.debug('ModeSelector', 'onDestroy');
    // Child cleanup is handled by Component.destroy() via addChild ownership.
    super.onDestroy();
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  /**
   * Update section title with translated text.
   * @private
   */
  _updateTitle() {
    if (!this.el) return;

    const titleElement = this.el.querySelector('.mode-title-left');
    if (titleElement) {
      titleElement.textContent = i18n.t('ui.modeSelector');
    }

    const instructionElement = this.el.querySelector('.mode-instruction');
    if (instructionElement) {
      instructionElement.textContent = i18n.t('ui.modeSelectorInstruction');
    }

    log.debug('ModeSelector', 'Title and instruction updated');
  }

  /**
   * Mount pump badge component.
   * @private
   */
  _mountPumpBadge() {
    log.debug('ModeSelector', '_mountPumpBadge called');

    if (!this.el) {
      log.error('ModeSelector', 'Cannot mount pump badge: this.el is null');
      return;
    }

    const container = this.el.querySelector('#pump-badge-container');
    if (!container) {
      log.error('ModeSelector', 'Pump badge container not found');
      return;
    }

    log.debug('ModeSelector', 'Pump badge container found');

    // Create Badge component for pump state
    this.pumpBadge = new Badge({
      storePath: Paths.RUNTIME.OUTPUTS.PUMP,
      mapFunction: mapPumpStateToBadge,
      assetKey: 'icon-pump',
      defaultState: {
        label: 'ui.pumpOff',
        class: 'off'
      }
    });

    log.debug('ModeSelector', 'Pump badge instance created');

    // Mount badge in its dedicated placeholder, then register parent/child ownership
    this.pumpBadge.mount(container);
    this.addChild(this.pumpBadge);

    // Add pump-badge class to the badge element
    if (this.pumpBadge.el) {
      this.pumpBadge.el.classList.add('pump-badge');
    }

    log.debug('ModeSelector', 'Pump badge mounted and activated successfully');
  }

  /**
   * Mount all mode buttons.
   * @private
   */
  _mountModeButtons() {
    log.debug('ModeSelector', '_mountModeButtons called');

    if (!this.el) {
      log.error('ModeSelector', 'Cannot mount mode buttons: this.el is null');
      return;
    }

    const gridContainer = this.el.querySelector('.mode-grid');
    if (!gridContainer) {
      log.error('ModeSelector', 'Mode grid container not found');
      return;
    }

    log.debug('ModeSelector', 'Mode grid container found');

    // Create and mount each mode button
    MODE_CONFIGURATIONS.forEach(config => {
      log.debug('ModeSelector', `Creating mode button: ${config.id}`);

      // Determine if this specific button should be editable
      // Rule: All buttons are editable EXCEPT wireless (paramId 23)
      // this.isEditable is the master switch for the entire component
      const isButtonEditable = this.isEditable && config.paramId !== MODE_PARAM_IDS.WIRELESS;

      // Create ModeStateButton
      const button = new ModeStateButton({
        id: `mode-button-${config.id}`,
        assetKey: config.assetKey,
        storePath: config.storePath,
        paramId: config.paramId,
        callback: isButtonEditable ? CommandManager.modifyParameter : null,
        isEditable: isButtonEditable,
        labelKey: config.labelKey
      });

      // Mount in grid slot, then register parent/child ownership
      button.mount(gridContainer);
      this.addChild(button);

      // Track button reference
      this.modeButtons.push(button);

      log.debug('ModeSelector', `Mode button ${config.id} (paramId: ${config.paramId}) mounted and activated (editable: ${isButtonEditable})`);
    });

    log.debug('ModeSelector', `All ${this.modeButtons.length} mode buttons mounted successfully`);
  }

  /**
   * Destroy all child components.
   * @private
   */
  _destroyChildComponents() {
    // Destroy pump badge
    if (this.pumpBadge && typeof this.pumpBadge.destroy === 'function') {
      this.pumpBadge.destroy();
      this.pumpBadge = null;
    }

    // Destroy all mode buttons
    this.modeButtons.forEach(button => {
      if (button && typeof button.destroy === 'function') {
        button.destroy();
      }
    });
    this.modeButtons = [];

    log.debug('ModeSelector', 'All child components destroyed');
  }
}
