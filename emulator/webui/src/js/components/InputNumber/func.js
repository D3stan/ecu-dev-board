/**
 * func.js
 * =======
 * Funzioni di utilità per gestione logica parametri numerici in InputNumber.
 * 
 * Logica:
 * - Conversione valore interno (intero) ↔ valore display (float con divisor)
 * - Gestione arrotondamento a step
 * - Validazione input utente
 * - Incremento/decremento ciclico
 * - Rilevamento tipo parametro (numerico vs enum)
 * 
 * @author FogExtra Team
 * @version 1.0.0
 */

import { ParamType } from '../../utils/constants.js';

/**
 * Verifica se un parametro è di tipo ENUM (non numerico)
 * @param {number} type - Tipo parametro (da ParamType)
 * @returns {boolean} True se enum, false se numerico
 */
export function isEnumType(type) {
  return (
    type === ParamType.PRESSURE_TYPE ||
    type === ParamType.AUX_TYPE ||
    type === ParamType.RELAY_MODE ||
    type === ParamType.LANG_TYPE ||
    type === ParamType.BOOL ||
    type === ParamType.MODBUS_BAUDRATE
  );
}

/**
 * Converte ParamType numerico in stringa enum per getEnumValue()
 * @param {number} type - Tipo parametro (da ParamType)
 * @returns {string|null} Stringa enum o null se non è enum
 */
export function getEnumTypeString(type) {
  switch (type) {
    case ParamType.PRESSURE_TYPE:
      return 'PRESSURE_TYPE';
    case ParamType.AUX_TYPE:
      return 'AUX_TYPE';
    case ParamType.RELAY_MODE:
      return 'RELAY_MODE';
    case ParamType.LANG_TYPE:
      return 'LANG_TYPE';
    case ParamType.BOOL:
      return 'BOOL';
    case ParamType.MONTH:
      return 'MONTH';
    case ParamType.MODBUS_BAUDRATE:
      return 'MODBUS_BAUDRATE';
    default:
      return null;
  }
}

/**
 * Converte valore interno (intero) in valore display (float)
 * @param {number} internalValue - Valore interno (intero)
 * @param {number} divisor - Divisore per conversione
 * @returns {number} Valore display (float)
 */
export function internalToDisplay(internalValue, divisor) {
  if (divisor === 0 || divisor === 1) {
    return internalValue;
  }
  return internalValue / divisor;
}

/**
 * Converte valore display (float) in valore interno (intero)
 * @param {number} displayValue - Valore display (float)
 * @param {number} divisor - Divisore per conversione
 * @returns {number} Valore interno (intero)
 */
export function displayToInternal(displayValue, divisor) {
  if (divisor === 0 || divisor === 1) {
    return Math.round(displayValue);
  }
  return Math.round(displayValue * divisor);
}

/**
 * Arrotonda un valore al più vicino multiplo di step
 * @param {number} value - Valore da arrotondare
 * @param {number} step - Step di arrotondamento
 * @returns {number} Valore arrotondato
 */
export function roundToStep(value, step) {
  if (step === 0) return value;
  return Math.round(value / step) * step;
}

/**
 * Valida e arrotonda un valore nel range [min, max] con step
 * @param {number} value - Valore da validare
 * @param {number} min - Valore minimo
 * @param {number} max - Valore massimo
 * @param {number} step - Step di arrotondamento
 * @returns {number} Valore validato e arrotondato
 */
export function validateValue(value, min, max, step) {
  // Arrotonda allo step
  let validated = roundToStep(value, step);
  
  // Clamp al range [min, max]
  validated = Math.max(min, Math.min(max, validated));
  
  return validated;
}

/**
 * Valida input utente manuale
 * - Se NaN o vuoto → ripristina previousValue
 * - Se fuori range → ripristina previousValue (NO clamp)
 * - Se valido → arrotonda allo step
 * 
 * @param {string|number} inputValue - Valore inserito dall'utente
 * @param {number} previousValue - Valore precedente (fallback)
 * @param {number} min - Valore minimo ammesso
 * @param {number} max - Valore massimo ammesso
 * @param {number} step - Step di arrotondamento
 * @returns {number} Valore validato
 */
export function getValidatedInputValue(inputValue, previousValue, min, max, step) {
  // Parse input
  const value = parseFloat(inputValue);
  
  // Se non è un numero valido, ripristina precedente
  if (isNaN(value)) {
    return previousValue;
  }
  
  // Se fuori range, ripristina precedente (NO clamp, come richiesto)
  if (value < min || value > max) {
    return previousValue;
  }
  
  // Arrotonda allo step
  return roundToStep(value, step);
}

/**
 * Incrementa valore con logica ciclica
 * @param {number} currentValue - Valore corrente
 * @param {number} min - Valore minimo
 * @param {number} max - Valore massimo
 * @param {number} step - Step di incremento
 * @returns {number} Nuovo valore
 */
export function incrementValue(currentValue, min, max, step) {
  let newValue = currentValue + step;
  
  // Arrotonda per evitare errori floating point
  newValue = roundToStep(newValue, step);
  
  // Logica ciclica: se supera max, torna a min
  if (newValue > max) {
    return min;
  }
  
  return newValue;
}

/**
 * Decrementa valore con logica ciclica
 * @param {number} currentValue - Valore corrente
 * @param {number} min - Valore minimo
 * @param {number} max - Valore massimo
 * @param {number} step - Step di decremento
 * @returns {number} Nuovo valore
 */
export function decrementValue(currentValue, min, max, step) {
  let newValue = currentValue - step;
  
  // Arrotonda per evitare errori floating point
  newValue = roundToStep(newValue, step);
  
  // Logica ciclica: se va sotto min, torna a max
  if (newValue < min) {
    return max;
  }
  
  return newValue;
}

/**
 * Formatta valore per display con unità e decimali appropriati
 * @param {number} value - Valore da formattare
 * @param {number} step - Step (per determinare decimali)
 * @param {string} unit - Unità di misura
 * @returns {string} Valore formattato (es: "23.5°C")
 */
export function formatDisplayValue(value, step, unit) {
  // Determina numero di decimali dallo step
  let decimals = 0;
  if (step < 1) {
    const stepStr = step.toString();
    const decimalPart = stepStr.split('.')[1];
    decimals = decimalPart ? decimalPart.length : 0;
  }
  
  // Formatta con decimali e unità
  return value.toFixed(decimals) + unit;
}

/**
 * Calcola la percentuale per il progresso dello slider
 * @param {number} value - Valore corrente
 * @param {number} min - Valore minimo
 * @param {number} max - Valore massimo
 * @returns {number} Percentuale (0-100)
 */
export function getSliderPercentage(value, min, max) {
  if (max === min) return 0;
  return ((value - min) / (max - min)) * 100;
}
