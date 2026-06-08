export const MsgType = {
  UPDATE: "UPDATE",
  TIME_SLOT: "TIME_SLOT",
  LANG: "LANG",
  PARAM: "PARAM",
  MODIFY: "MODIFY",
  MODIFY_STR: "MODIFY_STR",
  MENU: "MENU",
  FORCED_DISCONNECT: "FORCE_DISCONNECT",
  WIFI: "WIFI",
  HELLO: "HELLO"
};



/**
 * Connection mode reported by ESP HELLO handshake.
 * AP  = client connected via device SoftAP (can configure WiFi)
 * STA = client connected via external network (WiFi config disabled)
 * UNKNOWN = before HELLO arrives (default-safe: WiFi config disabled)
 */
export const ConnectionMode = {
  AP:      "AP",
  STA:     "STA",
  UNKNOWN: "UNKNOWN"
};

export const CmdToEsp = {
  MODIFY_PARAM: "MODIFY_PARAM",
  MODIFY_TIME_SLOT: "MODIFY_TIME_SLOT",
  DELETE_TIME_SLOT: "DELETE_TIME_SLOT",
  PUMP_STATE: "PUMP_STATE",
  UPDATE_RTC: "UPDATE_RTC",
  CMD_MODIFY_STR: "CMD_MODIFY_STR",
  CMD_CRED_WIFI: "CMD_CRED_WIFI",
  CMD_SCAN: "CMD_SCAN",
  CMD_CONNECT: "CMD_CONNECT",
  CMD_DISCONNECT: "CMD_DISCONNECT",
  CMD_GET_WIFI: "CMD_GET_WIFI",
  REQ_MSG: "REQ_MSG",
  SOFT_RESET: "SOFT_RESET"
}

export const BootstrapRequestType = {
  HELLO: "HELLO",
  PARAM: "PARAM",
  MENU: "MENU",
  TIME_SLOT: "TIME_SLOT",
  UPDATE: "UPDATE"
};

export const BootstrapRequestOrder = [
  BootstrapRequestType.HELLO,
  BootstrapRequestType.PARAM,
  BootstrapRequestType.MENU,
  BootstrapRequestType.TIME_SLOT,
  BootstrapRequestType.UPDATE
];

export const BOOTSTRAP_PIPELINE_DEFAULT_RETRY = 3;
export const BOOTSTRAP_PIPELINE_DEFAULT_TIMEOUT_MS = 800;

export const Separators = {
  CMD: "|",
  VALUE:  "☺",
  LIST:   "☻",
  TEXT:   "♥",
  LANG:   "♦",
  STRING: "♣"
};

export const PumpState = {
  OFF: 0,
  ON: 1,
  LOW_PRESSURE: 2,
  BLOCCKED: 3,
  TESTING: 4
};

export const PressureSwitch = {
  OFF: 0,
  ON: 1,
  IGNORED: 2
};

export const SocketState = {
  CONNECTING: "connecting",
  CONNECTED: "connected",
  DISCONNECTED: "disconnected",
  RECONNECTING: "reconnecting"
};


export const wifiStatus = {
  STOPPED: "stopped",          // manual disconnect (reconnect disabled at runtime)
  DISCONNECTED: "disconnected",
  SCANNING: "scanning",
  CONNECTING: "connecting",
  CONNECTED: "connected",      // ONLINE
  BACKOFF: "backoff",
  FAILED: "failed",
  AUTH_FAILED: "auth_failed"
};

/**
 * Wi-Fi signal level (5 livelli, no RSSI raw nel Store)
 */
export const wifiSignalLevel = {
  NONE:   0,
  LOW:    1,
  MIDDLE: 2,
  HIGH:   3,
  FULL:   4
};

/**
 * Wi-Fi operation in progress (maps to WifiOpEnum on ESP)
 * 0 = nessuna operazione, 1 = scan, 2 = connect
 */
export const wifiOp = {
  NONE:    0,
  SCAN:    1,
  CONNECT: 2
};

/**
 * Wi-Fi error code (maps to WifiErrorCode on ESP)
 * Sent once after operation failure, cleared on next operation start
 */
export const wifiError = {
  OK:           0,
  TIMEOUT:      1,
  NO_AP_FOUND:  2,
  AUTH_FAIL:    3,
  DHCP_FAIL:    4,
  UNKNOWN:      5
};

/**
 * Tipologia di dato del parametro (corrispondente a ParamTypes enum in Parameter.h)
 */
export const ParamType = {
  NUMBER: 0,
  FLOAT: 1,
  BOOL: 2,
  TIME: 3,
  MONTH: 4,
  PRESSURE_TYPE: 5,
  AUX_TYPE: 6,
  RELAY_MODE: 7,
  LANG_TYPE: 8,
  MODBUS_BAUDRATE: 9,
};

/**
 * Valori per il parametro Relay Mode (ParamType.RELAY_MODE)
 * Indica la modalità operativa del relè extra
 */
export const RelayModeType = {
  BYPASS: 0,        // Relè disabilitato (nascosto in UI)
  DISPENSER: 1,     // Modalità dosatore
  FAN: 2,           // Modalità ventola
  ANTIBACTERIAL: 3,  // Modalità antibatterico
  DISABLE: 4        // Modalità disabilitata (nascosto in UI)
};

/**
 * ID del parametro Relay Mode nello store
 */
export const RELAY_MODE_PARAM_ID = 22;

/**
 * ID del parametro Auto Clock Update
 * Abilita/disabilita l'aggiornamento automatico dell'RTC ESP32 dal browser
 */
export const AUTO_CLOCK_UPDATE_PARAM_ID = 36;

/**
 * ID parametro stringa per il nome dell'Access Point
 */
export const AP_NAME_PARAM_ID_STR = 0;

/**
 * Limiti di validazione per parametri stringa e WiFi
 */
export const STRING_PARAM_MAX_LENGTH = 64;
export const WIFI_SSID_MAX_LENGTH = 32;
export const WIFI_PASSWORD_MIN_LENGTH = 8;
export const WIFI_PASSWORD_MAX_LENGTH = 63;

/**
 * ID parametri sensori (setpoint)
 */
export const TEMP_SETPOINT_PARAM_ID = 0;
export const HUM_SETPOINT_PARAM_ID = 4;

/**
 * Tipo di menu associato al parametro (corrispondente a MenuTypes enum in Parameter.h)
 */
export const MenuTypeParam = {
  TIME: 0,
  DATE: 1,
  TEMPERATURE: 2,
  HUMIDITY: 3,
  RTC: 4,
  WIFI: 5,
  OTHER: 6
};

/**
 * Giorni della settimana (day keys in timeSlots)
 */
export const WeekDays = {
  MONDAY: 'mon',
  TUESDAY: 'tue',
  WEDNESDAY: 'wed',
  THURSDAY: 'thu',
  FRIDAY: 'fri',
  SATURDAY: 'sat',
  SUNDAY: 'sun'
};

/**
 * Array ordinato dei giorni della settimana per iterazione
 */
export const WeekDaysOrder = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/**
 * Mapping day string -> day index per i18n.tDay()
 */
export const WeekDayIndex = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6
};

/**
 * Mapping day index -> day string (inverso di WeekDayIndex)
 * 0 = 'sun' (Domenica), 1 = 'mon' (Lunedì), ..., 6 = 'sat' (Sabato)
 * Nota: JavaScript getDay() ritorna 0=Domenica, 1=Lunedì, etc.
 */
export const DayIndexToKey = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat'
};

/**
 * ID parametri per le modalità operative
 * Usati per controllare enable/disable delle modalità
 */
export const MODE_PARAM_IDS = {
  TEMPERATURE: 3,
  HUMIDITY: 7,
  TIMER: 10,
  CALENDAR: 11,
  AUX: 14,
  WIRELESS: 23
};

/**
 * ID del parametro Lingua
 * Usato per cambiare la lingua dell'interfaccia
 */
export const LANG_PARAM_ID = 24;

/**
 * ID del parametro Modbus Device ID
 * Usato per identificare la macchina nella rete Modbus, Access Point e DNS
 */
export const MODBUS_DEVICE_ID_PARAM_ID = 40;

/**
 * ID del parametro PIN device (parametro #41)
 * Usato per l'autenticazione frontend.
 * Il numero di cifre è derivato da maxValue del parametro.
 */
export const PIN_PARAM_ID = 41;

/**
 * Chiave localStorage per il PIN salvato dall'utente
 */
export const LOCALSTORAGE_PIN_KEY = 'fogextra_device_pin';

// massimo numero di scheduler
export const MAX_TIME_SLOTS = 10;