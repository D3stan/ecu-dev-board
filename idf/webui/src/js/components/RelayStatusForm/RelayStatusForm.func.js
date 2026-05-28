/**
 * RelayStatusForm.func.js
 * ========================
 * Helper functions for RelayStatusForm component.
 * 
 * Functions:
 * - getRelayIcon - Maps relay mode to asset key
 * - getRelayLabel - Returns ON/OFF label based on state
 * - shouldHideRelay - Determines if relay card should be hidden
 * - getMenuIdFromRelayMode - Maps relay mode to corresponding menu ID
 * 
 * @author FogExtra Team
 * @version 1.0.0
 */

import { RelayModeType } from '../../utils/constants.js';
import { MenuType } from '../../utils/menuMapping.js';

/**
 * Get asset key based on relay mode.
 * 
 * Relay modes:
 * - BYPASS = hidden, no icon shown
 * - DISPENSER = Dispenser icon
 * - FAN = Fan icon
 * - ANTIBACTERIAL = Antibacterial icon
 * 
 * @param {number} relayMode - Relay mode value from config.params[22].value
 * @returns {string} Asset catalog key
 * 
 * @example
 * getRelayIcon(RelayModeType.DISPENSER) → "icon-dispenser"
 * getRelayIcon(RelayModeType.FAN) → "icon-fan"
 */
export function getRelayIcon(relayMode) {
  const mode = Number(relayMode);
  
  switch (mode) {
    case RelayModeType.DISPENSER:
      return 'icon-dispenser';
    case RelayModeType.FAN:
      return 'icon-fan';
    case RelayModeType.ANTIBACTERIAL:
      return 'icon-antibacterial';
    default:
      return 'icon-setting'; // Fallback icon
  }
}

/**
 * Get relay state label (ON/OFF).
 * 
 * NOTE: Labels are NOT translated - they are always "ON" or "OFF"
 * regardless of the current UI language.
 * 
 * @param {boolean|number} isOn - Relay state (true/1 = ON, false/0 = OFF)
 * @returns {string} "ON" or "OFF"
 * 
 * @example
 * getRelayLabel(true)  → "ON"
 * getRelayLabel(1)     → "ON"
 * getRelayLabel(false) → "OFF"
 * getRelayLabel(0)     → "OFF"
 */
export function getRelayLabel(isOn) {
  return (isOn === true || isOn === 1) ? 'ON' : 'OFF';
}

/**
 * Determine if relay card should be hidden.
 * Card is hidden when relay mode is set to Bypass.
 * 
 * @param {number} relayMode - Relay mode value from config.params[22].value
 * @returns {boolean} True if card should be hidden
 * 
 * @example
 * shouldHideRelay(RelayModeType.BYPASS) → true  (Bypass mode)
 * shouldHideRelay(RelayModeType.DISPENSER) → false (Dispenser mode)
 * shouldHideRelay(RelayModeType.FAN) → false (Fan mode)
 */
export function shouldHideRelay(relayMode) {
  return (Number(relayMode) === RelayModeType.BYPASS) || (Number(relayMode) === RelayModeType.DISABLE);
}

/**
 * Map relay mode to corresponding menu ID.
 * Used for navigation when clicking on relay card.
 * 
 * @param {number} relayMode - Relay mode value from config.params[22].value
 * @returns {number|null} MenuType ID or null if bypass/invalid
 * 
 * @example
 * getMenuIdFromRelayMode(RelayModeType.DISPENSER) → MenuType.DISPENSER (9)
 * getMenuIdFromRelayMode(RelayModeType.FAN) → MenuType.FAN (8)
 * getMenuIdFromRelayMode(RelayModeType.ANTIBACTERIAL) → MenuType.ANTIBACTERIAL (10)
 * getMenuIdFromRelayMode(RelayModeType.BYPASS) → null (no menu)
 */
export function getMenuIdFromRelayMode(relayMode) {
  const mode = Number(relayMode);
  
  switch (mode) {
    case RelayModeType.DISPENSER:
      return MenuType.DISPENSER;
    case RelayModeType.FAN:
      return MenuType.FAN;
    case RelayModeType.ANTIBACTERIAL:
      return MenuType.ANTIBACTERIAL;
    case RelayModeType.BYPASS:
    default:
      return null; // No menu for bypass mode
  }
}
