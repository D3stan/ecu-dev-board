/**
 * logic.js
 * ========
 * Funzioni di utilità e validazione per i componenti WiFi Card Input.
 * 
 * Fornisce:
 * - Validazione lunghezza stringhe
 * - Troncamento a lunghezza massima
 * - Controllo necessità invio
 * - Validazione password WiFi
 * 
 * @author FogExtra Team
 * @version 1.0.0
 */

import { 
  STRING_PARAM_MAX_LENGTH, 
  WIFI_PASSWORD_MIN_LENGTH, 
  WIFI_PASSWORD_MAX_LENGTH 
} from '../../utils/constants.js';

/**
 * Verifica se il valore è cambiato e richiede invio
 * @param {string} newValue - Nuovo valore inserito
 * @param {string} oldValue - Valore precedente
 * @returns {boolean} True se deve essere inviato
 */
export function shouldSend(newValue, oldValue) {
  const trimmedNew = newValue.trim();
  const trimmedOld = oldValue.trim();
  
  // Non inviare se vuoto o uguale al precedente
  return trimmedNew !== "" && trimmedNew !== trimmedOld;
}

/**
 * Tronca una stringa alla lunghezza massima consentita
 * @param {string} value - Stringa da troncare
 * @param {number} maxLength - Lunghezza massima (default: STRING_PARAM_MAX_LENGTH)
 * @returns {string} Stringa troncata
 */
export function truncateString(value, maxLength = STRING_PARAM_MAX_LENGTH) {
  if (value.length > maxLength) {
    return value.substring(0, maxLength);
  }
  return value;
}

/**
 * Valida una stringa generica per parametri
 * @param {string} value - Valore da validare
 * @returns {Object} { valid: boolean, value: string, error: string|null }
 */
export function validateStringParam(value) {
  const trimmed = value.trim();
  
  if (trimmed === "") {
    return {
      valid: false,
      value: trimmed,
      error: "Value cannot be empty"
    };
  }
  
  // Tronca se troppo lungo
  const truncated = truncateString(trimmed);
  
  return {
    valid: true,
    value: truncated,
    error: null
  };
}

/**
 * Verifica se una password WiFi è valida
 * @param {string} password - Password da validare
 * @param {boolean} secure - Se la rete è protetta
 * @returns {boolean} True se valida
 */
export function isPasswordValid(password, secure) {
  // Se rete aperta, qualsiasi valore è valido (anche vuoto)
  if (!secure) {
    return true;
  }
  
  const trimmed = password.trim();
  
  // Se rete protetta, password deve rispettare standard WPA2
  return trimmed.length >= WIFI_PASSWORD_MIN_LENGTH && 
         trimmed.length <= WIFI_PASSWORD_MAX_LENGTH;
}

/**
 * Estrae la password da un oggetto network
 * @param {Object} network - Oggetto network { ssid, secure, psw, ... }
 * @returns {string} Password (stringa vuota se non presente)
 */
export function getNetworkPassword(network) {
  return network.psw || "";
}

/**
 * Valida credenziali WiFi complete
 * @param {string} ssid - SSID della rete
 * @param {string} password - Password della rete
 * @param {boolean} secure - Se la rete è protetta
 * @returns {Object} { valid: boolean, error: string|null }
 */
export function validateWifiCredentials(ssid, password, secure) {
  const trimmedSsid = ssid.trim();
  
  if (trimmedSsid === "") {
    return {
      valid: false,
      error: "SSID cannot be empty"
    };
  }
  
  if (!isPasswordValid(password, secure)) {
    return {
      valid: false,
      error: `Password must be between ${WIFI_PASSWORD_MIN_LENGTH} and ${WIFI_PASSWORD_MAX_LENGTH} characters`
    };
  }
  
  return {
    valid: true,
    error: null
  };
}
