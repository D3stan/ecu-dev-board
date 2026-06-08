// adapter.js
import { Store } from "./store.js";
import { Paths } from "../utils/paths.js";
import { MsgType, Separators, PumpState, PressureSwitch, wifiStatus, wifiSignalLevel, wifiOp, wifiError, ConnectionMode } from "../utils/constants.js";
import { LangIndex } from "../utils/i18n.js";

/* ----------------- CONSTANTS ----------------- */
const CHANGE_LANG_PARAM_ID = 24; // ParamId::ChangeLang dall'ESP

/* ----------------- BOOTSTRAP NOTIFIER ----------------- */
let bootstrapProcessedNotifier = null;

function setBootstrapProcessedNotifier(fn) {
  bootstrapProcessedNotifier = typeof fn === 'function' ? fn : null;
}

function notifyBootstrapProcessed(type) {
  if (!bootstrapProcessedNotifier) return;

  try {
    bootstrapProcessedNotifier(type);
  } catch (err) {
    console.error('[BOOTSTRAP] notifier error:', type, err);
  }
}

/* ----------------- HELPERS ----------------- */
function toBool(str) {
  return str === "T";
}

function toInt(str, fallback = 0) {
  const n = parseInt(str, 10);
  return Number.isNaN(n) ? fallback : n;
}

function toFloat(str, fallback = null) {
  const n = parseFloat(str);
  return Number.isNaN(n) ? fallback : n;
}

function decodeDays(flags) {
  const names = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const days = {};
  names.forEach((d, i) => days[d] = !!(flags & (1 << i)));
  return days;
}

function decodeParam(fields) {
  const IDX = {
    ID: 0,
    UNIT: 1,
    TYPE: 2,
    MENU_TYPE: 3,
    MIN: 4,
    MAX: 5,
    STEP: 6,
    DIVISOR: 7,
    SHIFT: 8,
    DEFAULT: 9,
    VALUE: 10
  };

  return {
    id:       toInt(fields[IDX.ID], -1),
    unit:     fields[IDX.UNIT] || "",
    type:     toInt(fields[IDX.TYPE], 0),
    menuType: toInt(fields[IDX.MENU_TYPE], 0),
    min:      toInt(fields[IDX.MIN], 0),
    max:      toInt(fields[IDX.MAX], 0),
    step:     toInt(fields[IDX.STEP], 1),
    divisor:  toInt(fields[IDX.DIVISOR], 1),
    shift:    toInt(fields[IDX.SHIFT], 0),
    default:  toInt(fields[IDX.DEFAULT], 0),
    value:    toInt(fields[IDX.VALUE], 0) 
  };
}

/**
 * Pulisce stringhe da caratteri terminali tipo "." o spazi
 */
function clean(str) {
  return str?.trim().replace(/\.$/, "") || "";
}

/**
 * Decodifica la stringa parametri "p1:desc1,p2:desc2"
 * @returns array di oggetti { name, ds }
 */
function decodeParams(str, sepField, sepKV) {
  if (!str) return [];
  return str.split(sepField).map(p => {
    const [name, desc] = p.split(sepKV, 2);
    return { name: clean(name), ds: clean(desc) };
  });
}


/* ----------------- WiFi HELPERS ----------------- */

/**
 * Converte RSSI (dB) in livello di segnale (wifiSignalLevel enum)
 * @param {number|null} db - RSSI value (negativo, es. -57)
 * @returns {number} wifiSignalLevel value
 */
function rssiToSignalLevel(db) {
  if (db === null || db === undefined) return wifiSignalLevel.NONE;
  if (db >= -55) return wifiSignalLevel.FULL;
  if (db >= -65) return wifiSignalLevel.HIGH;
  if (db >= -75) return wifiSignalLevel.MIDDLE;
  if (db >= -85) return wifiSignalLevel.LOW;
  return wifiSignalLevel.NONE;
}

/**
 * Mappa l'enum intero ESP (wifiStateEnum) → wifiStatus costante Store
 * @param {number} n - wifiStateEnum dall'ESP (0-7)
 * @returns {string} wifiStatus value
 */
function mapWifiStateEnumToStatus(n) {
  switch (n) {
    case 0: return wifiStatus.STOPPED;
    case 1: return wifiStatus.DISCONNECTED;
    case 2: return wifiStatus.SCANNING;
    case 3: return wifiStatus.CONNECTING;
    case 4: return wifiStatus.CONNECTED;
    case 5: return wifiStatus.BACKOFF;
    case 6: return wifiStatus.FAILED;
    case 7: return wifiStatus.AUTH_FAILED;
    default: return wifiStatus.DISCONNECTED;
  }
}

/* ----------------- DISPATCH ----------------- */
/**
 * Dispatcher dei messaggi ricevuti dall'ESP
 * @param {string} raw messaggio raw, es. "UPDATE|0,1,1,..."
 */
function dispatchMessage(raw) {
  if (typeof raw !== "string" || !raw.includes(Separators.CMD)) return;

  const [header, body] = raw.split(Separators.CMD, 2);

  switch (header) {
    case MsgType.UPDATE:    
      return parseUpdate(body);
    
    case MsgType.TIME_SLOT: 
      return parseTimeSlot(body);
    
    case MsgType.LANG:
      // 🌍 Full LANG payload replaced by static modules + localizationEffect.
      // Only extract langIndex to keep CONFIG.PARAMS[24] aligned.
      return parseLanguageIndexAck(body);

    case MsgType.PARAM:     
      return parseParam(body);
    
    case MsgType.MODIFY:    
      return parseModify(body);
    
    case MsgType.MODIFY_STR:
      return parseModifyStr(body);
    
    case MsgType.MENU:      
      return parseMenu(body);
    
    case MsgType.HELLO:
      return parseHello(body);

    case MsgType.WIFI:
      return parseWifi(body);
    
    case MsgType.FORCED_DISCONNECT:
      // 🚨 Già gestito in socket.js (non propagato qui)
      console.warn("⚠️ FORCED_DISCONNECT ricevuto (già gestito in socket.js)");
      return;

    // Silent handlers — these are system messages, not dispatched to Store
    case "ACK":
    case "NACK":
    case "PONG":
      return; // handled by commandManager or socket heartbeat
    
    default:
      console.warn("Messaggio sconosciuto:", raw);
  }
}

/* ----------------- PARSER UPDATE ----------------- */
function parseUpdate(body) {
  const parts = body.split(Separators.VALUE);
  let idx = 0;

  // --- parsing sequenziale ---
  const tempProbeConnected = toBool(parts[idx++]);
  const enableTemp         = toBool(parts[idx++]);
  const activeTemp         = toBool(parts[idx++]);

  const humProbeConnected  = toBool(parts[idx++]);
  const enableHum          = toBool(parts[idx++]);
  const activeHum          = toBool(parts[idx++]);

  const enableTimer        = toBool(parts[idx++]);
  const activeTimer        = toBool(parts[idx++]);

  //
  const enableCal          = toBool(parts[idx++]);
  const activeCal          = toBool(parts[idx++]);

  const enableAux          = toBool(parts[idx++]);
  const activeAux          = toBool(parts[idx++]);

  const enableWireless     = toBool(parts[idx++]);
  const activeWireless     = toBool(parts[idx++]);

  const extraRelayState    = toBool(parts[idx++]);
  const drainValveState    = toBool(parts[idx++]);
  const isModifing         = toBool(parts[idx++]);
  
  const isAntibacterialError = toBool(parts[idx++]);
  const pumpState          = toInt(parts[idx++], PumpState.OFF);
  const pressureSwitch     = toInt(parts[idx++], PressureSwitch.OFF);

  const timerModeOn        = (toInt(parts[idx++], 0) + 1)/1000;
  const timerModeOff       = (toInt(parts[idx++], 0) + 1)/1000;

  const timerRelay         = toInt(parts[idx++], 0);

  const sensorTemp         = toFloat(parts[idx++], null);
  const sensorHum          = toFloat(parts[idx++], null);

  const rtcTime            = parts[idx++] || "00:00";
  const rtcDayNumber       = toInt(parts[idx++], 0);

  const softwareRev       = parts[idx++] || "";

  // converto i secondi in ore
  const totalSecMaintenance = Math.floor(toInt(parts[idx++], 0) / 3600);
  const secMaintenanceLeft  = Math.floor(toInt(parts[idx++], 0) / 3600);
  const secAbsoluteTime = totalSecMaintenance - secMaintenanceLeft;

  // --- update Store ---
  Store.set(Paths.RUNTIME.ALERTS.IS_MODIFING, isModifing);

  Store.set(Paths.RUNTIME.ALERTS.IS_ANTIBACTERIAL_ERROR, isAntibacterialError);

  Store.set(Paths.RUNTIME.MODES.TEMP_ENABLED, enableTemp);
  Store.set(Paths.RUNTIME.MODES.TEMP_ACTIVE, activeTemp);

  Store.set(Paths.RUNTIME.MODES.HUM_ENABLED, enableHum);
  Store.set(Paths.RUNTIME.MODES.HUM_ACTIVE, activeHum);

  Store.set(Paths.RUNTIME.MODES.TIMER_ENABLED, enableTimer);
  Store.set(Paths.RUNTIME.MODES.TIMER_ACTIVE, activeTimer);

  Store.set(Paths.RUNTIME.MODES.CAL_ENABLED, enableCal);
  Store.set(Paths.RUNTIME.MODES.CAL_ACTIVE, activeCal);

  Store.set(Paths.RUNTIME.MODES.AUX_ENABLED, enableAux);
  Store.set(Paths.RUNTIME.MODES.AUX_ACTIVE, activeAux);

  Store.set(Paths.RUNTIME.MODES.WIFI_ENABLED, enableWireless);
  Store.set(Paths.RUNTIME.MODES.WIFI_ACTIVE, activeWireless);

  Store.set(Paths.RUNTIME.OUTPUTS.RELAY, extraRelayState);
  Store.set(Paths.RUNTIME.OUTPUTS.DRAIN, drainValveState);
  Store.set(Paths.RUNTIME.OUTPUTS.PUMP, pumpState);

  Store.set(Paths.RUNTIME.SENSORS.PRESSURE, pressureSwitch);

  // sensori con flag connected
  Store.set(Paths.RUNTIME.SENSORS.TEMP_CONNECTED, tempProbeConnected);
  Store.set(Paths.RUNTIME.SENSORS.TEMP_VALUE, tempProbeConnected ? sensorTemp: "--.- ");

  Store.set(Paths.RUNTIME.SENSORS.HUM_CONNECTED, humProbeConnected);
  Store.set(Paths.RUNTIME.SENSORS.HUM_VALUE, humProbeConnected ? sensorHum: "--.- ");

  // timers
  Store.set(Paths.RUNTIME.TIMERS.MODE_ON, timerModeOn);
  Store.set(Paths.RUNTIME.TIMERS.MODE_OFF, timerModeOff);

  // Store.set(Paths.RUNTIME.TIMERS.DISPENSER_OFF, timerRelay);

  // aggiorno il tempo dell'rtc
  Store.set(Paths.RUNTIME.RTC.TIME, rtcTime);
  Store.set(Paths.RUNTIME.RTC.DAY, rtcDayNumber);

  // aggiorno la revisione software
  Store.set(Paths.CONFIG.SOFTWARE.VERSION, softwareRev);

  // aggiorno i valori del timer di manutenzione
  
  Store.set(Paths.RUNTIME.TIMERS.MAINTENANCE.ABSOLUTE_TIME, secAbsoluteTime);
  Store.set(Paths.RUNTIME.TIMERS.MAINTENANCE.TIME_LEFT, secMaintenanceLeft);
  Store.set(Paths.RUNTIME.TIMERS.MAINTENANCE.IS_MAINTENANCE, (secMaintenanceLeft == 0));

  // Wi-Fi fields removed from UPDATE — now sent as separate WIFI snapshot message
  notifyBootstrapProcessed(MsgType.UPDATE);
}

/* ----------------- PARSER HELLO (connection mode handshake) ------------- */

/**
 * Parser per il messaggio HELLO (handshake iniziale connessione)
 * Formato: HELLO|AP☺AA:BB:CC:DD:EE:FF oppure HELLO|STA☺AA:BB:CC:DD:EE:FF
 * (backward-compatible: HELLO|AP / HELLO|STA senza MAC)
 * Imposta Store.wifi.connectionMode per il gating UI.
 * Imposta anche Store.config.software.macAddress.
 */
function parseHello(body) {
  if (!body) return;

  const [rawMode, rawMac = ""] = body.split(Separators.VALUE, 2);
  const mode = (rawMode || "").trim();
  const macAddress = (rawMac || "").trim().toUpperCase();

  if (mode === ConnectionMode.AP || mode === ConnectionMode.STA) {
    Store.set(Paths.WIFI.CONNECTION_MODE, mode);
  } else {
    Store.set(Paths.WIFI.CONNECTION_MODE, ConnectionMode.UNKNOWN);
  }

  Store.set(Paths.CONFIG.SOFTWARE.MAC_ADDRESS, macAddress);
  notifyBootstrapProcessed(MsgType.HELLO);
}

/* ----------------- PARSER WIFI (unified Wi-Fi snapshot) ----------------- */

/**
 * Parser per il messaggio WIFI (snapshot unificato dallo ESP)
 * 
 * Formato header: WIFI|state☺connectedSsid☺rssiDbm☺op☺silenceMs☺errCode☺staIp
 * Formato scan (opzionale, dopo ♦): ♦ssid☺channel☺bssid☺rssiDbm☺isKnown☺isOpen☻...
 * 
 * Il messaggio contiene SEMPRE lo stato corrente della connessione Wi-Fi.
 * La scan list (sezione dopo ♦) è presente solo quando ci sono risultati scan disponibili.
 * Campo staIp (posizione 6): IP assegnato alla STA, vuoto se STA non connessa.
 */
function parseWifi(body) {
  if (!body) return;

  // Split header section from scan list section (separator: ♦)
  const sections = body.split(Separators.LANG); // ♦
  const headerPart = sections[0] || "";
  const scanPart = sections.length > 1 ? sections[1] : null;

  // --- Parse header: state☺connectedSsid☺rssiDbm☺op☺silenceMs☺errCode ---
  const hf = headerPart.split(Separators.VALUE);
  const stateEnum    = toInt(hf[0], 1);
  const connSsid     = hf[1] || "";
  const rssiDbm      = toInt(hf[2], 0);
  const opCode       = toInt(hf[3], 0);
  const silenceMs    = toInt(hf[4], 0);
  const errCode      = toInt(hf[5], 0);

  const status = mapWifiStateEnumToStatus(stateEnum);
  const signalLevel = rssiDbm !== 0 ? rssiToSignalLevel(rssiDbm) : wifiSignalLevel.NONE;

  // --- Update Store: connection state ---
  Store.set(Paths.WIFI.CONNECTION.STATUS, status);
  Store.set(Paths.WIFI.CONNECTION.CONNECTED_SSID, connSsid);
  Store.set(Paths.WIFI.CONNECTION.CONNECTED_SIGNAL, signalLevel);
  Store.set(Paths.WIFI.CONNECTION.OPERATION, opCode);
  Store.set(Paths.WIFI.CONNECTION.SILENCE_MS, silenceMs);

  // --- Parse STA_IP (field index 6, after errCode) ---
  const staIpRaw = hf[6] || "";
  Store.set(Paths.WIFI.STA_IP, staIpRaw.length > 0 ? staIpRaw : null);

  // Error: only update if errCode changed; mark as unseen when new error arrives
  if (errCode !== wifiError.OK) {
    Store.set(Paths.WIFI.CONNECTION.ERROR_TYPE, errCode);
    Store.set(Paths.WIFI.CONNECTION.ERROR_SEEN_BY_USER, false);
  } else {
    Store.set(Paths.WIFI.CONNECTION.ERROR_TYPE, wifiError.OK);
  }

  // --- Notify socket.js about silence window (via custom event) ---
  if (silenceMs > 0) {
    window.dispatchEvent(new CustomEvent('wifi-silence', { detail: { silenceMs } }));
  }

  // --- Parse scan list (if present) ---
  if (scanPart !== null) {
    const items = scanPart.split(Separators.LIST).filter(s => s.trim() !== "");
    const list = [];

    for (let i = 0; i < items.length && list.length < 30; i++) {
      const f = items[i].split(Separators.VALUE);

      const ssid    = f[0] || "";
      const channel = toInt(f[1], 0);
      const bssid   = f[2] || "";
      const db      = toInt(f[3], -100);
      const isKnown = toInt(f[4], 0) === 1;
      const isOpen  = toInt(f[5], 0) === 1;

      const sl = rssiToSignalLevel(db);
      const id = bssid !== "" ? bssid : `${ssid}@${channel}#${i}`;

      list.push({ id, ssid, channel, bssid, isKnown, isOpen, signalLevel: sl });
    }

    Store.set(Paths.WIFI.NETWORKS, list);
    Store.set(Paths.WIFI.NETWORKS_UPDATED_AT, Date.now());
  }

}

/* ----------------- PARSER TIME SLOT ----------------- */
function parseTimeSlot(body) {
  const slotsRaw = body.split(Separators.LIST).filter(s => s.trim() !== "");
  const scheduler = [];

  for (const slotRaw of slotsRaw) {
    const parts = slotRaw.split(Separators.VALUE);
    if (parts.length < 6) continue;

    const id       = toInt(parts[0], -1);
    const hStart   = toInt(parts[1], 0);
    const mStart   = toInt(parts[2], 0);
    const hStop    = toInt(parts[3], 0);
    const mStop    = toInt(parts[4], 0);
    const dayFlags = toInt(parts[5], 0);

    scheduler.push({
      id,
      start: `${String(hStart).padStart(2, "0")}:${String(mStart).padStart(2, "0")}`,
      stop:  `${String(hStop).padStart(2, "0")}:${String(mStop).padStart(2, "0")}`,
      days: decodeDays(dayFlags)
    });

  }

  Store.set(Paths.RUNTIME.SCHEDULER, scheduler);
  notifyBootstrapProcessed(MsgType.TIME_SLOT);
}

/* ----------------- PARSER LANG ----------------- */

/**
 * parseLanguageIndexAck — lightweight LANG-message handler.
 *
 * The webapp now ships all 5 language bundles as static ES modules and the
 * localizationEffect observer reacts to CONFIG.PARAMS[24] (ChangeLang) to
 * drive language changes.  The old parseLang(body) that consumed a 4-5 KB
 * LANG payload is no longer needed.
 *
 * The ESP still broadcasts LANG|<langIndex>☺… as an ACK when the user changes
 * the language on the device.  This handler extracts only the langIndex from
 * the body and, if it differs from the current value, writes it to
 * CONFIG.PARAMS[24].value — which triggers localizationEffect automatically.
 *
 * @param {string} body - message body after the 'LANG|' prefix
 */
function parseLanguageIndexAck(body) {
  // Extract langIndex (everything before the first ☺ separator)
  const firstSepIdx = body.indexOf(Separators.VALUE);
  const rawIndex    = firstSepIdx !== -1 ? body.substring(0, firstSepIdx) : body;
  const langIndex   = toInt(rawIndex, -1);

  if (langIndex < LangIndex.ENGLISH || langIndex > LangIndex.SPANISH) {
    log.warn(`🌍 [LANG ACK] langIndex out of range: ${langIndex} — ignored`);
    return;
  }

  // Sync CONFIG.PARAMS[24] so localizationEffect fires automatically
  const configParams = Store.get(Paths.CONFIG.PARAMS) || [];
  const idx          = configParams.findIndex(p => p.id === CHANGE_LANG_PARAM_ID);

  if (idx !== -1 && configParams[idx].value !== langIndex) {
    const updated = configParams.map(p =>
      p.id === CHANGE_LANG_PARAM_ID ? { ...p, value: langIndex } : p
    );
    Store.set(Paths.CONFIG.PARAMS, updated);
    log.debug(`🌍 [LANG ACK] param #${CHANGE_LANG_PARAM_ID} → ${langIndex}`);
  }
}

/* ----------------- PARSER PARAM ----------------- */

function parseParam(body) {
  if (!body) {
    console.warn('[parseParam] Body vuoto');
    return;
  }

  // 1. Separa parametri numerici da parametri stringa usando SEPARATOR_STRING (♣)
  const sections = body.split(Separators.STRING);
  
  // Sezione parametri numerici (obbligatoria)
  const numericSection = sections[0] || '';
  
  // Sezione parametri stringa (opzionale, potrebbe non esserci)
  const stringSection = sections[1] || '';

  // 2. Parse parametri numerici
  const rawParams = numericSection.split(Separators.LIST).filter(p => p.trim() !== "");
  const params = [];

  for (const raw of rawParams) {
    const fields = raw.split(Separators.VALUE);
    if (fields.length < 11) {
      console.warn("Parametro numerico malformato:", raw);
      continue;
    }
    params.push(decodeParam(fields));
  }

  // 3. Parse parametri stringa
  const paramsStr = [];
  
  if (stringSection.trim() !== '') {
    const rawStrParams = stringSection.split(Separators.VALUE);
    
    rawStrParams.forEach((value, index) => {
      paramsStr.push({
        id: index,
        value: value
      });
    });
  }

  // 4. Aggiorna lo Store
  Store.set(Paths.CONFIG.PARAMS, params);
  Store.set(Paths.CONFIG.PARAMS_STR, paramsStr);
  
  // 5. Inizializza la lingua corrente dal parametro ChangeLang
  // ⚠️ USA IL VALORE CORRENTE (value) NON IL DEFAULT
  const changeLangParam = params.find(p => p.id === CHANGE_LANG_PARAM_ID);
  if (changeLangParam && changeLangParam.value !== undefined) {
    Store.set(Paths.LOCALIZATION.CURRENT_LANG_INDEX, changeLangParam.value);
  }

  notifyBootstrapProcessed(MsgType.PARAM);
}

/* ----------------- PARSER MODIFY ----------------- */

function parseModify(body) {
  if (!body) return;

  // ogni coppia "id,value" è separata da ';'
  const pairs = body
    .split(Separators.LIST)      // ';'
    .map(s => s.trim())
    .filter(Boolean);

  if (pairs.length === 0) return;

  // prendo i parametri correnti dallo store
  const oldParams = Store.get(Paths.CONFIG.PARAMS) || [];

  // 🔧 FIX: Crea NUOVO array per triggerare Store subscription
  // Lo Store non notifica se oldValue === value (stesso riferimento)
  const params = oldParams.map(p => ({ ...p })); // Shallow copy di ogni parametro

  // mappa veloce: id -> index nell'array params
  const indexById = new Map(params.map((p, i) => [p.id, i]));

  const updates = [];

  for (const pair of pairs) {
    const [idStr, valStr] = pair.split(Separators.VALUE); // ','
    const id = toInt(idStr, NaN);
    if (Number.isNaN(id)) {
      console.warn("MODIFY: id non valido in", pair);
      continue;
    }
    const value = toInt(valStr, 0);

    updates.push({ id, value });

    // NOTE: CURRENT_LANG_INDEX is updated by localizationEffect (subscriber to
    // CONFIG.PARAMS). Do NOT set it here — that would fire i18n BEFORE LANGS is
    // populated, causing "No language data available" warnings in all components.

    const idx = indexById.get(id);
    if (idx !== undefined) {
      // NB: 'value' è un campo runtime; se non esiste, lo creo
      params[idx].value = value;

      // Se vuoi anche calcolare un "physicalValue" in base a divisor/shift:
      // const { divisor = 1, shift = 0 } = params[idx];
      // params[idx].physicalValue = (value + shift) / (divisor || 1);
    } else {
      console.warn(`MODIFY: parametro id=${id} non trovato in Store.config.params`);
    }
  }

  // 🔧 FIX: Aggiorna con il NUOVO array (riferimento diverso triggera subscription)
  Store.set(Paths.CONFIG.PARAMS, params);

  return updates; // opzionale, utile per logging/test
}

/* ----------------- PARSER MODIFY_STR ----------------- */

/**
 * Parser per i messaggi MODIFY_STR (modifica parametri stringa)
 * Formato: MODIFY_STR|id☺value
 * 
 * Aggiorna config.paramsStr[id] nello Store
 */
function parseModifyStr(body) {
  if (!body) {
    console.warn("⚠️ [parseModifyStr] Body vuoto");
    return;
  }

  // Split id☺value
  const [idStr, value] = body.split(Separators.VALUE);
  const id = toInt(idStr, -1);

  if (id < 0) {
    console.warn("⚠️ [parseModifyStr] ID non valido:", idStr);
    return;
  }

  // Prendi paramsStr corrente dallo Store
  const oldParamsStr = Store.get(Paths.CONFIG.PARAMS_STR) || [];

  // Crea NUOVO array per triggerare subscription (shallow copy)
  const paramsStr = oldParamsStr.map(p => ({ ...p }));

  // Trova e aggiorna il parametro con questo ID
  const paramIndex = paramsStr.findIndex(p => p.id === id);

  if (paramIndex !== -1) {
    // Parametro esistente: aggiorna il valore
    paramsStr[paramIndex].value = value || "";
  } else {
    // Parametro non trovato: crea nuovo entry
    paramsStr.push({ id, value: value || "" });
  }

  // Aggiorna Store con nuovo array (riferimento diverso triggera subscription)
  Store.set(Paths.CONFIG.PARAMS_STR, paramsStr);

  return { id, value };
}

/* ----------------- PARSER MENU ----------------- */


/**
 * Parser per i messaggi MENU
 * Formato:
 *   MENU|menu1,menu2,...,menuN; parId1,parId2,...; parId1,parId2,...; ...
 * Output nello store:
 *   config.menu = [
 *     { menuId: menu1, params: [ ... ] },
 *     { menuId: menu2, params: [ ... ] },
 *     ...
 *   ]
 */
function parseMenu(body) {
  if (!body) return;

  // 1. Split su ';'
  const segments = body.split(Separators.LIST).map(s => s.trim()).filter(Boolean);
  if (segments.length < 2) {
    console.warn("MENU message malformato:", body);
    return;
  }

  // 2. Primo segmento = lista ID menu
  const menuIds = segments[0]
    .split(Separators.VALUE)
    .map(s => parseInt(s, 10))
    .filter(n => !isNaN(n));

  // 3. Segmenti successivi = parametri per ciascun menu
  const result = menuIds.map((menuId, idx) => {
    const seg = segments[idx + 1] || ""; // può mancare
    const params = seg
      .split(Separators.VALUE)
      .map(s => parseInt(s, 10))
      .filter(n => !isNaN(n));

    return { menuId, params };
  });

  // 4. Aggiungi menu Wi-Fi locale (MenuType.WIFI = 7)
  // Questo menu non arriva dall'ESP ma è gestito localmente dalla WebApp
  const WIFI_MENU_ID = 7;
  result.push({ menuId: WIFI_MENU_ID, params: [] });
  
  // 5. Aggiorna lo store
  Store.set(Paths.CONFIG.MENU, result);

  notifyBootstrapProcessed(MsgType.MENU);
}

export { dispatchMessage, setBootstrapProcessedNotifier };
