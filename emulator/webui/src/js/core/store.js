// store.js
import { PumpState, PressureSwitch, SocketState, wifiStatus, wifiSignalLevel, wifiOp, wifiError, ConnectionMode } from "../utils/constants.js";

/**
 * Store centralizzato con pattern Observer e path-based subscription
 * Notifica solo se il valore cambia effettivamente (diff automatico)
 */
const Store = (() => {
  // Stato globale dell'applicazione
  let state = {
    runtime: {
      rtc:{
        time: "",
        day: "",
      },
      alerts: {
        isModifing: false,
        isPumpBlocked: false,
        isAntibacterialError: false,
        pumpHours: 0,
      },
      sensors: {
        temperature: { value: null, connected: false },
        humidity: { value: null, connected: false },
        pressureSwitch: PressureSwitch.OFF,
      },
      outputs: {
        pumpState: PumpState.OFF,
        extraRelay: false,
        drainValve: false,
      },
      modes: {
        temperature: { isEnabled: false, isActive: false },
        humidity: { isEnabled: false, isActive: false },
        timer: { isEnabled: false, isActive: false },
        calendar: { isEnabled: false, isActive: false },
        aux: { isEnabled: false, isActive: false },
        wireless: { isEnabled: false, isActive: false },
      },
      timers: {
        mode: { on: 0, off: 0 },
        dispenser: { on: 0, off: 0 },
        fan: { on: 0, off: 0 },
        maintenance: {
          absoluteTime: 0, 
          timeLeft: 0, 
          isMaintenance: false
        }
      },
      scheduler: [],
    },
    wifi: {
      // Connection mode from HELLO handshake: "AP", "STA", or "UNKNOWN"
      connectionMode: ConnectionMode.UNKNOWN,

      // STA IP address (from WIFI snapshot), null when STA not connected
      staIp: null,

      // List of scanned networks (max 30), no RSSI stored.
      networks: [],

      // Timestamp of last scan list update (Date.now())
      networksUpdatedAt: 0,

      connection: {
        // High-level connection state (wifiStatus.*)
        status: wifiStatus.DISCONNECTED,

        // Network currently connected (summary)
        connectedNetwork: {
          ssid: "",
          signalLevel: wifiSignalLevel.NONE
        },

        // Current operation in progress (wifiOp.*)
        operation: wifiOp.NONE,

        // Silence window duration (ms) suggested by ESP for current operation
        silenceMs: 0,

        // Error from last operation (wifiError.*)
        error: {
          type: wifiError.OK,
          seenByUser: true
        }
      }
    },
    config: {
      params: [],
      paramsStr: [],
      menu: [],
      software: {
        version: "",
        macAddress: "",
      }
    },
    localization: {
      langs: [],
      currentLang: "en",
      currentLangIndex: 1, // Default: ITALIAN (vedi langEnum.h: 0=EN, 1=IT, 2=FR, 3=DE, 4=ES)
    },
    socket: {
      state: SocketState.DISCONNECTED,
    },
    app: {
      loading: false,
      initialized: false,
      error: null,
      selectedMenu: null,  // MenuId correntemente visualizzato in MenuSettingsPage
      auth: {
        locked: false,       // true = app bloccata, utente deve inserire PIN
        pinRequired: false,  // true = param 41 presente (PIN configurato su ESP)
      }
    },
  };

  // Mappa dei subscriber: { "path": [callback1, callback2, ...] }
  const listeners = {};

  // Mappa per tracciare quali path sono stati impostati almeno una volta
  // { "path": true } → path già impostato, false → mai impostato
  const pathInitialized = {};

  /**
   * Normalizza gli argomenti in una stringa path "a.b.c"
   * Supporta: get("a", "b", "c") oppure get("a.b.c")
   */
  function normalizePath(args) {
    if (args.length === 1) {
      if (Array.isArray(args[0])) return args[0].join(".");
      return args[0];
    }
    return Array.from(args).join(".");
  }

  /**
   * Verifica se un path punta a un valore foglia valido
   * @returns { valid: boolean, finalValue: any, error: string }
   */
  function validatePath(path) {
    if (!path || typeof path !== "string") {
      return { valid: false, error: "Path vuoto o non valido" };
    }

    const keys = path.split(".");
    let obj = state;
    let traversedPath = [];

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      traversedPath.push(key);

      if (obj === undefined || obj === null) {
        return {
          valid: false,
          error: `Path non valido: ${traversedPath.join(".")} → valore undefined/null`,
        };
      }

      if (!(key in obj)) {
        return {
          valid: false,
          error: `Path non valido: proprietà "${key}" non esiste in ${traversedPath.slice(0, -1).join(".")}`,
        };
      }

      obj = obj[key];
    }

    // Controlla se è un valore foglia (non un oggetto navigabile)
    // Eccezione: array e oggetti semplici sono considerati valori foglia
    if (typeof obj === "object" && obj !== null && !Array.isArray(obj)) {
      // Verifica se è un oggetto con proprietà (non foglia)
      if (Object.keys(obj).length > 0) {
        return {
          valid: false,
          error: `Path incompleto: ${path} punta a un oggetto con proprietà [${Object.keys(obj).join(", ")}]`,
        };
      }
    }

    return { valid: true, finalValue: obj };
  }

  /**
   * Ottiene il valore di un path nello Store
   * @example get("runtime.outputs.pumpState")
   * @example get("runtime", "outputs", "pumpState")
   */
  function get(...args) {
    const path = normalizePath(args);
    const validation = validatePath(path);

    if (!validation.valid) {
      console.error(`[Store.get] ${validation.error}`);
      throw new Error(`[Store.get] ${validation.error}`);
    }

    return validation.finalValue;
  }

  /**
   * Imposta un valore nello Store e notifica i subscriber
   * Notifica SOLO se il valore cambia effettivamente (diff automatico)
   * @example set("runtime.outputs.pumpState", PumpState.ON)
   * @example set("runtime", "outputs", "pumpState", PumpState.ON)
   */
  function set(...args) {
    const value = args.pop(); // ultimo argomento = valore
    const path = normalizePath(args);

    if (!path) {
      console.error("[Store.set] Path vuoto", args);
      throw new Error("[Store.set] Path vuoto");
    }

    const keys = path.split(".");

    // Naviga fino al penultimo livello
    let obj = state;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in obj)) {
        console.error(`[Store.set] Path non valido: ${path} (errore a "${key}")`);
        throw new Error(`[Store.set] Path non valido: ${path}`);
      }
      obj = obj[key];
    }

    const lastKey = keys[keys.length - 1];

    if (!(lastKey in obj)) {
      console.error(`[Store.set] Path non valido: ${path} (proprietà "${lastKey}" non esiste)`);
      throw new Error(`[Store.set] Path non valido: ${path}`);
    }

    const oldValue = obj[lastKey];
    
    // Verifica se questo path è mai stato impostato prima
    const isFirstSet = !pathInitialized[path];

    // ⚠️ DIFF: notifica SOLO se il valore cambia O se è la prima volta che viene impostato
    // EXCEPTION 1: config.menu SEMPRE notificato (menu può cambiare anche con stessa struttura)
    // EXCEPTION 2: Prima impostazione SEMPRE notificata (per inizializzazione corretta UI)
    if (path !== 'config.menu' && !isFirstSet && oldValue === value) {
      return; // Nessun cambiamento e già inizializzato → non notificare
    }

    // Aggiorna il valore
    obj[lastKey] = value;
    
    // Marca il path come inizializzato
    if (isFirstSet) {
      pathInitialized[path] = true;
    }

    // Notifica i subscriber del path specifico
    if (listeners[path]) {
      listeners[path].forEach((callback, index) => {
        try {
          callback(value, oldValue);
        } catch (err) {
          console.error(`[Store] Errore nel callback per path "${path}":`, err);
        }
      });
    }
  }

  /**
   * Registra un callback per essere notificato quando un path cambia
   * @param {string} path - Path completo al valore (es: "runtime.outputs.pumpState")
   * @param {function} callback - Funzione chiamata con (newValue, oldValue)
   * @param {boolean} immediate - Se true, triggera immediatamente il callback con il valore corrente (default: true)
   * @returns {function} unsubscribe function
   */
  function subscribe(path, callback, immediate = true) {
    if (typeof path !== "string") {
      console.error("[Store.subscribe] Path deve essere una stringa", path);
      throw new Error("[Store.subscribe] Path deve essere una stringa");
    }

    if (typeof callback !== "function") {
      console.error("[Store.subscribe] Callback deve essere una funzione", callback);
      throw new Error("[Store.subscribe] Callback deve essere una funzione");
    }

    // Valida che il path esista
    const validation = validatePath(path);
    if (!validation.valid) {
      console.error(`[Store.subscribe] ${validation.error}`);
      throw new Error(`[Store.subscribe] ${validation.error}`);
    }

    // Crea l'array di listener se non esiste
    if (!listeners[path]) {
      listeners[path] = [];
    }

    // Aggiungi il callback
    listeners[path].push(callback);

    // 🔥 IMMEDIATE TRIGGER: Se richiesto, triggera subito il callback con il valore corrente
    if (immediate && validation.valid) {
      const currentValue = validation.finalValue;
      
      // Triggera il callback in modo asincrono per evitare side-effects durante la subscription
      setTimeout(() => {
        try {
          callback(currentValue, undefined);
        } catch (error) {
          console.error(`[Store.subscribe] Errore in callback immediato per path "${path}":`, error);
        }
      }, 0);
    }

    // Ritorna la funzione di unsubscribe
    return () => {
      const idx = listeners[path].indexOf(callback);
      if (idx >= 0) {
        listeners[path].splice(idx, 1);
      }

      // Cleanup: rimuovi l'array se vuoto
      if (listeners[path].length === 0) {
        delete listeners[path];
      }
    };
  }

  /**
   * Ritorna una copia profonda dello stato (per debug/logging)
   */
  function getState() {
    return JSON.parse(JSON.stringify(state));
  }

  /**
   * Reset dello stato (per test o riconnessione)
   */
  function reset() {
    state.runtime.alerts.isModifing = false;
    state.runtime.alerts.isPumpBlocked = false;
    state.runtime.alerts.isAntibacterial = false;
    state.runtime.alerts.pumpHours = 0;

    state.runtime.sensors = {
      temperature: { value: null, connected: false },
      humidity: { value: null, connected: false },
      pressureSwitch: PressureSwitch.OFF,
    };

    state.runtime.outputs = {
      pumpState: PumpState.OFF,
      extraRelay: false,
      drainValve: false,
    };

    state.runtime.modes = {
      temperature: { isEnabled: false, isActive: false },
      humidity: { isEnabled: false, isActive: false },
      timer: { isEnabled: false, isActive: false },
      calendar: { isEnabled: false, isActive: false },
      aux: { isEnabled: false, isActive: false },
      wireless: { isEnabled: false, isActive: false },
    };

    state.runtime.timers = {
      mode: { on: 0, off: 0 },
      dispenser: { on: 0, off: 0 },
      fan: { on: 0, off: 0 },
    };

    state.wifi = {
      networks: [],
      networksUpdatedAt: 0,
      connection: {
        status: wifiStatus.DISCONNECTED,
        connectedNetwork: {
          ssid: "",
          signalLevel: wifiSignalLevel.NONE
        },
        operation: wifiOp.NONE,
        silenceMs: 0,
        error: {
          type: wifiError.OK,
          seenByUser: true
        }
      }
    };

    state.runtime.scheduler = [];
    state.config.params = [];
    state.config.paramsStr = [];
    state.config.menu = [];
    state.config.software.version = "";
    state.config.software.macAddress = "";
    state.localization.langs = [];
    state.localization.currentLang = "en";
    state.localization.currentLangIndex = 1; // Default: ITALIAN
    state.socket.state = SocketState.DISCONNECTED;
    state.app.loading = false;
    state.app.initialized = false;
    state.app.error = null;
    state.app.selectedMenu = null;
    state.app.auth = { locked: false, pinRequired: false };


        
    // ⚠️ Reset anche la mappa di inizializzazione per forzare re-notifica dopo reset
    Object.keys(pathInitialized).forEach(key => delete pathInitialized[key]);
  }

  /**
   * Metodo di debug per vedere tutti i listener attivi
   */
  function _debugListeners() {
    return Object.keys(listeners).map(path => ({
      path,
      count: listeners[path].length
    }));
  }

  /**
   * Forza il replay di tutti i listener attivi usando i valori correnti dello Store.
   * - Non usa set()
   * - Non modifica lo stato
   * - Non modifica pathInitialized
   * - Usa una fotografia stabile dei listener al momento della chiamata
   */
  function updateAllListeners() {
    const activePaths = Object.keys(listeners).filter(path =>
      Array.isArray(listeners[path]) && listeners[path].length > 0
    );

    const listenersSnapshot = activePaths.map(path => ({
      path,
      callbacks: listeners[path].slice()
    }));

    for (const { path, callbacks } of listenersSnapshot) {
      let currentValue;
      try {
        currentValue = get(path);
      } catch (err) {
        console.error(`[STORE] updateAllListeners() skip path \"${path}\" (get error):`, err);
        continue;
      }

      callbacks.forEach((callback, index) => {
        try {
          callback(currentValue, undefined);
        } catch (err) {
          console.error(`[STORE] updateAllListeners() callback error path=\"${path}\" #${index + 1}/${callbacks.length}:`, err);
        }
      });
    }
  }

  return { get, set, subscribe, getState, reset, _debugListeners, updateAllListeners };
})();

export { Store };