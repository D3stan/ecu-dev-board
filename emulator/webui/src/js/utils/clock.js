/**
 * clock.js
 * 
 * Gestione dell'orologio nella top bar.
 * Aggiorna automaticamente il display dell'ora corrente.
 */

let clockInterval = null;

/**
 * Formatta l'ora corrente come stringa HH:MM
 * @returns {string} Ora formattata (es. "14:35")
 */
function formatCurrentTime() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Aggiorna il display dell'orologio nel DOM
 */
function updateClockDisplay() {
  const clockElement = document.getElementById('current-time');
  
  if (!clockElement) {
    console.warn('⚠️ Elemento current-time non trovato nel DOM');
    return;
  }
  
  const timeString = formatCurrentTime();
  clockElement.textContent = timeString;
}

/**
 * Avvia l'orologio con aggiornamenti automatici ogni minuto
 */
export function startClock() {
  // Aggiorna subito al primo caricamento
  updateClockDisplay();
  
  // Ferma l'eventuale clock precedente
  if (clockInterval) {
    clearInterval(clockInterval);
  }
  
  // Aggiorna ogni secondo (per precisione al cambio minuto)
  // Alternativa: aggiornare ogni 60 secondi per risparmiare risorse
  clockInterval = setInterval(updateClockDisplay, 1000);
}

/**
 * Ferma l'orologio
 */
export function stopClock() {
  if (clockInterval) {
    clearInterval(clockInterval);
    clockInterval = null;
  }
}

/**
 * Ottiene l'ora corrente formattata
 * @returns {string} Ora corrente (HH:MM)
 */
export function getCurrentTime() {
  return formatCurrentTime();
}

/**
 * Imposta manualmente un'ora nel display (utile per testing o sincronizzazione)
 * @param {string} timeString - Ora in formato "HH:MM"
 */
export function setClockDisplay(timeString) {
  const clockElement = document.getElementById('current-time');
  
  if (!clockElement) {
    console.warn('⚠️ Elemento current-time non trovato nel DOM');
    return;
  }
  
  clockElement.textContent = timeString;
}
