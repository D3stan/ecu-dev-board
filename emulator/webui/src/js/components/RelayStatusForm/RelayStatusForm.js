/**
 * RelayStatusForm.js
 * ===================
 * Component that displays the current relay (fan/dispenser/antibacterial) status.
 * 
 * Features:
 * - Shows relay type via icon (dispenser/fan/antibacterial)
 * - Displays ON/OFF state with visual feedback
 * - Auto-hides when relay mode is set to Bypass (0)
 * - Reactive updates via Observer pattern
 * - Uses existing HTML/CSS structure from placeholder
 * 
 * Store Subscriptions:
 * - config.params (array) - Monitors relayMode changes (param id 22)
 * - runtime.outputs.extraRelay - Updates ON/OFF state
 * 
 * Visibility Rules:
 * - Hidden when relayMode = 0 (Bypass)
 * - Visible for modes 1 (Dispenser), 2 (Fan), 3 (Antibacterial)
 * 
 * @author FogExtra Team
 * @version 1.0.0
 */

import { Component } from '../../core/Component.js';
import { Store } from '../../core/store.js';
import { Paths } from '../../utils/paths.js';
import { log } from '../../utils/logger.js';
import { RelayModeType, RELAY_MODE_PARAM_ID } from '../../utils/constants.js';
import { NavigatorManager } from '../../managers/navigatorManager.js';
import { getRelayIcon, getRelayLabel, shouldHideRelay, getMenuIdFromRelayMode } from './RelayStatusForm.func.js';
import { RELAY_MODE_MAPPING } from '../../utils/enumMappings.js';

export class RelayStatusForm extends Component {
  /**
   * Create RelayStatusForm instance.
   * 
   * @param {Object} options - Component configuration
   */
  constructor(options = {}) {
    super({
      id: options.id || 'relay-status-form',
      ...options
    });

    // Component state
    this.relayMode = RelayModeType.BYPASS; // Default to BYPASS
    this.isRelayOn = false;
    this.currentLangIndex = 1; // Default to Italian

    log.debug('RelayStatusForm', 'Created');
  }

  /**
   * Called when component is created.
   */
  onCreate() {
    super.onCreate();
    log.debug('RelayStatusForm', 'onCreate');
  }

  /**
   * Render component HTML structure.
   * Uses the same structure as the existing placeholder.
   * Card is clickable to navigate to corresponding menu settings.
   * 
   * @returns {HTMLElement} Component element
   */
  render() {
    const container = document.createElement('div');
    container.className = 'pump-card simple-card relay-card off';
    container.dataset.component = 'RelayStatusForm';
    
    // Make card clickable (cursor pointer)
    container.style.cursor = 'pointer';

    // Initial icon key (will be updated based on relayMode)
    const assetKey = getRelayIcon(this.relayMode);
    const label = getRelayLabel(this.isRelayOn);

    container.innerHTML = `
      <div class="pump-card-icon">
        <img data-asset-key="${assetKey}" alt="Relay" data-ref="icon">
      </div>
      <div class="relay-mode-label" data-ref="modeLabel"></div>
      <div class="pump-card-label" data-ref="label">${label}</div>
    `;

    return container;
  }

  /**
   * Called when component is mounted to DOM.
   */
  onMount() {
    super.onMount();
    
    // Cache DOM references
    this._cacheDom();
    
    // Setup click event listener
    this._setupClickHandler();
    
    log.debug('RelayStatusForm', 'onMount - Component mounted');
  }

  /**
   * Called when component becomes active/visible.
   * Setup reactive subscriptions to Store.
   */
  onActivate() {
    super.onActivate();
    
    // Subscribe to store changes
    this._subscribeToStore();
    
    // Initialize current state
    this._initializeState();

    log.debug('RelayStatusForm', 'onActivate - Component activated');
  }

  /**
   * Setup click event listener on card.
   * Navigates to corresponding menu settings page.
   * 
   * @private
   */
  _setupClickHandler() {
    if (!this.el) {
      log.error('RelayStatusForm', 'Cannot setup click handler: this.el is null');
      return;
    }

    this.el.addEventListener('click', () => this._handleCardClick());
    log.debug('RelayStatusForm', 'Click handler attached');
  }

  /**
   * Handle card click - navigate to menu settings.
   * Maps current relayMode to corresponding menu and navigates.
   * 
   * @private
   */
  _handleCardClick() {
    // Get menu ID from current relay mode
    const menuId = getMenuIdFromRelayMode(this.relayMode);
    
    if (menuId === null) {
      log.warn('RelayStatusForm', `Cannot navigate: relay mode ${this.relayMode} has no corresponding menu`);
      return;
    }

    log.info('RelayStatusForm', `Card clicked - navigating to menu ${menuId} (relay mode: ${this.relayMode})`);
    
    // Set selected menu in Store (same as Sidebar does)
    Store.set(Paths.APP.SELECTED_MENU, menuId);
    
    // Navigate to menu settings page
    NavigatorManager.navigateTo('menuSettingsPage');
  }

  /**
   * Cache DOM element references.
   * 
   * @private
   */
  _cacheDom() {
    if (!this.el) {
      log.error('RelayStatusForm', 'Cannot cache DOM: this.el is null');
      return;
    }

    this.$icon = this.el.querySelector('[data-ref="icon"]');
    this.$label = this.el.querySelector('[data-ref="label"]');
    this.$modeLabel = this.el.querySelector('[data-ref="modeLabel"]');

    log.debug('RelayStatusForm', 'DOM elements cached');
  }

  /**
   * Subscribe to store changes.
   * 
   * @private
   */
  _subscribeToStore() {
    try {
      // Subscribe to config.params array to detect relayMode changes
      this.subscribeToStore(Paths.CONFIG.PARAMS, (params) => {
        if (!Array.isArray(params)) return;
        
        const relayParam = params.find(p => p.id === RELAY_MODE_PARAM_ID);
        if (relayParam && relayParam.value !== undefined) {
          const newMode = relayParam.value;
          if (newMode !== this.relayMode) {
            log.debug('RelayStatusForm', `Relay mode changed: ${this.relayMode} → ${newMode}`);
            this.relayMode = newMode;
            this._updateIcon();
            this._updateModeLabel();
            this._updateVisibility();
          }
        }
      });
    } catch (err) {
      log.warn('RelayStatusForm', 'Unable to subscribe to config.params:', err?.message);
    }

    try {
      // Subscribe to runtime relay state (ON/OFF)
      this.subscribeToStore(Paths.RUNTIME.OUTPUTS.RELAY, (value) => {
        const newState = (value === true || value === 1);
        if (newState !== this.isRelayOn) {
          log.debug('RelayStatusForm', `Relay state changed: ${this.isRelayOn} → ${newState}`);
          this.isRelayOn = newState;
          this._updateState();
        }
      });
    } catch (err) {
      log.warn('RelayStatusForm', 'Unable to subscribe to outputs.extraRelay:', err?.message);
    }

    try {
      // Subscribe to language changes
      this.subscribeToStore(Paths.LOCALIZATION.CURRENT_LANG_INDEX, (langIndex) => {
        if (langIndex !== undefined && langIndex !== this.currentLangIndex) {
          log.debug('RelayStatusForm', `Language changed: ${this.currentLangIndex} → ${langIndex}`);
          this.currentLangIndex = langIndex;
          this._updateModeLabel();
        }
      });
    } catch (err) {
      log.warn('RelayStatusForm', 'Unable to subscribe to currentLangIndex:', err?.message);
    }

    log.debug('RelayStatusForm', 'Store subscriptions created');
  }

  /**
   * Initialize component state from Store.
   * Called once on activation to set initial values.
   * 
   * @private
   */
  _initializeState() {
    try {
      // Get initial relay mode
      const params = Store.get(Paths.CONFIG.PARAMS);
      if (Array.isArray(params)) {
        const relayParam = params.find(p => p.id === RELAY_MODE_PARAM_ID);
        if (relayParam && relayParam.value !== undefined) {
          this.relayMode = relayParam.value;
        }
      }
    } catch (e) {
      log.debug('RelayStatusForm', `Could not get initial relay mode, using default (${RelayModeType.BYPASS})`);
    }

    try {
      // Get initial relay state
      const relayState = Store.get(Paths.RUNTIME.OUTPUTS.RELAY);
      this.isRelayOn = (relayState === true || relayState === 1);
    } catch (e) {
      log.debug('RelayStatusForm', 'Could not get initial relay state, using default (false)');
    }

    try {
      // Get initial language index
      const langIndex = Store.get(Paths.LOCALIZATION.CURRENT_LANG_INDEX);
      if (langIndex !== undefined) {
        this.currentLangIndex = langIndex;
      }
    } catch (e) {
      log.debug('RelayStatusForm', 'Could not get initial language index, using default (1 - Italian)');
    }

    // Apply initial state to UI
    this._updateIcon();
    this._updateModeLabel();
    this._updateState();
    this._updateVisibility();
  }

  /**
   * Update relay icon based on current relay mode.
   * 
   * @private
   */
  _updateIcon() {
    if (!this.$icon) return;

    const assetKey = getRelayIcon(this.relayMode);
    if (this.$icon.getAttribute('data-asset-key') !== assetKey) {
      this.$icon.setAttribute('data-asset-key', assetKey);
      this.$icon.removeAttribute('src');
      this.refreshDeferredImages();
    }

    log.debug('RelayStatusForm', `Icon updated to assetKey: ${assetKey} (mode: ${this.relayMode})`);
  }

  /**
   * Update relay mode label based on current relay mode and language.
   * Label is shown only on small screens (≤340px) via CSS.
   * 
   * @private
   */
  _updateModeLabel() {
    if (!this.$modeLabel) return;

    // Get translated mode name from RELAY_MODE_MAPPING
    const modeMapping = RELAY_MODE_MAPPING[this.relayMode];
    if (!modeMapping) {
      log.warn('RelayStatusForm', `No mapping found for relay mode: ${this.relayMode}`);
      this.$modeLabel.textContent = '';
      return;
    }

    const modeName = modeMapping[this.currentLangIndex] || modeMapping[0]; // Fallback to English
    this.$modeLabel.textContent = modeName;

    log.debug('RelayStatusForm', `Mode label updated: ${modeName} (mode: ${this.relayMode}, lang: ${this.currentLangIndex})`);
  }

  /**
   * Update relay state (ON/OFF label and CSS class).
   * 
   * @private
   */
  _updateState() {
    if (!this.el || !this.$label) return;

    const label = getRelayLabel(this.isRelayOn);
    this.$label.textContent = label;

    // Update CSS classes
    if (this.isRelayOn) {
      this.el.classList.remove('off');
      this.el.classList.add('on');
    } else {
      this.el.classList.remove('on');
      this.el.classList.add('off');
    }

    log.debug('RelayStatusForm', `State updated: ${label} (isOn: ${this.isRelayOn})`);
  }

  /**
   * Update component visibility based on relay mode.
   * Hides component when relay mode is Bypass (0).
   * 
   * @private
   */
  _updateVisibility() {
    if (!this.el) return;

    const hidden = shouldHideRelay(this.relayMode);
    
    if (hidden) {
      this.el.style.display = 'none';
      log.debug('RelayStatusForm', 'Component hidden (Bypass mode)');
    } else {
      this.el.style.display = ''; // Reset to default (flex)
      log.debug('RelayStatusForm', 'Component visible (mode: ' + this.relayMode + ')');
    }
  }

  /**
   * Called when component is deactivated.
   * Cleanup is handled automatically by Component base class.
   */
  onDeactivate() {
    super.onDeactivate();
    log.debug('RelayStatusForm', 'onDeactivate - Component deactivated');
  }

  /**
   * Called when component is destroyed.
   * Final cleanup.
   */
  onDestroy() {
    // Clear DOM references
    this.$icon = null;
    this.$label = null;
    this.$modeLabel = null;

    super.onDestroy();
    log.debug('RelayStatusForm', 'onDestroy');
  }
}
