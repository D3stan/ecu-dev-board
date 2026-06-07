/**
 * BadgeFunctions.js
 * =================
 * Helper functions for Badge component to map store values to display states.
 * 
 * @author FogExtra Team
 * @version 1.0.0
 */

import { SocketState, PumpState } from '../../utils/constants.js';

/**
 * Maps socket connection state to badge display configuration.
 * 
 * @param {string} state - Socket state from store (SocketState values)
 * @returns {Object} Object with label ( key) and CSS class
 * 
 * @example
 * mapSocketStateToBadge('connected')
 * // Returns: { label: 'ui.connected', class: 'connected' }
 */
export function mapSocketStateToBadge(state) {
  switch (state) {
    case SocketState.CONNECTED:
      return { label: 'ui.connected', class: 'connected' };
    
    case SocketState.CONNECTING:
      return { label: 'ui.connecting', class: 'connecting' };
    
    case SocketState.RECONNECTING:
      return { label: 'ui.reconnecting', class: 'connecting' }; // Same style as connecting
    
    case SocketState.DISCONNECTED:
    default:
      return { label: 'ui.disconnected', class: 'error' };
  }
}

/**
 * Maps pump state to badge display configuration.
 * 
 * @param {number} state - Pump state from store (PumpState enum values)
 * @returns {Object} Object with label (i18n key) and CSS class
 * 
 * @example
 * mapPumpStateToBadge(1)
 * // Returns: { label: 'ui.pumpOn', class: 'on' }
 */
export function mapPumpStateToBadge(state) {
  switch (state) {
    case PumpState.ON:
      return { label: 'ui.pumpOn', class: 'on' };
    
    case PumpState.OFF:
      return { label: 'ui.pumpOff', class: 'off' };
    
    case PumpState.LOW_PRESSURE:
      return { label: 'ui.pumpLowPressure', class: 'warning' };
    
    case PumpState.BLOCCKED:
      return { label: 'ui.pumpBlocked', class: 'error' };
    
    case PumpState.TESTING:
      return { label: 'ui.pumpTesting', class: 'testing' };
    
    default:
      return { label: 'ui.pumpOff', class: 'off' };
  }
}
