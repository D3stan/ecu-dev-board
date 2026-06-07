/**
 * PowerButton.func.js
 * ====================
 * Helper functions for PowerButton component logic and DOM updates.
 * 
 * @author FogExtra Team
 * @version 1.0.0
 */

import { i18n } from '../../utils/i18n.js';
import { log } from '../../utils/logger.js';

/**
 * Determines the PowerButton state based on parameter and active status.
 * 
 * @param {Object} param - Parameter object with value property
 * @param {boolean} isActive - Whether the power is currently active
 * @returns {string} State: 'hidden', 'off', 'on'
 */
export function getPowerButtonState(param, isActive) {
  // If parameter is disabled (value = 0), hide button
  if (!param || param.value === 0) {
    return 'hidden';
  }
  
  // If parameter is enabled (value = 1), show with current active state
  return isActive ? 'on' : 'off';
}

/**
 * Checks if the power button should be clickable.
 * 
 * @param {Object} param - Parameter object with value property
 * @returns {boolean} True if button is clickable (visible and enabled)
 */
export function isButtonClickable(param) {
  return param && param.value === 1;
}

/**
 * Updates the PowerButton DOM element with current state.
 * 
 * @param {HTMLElement} element - PowerButton container element
 * @param {string} state - Button state: 'hidden', 'off', 'on'
   * @param {string} assetKey - Catalog asset key for the power icon
   */
export function updatePowerButtonDOM(element, state, assetKey) {
  // Handle hidden state
  if (state === 'hidden') {
    element.style.display = 'none';
    log.debug('PowerButton.func', 'Button hidden (parameter disabled)');
    return;
  }

  // Show element
  element.style.display = '';

  const button = element.querySelector('.power-button');
  const icon = element.querySelector('.power-icon');
  const label = element.querySelector('.power-label');

  if (!button || !icon || !label) {
    log.error('PowerButton.func', 'Missing button child elements');
    return;
  }

  // Update button classes
  button.classList.remove('on', 'off');
  button.classList.add(state);

  // Update icon source if needed
  if (assetKey) {
    if (icon.getAttribute('data-asset-key') !== assetKey) {
      icon.setAttribute('data-asset-key', assetKey);
      icon.removeAttribute('src');
    }
  }

  // Update label text
  const labelText = state === 'on' ? 'On' : 'Off';
  
  // Try to get translated text, fallback to default
  try {
    label.textContent = i18n.t(`ui.power${labelText}`) || labelText;
  } catch (e) {
    label.textContent = labelText;
  }

  log.debug('PowerButton.func', `Button updated: ${state.toUpperCase()}`);
}

/**
 * Creates the PowerButton HTML structure.
 * 
   * @param {string} assetKey - Catalog asset key for the power icon
   * @returns {string} HTML string for the PowerButton
   */
export function createPowerButtonHTML(assetKey) {
    return `
      <div class="power-button-container">
        <button class="power-button off" type="button" aria-label="Power toggle">
          <img data-asset-key="${assetKey}" alt="Power Icon" class="power-icon">
          <span class="power-label"></span>
        </button>
      </div>
  `;
}

/**
 * Handles the power button click event.
 * 
 * @param {boolean} currentState - Current active state (true = ON, false = OFF)
 * @param {Function} callback - Callback function to execute with new state
 */
export function handlePowerButtonClick(currentState, callback) {
  if (typeof callback !== 'function') {
    log.error('PowerButton.func', 'handlePowerButtonClick: callback must be a function');
    return;
  }

  const newState = !currentState;
  
  log.debug('PowerButton.func', `Power button clicked: ${currentState ? 'ON' : 'OFF'} → ${newState ? 'ON' : 'OFF'}`);
  
  // Execute callback with new state
  try {
    callback(newState);
  } catch (error) {
    log.error('PowerButton.func', 'Error executing power button callback:', error);
  }
}

/**
 * Validates PowerButton component props.
 * 
 * @param {Object} props - Component props to validate
 * @returns {boolean} True if props are valid
 */
export function validatePowerButtonProps(props) {
  const { assetKey, callback, storePath, paramId } = props;

  if (!assetKey || typeof assetKey !== 'string') {
    log.error('PowerButton.func', 'assetKey must be a non-empty string');
    return false;
  }

  if (typeof callback !== 'function') {
    log.error('PowerButton.func', 'callback must be a function');
    return false;
  }

  if (!storePath || typeof storePath !== 'string') {
    log.error('PowerButton.func', 'storePath must be a non-empty string');
    return false;
  }

  if (typeof paramId !== 'number') {
    log.error('PowerButton.func', 'paramId must be a number');
    return false;
  }

  return true;
}