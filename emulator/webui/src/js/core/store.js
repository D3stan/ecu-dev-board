// store.js — ECU reactive state store
import { SocketState } from '../utils/constants.js';

/**
 * Centralized store with Observer pattern and path-based subscription.
 * Notifies only when the value actually changes (automatic diff).
 */
const Store = (() => {
  // Global application state — must match Paths exactly
  let state = {
    telemetry: {
      snapshot: null,
    },
    config: {
      firmwareVersion: '',
      maps: {
        ignition:  [],
        powerJet:  [],
      },
      activeMapId:  null,
      syncPulses:   0,
      egtAlarm:     0,
      menu:         [],
      software: {
        version:    '',
        macAddress:  '',
      },
      params:       [],
      paramsStr:    [],
    },
    localization: {
      currentLangIndex: null,
      langs:            [],
    },
    ota: {
      available:      false,
      remoteVersion:  '',
      currentVersion: '',
    },
    command: {
      lastAck: null,
    },
    socket: {
      state: SocketState.DISCONNECTED,
    },
    app: {
      loading:     false,
      initialized: false,
      error:       null,
      selectedMenu: null,
      auth: {
        locked:      false,
        pinRequired: false,
      },
    },
    runtime: {
      rtc: {
        time: '--:--',
      },
    },
  };

  // Subscriber map: { "path": [callback1, callback2, ...] }
  const listeners = {};

  // Track which paths have been set at least once
  const pathInitialized = {};

  /**
   * Normalize arguments into a "a.b.c" path string.
   * Supports: get("a", "b", "c") or get("a.b.c")
   */
  function normalizePath(args) {
    if (args.length === 1) {
      if (Array.isArray(args[0])) return args[0].join('.');
      return args[0];
    }
    return Array.from(args).join('.');
  }

  /**
   * Validate that a path points to a valid leaf value.
   * @returns {{ valid: boolean, finalValue: any, error: string }}
   */
  function validatePath(path) {
    if (!path || typeof path !== 'string') {
      return { valid: false, error: 'Empty or invalid path' };
    }

    const keys = path.split('.');
    let obj = state;
    const traversedPath = [];

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      traversedPath.push(key);

      if (obj === undefined || obj === null) {
        return {
          valid: false,
          error: `Invalid path: ${traversedPath.join('.')} → undefined/null`,
        };
      }

      if (!(key in obj)) {
        return {
          valid: false,
          error: `Invalid path: property "${key}" does not exist in ${traversedPath.slice(0, -1).join('.')}`,
        };
      }

      obj = obj[key];
    }

    // Check if it's a leaf value (not a navigable object)
    // Exception: arrays and simple objects are considered leaf values
    if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
      if (Object.keys(obj).length > 0) {
        return {
          valid: false,
          error: `Incomplete path: ${path} points to an object with properties [${Object.keys(obj).join(', ')}]`,
        };
      }
    }

    return { valid: true, finalValue: obj };
  }

  /**
   * Get a value from the store by path.
   * @example get("telemetry.snapshot")
   * @example get("config", "firmwareVersion")
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
   * Set a value in the store and notify subscribers.
   * Notifies ONLY when the value actually changes (automatic diff).
   * @example set("telemetry.snapshot", data)
   * @example set("config", "firmwareVersion", "1.2.3")
   */
  function set(...args) {
    const value = args.pop(); // last argument = value
    const path = normalizePath(args);

    if (!path) {
      console.error('[Store.set] Empty path', args);
      throw new Error('[Store.set] Empty path');
    }

    const keys = path.split('.');

    // Navigate to the penultimate level
    let obj = state;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in obj)) {
        console.error(`[Store.set] Invalid path: ${path} (error at "${key}")`);
        throw new Error(`[Store.set] Invalid path: ${path}`);
      }
      obj = obj[key];
    }

    const lastKey = keys[keys.length - 1];

    if (!(lastKey in obj)) {
      console.error(`[Store.set] Invalid path: ${path} (property "${lastKey}" does not exist)`);
      throw new Error(`[Store.set] Invalid path: ${path}`);
    }

    const oldValue = obj[lastKey];

    // Check if this path has ever been set
    const isFirstSet = !pathInitialized[path];

    // DIFF: notify ONLY if the value changes OR if it's the first time being set
    // Telemetry snapshot always notifies (high-frequency, may contain same RPM value)
    if (path !== 'telemetry.snapshot' && !isFirstSet && oldValue === value) {
      return; // No change and already initialized → don't notify
    }

    // Update the value
    obj[lastKey] = value;

    // Mark path as initialized
    if (isFirstSet) {
      pathInitialized[path] = true;
    }

    // Notify subscribers for this specific path
    if (listeners[path]) {
      listeners[path].forEach((callback) => {
        try {
          callback(value, oldValue);
        } catch (err) {
          console.error(`[Store] Callback error for path "${path}":`, err);
        }
      });
    }
  }

  /**
   * Subscribe to path changes.
   * @param {string} path — full path to the value
   * @param {function} callback — called with (newValue, oldValue)
   * @param {boolean} immediate — if true, fires immediately with current value (default: true)
   * @returns {function} unsubscribe function
   */
  function subscribe(path, callback, immediate = true) {
    if (typeof path !== 'string') {
      console.error('[Store.subscribe] Path must be a string', path);
      throw new Error('[Store.subscribe] Path must be a string');
    }

    if (typeof callback !== 'function') {
      console.error('[Store.subscribe] Callback must be a function', callback);
      throw new Error('[Store.subscribe] Callback must be a function');
    }

    // Validate path exists
    const validation = validatePath(path);
    if (!validation.valid) {
      console.error(`[Store.subscribe] ${validation.error}`);
      throw new Error(`[Store.subscribe] ${validation.error}`);
    }

    // Create listener array if needed
    if (!listeners[path]) {
      listeners[path] = [];
    }

    // Add callback
    listeners[path].push(callback);

    // Immediate trigger: fire callback asynchronously with current value
    if (immediate && validation.valid) {
      const currentValue = validation.finalValue;
      setTimeout(() => {
        try {
          callback(currentValue, undefined);
        } catch (error) {
          console.error(`[Store.subscribe] Immediate callback error for path "${path}":`, error);
        }
      }, 0);
    }

    // Return unsubscribe function
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

  /**
   * Returns a deep copy of the state (for debug/logging).
   */
  function getState() {
    return JSON.parse(JSON.stringify(state));
  }

  /**
   * Reset state to initial values (for reconnection).
   */
  function reset() {
    state.telemetry.snapshot = null;

    state.config.firmwareVersion = '';
    state.config.maps.ignition = [];
    state.config.maps.powerJet = [];
    state.config.activeMapId = null;
    state.config.syncPulses = 0;
    state.config.egtAlarm = 0;
    state.config.menu = [];
    state.config.software.version = '';
    state.config.software.macAddress = '';
    state.config.params = [];
    state.config.paramsStr = [];

    state.localization.currentLangIndex = null;
    state.localization.langs = [];

    state.ota.available = false;
    state.ota.remoteVersion = '';
    state.ota.currentVersion = '';

    state.command.lastAck = null;

    state.socket.state = SocketState.DISCONNECTED;

    state.app.loading = false;
    state.app.initialized = false;
    state.app.error = null;
    state.app.selectedMenu = null;
    state.app.auth.locked = false;
    state.app.auth.pinRequired = false;

    state.runtime.rtc.time = '--:--';

    // Reset initialization map to force re-notification after reset
    Object.keys(pathInitialized).forEach(key => delete pathInitialized[key]);
  }

  /**
   * Debug: list all active listeners.
   */
  function _debugListeners() {
    return Object.keys(listeners).map(path => ({
      path,
      count: listeners[path].length,
    }));
  }

  /**
   * Force replay of all active listeners with current store values.
   */
  function updateAllListeners() {
    const activePaths = Object.keys(listeners).filter(path =>
      Array.isArray(listeners[path]) && listeners[path].length > 0
    );

    const listenersSnapshot = activePaths.map(path => ({
      path,
      callbacks: listeners[path].slice(),
    }));

    for (const { path, callbacks } of listenersSnapshot) {
      let currentValue;
      try {
        currentValue = get(path);
      } catch (err) {
        console.error(`[Store] updateAllListeners() skip path "${path}" (get error):`, err);
        continue;
      }

      callbacks.forEach((callback, index) => {
        try {
          callback(currentValue, undefined);
        } catch (err) {
          console.error(`[Store] updateAllListeners() callback error path="${path}" #${index + 1}/${callbacks.length}:`, err);
        }
      });
    }
  }

  return { get, set, subscribe, getState, reset, _debugListeners, updateAllListeners };
})();

export { Store };