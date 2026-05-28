/**
 * SensorCard.js
 * =============
 * Component that displays a sensor reading (temperature or humidity) with:
 * - Current sensor value (live reading)
 * - Setpoint value (target from parameter)
 * - Progress bar showing both values
 * - Min/Max range labels
 * 
 * Features:
 * - Reactive updates via Observer pattern
 * - Click to navigate to parameter editor
 * - Reuses exact HTML/CSS from SensorsForm placeholders
 * 
 * Store Subscriptions:
 * - sensorPath (runtime.sensors.temperature.value or humidity.value)
 * - config.params (for setpoint, min, max, unit)
 * 
 * @author FogExtra Team
 * @version 1.0.0
 */

import { Component } from '../../core/Component.js';
import { Store } from '../../core/store.js';
import { NavigatorManager } from '../../managers/navigatorManager.js';
import { Paths } from '../../utils/paths.js';
import { log } from '../../utils/logger.js';
import { 
  formatSensorValue, 
  calculateMarkerPosition,
  calculateBarFillPosition,
  convertToDisplay 
} from './SensorCard.func.js';

export class SensorCard extends Component {
  /**
   * Create SensorCard instance.
   * 
   * @param {Object} options - Component configuration
   * @param {number} options.paramId - Parameter ID for setpoint (0=temp, 4=humidity)
   * @param {string} options.sensorPath - Store path to sensor value
   * @param {string} options.assetKey - Catalog key for sensor icon
   */
  constructor(options = {}) {
    super({
      id: options.id || 'sensor-card',
      ...options
    });

    // Validate required options
    if (typeof options.paramId !== 'number') {
      throw new Error('SensorCard: paramId is required');
    }
    if (!options.sensorPath) {
      throw new Error('SensorCard: sensorPath is required');
    }
    if (!options.assetKey) {
      throw new Error('SensorCard: assetKey is required');
    }

    // Store configuration
    this.paramId = options.paramId;
    this.sensorPath = options.sensorPath;
    this.assetKey = options.assetKey;
    this.decimals = options.decimals !== undefined ? options.decimals : null;

    // Component state
    this.param = null;           // Parameter object from store
    this.sensorValue = null;     // Current sensor reading
    this.sensorConnected = false; // Sensor connection status
    this.setpointDisplay = null; // Setpoint value (converted with divisor)
    this.minDisplay = null;      // Min value (converted with divisor)
    this.maxDisplay = null;      // Max value (converted with divisor)

    // Cached DOM references
    this.$sensorValue = null;
    this.$barFill = null;
    this.$barMarker = null;
    this.$minLabel = null;
    this.$maxLabel = null;
    this.$setpointLabel = null;

    log.debug('SensorCard', `Created for param ${this.paramId}, sensor path: ${this.sensorPath}`);
  }

  /**
   * Called when component is created.
   */
  onCreate() {
    super.onCreate();
    log.debug('SensorCard', 'onCreate');
  }

  /**
   * Render component HTML structure.
   * Uses exact structure from SensorsForm placeholder.
   * 
   * @returns {HTMLElement} Component element
   */
  render() {
    const container = document.createElement('div');
    container.className = 'pump-card sensor-card';
    container.dataset.component = 'SensorCard';
    container.dataset.paramId = this.paramId;

    // Initial values (will be updated by subscriptions)
    const unit = this.param?.unit || '';
    const displayValue = formatSensorValue(this.sensorValue, unit, this.decimals);

    container.innerHTML = `
      <div class="sensor-card-top">
        <div class="pump-card-icon">
          <img data-asset-key="${this.assetKey}" alt="Sensor">
        </div>
        <div class="sensor-value-container">
          <div class="pump-card-value" data-ref="value">${displayValue}</div>
        </div>
      </div>
      <div class="sensor-bar-container">
        <div class="sensor-bar-track">
          <div class="sensor-bar-fill" data-ref="fill" style="width: 0%;"></div>
          <div class="sensor-setpoint-marker" data-ref="marker" style="left: 50%;"></div>
        </div>
        <div class="sensor-bar-labels">
          <span class="sensor-bar-label" data-ref="min">--</span>
          <span class="sensor-setpoint" data-ref="setpoint">--</span>
          <span class="sensor-bar-label" data-ref="max">--</span>
        </div>
      </div>
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
    
    // Bind click event
    this._bindEvents();
    
    log.debug('SensorCard', 'onMount - Component mounted');
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

    log.debug('SensorCard', 'onActivate - Component activated');
  }

  /**
   * Cache DOM element references.
   * 
   * @private
   */
  _cacheDom() {
    if (!this.el) {
      log.error('SensorCard', 'Cannot cache DOM: this.el is null');
      return;
    }

    this.$sensorValue = this.el.querySelector('[data-ref="value"]');
    this.$barFill = this.el.querySelector('[data-ref="fill"]');
    this.$barMarker = this.el.querySelector('[data-ref="marker"]');
    this.$minLabel = this.el.querySelector('[data-ref="min"]');
    this.$maxLabel = this.el.querySelector('[data-ref="max"]');
    this.$setpointLabel = this.el.querySelector('[data-ref="setpoint"]');

    log.debug('SensorCard', 'DOM elements cached');
  }

  /**
   * Bind click event listener.
   * 
   * @private
   */
  _bindEvents() {
    if (!this.el) {
      log.error('SensorCard', 'Cannot bind events: this.el is null');
      return;
    }

    // Click anywhere on card navigates to parameter editor
    this.el.addEventListener('click', () => {
      if (!this.param) {
        log.warn('SensorCard', 'Click ignored: param not loaded yet');
        return;
      }

      log.debug('SensorCard', `Card clicked - navigating to parameter editor for param ${this.paramId}`);
      NavigatorManager.navigateTo('parameterEditorPage', { param: this.param });
    });

    // Add cursor pointer to indicate clickability
    this.el.style.cursor = 'pointer';

    log.debug('SensorCard', 'Events bound');
  }

  /**
   * Subscribe to store changes.
   * 
   * @private
   */
  _subscribeToStore() {
    try {
      // Subscribe to sensor value changes
      this.subscribeToStore(this.sensorPath, (value) => {
        log.debug('SensorCard', `Sensor value changed: ${this.sensorValue} → ${value}`);
        this.sensorValue = value;
        this._updateSensorValue();
        this._updateBar();
      });
    } catch (err) {
      log.warn('SensorCard', `Unable to subscribe to ${this.sensorPath}:`, err?.message);
    }

    try {
      // Subscribe to sensor connected status
      const connectedPath = this.sensorPath.replace('.value', '.connected');
      this.subscribeToStore(connectedPath, (isConnected) => {
        log.debug('SensorCard', `Sensor connection status: ${isConnected}`);
        this.sensorConnected = isConnected;
        this._updateBar();
      });
    } catch (err) {
      log.warn('SensorCard', `Unable to subscribe to sensor connection: ${err?.message}`);
    }

    try {
      // Subscribe to config.params for setpoint, min, max changes
      this.subscribeToStore(Paths.CONFIG.PARAMS, (params) => {
        if (!Array.isArray(params)) return;
        
        const param = params.find(p => p.id === this.paramId);
        if (param) {
          log.debug('SensorCard', `Parameter changed for id ${this.paramId}`);
          this.param = param;
          this._updateParamValues();
          this._updateBar();
        }
      });
    } catch (err) {
      log.warn('SensorCard', 'Unable to subscribe to config.params:', err?.message);
    }

    log.debug('SensorCard', 'Store subscriptions created');
  }

  /**
   * Initialize component state from Store.
   * Called once on activation to set initial values.
   * 
   * @private
   */
  _initializeState() {
    try {
      // Get initial sensor value
      const sensorValue = Store.get(this.sensorPath);
      this.sensorValue = sensorValue;
      log.debug('SensorCard', `Initial sensor value: ${sensorValue}`);
    } catch (e) {
      log.debug('SensorCard', `Could not get initial sensor value from ${this.sensorPath}`);
    }

    try {
      // Get initial sensor connected status
      const connectedPath = this.sensorPath.replace('.value', '.connected');
      const isConnected = Store.get(connectedPath);
      this.sensorConnected = isConnected;
      log.debug('SensorCard', `Initial sensor connected: ${isConnected}`);
    } catch (e) {
      log.debug('SensorCard', `Could not get initial sensor connection status`);
    }

    try {
      // Get initial parameter
      const params = Store.get(Paths.CONFIG.PARAMS);
      if (Array.isArray(params)) {
        const param = params.find(p => p.id === this.paramId);
        if (param) {
          this.param = param;
          log.debug('SensorCard', `Initial parameter loaded:`, param);
        }
      }
    } catch (e) {
      log.debug('SensorCard', 'Could not get initial parameter');
    }

    // Apply initial state to UI
    this._updateSensorValue();
    this._updateParamValues();
    this._updateBar();
  }

  /**
   * Update sensor value display.
   * 
   * @private
   */
  _updateSensorValue() {
    if (!this.$sensorValue || !this.param) return;

    const unit = this.param.unit || '';
    const formattedValue = formatSensorValue(this.sensorValue, unit, this.decimals);
    this.$sensorValue.textContent = formattedValue;

    log.debug('SensorCard', `Sensor value updated: ${formattedValue}`);
  }

  /**
   * Update parameter-based values (setpoint, min, max).
   * Applies divisor conversion for display.
   * 
   * @private
   */
  _updateParamValues() {
    if (!this.param) return;

    const divisor = this.param.divisor || 1;
    const unit = this.param.unit || '';

    // Convert internal values to display values
    this.setpointDisplay = convertToDisplay(this.param.value, divisor);
    this.minDisplay = convertToDisplay(this.param.min, divisor);
    this.maxDisplay = convertToDisplay(this.param.max, divisor);

    // Update labels
    if (this.$setpointLabel) {
      this.$setpointLabel.textContent = formatSensorValue(this.setpointDisplay, unit, this.decimals);
    }
    if (this.$minLabel) {
      this.$minLabel.textContent = formatSensorValue(this.minDisplay, unit, this.decimals);
    }
    if (this.$maxLabel) {
      this.$maxLabel.textContent = formatSensorValue(this.maxDisplay, unit, this.decimals);
    }

    log.debug('SensorCard', `Param values updated - setpoint: ${this.setpointDisplay}, min: ${this.minDisplay}, max: ${this.maxDisplay}`);
  }

  /**
   * Update progress bar fill and setpoint marker.
   * Handles both positive-only, negative-only, and mixed ranges (crossing zero).
   * 
   * @private
   */
  _updateBar() {
    if (!this.$barFill || !this.$barMarker) return;
    
    // If no parameter, cannot calculate anything
    if (!this.param) {
      this.$barFill.style.width = '0%';
      this.$barFill.style.marginLeft = '0%';
      this.$barMarker.style.left = '50%';
      return;
    }

    const setpoint = this.setpointDisplay;
    const min = this.minDisplay;
    const max = this.maxDisplay;
    
    // ✅ ALWAYS update marker position (independent of sensor connection)
    const markerPosition = calculateMarkerPosition(setpoint, min, max);
    this.$barMarker.style.left = `${markerPosition}%`;
    
    // ✅ Update bar fill ONLY if sensor is connected and has valid value
    if (!this.sensorConnected || this.sensorValue === null || this.sensorValue === undefined) {
      this.$barFill.style.width = '0%';
      this.$barFill.style.marginLeft = '0%';
      log.debug('SensorCard', `Marker updated to ${markerPosition}% - Sensor disconnected, bar empty`);
      return;
    }

    const value = this.sensorValue;
    
    // Calculate bar fill position using helper function
    const { fillStart, fillWidth } = calculateBarFillPosition(value, min, max);
    this.$barFill.style.marginLeft = `${fillStart}%`;
    this.$barFill.style.width = `${fillWidth}%`;

    log.debug('SensorCard', `Bar updated - fill: ${fillWidth}% at ${fillStart}%, marker: ${markerPosition}%`);
  }

  /**
   * Called when component is deactivated.
   * Cleanup is handled automatically by Component base class.
   */
  onDeactivate() {
    super.onDeactivate();
    log.debug('SensorCard', 'onDeactivate - Component deactivated');
  }

  /**
   * Called when component is destroyed.
   * Final cleanup.
   */
  onDestroy() {
    // Clear DOM references
    this.$sensorValue = null;
    this.$barFill = null;
    this.$barMarker = null;
    this.$minLabel = null;
    this.$maxLabel = null;
    this.$setpointLabel = null;

    // Clear state
    this.param = null;
    this.sensorValue = null;

    super.onDestroy();
    log.debug('SensorCard', 'onDestroy');
  }
}
