/**
 * ModeStateButton.func.js
 * =======================
 * Helper functions for ModeStateButton component.
 * 
 * Determines button visual state based on parameter and runtime values.
 * 
 * @author FogExtra Team
 * @version 1.0.0
 */

/**
 * Determina lo stato visuale del pulsante mode.
 * 
 * Stati possibili:
 * - "disabled": parametro value = 0 (modalità disabilitata)
 * - "enabled-inactive": parametro value = 1 E isActive = false
 * - "enabled-active": parametro value = 1 E isActive = true
 * 
 * @param {Object} param - Parametro dallo store (config.params[id])
 * @param {boolean} isActive - Stato attivo/inattivo (runtime.modes.xxx.isActive)
 * @returns {string} Classe CSS dello stato ("disabled", "enabled-inactive", "enabled-active")
 * 
 * @example
 * getModeButtonState({ value: 0 }, false) // returns "disabled"
 * getModeButtonState({ value: 1 }, false) // returns "enabled-inactive"
 * getModeButtonState({ value: 1 }, true)  // returns "enabled-active"
 */
export function getModeButtonState(param, isActive) {
  // Se param non esiste o value è 0, è disabilitato
  if (!param || param.value === 0) {
    return 'disabled';
  }

  // Se param.value è 1, controlla isActive
  if (param.value === 1) {
    return isActive ? 'enabled-active' : 'enabled-inactive';
  }

  // Default: disabled (per sicurezza)
  return 'disabled';
}

/**
 * Determina se il pulsante può essere cliccato.
 * Un pulsante disabilitato non deve rispondere ai click.
 * 
 * @param {Object} param - Parametro dallo store
 * @returns {boolean} true se il pulsante è cliccabile
 */
export function isButtonClickable(param) {
  return param && param.value === 1;
}

/**
 * Calcola il nuovo valore del parametro dopo il toggle.
 * Se il parametro è abilitato (value = 1), lo disabilita (value = 0).
 * Se il parametro è disabilitato (value = 0), lo abilita (value = 1).
 * 
 * @param {Object} param - Parametro dallo store
 * @returns {number} Nuovo valore (0 o 1)
 */
export function toggleParameterValue(param) {
  if (!param) return 0;
  
  return param.value === 1 ? 0 : 1;
}
