/**
 * SensorsForm.js
 * ==============
 * Main container for the Sensors section on the Home page.
 * 
 * Features:
 * - Orchestrates all sensor-related subcomponents
 * - Maintains responsive 6-column grid layout
 * - Auto-updates title on language change (i18n)
 * - Lifecycle management for child components
 * 
 * Child Components (to be added):
 * - Badge (connection) - Shows socket connection state
 * - Badge (pump) - Shows pump operational state  
 * - TimerForm - Displays ON/OFF timers
 * - SensorCard (temperature) - Temperature sensor data
 * - SensorCard (humidity) - Humidity sensor data
 * - RelayForm - Optional relay/fan control (conditional)
 * 
 * @author FogExtra Team
 * @version 1.0.0
 */

import { Component } from '../../../core/Component.js';
import { Store } from '../../../core/store.js';
import { Paths } from '../../../utils/paths.js';
import { i18n } from '../../../utils/i18n.js';
import { log } from '../../../utils/logger.js';
import { TEMP_SETPOINT_PARAM_ID, HUM_SETPOINT_PARAM_ID } from '../../../utils/constants.js';
import { Badge } from '../../Badge/Badge.js';
import { mapSocketStateToBadge } from '../../Badge/BadgeFunctions.js';
import { TimerForm } from '../../TimerForm/TimerForm.js';
import { RelayStatusForm } from '../../RelayStatusForm/RelayStatusForm.js';
import { SensorCard } from '../../SensorCard/SensorCard.js';

export class SensorsForm extends Component {
  /**
   * Create SensorsForm instance.
   * 
   * @param {Object} options - Component configuration
   */
  constructor(options = {}) {
    super({
      id: options.id || 'sensors-form',
      ...options
    });

    // Child component references (to be implemented)
    this.connectionBadge = null;
    this.pumpBadge = null;
    this.timerForm = null;
    this.temperatureCard = null;
    this.humidityCard = null;
    this.relayForm = null;

    // Enable automatic translation updates
    this.enableI18n(() => this._updateTitle());

    log.debug('SensorsForm', 'Created');
  }

  /**
   * Called when component is created.
   */
  onCreate() {
    super.onCreate();
    log.debug('SensorsForm', 'onCreate');
  }

  /**
   * Render component HTML structure.
   * Returns static HTML with placeholders for child components.
   * 
   * @returns {HTMLElement} Component element
   */
  render() {
    const container = document.createElement('div');
    container.className = 'pump-section';

    container.innerHTML = `
      <!-- Header: Title + Connection Badge -->
      <div class="pump-header">
        <h2 class="section-title sensors-title">${i18n.t('ui.sensors') || 'Sensors'}</h2>
        <div id="connection-badge-container"></div>
      </div>
      
      <!-- Grid Container: 6 columns × 2 rows -->
      <div class="pump-cards">
        
        <!-- Timer Card will be mounted here by TimerForm component -->
        
        <!-- Relay Status Card will be mounted here by RelayStatusForm component -->
        
        <!-- Temperature Sensor Card will be mounted here by SensorCard component -->
        
        <!-- Humidity Sensor Card will be mounted here by SensorCard component -->
        
      </div>
    `;

    return container;
  }

  /**
   * Called when component is mounted to DOM.
   * Setup child components and event listeners.
   */
  onMount() {
    super.onMount();
    
    // Mount connection badge
    this._mountConnectionBadge();
    
    // Mount sensor cards (Top)
    this._mountSensorCards();
    
    // Mount timer form (Middle)
    this._mountTimerForm();
    
    // Mount relay status form (Bottom)
    this._mountRelayForm();

    log.debug('SensorsForm', 'onMount - Component mounted');
  }

  /**
   * Called when component becomes active/visible.
   * Setup reactive subscriptions to Store.
   */
  onActivate() {
    super.onActivate();
    
    // Subscribe to visibility changes
    this._subscribeToVisibilityChanges();
    
    // Initial visibility check
    this._updateSensorVisibility();
    
    // TODO: Subscribe to Store when child components are ready
    // For now, force initial update
    this.update();

    log.debug('SensorsForm', 'onActivate - Component activated');
  }

  /**
   * Update component display.
   * Called when reactive data changes or manually triggered.
   */
  update() {
    // TODO: Update child components when implemented
    // For now, no-op since we're rendering static HTML
    
    log.debug('SensorsForm', 'update - Component updated');
  }

  /**
   * Subscribe to store changes for sensor visibility.
   * @private
   */
  _subscribeToVisibilityChanges() {
    const paths = [
      Paths.RUNTIME.SENSORS.TEMP_CONNECTED,
      Paths.RUNTIME.MODES.TEMP_ENABLED,
      Paths.RUNTIME.SENSORS.HUM_CONNECTED,
      Paths.RUNTIME.MODES.HUM_ENABLED
    ];

    paths.forEach(path => {
      this.subscribeToStore(path, () => this._updateSensorVisibility());
    });
  }

  /**
   * Update visibility and layout of sensor cards based on connection and mode status.
   * @private
   */
  _updateSensorVisibility() {
    if (!this.temperatureCard?.el || !this.humidityCard?.el) return;

    const tempConnected = Store.get(Paths.RUNTIME.SENSORS.TEMP_CONNECTED);
    const tempEnabled = Store.get(Paths.RUNTIME.MODES.TEMP_ENABLED);
    const humConnected = Store.get(Paths.RUNTIME.SENSORS.HUM_CONNECTED);
    const humEnabled = Store.get(Paths.RUNTIME.MODES.HUM_ENABLED);

    // Show if connected OR enabled
    const showTemp = tempConnected || tempEnabled;
    const showHum = humConnected || humEnabled;

    // Update display
    this.temperatureCard.el.style.display = showTemp ? '' : 'none';
    this.humidityCard.el.style.display = showHum ? '' : 'none';

    // Update grid sizing
    if (showTemp && showHum) {
      // Both visible: share space (3 cols each)
      this.temperatureCard.el.style.gridColumn = 'span 3';
      this.humidityCard.el.style.gridColumn = 'span 3';
      this.temperatureCard.el.classList.remove('full-width');
      this.humidityCard.el.classList.remove('full-width');
    } else if (showTemp) {
      // Only temp: full width
      this.temperatureCard.el.style.gridColumn = 'span 6';
      this.temperatureCard.el.classList.add('full-width');
    } else if (showHum) {
      // Only hum: full width
      this.humidityCard.el.style.gridColumn = 'span 6';
      this.humidityCard.el.classList.add('full-width');
    }
    
    log.debug('SensorsForm', `Visibility updated - Temp: ${showTemp}, Hum: ${showHum}`);
  }

  /**
   * Update section title with translated text.
   * Called automatically when language changes (via enableI18n).
   * 
   * @private
   */
  _updateTitle() {
    if (!this.el) return;

    const titleElement = this.el.querySelector('.section-title');
    if (titleElement) {
      titleElement.textContent = i18n.t('ui.sensors') || 'Sensors';
      log.debug('SensorsForm', 'Title updated to:', titleElement.textContent);
    }
  }

  /**
   * Mount child components (placeholder methods for future implementation).
   * These will be implemented when Badge, TimerForm, SensorCard, RelayForm are created.
   * 
   * @private
   */
  
  /**
   * Mount connection badge component.
   * Subscribes to socket.state and displays connection status.
   * @private
   */
  _mountConnectionBadge() {
    log.debug('SensorsForm', '_mountConnectionBadge called');
    
    if (!this.el) {
      log.error('SensorsForm', 'Cannot mount connection badge: this.el is null');
      return;
    }
    
    const container = this.el.querySelector('#connection-badge-container');
    if (!container) {
      log.error('SensorsForm', 'Connection badge container not found');
      return;
    }

    log.debug('SensorsForm', 'Connection badge container found');

    // Create Badge component for socket connection state
    this.connectionBadge = new Badge({
      storePath: 'socket.state',
      mapFunction: mapSocketStateToBadge,
      defaultState: { 
        label: 'ui.disconnected', 
        class: 'error' 
      }
    });

    log.debug('SensorsForm', 'Connection badge instance created');

    // Mount in dedicated placeholder, then register parent/child ownership
    this.connectionBadge.mount(container);
    this.addChild(this.connectionBadge);

    log.debug('SensorsForm', 'Connection badge mounted and activated successfully');
  }

  /**
   * Mount timer form component.
   * Displays ON/OFF timers with navigation to editor.
   * @private
   */
  _mountTimerForm() {
    log.debug('SensorsForm', '_mountTimerForm called');
    
    if (!this.el) {
      log.error('SensorsForm', 'Cannot mount timer form: this.el is null');
      return;
    }
    
    // Mount directly into .pump-cards grid
    const gridContainer = this.el.querySelector('.pump-cards');
    if (!gridContainer) {
      log.error('SensorsForm', 'Grid container .pump-cards not found');
      return;
    }

    log.debug('SensorsForm', 'Grid container found');

    // Create TimerForm component
    this.timerForm = new TimerForm();

    log.debug('SensorsForm', 'TimerForm instance created');

    // Mount in grid, then register parent/child ownership
    this.timerForm.mount(gridContainer);
    this.addChild(this.timerForm);

    log.debug('SensorsForm', 'TimerForm mounted and activated successfully');
  }

  /**
   * Mount relay status form component.
   * Displays relay status (Dispenser/Fan/Antibacterial) with ON/OFF state.
   * Automatically hides when relayMode = 0 (Bypass).
   * @private
   */
  _mountRelayForm() {
    log.debug('SensorsForm', '_mountRelayForm called');
    
    if (!this.el) {
      log.error('SensorsForm', 'Cannot mount relay form: this.el is null');
      return;
    }
    
    // Mount into .pump-cards grid
    const gridContainer = this.el.querySelector('.pump-cards');
    if (!gridContainer) {
      log.error('SensorsForm', 'Grid container .pump-cards not found');
      return;
    }

    log.debug('SensorsForm', 'Grid container found');

    // Create RelayStatusForm component
    this.relayForm = new RelayStatusForm();

    log.debug('SensorsForm', 'RelayStatusForm instance created');

    // Mount in grid, then register parent/child ownership
    this.relayForm.mount(gridContainer);
    this.addChild(this.relayForm);

    log.debug('SensorsForm', 'RelayStatusForm mounted and activated successfully');
  }

  /**
   * Mount sensor cards (temperature and humidity).
   * Displays live sensor readings with setpoint indicators.
   * @private
   */
  _mountSensorCards() {
    log.debug('SensorsForm', '_mountSensorCards called');
    
    if (!this.el) {
      log.error('SensorsForm', 'Cannot mount sensor cards: this.el is null');
      return;
    }
    
    const gridContainer = this.el.querySelector('.pump-cards');
    if (!gridContainer) {
      log.error('SensorsForm', 'Grid container .pump-cards not found');
      return;
    }

    log.debug('SensorsForm', 'Grid container found');

    // Create Temperature SensorCard
    this.temperatureCard = new SensorCard({
      paramId: TEMP_SETPOINT_PARAM_ID,
      sensorPath: Paths.RUNTIME.SENSORS.TEMP_VALUE,
      assetKey: 'icon-thermo',
      decimals: 1
    });

    log.debug('SensorsForm', 'Temperature SensorCard instance created');

    // Mount in grid, then register parent/child ownership
    this.temperatureCard.mount(gridContainer);
    this.addChild(this.temperatureCard);

    log.debug('SensorsForm', 'Temperature SensorCard mounted and activated');

    // Create Humidity SensorCard
    this.humidityCard = new SensorCard({
      paramId: HUM_SETPOINT_PARAM_ID,
      sensorPath: Paths.RUNTIME.SENSORS.HUM_VALUE,
      assetKey: 'icon-humidity',
      decimals: 0
    });

    log.debug('SensorsForm', 'Humidity SensorCard instance created');

    // Mount in grid, then register parent/child ownership
    this.humidityCard.mount(gridContainer);
    this.addChild(this.humidityCard);

    log.debug('SensorsForm', 'Humidity SensorCard mounted and activated');
    log.debug('SensorsForm', 'All sensor cards mounted successfully');
  }

  /**
   * Destroy child components when component is destroyed.
   * 
   * @private
   */
  _destroyChildComponents() {
    // Destroy all child components
    const components = [
      this.connectionBadge,
      this.pumpBadge,
      this.timerForm,
      this.temperatureCard,
      this.humidityCard,
      this.relayForm
    ];

    components.forEach(component => {
      if (component && typeof component.destroy === 'function') {
        component.destroy();
      }
    });

    // Clear references
    this.connectionBadge = null;
    this.pumpBadge = null;
    this.timerForm = null;
    this.temperatureCard = null;
    this.humidityCard = null;
    this.relayForm = null;

    log.debug('SensorsForm', 'All child components destroyed');
  }

  /**
   * Called when component is destroyed.
   * Cleanup all resources and child components.
   */
  onDestroy() {
    // Child cleanup is handled by Component.destroy() via addChild ownership.
    super.onDestroy();
    log.debug('SensorsForm', 'onDestroy');
  }
}
