/**
 * TimerForm.func.js
 * =================
 * Pure helper functions for TimerForm component.
 * 
 * Functions:
 * - formatTime - Converts seconds to MM:SS format
 * - isBypassMode - Checks if relay is in Bypass mode
 * 
 * @author FogExtra Team
 * @version 1.0.0
 */

import { RelayModeType } from '../../utils/constants.js';

/**
 * Format time value to MM:SS string.
 * Handles both numeric (seconds) and string (MM:SS) inputs.
 * 
 * @param {number|string} value - Time in seconds or "MM:SS" format
 * @returns {string} Formatted time string "MM:SS"
 * 
 * @example
 * formatTime(90)        → "01:30"
 * formatTime(0)         → "00:00"
 * formatTime("02:15")   → "02:15"
 * formatTime(3661)      → "61:01"
 */
export function formatTime(value) {
  // If already formatted as MM:SS, return as-is
  if (typeof value === 'string' && value.includes(':')) {
    return value;
  }

  // Convert to integer seconds
  const totalSeconds = parseInt(value) || 0;
  
  // Calculate minutes and seconds
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  // Pad with zeros and format
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  
  return `${mm}:${ss}`;
}

/**
 * Check if relay mode is set to Bypass.
 * 
 * Relay mode values:
 * - BYPASS = relay card hidden, timer card expands
 * - DISPENSER = Dispenser mode
 * - FAN = Fan mode
 * - ANTIBACTERIAL = Antibacterial mode
 * 
 * @param {number|string} relayMode - Relay mode value from config
 * @returns {boolean} True if mode is Bypass
 * 
 * @example
 * isBypassMode(RelayModeType.BYPASS) → true
 * isBypassMode(RelayModeType.DISPENSER) → false
 * isBypassMode(RelayModeType.FAN) → false
 */
export function isHideMode(relayMode) {
  return (Number(relayMode) === RelayModeType.BYPASS) || (Number(relayMode) === RelayModeType.DISABLE);
}
