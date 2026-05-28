/**
 * logger.js
 * =========
 * Centralized logging utility for production-safe logging.
 *
 * Policy:
 * - low-level log/info/debug channels are always suppressed
 * - only `warn/error` can be emitted
 * - a single global flag enables/disables all emitted logs
 */

// ============================================
// CONFIGURATION
// ============================================

let enableLogs = false;
const c = globalThis.console;

const originalConsole = {
  log: c['log'].bind(c),
  info: c['info'].bind(c),
  debug: c['debug'] ? c['debug'].bind(c) : c['log'].bind(c),
  warn: c['warn'].bind(c),
  error: c['error'].bind(c)
};

const NOOP = () => {};

function applyConsolePolicy() {
  // Produzione: niente log di debug/info
  c['log'] = NOOP;
  c['info'] = NOOP;
  c['debug'] = NOOP;

  // Warn/error controllati da un unico flag globale
  c['warn'] = (...args) => {
    if (enableLogs) {
      originalConsole.warn(...args);
    }
  };

  c['error'] = (...args) => {
    if (enableLogs) {
      originalConsole.error(...args);
    }
  };
}

// ============================================
// INTERNAL HELPERS
// ============================================

/**
 * Get timestamp for log messages
 * @private
 */
function getTimestamp() {
  const now = new Date();
  return now.toLocaleTimeString('it-IT', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    fractionalSecondDigits: 3
  });
}

/**
 * Format log message with timestamp and level
 * @private
 */
function formatMessage(level, message) {
  const timestamp = getTimestamp();
  const levelPrefix = `[${level.toUpperCase()}]`;
  return `${timestamp} ${levelPrefix} ${message}`;
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Log debug message (only if debug mode is enabled)
 * @param {string} message - Message to log
 * @param {...any} args - Additional arguments to log
 */
export function debug(message, ...args) {
  return;
}

/**
 * Log info message (only if debug mode is enabled)
 * @param {string} message - Message to log
 * @param {...any} args - Additional arguments to log
 */
export function info(message, ...args) {
  return;
}

/**
 * Log warning message (only if debug mode is enabled)
 * @param {string} message - Message to log
 * @param {...any} args - Additional arguments to log
 */
export function warn(message, ...args) {
  if (enableLogs) {
    originalConsole.warn(formatMessage('warn', message), ...args);
  }
}

/**
 * Log error message (ALWAYS logged, regardless of debug mode)
 * @param {string} message - Message to log
 * @param {...any} args - Additional arguments to log
 */
export function error(message, ...args) {
  if (enableLogs) {
    originalConsole.error(formatMessage('error', message), ...args);
  }
}

/**
 * Set debug mode (enable/disable debug logs)
 * @param {boolean} enabled - True to enable debug logs, false to disable
 */
export function setDebugMode(enabled) {
  enableLogs = Boolean(enabled);
  applyConsolePolicy();
}

export function setLogEnabled(enabled) {
  setDebugMode(enabled);
}

/**
 * Get current debug mode status
 * @returns {boolean} True if debug mode is enabled
 */
export function isDebugEnabled() {
  return enableLogs;
}

// Applica subito la policy globale (default: logging disabilitato)
applyConsolePolicy();

// ============================================
// EXPORT DEFAULT LOGGER OBJECT
// ============================================

export const log = {
  debug,
  info,
  warn,
  error,
  setDebugMode,
  setLogEnabled,
  isDebugEnabled
};
