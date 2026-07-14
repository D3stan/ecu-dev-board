/**
 * authGuard.js
 * =============
 * Authentication guard — subscribes to Store.CONFIG.PARAMS and manages
 * the PIN-based lock state of the application.
 *
 * The PIN is derived from parameter #41 received from the ESP.
 * PIN digit count is dynamic, derived from the parameter's maxValue.
 * Leading zeros are significant: value 33 with maxValue 9999 → PIN "0033".
 *
 * The guard compares the ESP PIN with the value stored in localStorage.
 * If they match, the app is unlocked. Otherwise, it is locked.
 *
 * Pattern: identical to localizationEffect.js (reactive observer on CONFIG.PARAMS).
 *
 * Usage:
 *   import { initAuthGuard, destroyAuthGuard, verifyPin, isLocked } from './authGuard.js';
 *   initAuthGuard();   // call once, before waitForRuntimeConfig()
 *
 * @author FogExtra Team
 * @version 1.0.0
 */

import { Store } from './store.js';
import { Paths } from '../utils/paths.js';
import { PIN_PARAM_ID, LOCALSTORAGE_PIN_KEY } from '../utils/constants.js';
import { log } from '../utils/logger.js';
import { navigateTo, getCurrentPage } from '../managers/navigatorManager.js';

// Guard — prevents installing the observer more than once per session
let _unsub = null;

// Cached PIN digit count (derived from maxValue of param 41)
let _pinDigitCount = 4;

// Cached current ESP PIN string (padded)
let _currentEspPin = null;

// Pagina da cui l'utente è stato interrotto dal lock.
// Viene salvata quando scatta il lock e usata da PinPage per tornare
// alla pagina corretta dopo sblocco, invece di andare sempre a homePage.
let _returnPageAfterUnlock = null;

// ─── internal helpers ────────────────────────────────────────────────────────

/**
 * Compute the number of digits from a parameter's maxValue.
 * Example: maxValue 999 → 3 digits, maxValue 9999 → 4 digits
 *
 * @param {number} maxValue
 * @returns {number} digit count
 */
function _computeDigitCount(maxValue) {
  if (maxValue == null || maxValue <= 0) return 4; // fallback
  return String(maxValue).length;
}

/**
 * Convert a numeric PIN value to a padded string.
 * Example: value=33, digits=4 → "0033"
 *
 * @param {number} value
 * @param {number} digits
 * @returns {string}
 */
function _padPin(value, digits) {
  return String(value).padStart(digits, '0');
}

/**
 * Read the user's saved PIN from localStorage.
 * @returns {string|null}
 */
function _readStoredPin() {
  try {
    return localStorage.getItem(LOCALSTORAGE_PIN_KEY);
  } catch (e) {
    log.warn('🔒 [AuthGuard] Cannot read localStorage:', e);
    return null;
  }
}

/**
 * Save the user's PIN to localStorage.
 * @param {string} pin — padded PIN string
 */
function _saveStoredPin(pin) {
  try {
    localStorage.setItem(LOCALSTORAGE_PIN_KEY, pin);
  } catch (e) {
    log.warn('🔒 [AuthGuard] Cannot write localStorage:', e);
  }
}

/**
 * Update Store auth state. Only writes if value actually changed.
 * If locked changes from false → true, navigate to pinPage immediately.
 * @param {boolean} locked
 * @param {boolean} pinRequired
 */
function _updateAuthState(locked, pinRequired) {
  const currentLocked = Store.get(Paths.APP.AUTH.LOCKED);
  const currentRequired = Store.get(Paths.APP.AUTH.PIN_REQUIRED);

  const lockStateChanged = currentLocked !== locked;

  if (lockStateChanged) {
    Store.set(Paths.APP.AUTH.LOCKED, locked);
    
    // Se l'app è appena diventata locked, naviga a pinPage senza inquinare lo stack.
    // replace=true sostituisce la pagina corrente nello stack invece di fare push,
    // così pinPage non compare mai nel back stack dell'utente.
    if (locked && getCurrentPage() !== 'pinPage') {
      // Salva la pagina corrente come destinazione di ritorno post-sblocco.
      // Non salvare mai pinPage stessa come destinazione.
      const currentPage = getCurrentPage();
      _returnPageAfterUnlock = (currentPage && currentPage !== 'pinPage')
        ? currentPage
        : 'homePage';

      log.info(`🔒 [AuthGuard] App locked! Return page saved: "${_returnPageAfterUnlock}". Redirecting to pinPage...`);

      // replace=true: pinPage sostituisce la pagina corrente nello stack
      navigateTo('pinPage', {}, true);
    }
  }
  if (currentRequired !== pinRequired) {
    Store.set(Paths.APP.AUTH.PIN_REQUIRED, pinRequired);
  }
}

/**
 * Core handler — called every time Store.CONFIG.PARAMS changes.
 * Extracts PIN_PARAM_ID, computes padded PIN, compares with localStorage.
 *
 * @param {Array} params  current value of Store.CONFIG.PARAMS
 */
function _handleParamsChange(params) {
  if (!Array.isArray(params) || params.length === 0) return;

  const pinParam = params.find(p => p.id === PIN_PARAM_ID);

  if (!pinParam) {
    // Parameter 41 not present in the dump — PIN always active per spec,
    // but if the param doesn't exist at all, we can't enforce a PIN.
    // Keep current state (don't unlock if was locked).
    log.debug('🔒 [AuthGuard] Param 41 not found in params array');
    return;
  }

  // Compute digit count from maxValue
  const digitCount = _computeDigitCount(pinParam.max);
  _pinDigitCount = digitCount;

  // Compute padded PIN from ESP value
  const espPin = _padPin(pinParam.value, digitCount);
  _currentEspPin = espPin;

  // PIN is always required (per spec: 0 does NOT mean disabled)
  const pinRequired = true;

  // Read user's stored PIN from localStorage
  const storedPin = _readStoredPin();

  // Compare
  const locked = storedPin !== espPin;

  _updateAuthState(locked, pinRequired);

  log.debug(
    `🔒 [AuthGuard] PIN check: espPin="${espPin}" (${digitCount} digits), ` +
    `storedPin="${storedPin}", locked=${locked}`
  );
}

// ─── public API ──────────────────────────────────────────────────────────────

/**
 * Install the auth guard observer.
 * Must be called ONCE before waitForRuntimeConfig() so that when the PARAM
 * dump arrives from the ESP the observer fires, evaluates the PIN, and
 * sets the lock state.
 *
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function initAuthGuard() {
  if (_unsub) {
    log.warn('🔒 [AuthGuard] already installed — skipping duplicate init');
    return;
  }

  _unsub = Store.subscribe(Paths.CONFIG.PARAMS, _handleParamsChange);
  log.info('🔒 [AuthGuard] installed — observing CONFIG.PARAMS for PIN changes');
}

/**
 * Remove the observer (call on page unload or full reset if needed).
 */
export function destroyAuthGuard() {
  if (_unsub) {
    _unsub();
    _unsub = null;
    _currentEspPin = null;
    log.debug('🔒 [AuthGuard] destroyed');
  }
}

/**
 * Verify a PIN entered by the user.
 * If correct: saves to localStorage, sets locked=false in Store.
 * If incorrect: returns false.
 *
 * @param {string} userPin — PIN string entered by the user (e.g. "0033")
 * @returns {boolean} true if PIN is correct
 */
export function verifyPin(userPin) {
  if (!_currentEspPin) {
    log.warn('🔒 [AuthGuard] verifyPin called but no ESP PIN available');
    return false;
  }

  // Pad user input to match expected digit count
  const paddedUserPin = String(userPin).padStart(_pinDigitCount, '0');

  if (paddedUserPin === _currentEspPin) {
    // PIN correct — save to localStorage and unlock
    _saveStoredPin(paddedUserPin);
    _updateAuthState(false, true);
    log.info('🔓 [AuthGuard] PIN verified — app unlocked');
    return true;
  }

  log.info(`🔒 [AuthGuard] PIN incorrect: entered="${paddedUserPin}", expected="${_currentEspPin}"`);
  return false;
}

/**
 * Read the current lock state from the Store.
 * Utility for quick checks without subscription.
 *
 * @returns {boolean} true if app is locked
 */
export function isLocked() {
  try {
    return Store.get(Paths.APP.AUTH.LOCKED);
  } catch {
    return false;
  }
}

/**
 * Get the expected PIN digit count (derived from param 41 maxValue).
 * Used by PinPage to render the correct number of indicators.
 *
 * @returns {number} digit count (default 4)
 */
export function getPinDigitCount() {
  return _pinDigitCount;
}

/**
 * Ritorna la pagina da cui l'utente è stato interrotto dal lock.
 * Usata da PinPage per tornare alla pagina corretta dopo sblocco.
 * Se non disponibile (es. primo avvio con PIN sbagliato), ritorna 'homePage'.
 *
 * @returns {string} pageId della pagina di ritorno
 */
export function getReturnPageAfterUnlock() {
  return _returnPageAfterUnlock || 'homePage';
}
