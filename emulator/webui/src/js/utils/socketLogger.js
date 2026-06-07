/**
 * socketLogger.js
 * ===============
 * Utility per catturare, loggare e salvare i messaggi ESP per test e debugging.
 * 
 * Funzionalità:
 * - Log formattato dei messaggi ricevuti
 * - Raccolta messaggi per tipo
 * - Export messaggi per test
 * - Statistiche ricezione
 * 
 * @author FogExtra Team
 * @version 1.0.0
 */

import { MsgType } from './constants.js';

// ============================================
// STORAGE MESSAGGI
// ============================================

const messageStore = {
  [MsgType.UPDATE]: [],
  [MsgType.TIME_SLOT]: [],
  [MsgType.LANG]: [],
  [MsgType.PARAM]: [],
  [MsgType.MODIFY]: [],
  [MsgType.MENU]: [],
  UNKNOWN: []
};

const stats = {
  total: 0,
  [MsgType.UPDATE]: 0,
  [MsgType.TIME_SLOT]: 0,
  [MsgType.LANG]: 0,
  [MsgType.PARAM]: 0,
  [MsgType.MODIFY]: 0,
  [MsgType.MENU]: 0,
  UNKNOWN: 0
};

// ============================================
// LOGGING FUNCTIONS
// ============================================

/**
 * Log e salva un messaggio ricevuto dall'ESP
 * @param {string} raw - Messaggio raw completo
 */
export function logSocketMessage(raw) {
  if (!raw || typeof raw !== 'string') return;
  
  const [header, body] = raw.split("|", 2);
  const timestamp = new Date().toISOString();
  
  // Incrementa statistiche
  stats.total++;
  
  // Identifica tipo messaggio
  const messageType = identifyMessageType(header);
  stats[messageType]++;
  
  // Salva messaggio
  const messageData = {
    timestamp,
    header,
    body: body || '',
    raw,
    length: raw.length
  };
  
  messageStore[messageType].push(messageData);
  
  // Limita dimensione storage (mantieni solo ultimi 100 UPDATE, 10 per altri tipi)
  const maxSize = messageType === MsgType.UPDATE ? 100 : 10;
  if (messageStore[messageType].length > maxSize) {
    messageStore[messageType].shift(); // Rimuovi il più vecchio
  }
  
  // Log formattato in console
  logToConsole(messageType, header, body, raw);
}

/**
 * Identifica il tipo di messaggio
 * @param {string} header - Header del messaggio
 * @returns {string} Tipo messaggio (costante MsgType)
 */
function identifyMessageType(header) {
  switch (header) {
    case MsgType.UPDATE:
      return MsgType.UPDATE;
    case MsgType.TIME_SLOT:
      return MsgType.TIME_SLOT;
    case MsgType.LANG:
      return MsgType.LANG;
    case MsgType.PARAM:
      return MsgType.PARAM;
    case MsgType.MODIFY:
      return MsgType.MODIFY;
    case MsgType.MENU:
      return MsgType.MENU;
    default:
      return 'UNKNOWN';
  }
}

/**
 * Log formattato in console
 * @param {string} type - Tipo messaggio
 * @param {string} header - Header
 * @param {string} body - Body
 * @param {string} raw - Messaggio completo
 */
function logToConsole(type, header, body, raw) {
  // UPDATE: log minimale (arrivano ogni 500ms)
  if (type === MsgType.UPDATE) {
    return;
  }
}

/**
 * Ottieni icona per tipo messaggio
 * @param {string} type - Tipo messaggio
 * @returns {string} Emoji icona
 */
function getMessageIcon(type) {
  const icons = {
    [MsgType.UPDATE]: '📡',
    [MsgType.TIME_SLOT]: '⏰',
    [MsgType.LANG]: '🌐',
    [MsgType.PARAM]: '⚙️',
    [MsgType.MODIFY]: '✏️',
    [MsgType.MENU]: '📋',
    UNKNOWN: '❓'
  };
  return icons[type] || '📩';
}

/**
 * Ottieni stile CSS per log
 * @param {string} type - Tipo messaggio
 * @returns {string} Stile CSS
 */
function getMessageStyle(type) {
  const styles = {
    [MsgType.UPDATE]: 'color: #888; font-weight: normal;',
    [MsgType.TIME_SLOT]: 'color: #ff9800; font-weight: bold;',
    [MsgType.LANG]: 'color: #2196f3; font-weight: bold;',
    [MsgType.PARAM]: 'color: #4caf50; font-weight: bold;',
    [MsgType.MODIFY]: 'color: #9c27b0; font-weight: bold;',
    [MsgType.MENU]: 'color: #f44336; font-weight: bold;',
    UNKNOWN: 'color: #ff5722; font-weight: bold;'
  };
  return styles[type] || 'color: #000; font-weight: normal;';
}

// ============================================
// EXPORT FUNCTIONS
// ============================================

/**
 * Ottieni tutti i messaggi salvati per tipo
 * @param {string} type - Tipo messaggio (opzionale)
 * @returns {Array|Object} Array di messaggi o oggetto completo
 */
export function getMessages(type = null) {
  if (type) {
    return [...messageStore[type]];
  }
  return JSON.parse(JSON.stringify(messageStore));
}

/**
 * Ottieni statistiche messaggi
 * @returns {Object} Statistiche
 */
export function getStats() {
  return { ...stats };
}

/**
 * Ottieni ultimo messaggio per tipo
 * @param {string} type - Tipo messaggio
 * @returns {Object|null} Ultimo messaggio
 */
export function getLastMessage(type) {
  const messages = messageStore[type];
  return messages.length > 0 ? { ...messages[messages.length - 1] } : null;
}

/**
 * Esporta tutti i messaggi come JSON formattato
 * @returns {string} JSON formattato
 */
export function exportMessagesAsJSON() {
  const data = {
    exportDate: new Date().toISOString(),
    stats: getStats(),
    messages: getMessages()
  };
  return JSON.stringify(data, null, 2);
}

/**
 * Esporta esempi di messaggi (uno per tipo) come oggetto per test
 * @returns {Object} Oggetto con esempi di messaggi
 */
export function exportMessageExamples() {
  const examples = {};
  
  for (const type in messageStore) {
    if (type === MsgType.UPDATE) {
      // Per UPDATE, prendi il primo (più rappresentativo)
      examples[type] = messageStore[type][0] || null;
    } else {
      // Per altri tipi, prendi l'ultimo (più recente)
      examples[type] = getLastMessage(type);
    }
  }
  
  return examples;
}

/**
 * Stampa report completo in console
 */
export function printReport() {
  console.table(stats);
}

/**
 * Pulisci tutti i messaggi salvati
 */
export function clear() {
  for (const type in messageStore) {
    messageStore[type] = [];
  }
  for (const key in stats) {
    stats[key] = 0;
  }
}

// ============================================
// DEBUG HELPERS
// ============================================

/**
 * Esporta funzioni helper per window.FogExtra
 */
export const socketLogger = {
  log: logSocketMessage,
  getMessages,
  getStats,
  getLastMessage,
  exportMessagesAsJSON,
  exportMessageExamples,
  printReport,
  clear
};
