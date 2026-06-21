import { SocketState } from "../utils/constants.js";

function createInitialState() {
  return {
    telemetry: {
      rpm: 1200.0,
      tps: 0.0,
      egt: 20.0,
      ecu_advance: 0.0,
      spark_detected: false,
      t_us: 0,
      gen: 0,
      tps_fallback_used: false,
      rpm_accel: 0.0,
      rpm_synchronized: false,
      water_temp: 0.0,
      water_state: "Unknown",
      water_request: "Normal",
      egt_state: "Unknown",
      egt_request: "Normal",
      qs_active: false,
      qs_armed: false,
      map_request: "Primary",
      knock: null,
      meta: {
        tps: null,
        rpm: null,
        egt: null,
        water: null,
        qs: null,
        map: null
      },
      overflow: {
        quick_shift_events: 0,
        map_switch_events: 0,
        knock_measurements: 0,
        fault_events: 0
      },
      transport: {
        sent_frames: 0,
        dropped_frames: 0,
        send_errors: 0
      },
      events: []
    },
    connection: {
      schema_version: 0,
      state_hz: 0,
      events_per_batch: 0,
      device: {
        hwid: "",
        hardware_revision: "",
        chip_model: "",
        flash_size_bytes: 0
      }
    },
    recording: {
      config: {
        auto_enabled: false,
        rpm_threshold: 300,
        start_debounce_ms: 1000,
        stop_debounce_ms: 3000
      }
    },
    digitalTwin: {
      enabled: false,
      server_url: "",
      status: "disabled",
      error: null,
      active_run_id: null,
      ecu_id: null,
      recording_source: null,
      queued_frames: 0,
      last_ack_t_us: null,
      last_ack_batch_seq: null
    },
    overrides: {
      tps: { active: false, value: 0.0 },
      egt: { active: false, value: 20.0 },
      rpm: { active: false, value: 1200.0 },
      egt_fault: { active: false }
    },
    socket: {
      state: SocketState.DISCONNECTED
    }
  };
}

const Store = (() => {
  let state = createInitialState();
  const listeners = {};
  const pathInitialized = {};

  function normalizePath(args) {
    if (args.length === 1) {
      if (Array.isArray(args[0])) return args[0].join(".");
      return args[0];
    }
    return Array.from(args).join(".");
  }

  function validatePath(path) {
    if (!path || typeof path !== "string") {
      return { valid: false, error: "Path vuoto o non valido" };
    }

    const keys = path.split(".");
    let obj = state;
    const traversedPath = [];

    for (const key of keys) {
      traversedPath.push(key);

      if (obj === undefined || obj === null) {
        return {
          valid: false,
          error: `Path non valido: ${traversedPath.join(".")} -> valore undefined/null`,
        };
      }

      if (!(key in obj)) {
        return {
          valid: false,
          error: `Path non valido: proprieta "${key}" non esiste in ${traversedPath.slice(0, -1).join(".")}`,
        };
      }

      obj = obj[key];
    }

    return { valid: true, finalValue: obj };
  }

  function get(...args) {
    const path = normalizePath(args);
    const validation = validatePath(path);

    if (!validation.valid) {
      console.error(`[Store.get] ${validation.error}`);
      throw new Error(`[Store.get] ${validation.error}`);
    }

    return validation.finalValue;
  }

  function set(...args) {
    const value = args.pop();
    const path = normalizePath(args);

    if (!path) {
      console.error("[Store.set] Path vuoto", args);
      throw new Error("[Store.set] Path vuoto");
    }

    const keys = path.split(".");
    let obj = state;

    for (let i = 0; i < keys.length - 1; i += 1) {
      const key = keys[i];
      if (!(key in obj)) {
        console.error(`[Store.set] Path non valido: ${path} (errore a "${key}")`);
        throw new Error(`[Store.set] Path non valido: ${path}`);
      }
      obj = obj[key];
    }

    const lastKey = keys[keys.length - 1];
    if (!(lastKey in obj)) {
      console.error(`[Store.set] Path non valido: ${path} (proprieta "${lastKey}" non esiste)`);
      throw new Error(`[Store.set] Path non valido: ${path}`);
    }

    const oldValue = obj[lastKey];
    const isFirstSet = !pathInitialized[path];

    if (path !== "config.menu" && !isFirstSet && oldValue === value) {
      return;
    }

    obj[lastKey] = value;

    if (isFirstSet) {
      pathInitialized[path] = true;
    }

    if (listeners[path]) {
      listeners[path].forEach((callback) => {
        try {
          callback(value, oldValue);
        } catch (err) {
          console.error(`[Store] Errore nel callback per path "${path}":`, err);
        }
      });
    }
  }

  function subscribe(path, callback, immediate = true) {
    if (typeof path !== "string") {
      console.error("[Store.subscribe] Path deve essere una stringa", path);
      throw new Error("[Store.subscribe] Path deve essere una stringa");
    }

    if (typeof callback !== "function") {
      console.error("[Store.subscribe] Callback deve essere una funzione", callback);
      throw new Error("[Store.subscribe] Callback deve essere una funzione");
    }

    const validation = validatePath(path);
    if (!validation.valid) {
      console.error(`[Store.subscribe] ${validation.error}`);
      throw new Error(`[Store.subscribe] ${validation.error}`);
    }

    if (!listeners[path]) {
      listeners[path] = [];
    }

    listeners[path].push(callback);

    if (immediate) {
      const currentValue = validation.finalValue;
      setTimeout(() => {
        try {
          callback(currentValue, undefined);
        } catch (error) {
          console.error(`[Store.subscribe] Errore in callback immediato per path "${path}":`, error);
        }
      }, 0);
    }

    return () => {
      const idx = listeners[path].indexOf(callback);
      if (idx >= 0) {
        listeners[path].splice(idx, 1);
      }

      if (listeners[path].length === 0) {
        delete listeners[path];
      }
    };
  }

  function getState() {
    return JSON.parse(JSON.stringify(state));
  }

  function reset() {
    state = createInitialState();
    Object.keys(pathInitialized).forEach((key) => delete pathInitialized[key]);
  }

  function _debugListeners() {
    return Object.keys(listeners).map((path) => ({
      path,
      count: listeners[path].length
    }));
  }

  function updateAllListeners() {
    const activePaths = Object.keys(listeners).filter((path) =>
      Array.isArray(listeners[path]) && listeners[path].length > 0
    );

    const listenersSnapshot = activePaths.map((path) => ({
      path,
      callbacks: listeners[path].slice()
    }));

    for (const { path, callbacks } of listenersSnapshot) {
      let currentValue;
      try {
        currentValue = get(path);
      } catch (err) {
        console.error(`[STORE] updateAllListeners() skip path "${path}" (get error):`, err);
        continue;
      }

      callbacks.forEach((callback, index) => {
        try {
          callback(currentValue, undefined);
        } catch (err) {
          console.error(`[STORE] updateAllListeners() callback error path="${path}" #${index + 1}/${callbacks.length}:`, err);
        }
      });
    }
  }

  return { get, set, subscribe, getState, reset, _debugListeners, updateAllListeners };
})();

export { Store };
