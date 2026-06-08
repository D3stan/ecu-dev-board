/**
 * commandManager.js
 * 
 * Manager per invio comandi a ESP32 via WebSocket con ACK tracking.
 * 
 * Funzionalità:
 * - Invio comandi strutturati a ESP32
 * - Tracking ACK/NACK dei comandi
 * - Timeout management
 * - Queue comandi con retry
 * - Promise-based API per comandi asincroni
 */

import { Socket } from '../core/socket.js';
import { Separators, CmdToEsp } from '../utils/constants.js';
import { Store } from '../core/store.js';
import { Paths } from '../utils/paths.js';
import { log } from '../utils/logger.js';

// ============================================
// STATE
// ============================================

const state = {
  pendingCommands: new Map(),  // Map<commandId, {command, timestamp, resolve, reject, timeout}>
  commandIdCounter: 0,         // Counter per ID univoci
  defaultTimeout: 5000,        // Timeout default in ms
  initialized: false,
  unsubscribeSocketMessage: null,
};

// ============================================
// PRIVATE HELPERS
// ============================================

/**
 * Genera un ID univoco per il comando
 */
function generateCommandId() {
  state.commandIdCounter = (state.commandIdCounter + 1) % 10000;
  return `cmd_${Date.now()}_${state.commandIdCounter}`;
}

/**
 * Formatta il comando nel protocollo ESP32
 * Formato: COMMAND|param1|param2|...|commandId
 */
function formatCommand(command, params = [], commandId = null) {
  const parts = [command.toUpperCase()];
  
  if (Array.isArray(params)) {
    parts.push(...params.map(p => String(p)));
  }
  
  if (commandId) {
    parts.push(commandId);
  }
  
  return parts.join(Separators.CMD);
}

/**
 * Converte un oggetto TimeSlot in dayFlags (bitmask)
 * @param {Object} days - Oggetto con chiavi giorno (mon, tue, wed, thu, fri, sat, sun)
 * @returns {number} Bitmask dove bit 0=lun, bit 1=mar, ecc.
 */
function convertDaysToBitmask(days) {
  const dayOrder = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  let bitmask = 0;
  
  dayOrder.forEach((day, index) => {
    if (days[day]) {
      bitmask |= (1 << index);
    }
  });
  
  return bitmask;
}

/**
 * Parse una stringa orario "HH:MM" in ore e minuti
 * @param {string} timeString - Stringa formato "HH:MM" (es: "17:30")
 * @returns {Object} { hours, minutes }
 */
function parseTimeString(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return { hours, minutes };
}

/**
 * Rimuove un comando pending per timeout
 */
function handleCommandTimeout(commandId) {
  const pending = state.pendingCommands.get(commandId);
  
  if (!pending) return;
  
  state.pendingCommands.delete(commandId);
  
  console.error(`⏱️ Timeout comando: "${pending.command}" (ID: ${commandId})`);
  
  if (pending.reject) {
    pending.reject(new Error(`Timeout: comando "${pending.command}" non ha ricevuto risposta`));
  }
}

/**
 * Gestisce la risposta ACK/NACK dal socket
 */
function handleCommandResponse(commandId, success, message = '') {
  const pending = state.pendingCommands.get(commandId);
  
  if (!pending) {
    console.warn(`⚠️ Ricevuta risposta per comando sconosciuto: ${commandId}`);
    return;
  }
  
  // Clear timeout
  if (pending.timeout) {
    clearTimeout(pending.timeout);
  }
  
  state.pendingCommands.delete(commandId);
  
  if (success) {
    if (pending.resolve) {
      pending.resolve({ success: true, message, commandId });
    }
  } else {
    console.error(`❌ NACK ricevuto: "${pending.command}" (ID: ${commandId}) - ${message}`);
    if (pending.reject) {
      pending.reject(new Error(`NACK: ${message || 'Comando rifiutato'}`));
    }
  }
}

/**
 * Check if commands should be blocked due to PIN lock.
 * @returns {boolean}
 */
function _isCommandBlocked() {
  try {
    return Store.get(Paths.APP.AUTH.LOCKED);
  } catch (e) {
    return false; // Store not ready — allow
  }
}

/**
 * True when the message is a bootstrap pull request (REQ_MSG|*).
 * These messages must bypass PIN lock.
 * @param {string} message
 * @returns {boolean}
 */
function isBootstrapRequest(message) {
  if (typeof message !== 'string') return false;
  return message.startsWith(`${CmdToEsp.REQ_MSG}${Separators.CMD}`);
}

/**
 * Guarded Socket.send — blocks when PIN locked.
 * @param {string} message
 * @returns {boolean} true if sent, false if blocked
 */
function _guardedSend(message) {
  if (_isCommandBlocked() && !isBootstrapRequest(message)) {
    console.warn(`\uD83D\uDD12 [CommandManager] Send blocked \u2014 PIN required: ${message.substring(0, 40)}...`);
    return false;
  }
  Socket.send(message);
  return true;
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Invia un comando fire-and-forget (senza attendere risposta)
 * @param {string} command - Nome del comando
 * @param {Array} params - Parametri del comando
 */
export function send(command, params = []) {
  if (!command) {
    console.error('\u274C CommandManager.send: command \u00e8 obbligatorio');
    return;
  }
  
  const formattedCommand = formatCommand(command, params);
  
  try {
    if (!_guardedSend(formattedCommand)) {
      console.warn(`\uD83D\uDD12 [CommandManager] Command "${command}" blocked \u2014 PIN required`);
      return;
    }
  } catch (error) {
    console.error(`❌ Errore invio comando "${command}":`, error);
  }
}

/**
 * Invia comando SOFT_RESET al device (fire-and-forget, nessun ACK).
 * Triggera snapshot + soft reset con Fast Recovery.
 * @param {string} reason - Motivo reset (default: "WEB_CONSOLE")
 */
export function softReset(reason = "WEB_CONSOLE") {
  return send(CmdToEsp.SOFT_RESET, [reason]);
}

/**
 * Invia un comando e attende la risposta (ACK/NACK)
 * @param {string} command - Nome del comando
 * @param {Array} params - Parametri del comando
 * @param {number} timeout - Timeout in ms (default: 5000)
 * @returns {Promise} Promise che si risolve con ACK o reject con NACK/timeout
 */
export function sendAndWait(command, params = [], timeout = null) {
  if (!command) {
    return Promise.reject(new Error('CommandManager.sendAndWait: command è obbligatorio'));
  }
  const commandId = generateCommandId();
  const formattedCommand = formatCommand(command, params, commandId);

  if (_isCommandBlocked() && !isBootstrapRequest(formattedCommand)) {
    console.warn(`\uD83D\uDD12 [CommandManager] Command "${command}" blocked \u2014 PIN required`);
    return Promise.reject(new Error('App locked: PIN required'));
  }

  const timeoutMs = timeout || state.defaultTimeout;
  
  return new Promise((resolve, reject) => {
    // Setup timeout
    const timeoutHandle = setTimeout(() => {
      handleCommandTimeout(commandId);
    }, timeoutMs);
    
    // Salva comando pending
    state.pendingCommands.set(commandId, {
      command,
      params,
      timestamp: Date.now(),
      resolve,
      reject,
      timeout: timeoutHandle,
    });
    
    // Invia comando
    try {
      if (!_guardedSend(formattedCommand)) {
        clearTimeout(timeoutHandle);
        state.pendingCommands.delete(commandId);
        reject(new Error('App locked: PIN required'));
        return;
      }
    } catch (error) {
      // Cleanup su errore
      clearTimeout(timeoutHandle);
      state.pendingCommands.delete(commandId);
      reject(error);
    }
  });
}

/**
 * Imposta il timeout default per i comandi
 * @param {number} ms - Timeout in millisecondi
 */
export function setDefaultTimeout(ms) {
  if (typeof ms !== 'number' || ms < 0) {
    console.warn('⚠️ setDefaultTimeout: valore non valido');
    return;
  }
  
  state.defaultTimeout = ms;
}

/**
 * Ottiene il numero di comandi pending
 * @returns {number}
 */
export function getPendingCount() {
  return state.pendingCommands.size;
}

/**
 * Cancella tutti i comandi pending
 */
export function clearPending() {
  state.pendingCommands.forEach((pending, commandId) => {
    if (pending.timeout) {
      clearTimeout(pending.timeout);
    }
    if (pending.reject) {
      pending.reject(new Error('Comando cancellato'));
    }
  });
  
  state.pendingCommands.clear();
}

/**
 * Inizializza il CommandManager
 */
export function init() {
  if (state.initialized) {
    return;
  }
  
  // Setup listener per messaggi Socket
  // Nota: Adapter già gestisce i messaggi, qui intercettiamo ACK/NACK
  state.unsubscribeSocketMessage = Socket.onMessage((raw) => {
    const [header, ...parts] = raw.split('|');
    
    // Gestisci risposte ACK/NACK
    if (header === 'ACK' && parts.length >= 1) {
      const commandId = parts[0];
      const message = parts.slice(1).join('|');
      handleCommandResponse(commandId, true, message);
    } else if (header === 'NACK' && parts.length >= 1) {
      const commandId = parts[0];
      const message = parts.slice(1).join('|');
      handleCommandResponse(commandId, false, message);
    }
  });

  state.initialized = true;
}

/**
 * Ottiene lo stato interno (per debug)
 */
export function _debug() {
  const pending = [];
  state.pendingCommands.forEach((cmd, id) => {
    pending.push({
      id,
      command: cmd.command,
      params: cmd.params,
      age: Date.now() - cmd.timestamp,
    });
  });
  
  return {
    pendingCount: state.pendingCommands.size,
    pending,
    defaultTimeout: state.defaultTimeout,
    commandIdCounter: state.commandIdCounter,
  };
}

// ============================================
// ESEMPI DI USO
// ============================================

/**
 * Modifica un parametro
 * @param {number} paramId - ID del parametro (0-n)
 * @param {number} value - Valore del parametro
 * 
 * Formato messaggio: MODIFY_PARAM|<paramId>☺<value>
 * Esempio: MODIFY_PARAM|0☺25 (imposta temperatura a 25)
 */
export function modifyParameter(paramId, value) {
  if (typeof paramId !== 'number' || typeof value !== 'number') {
    console.error('❌ modifyParameter: paramId e value devono essere numeri');
    return;
  }
  
  const payload = `${paramId}${Separators.VALUE}${value}`;
  const message = `${CmdToEsp.MODIFY_PARAM}${Separators.CMD}${payload}`;
  
  try {
    if (!_guardedSend(message)) return;
  } catch (error) {
    console.error(`❌ Errore invio modifyParameter:`, error);
  }
}

/**
 * Modifica un parametro stringa (es. nome Access Point)
 * @param {number} paramId - ID del parametro stringa (0-n)
 * @param {string} value - Valore stringa del parametro
 * 
 * Formato messaggio: CMD_MODIFY_STR|<paramId>☺<value>
 * Esempio: CMD_MODIFY_STR|0☺MioAccessPoint
 */
export function modifyStringParameter(paramId, value) {
  if (typeof paramId !== 'number' || typeof value !== 'string') {
    console.error('❌ modifyStringParameter: parametri non validi', { paramId, value });
    return;
  }
  
  const payload = `${paramId}${Separators.VALUE}${value}`;
  const message = `${CmdToEsp.CMD_MODIFY_STR}${Separators.CMD}${payload}`;
  
  try {
    if (!_guardedSend(message)) return;
  } catch (error) {
    console.error('❌ Errore invio CMD_MODIFY_STR:', error);
  }
}

/**
 * Invia una richiesta di connessione WiFi all'ESP32 (helper legacy)
 * @param {string} ssid - Nome della rete WiFi
 * @param {string} password - Password della rete WiFi
 * 
 * Formato messaggio: CMD_CONNECT|<ssid>☺<password>☺0☺
 * Esempio: CMD_CONNECT|MiaReteWiFi☺password123☺0☺
 */
export function setWifiCredentials(ssid, password) {
  if (typeof ssid !== 'string' || typeof password !== 'string') {
    console.error('❌ setWifiCredentials: parametri non validi', { ssid, password });
    return;
  }
  
  // Validazione SSID (max 32 caratteri)
  if (ssid.length === 0 || ssid.length > 32) {
    console.error('❌ SSID non valido (lunghezza: ' + ssid.length + ', max: 32)');
    return;
  }
  
  // Validazione password (min 8, max 63 caratteri per WPA2)
  if (password.length > 0 && (password.length < 8 || password.length > 63)) {
    console.error('❌ Password non valida (lunghezza: ' + password.length + ', range: 8-63)');
    return;
  }
  
  // Legacy helper kept for compatibility: internally map to CMD_CONNECT protocol.
  const payload = [ssid, password, "0", ""].join(Separators.VALUE);
  const message = `${CmdToEsp.CMD_CONNECT}${Separators.CMD}${payload}`;
  
  try {
    if (!_guardedSend(message)) return;
  } catch (error) {
    console.error('❌ Errore invio CMD_CONNECT (from setWifiCredentials):', error);
  }
}

/**
 * Invia richiesta di scan Wi-Fi all'ESP32
 * Se il Wi-Fi è occupato (scanning/connecting/backoff/online), il comando viene ignorato silenziosamente.
 * 
 * Formato messaggio: CMD_SCAN|
 */
export function sendWifiScan() {
  const message = `${CmdToEsp.CMD_SCAN}${Separators.CMD}`;
  try {
    if (!_guardedSend(message)) return;
  } catch (error) {
    console.error('❌ Errore invio CMD_SCAN:', error);
  }
}

/**
 * Invia richiesta di connessione Wi-Fi all'ESP32
 * Se il Wi-Fi è occupato, il comando viene ignorato silenziosamente.
 * 
 * @param {Object} params - Parametri di connessione
 * @param {string} params.ssid - Nome della rete Wi-Fi (obbligatorio)
 * @param {string} [params.psw=""] - Password (vuoto per reti open o known)
 * @param {number} [params.channel=0] - Canale (0 se sconosciuto)
 * @param {string} [params.bssid=""] - BSSID in formato AA:BB:CC:DD:EE:FF (vuoto se sconosciuto)
 * 
 * Formato messaggio: CMD_CONNECT|<ssid>☺<psw>☺<channel>☺<bssid>
 */
export function sendWifiConnect({ ssid, psw = "", channel = 0, bssid = "" }) {
  if (!ssid || typeof ssid !== 'string') {
    console.error('❌ sendWifiConnect: ssid obbligatorio');
    return;
  }

  const payload = [ssid, psw, String(channel), bssid].join(Separators.VALUE);
  const message = `${CmdToEsp.CMD_CONNECT}${Separators.CMD}${payload}`;

  try {
    if (!_guardedSend(message)) return;
  } catch (error) {
    console.error('❌ Errore invio CMD_CONNECT:', error);
  }
}

/**
 * Richiede un full Wi-Fi snapshot dall'ESP (stato + scan list se disponibile)
 * Risposta: messaggio WIFI con header + eventuale scan list
 * 
 * Formato messaggio: CMD_GET_WIFI|
 */
export function sendWifiGetWifi() {
  const message = `${CmdToEsp.CMD_GET_WIFI}${Separators.CMD}`;
  try {
    if (!_guardedSend(message)) return;
  } catch (error) {
    console.error('❌ Errore invio CMD_GET_WIFI:', error);
  }
}

/**
 * Invia richiesta di disconnessione Wi-Fi all'ESP32
 * Sempre accettata, anche se il Wi-Fi è occupato (abort scan/connect/backoff).
 * Disabilita il reconnect automatico fino al prossimo CMD_CONNECT o reboot.
 * 
 * Formato messaggio: CMD_DISCONNECT|
 */
export function sendWifiDisconnect() {
  const message = `${CmdToEsp.CMD_DISCONNECT}${Separators.CMD}`;
  try {
    if (!_guardedSend(message)) return;
  } catch (error) {
    console.error('❌ Errore invio CMD_DISCONNECT:', error);
  }
}

/**
 * Modifica o crea un TimeSlot
 * @param {Object} timeSlot - Oggetto TimeSlot
 * @param {number} timeSlot.id - ID dello slot (255 per nuovo, 0-254 per modifica)
 * @param {string} timeSlot.start - Orario inizio formato "HH:MM" (es: "09:30")
 * @param {string} timeSlot.stop - Orario fine formato "HH:MM" (es: "17:00")
 * @param {Object} timeSlot.days - Oggetto giorni {mon: true, tue: false, ...}
 * 
 * Formato messaggio: MODIFY_TIME_SLOT|<id>☺<hourStart>☺<minStart>☺<hourStop>☺<minStop>☺<dayFlags>
 * Esempio: MODIFY_TIME_SLOT|255☺9☺30☺17☺0☺127 (nuovo slot 9:30-17:00, tutti i giorni)
 */
export function modifyTimeSlot(timeSlot) {
  if (!timeSlot || typeof timeSlot !== 'object') {
    console.error('❌ modifyTimeSlot: timeSlot deve essere un oggetto');
    return;
  }
  
  const { id, start, stop, days } = timeSlot;
  
  // Validazione
  if (typeof id !== 'number' || typeof start !== 'string' || typeof stop !== 'string' || !days) {
    console.error('❌ modifyTimeSlot: timeSlot non valido', timeSlot);
    return;
  }
  
  // Parse stringhe orario "HH:MM"
  const startTime = parseTimeString(start);
  const stopTime = parseTimeString(stop);
  
  // Converti giorni in bitmask
  const dayFlags = convertDaysToBitmask(days);
  
  // Costruisci payload: id☺hourStart☺minStart☺hourStop☺minStop☺dayFlags
  const parts = [
    id,
    startTime.hours,
    startTime.minutes,
    stopTime.hours,
    stopTime.minutes,
    dayFlags
  ];
  
  const payload = parts.join(Separators.VALUE);
  const message = `${CmdToEsp.MODIFY_TIME_SLOT}${Separators.CMD}${payload}`;
  
  try {
    if (!_guardedSend(message)) return;
  } catch (error) {
    console.error(`❌ Errore invio modifyTimeSlot:`, error);
  }
}

/**
 * Elimina un TimeSlot
 * @param {number} slotId - ID dello slot da eliminare (0-254)
 * 
 * Formato messaggio: DELETE_TIME_SLOT|<id>
 * Esempio: DELETE_TIME_SLOT|2
 */
export function deleteTimeSlot(slotId) {
  if (typeof slotId !== 'number') {
    console.error('❌ deleteTimeSlot: slotId deve essere un numero');
    return;
  }
  
  const message = `${CmdToEsp.DELETE_TIME_SLOT}${Separators.CMD}${slotId}`;
  
  try {
    if (!_guardedSend(message)) return;
  } catch (error) {
    console.error(`❌ Errore invio deleteTimeSlot:`, error);
  }
}

/**
 * Toggles the pump power state.
 * @param {boolean} state - true to turn ON, false to turn OFF.
 *
 * Sends: CMD_PUMP_STATE|<value>
 * Where <value> is 1 for ON, 0 for OFF.
 */
export function powerPump(state) {
  if (typeof state !== "boolean") {
    console.error("❌ powerPump: 'state' must be a boolean (true/false). Command aborted.");
    return;
  }

  const value = state ? 1 : 0;
  const message = `${CmdToEsp.PUMP_STATE}${Separators.CMD}${value}`;

  try {
    if (!_guardedSend(message)) return;
  } catch (error) {
    console.error("❌ Error sending powerPump command:", error);
  }
}

/**
 * Aggiorna l'RTC dell'ESP32 con la data/ora corrente del sistema
 * @param {Date} date - Oggetto Date con la data/ora da impostare (opzionale, default: now)
 * 
 * Formato messaggio: UPDATE_RTC|<year>☺<month>☺<day>☺<hour>☺<minute>☺<second>
 * Esempio: UPDATE_RTC|2025☺10☺21☺14☺30☺45
 */
export function updateRTC(date = null) {
  log.warn("Inviato aggiornamento alla centralina");

  const now = date || new Date();
  
  // Estrai componenti della data
  const year = now.getFullYear();
  const month = now.getMonth() + 1;  // getMonth() restituisce 0-11, serve 1-12
  const day = now.getDate();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const second = now.getSeconds();
  
  // Costruisci payload: year☺month☺day☺hour☺minute☺second
  const parts = [year, month, day, hour, minute, second];
  const payload = parts.join(Separators.VALUE);
  const message = `${CmdToEsp.UPDATE_RTC}${Separators.CMD}${payload}`;
  
  try {
    // RTC update bypasses PIN lock — safe, non-destructive, always allowed
    Socket.send(message);
  } catch (error) {
    console.error(`❌ Errore invio comando UPDATE_RTC:`, error);
  }
}

/**
 * Send a bootstrap pull request message: REQ_MSG|TYPE
 * This path is intentionally PIN-bypassable by policy.
 * @param {string} type
 * @returns {boolean} true if sent, false if blocked/unavailable
 */
export function sendBootstrapRequest(type) {
  if (typeof type !== 'string' || type.trim().length === 0) {
    console.error('❌ sendBootstrapRequest: type non valido');
    return false;
  }

  const message = `${CmdToEsp.REQ_MSG}${Separators.CMD}${type.trim().toUpperCase()}`;

  try {
    const ok = _guardedSend(message);
    if (!ok) return false;
    return true;
  } catch (error) {
    console.error('❌ Errore invio bootstrap request:', error);
    return false;
  }
}

 /**
  * Comando per accendere la pompa
  * 
  * /

/**
 * Esempi di comandi tipici per il nebulizzatore
 * @deprecated Usa modifyParameter, modifyTimeSlot, deleteTimeSlot
 */
export const Commands = {
  // Power
  powerOn: () => send('POWER', ['ON']),
  powerOff: () => send('POWER', ['OFF']),
  
  // Parametri (DEPRECATO - usa modifyParameter invece)
  setTemperature: (value) => modifyParameter(0, value),
  setHumidity: (value) => modifyParameter(4, value),
  setTimerOn: (seconds) => modifyParameter(1, seconds),
  setTimerOff: (seconds) => modifyParameter(9, seconds),
  
  // Time Slots (DEPRECATO - usa modifyTimeSlot/deleteTimeSlot invece)
  addTimeSlot: (timeSlot) => modifyTimeSlot({ ...timeSlot, id: 255 }),
  editTimeSlot: (timeSlot) => modifyTimeSlot(timeSlot),
  deleteTimeSlot: (slotId) => deleteTimeSlot(slotId),
  
  // Modalità
  setMode: (mode) => send('MODE', [mode]), // TEMP, HUMID, TIMER, CALENDAR
  
  // Reset
  resetToDefaults: () => sendAndWait('RESET', []),
  
  // Info
  requestUpdate: () => send('GET_UPDATE'),
  requestParams: () => send('GET_PARAMS'),
};

// Export default per import singolo
export const CommandManager = {
  init,
  send,
  sendAndWait,
  setDefaultTimeout,
  getPendingCount,
  clearPending,
  modifyParameter,
  modifyStringParameter,
  modifyTimeSlot,
  deleteTimeSlot,
  powerPump,
  updateRTC,
  setWifiCredentials,
  sendWifiScan,
  sendWifiConnect,
  sendWifiDisconnect,
  sendWifiGetWifi,
  sendBootstrapRequest,
  softReset,
  Commands,
  _debug,
};
