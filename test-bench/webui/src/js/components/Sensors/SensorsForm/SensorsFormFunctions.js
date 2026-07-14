/**
 * SensorsFormFunctions.js
 * =======================
 * Helper functions for SensorsForm component.
 * 
 * Provides utility functions for:
 * - Data transformation
 * - State mapping
 * - Formatting
 * 
 * @author FogExtra Team
 * @version 1.0.0
 */

/**
 * Map socket state to human-readable label.
 * 
 * @param {number} state - Socket state (from SocketState enum)
 * @returns {string} Human-readable label
 */
export function mapSocketState(state) {
  const labels = {
    0: 'Disconnected',
    1: 'Connecting',
    2: 'Connected'
  };
  
  return labels[state] || 'Unknown';
}

/**
 * Map pump state to human-readable label.
 * 
 * @param {number} state - Pump state (from PumpState enum)
 * @returns {string} Human-readable label
 */
export function mapPumpState(state) {
  const labels = {
    0: 'Off',
    1: 'On',
    2: 'Low Pressure',
    3: 'Blocked',
    4: 'Testing'
  };
  
  return labels[state] || 'Unknown';
}

/**
 * Get CSS class for socket state badge.
 * 
 * @param {number} state - Socket state
 * @returns {string} CSS class name
 */
export function getSocketStateClass(state) {
  const classes = {
    0: 'disconnected',
    1: 'connecting',
    2: 'connected'
  };
  
  return classes[state] || 'disconnected';
}

/**
 * Get CSS class for pump state badge.
 * 
 * @param {number} state - Pump state
 * @returns {string} CSS class name
 */
export function getPumpStateClass(state) {
  const classes = {
    0: 'off',
    1: 'on',
    2: 'warning',
    3: 'error',
    4: 'testing'
  };
  
  return classes[state] || 'off';
}

/**
 * Format timer value (seconds) to mm:ss.
 * 
 * @param {number} seconds - Timer value in seconds
 * @returns {string} Formatted time (mm:ss)
 */
export function formatTimerValue(seconds) {
  if (!seconds || seconds === 0) return '00:00';
  
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Calculate sensor bar position and width.
 * 
 * @param {number} value - Current sensor value
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @param {number} setpoint - Setpoint value
 * @returns {Object} { barWidth, barMargin, setpointPosition }
 */
export function calculateSensorBarPosition(value, min, max, setpoint) {
  const range = max - min;
  
  if (range === 0) {
    return { barWidth: 0, barMargin: 0, setpointPosition: 50 };
  }
  
  // Calculate bar width and position
  const valuePercent = ((value - min) / range) * 100;
  const setpointPercent = ((setpoint - min) / range) * 100;
  
  // Bar starts from min or value (whichever is smaller)
  const barStart = Math.min(valuePercent, setpointPercent);
  const barEnd = Math.max(valuePercent, setpointPercent);
  const barWidth = barEnd - barStart;
  const barMargin = barStart;
  
  return {
    barWidth: Math.max(0, Math.min(100, barWidth)),
    barMargin: Math.max(0, Math.min(100, barMargin)),
    setpointPosition: Math.max(0, Math.min(100, setpointPercent))
  };
}

import { RelayModeType } from '../../../utils/constants.js';

/**
 * Check if relay form should be visible based on relay mode.
 * 
 * @param {number} relayMode - Relay mode value
 * @returns {boolean} True if relay form should be visible
 */
export function isRelayFormVisible(relayMode) {
  // Hidden only if Bypass
  return relayMode !== RelayModeType.BYPASS;
}

/**
 * Get timer form column span based on relay visibility.
 * 
 * @param {boolean} relayVisible - Whether relay form is visible
 * @returns {number} Number of grid columns to span (4 or 6)
 */
export function getTimerFormColumnSpan(relayVisible) {
  return relayVisible ? 4 : 6;
}
