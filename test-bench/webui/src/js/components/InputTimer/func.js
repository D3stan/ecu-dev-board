/**
 * func.js
 * =======
 * Funzioni di utilità per gestione logica timer in InputTimer.
 * 
 * Logica:
 * - Conversione secondi ↔ HMS (hours, minutes, seconds)
 * - Calcolo limiti dinamici in base al max
 * - Validazione totale con clamp automatico
 * - Validazione input utente
 * 
 * @author FogExtra Team
 * @version 1.0.0
 */

/**
 * Converte secondi totali in ore/minuti/secondi
 * @param {number} totalSeconds - Secondi totali
 * @returns {Object} { hours, minutes, seconds }
 */
export function secondsToHMS(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { hours, minutes, seconds };
}

/**
 * Converte ore/minuti/secondi in secondi totali
 * @param {number} hours - Ore
 * @param {number} minutes - Minuti
 * @param {number} seconds - Secondi
 * @returns {number} Secondi totali
 */
export function hmsToSeconds(hours, minutes, seconds) {
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Calcola i valori massimi dinamici per ogni unità
 * 
 * Logica:
 * - Se max = 1870s (31m 10s):
 *   - hours: 0 (1870 < 3600)
 *   - minutes: 31 max
 *   - seconds: 10 max quando minutes = 31, altrimenti 59
 * 
 * @param {number} max - Valore massimo in secondi
 * @param {number} currentHours - Ore correnti (per calcolo dinamico)
 * @param {number} currentMinutes - Minuti correnti (per calcolo dinamico)
 * @returns {Object} { hours, minutes, seconds }
 */
export function getMaxValues(max, currentHours = 0, currentMinutes = 0) {
  // Max ore
  const maxHours = Math.floor(max / 3600);
  
  // Max minuti (dipende dalle ore correnti)
  let maxMinutes;
  if (currentHours === maxHours) {
    // Se siamo all'ora massima, calcola i minuti residui
    const remainingAfterMaxHours = max % 3600;
    maxMinutes = Math.floor(remainingAfterMaxHours / 60);
  } else {
    // Altrimenti minuti vanno da 0 a 59
    maxMinutes = 59;
  }
  
  // Max secondi (dipende da ore E minuti correnti)
  let maxSeconds;
  if (currentHours === maxHours) {
    const remainingAfterMaxHours = max % 3600;
    const maxMinsAtMaxHours = Math.floor(remainingAfterMaxHours / 60);
    
    if (currentMinutes === maxMinsAtMaxHours) {
      // Se siamo all'ora e minuto massimo, calcola i secondi residui
      maxSeconds = remainingAfterMaxHours % 60;
    } else {
      maxSeconds = 59;
    }
  } else {
    maxSeconds = 59;
  }
  
  return {
    hours: maxHours,
    minutes: maxMinutes,
    seconds: maxSeconds
  };
}

/**
 * Valida il totale e clamp al max se necessario
 * 
 * Se ore/minuti/secondi eccedono il max, li riduce al max consentito.
 * Esempio: max = 1870s (31m 10s), state = {h:0, m:31, s:25}
 *   → totalSeconds = 1885 > 1870
 *   → ritorna {h:0, m:31, s:10} (valore clamped al max)
 * 
 * @param {Object} state - State corrente {hours, minutes, seconds}
 * @param {number} max - Valore massimo in secondi
 * @returns {Object} State validato {hours, minutes, seconds}
 */
export function validateTotal(state, max) {
  const totalSeconds = hmsToSeconds(state.hours, state.minutes, state.seconds);
  
  if (totalSeconds > max) {
    // Clamp al max
    return secondsToHMS(max);
  }
  
  return state;
}

/**
 * Valida un valore inserito manualmente dall'utente
 * 
 * Logica:
 * - Se NaN o vuoto → reimposta previousValue
 * - Se < min → reimposta previousValue (NON clamp)
 * - Se > max → reimposta previousValue (NON clamp)
 * - Se decimale (es: 21.4) → tronca a 21
 * - Solo se il valore è nel range [min, max] viene accettato
 * 
 * @param {string|number} inputValue - Valore inserito
 * @param {number} previousValue - Valore precedente (fallback)
 * @param {number} min - Valore minimo ammesso
 * @param {number} max - Valore massimo ammesso
 * @returns {number} Valore validato
 */
export function getValidatedValue(inputValue, previousValue, min, max) {
  // Parse input
  let value = parseInt(inputValue, 10);
  
  // Se non è un numero valido, usa il valore precedente
  if (isNaN(value)) {
    return previousValue;
  }
  
  // Se il valore è fuori range, ripristina il valore precedente
  if (value < min || value > max) {
    return previousValue;
  }
  
  // Valore valido
  return value;
}
