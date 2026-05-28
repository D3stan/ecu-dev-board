// paramHelpers.js
/**
 * Funzioni helper per la gestione e formattazione dei parametri
 */

import { ParamType } from './constants.js';
import { Store } from '../core/store.js';
import { Paths } from './paths.js';
import { getEnumValue } from './enumMappings.js';
import { i18n } from './i18n.js';

/**
 * Calcola il valore display da un parametro raw
 * Formula: displayValue = (rawValue + offset) / divisor
 * 
 * @param {number} rawValue - Valore grezzo dal parametro
 * @param {number} divisor - Divisore per scala fixed-point (default 1)
 * @param {number} offset - Offset da aggiungere prima della divisione (default 0)
 * @returns {number} Valore fisico calcolato
 */
export function calculateDisplayValue(rawValue, divisor = 1, offset = 0) {
  return (rawValue + offset) / divisor;
}

/**
 * Formatta un valore numerico in base al tipo di parametro
 * 
 * @param {number} value - Valore da formattare (già calcolato con calculateDisplayValue)
 * @param {number} type - Tipo parametro (ParamType enum)
 * @param {string} unit - Unità di misura (es. "°C", "%", "s")
 * @param {number} divisor - Divisore (usato per determinare decimali)
 * @returns {string} Valore formattato
 */
export function formatParamValue(value, type, unit = '', divisor = 1) {
  // Determina numero decimali in base al divisor
  let decimals = 0;
  if (divisor === 10) decimals = 1;
  else if (divisor === 100) decimals = 2;
  else if (divisor === 1000) decimals = 3;
  
  switch (type) {
    case ParamType.BOOL:
      // Boolean: 0 = OFF, 1 = ON
      return value !== 0 ? 'ON' : 'OFF';
    
    case ParamType.TIME:
      // Time: converti minuti in HH:MM o secondi in MM:SS
      return formatTimeValue(value);
    
    case ParamType.FLOAT:
      // Float: sempre con decimali
      return `${value.toFixed(decimals > 0 ? decimals : 1)}`;
    
    case ParamType.NUMBER:
      // Number: decimali solo se divisor > 1
      if (decimals > 0) {
        return `${value.toFixed(decimals)}`;
      }
      return `${Math.round(value)}`;
    
    default:
      // Tutti gli altri tipi
      if (decimals > 0) {
        return `${value.toFixed(decimals)}`;
      }
      return `${value}`;
  }
}

/**
 * Formatta un valore temporale (minuti o secondi) in formato HH:MM o MM:SS
 * 
 * @param {number} value - Valore in secondi o minuti
 * @param {boolean} isSeconds - Se true, interpreta come secondi; altrimenti come minuti
 * @returns {string} Tempo formattato (es. "05:30")
 */
export function formatTimeValue(value, isSeconds = false) {
  if (isSeconds) {
    // Value in secondi → converti in MM:SS
    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value % 60);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  } else {
    // Value in minuti → converti in HH:MM
    const hours = Math.floor(value / 60);
    const minutes = Math.floor(value % 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }
}

/**
 * Ottiene il valore display completo di un parametro (valore + unità formattato)
 * 
 * @param {object} param - Oggetto parametro con proprietà: value, divisor, offset, type, unit
 * @returns {string} Valore formattato con unità
 */
export function getParameterDisplayValue(param) {
  if (!param || param.value === null || param.value === undefined) {
    return '---';
  }
  
  const { value, divisor = 1, offset = 0, type, unit = '' } = param;
  
  // Ottieni lingua corrente per mappature ENUM
  const langIndex = Store.get(Paths.LOCALIZATION.CURRENT_LANG_INDEX) || 0;
  
  // Gestione tipi ENUM speciali
  switch (type) {
    case ParamType.PRESSURE_TYPE:
      return getEnumValue('PRESSURE_TYPE', value, langIndex);
    
    case ParamType.RELAY_MODE:
      return getEnumValue('RELAY_MODE', value, langIndex);
    
    case ParamType.LANG_TYPE:
      return getEnumValue('LANG_TYPE', value, langIndex);
    
    case ParamType.MONTH:
      return getEnumValue('MONTH', value, langIndex);
    
    case ParamType.MODBUS_BAUDRATE:
      return getEnumValue('MODBUS_BAUDRATE', value, langIndex);
    
    case ParamType.BOOL:
      // Boolean: 0 = OFF, 1 = ON
      return value !== 0 ? 'ON' : 'OFF';
    
    case ParamType.TIME:
      // Time: formatta in formato mn'sec''
      const minutes = Math.floor(value / 60);
      const seconds = Math.floor(value % 60);
      return `${minutes}'${seconds}''`;
    
    default:
      // Tipi NUMBER e FLOAT
      const displayValue = calculateDisplayValue(value, divisor, offset);
      return formatParamValue(displayValue, type, unit, divisor);
  }
}

/**
 * Converte un valore display in valore raw (inverso di calculateDisplayValue)
 * Formula: rawValue = (displayValue * divisor) - offset
 * 
 * @param {number} displayValue - Valore fisico da convertire
 * @param {number} divisor - Divisore per scala fixed-point (default 1)
 * @param {number} offset - Offset da sottrarre dopo la moltiplicazione (default 0)
 * @returns {number} Valore grezzo
 */
export function calculateRawValue(displayValue, divisor = 1, offset = 0) {
  return Math.round((displayValue * divisor) - offset);
}

/**
 * Arricchisce un parametro con le traduzioni correnti (name, ds)
 * Prende un parametro raw dallo Store e aggiunge i campi tradotti
 * 
 * @param {object} param - Parametro raw (con id, value, type, ecc.)
 * @returns {object} Parametro arricchito con name e ds tradotti
 */
export function enrichParamWithTranslations(param) {
  if (!param || typeof param.id !== 'number') {
    console.warn('enrichParamWithTranslations: parametro non valido', param);
    return param;
  }
  
  // Ottieni traduzione per questo parametro
  const translation = i18n.tParam(param.id);
  
  // Ritorna parametro arricchito
  return {
    ...param,
    name: translation.name,
    ds: translation.ds
  };
}

/**
 * Arricchisce un array di parametri con le traduzioni correnti
 * Utile per processare tutti i parametri dallo Store in un colpo solo
 * 
 * @param {Array} params - Array di parametri raw
 * @returns {Array} Array di parametri arricchiti
 */
export function enrichParamsWithTranslations(params) {
  if (!Array.isArray(params)) {
    console.warn('enrichParamsWithTranslations: params deve essere un array', params);
    return [];
  }
  
  return params.map(enrichParamWithTranslations);
}
