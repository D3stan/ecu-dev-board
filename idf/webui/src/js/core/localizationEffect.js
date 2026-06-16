/**
 * localizationEffect.js
 * =====================
 * Localization observer — subscribes to Store.CONFIG.PARAMS and keeps
 * Store.LOCALIZATION.LANGS + Store.LOCALIZATION.CURRENT_LANG_INDEX aligned
 * with the language chosen on the device (parameter #24 ChangeLang).
 *
 * This replaces the old parseLang(body) approach that required the ESP to send
 * a ~4–5 KB LANG payload over the WebSocket. The webapp now ships all five
 * language bundles as static ES modules loaded at startup.
 *
 * Store shape produced (identical to old parseLang output):
 *   localization.langs[langIndex] = {
 *     menuName:   string[],             // 11 menu labels
 *     daysLetter: string[],             // 7 single-char day abbreviations
 *     param:      { name, ds }[]        // 41 parameter name/description pairs
 *   }
 *   localization.currentLangIndex = langIndex  (0=EN 1=IT 2=FR 3=DE 4=ES)
 *
 * Usage:
 *   import { initLocalizationEffect, destroyLocalizationEffect } from './localizationEffect.js';
 *   initLocalizationEffect();   // call once, before waitForRuntimeConfig()
 */

import { Store }         from './store.js';
import { Paths }         from '../utils/paths.js';
import { LangIndex }     from '../utils/i18n.js';
import { buildLangData, LANG_NAMES } from '../lang/index.js';
import { log }           from '../utils/logger.js';

// ParamId for the language-selection parameter (mirrors adapter.js constant)
const CHANGE_LANG_PARAM_ID = 24;

// Guard — prevents installing the observer more than once per session
let _unsub = null;

// ─── internal helpers ────────────────────────────────────────────────────────

/**
 * Merge langData for langIndex into the existing LANGS array (length 5)
 * and update CURRENT_LANG_INDEX in one atomic sequence.
 *
 * @param {number} langIndex
 * @param {{ menuName, daysLetter, param }} langData
 */
function _applyToStore(langIndex, langData) {
  // Clone the existing array to avoid mutating the object held by the Store
  const langs = (Store.get(Paths.LOCALIZATION.LANGS) || []).slice();

  // Ensure array has exactly 5 slots
  while (langs.length < 5) langs.push(null);

  langs[langIndex] = langData;

  Store.set(Paths.LOCALIZATION.LANGS, langs);
  Store.set(Paths.LOCALIZATION.CURRENT_LANG_INDEX, langIndex);
}

/**
 * Core handler — called every time Store.CONFIG.PARAMS changes.
 * Extracts CHANGE_LANG_PARAM_ID, builds langData from static modules, writes Store.
 * Idempotent: does nothing if langIndex is already loaded and current.
 *
 * @param {Array} params  current value of Store.CONFIG.PARAMS
 */
function _handleParamsChange(params) {
  if (!Array.isArray(params) || params.length === 0) return;

  const changeLangParam = params.find(p => p.id === CHANGE_LANG_PARAM_ID);
  if (!changeLangParam) return;

  const langIndex = changeLangParam.value;

  // Range guard
  if (langIndex < LangIndex.ENGLISH || langIndex > LangIndex.SPANISH) {
    log.warn(`🌍 [LocalizationEffect] langIndex out of range: ${langIndex}`);
    return;
  }

  // Idempotency check — skip if this lang is already loaded and active
  const currentIndex = Store.get(Paths.LOCALIZATION.CURRENT_LANG_INDEX);
  const langs        = Store.get(Paths.LOCALIZATION.LANGS) || [];
  if (langIndex === currentIndex && langs[langIndex] != null) return;

  // Build data from static module
  const langData = buildLangData(langIndex);
  if (!langData) {
    log.warn(`🌍 [LocalizationEffect] buildLangData(${langIndex}) returned null`);
    return;
  }

  _applyToStore(langIndex, langData);

  log.debug(
    `🌍 Lang changed: idx=${langIndex} (${LANG_NAMES[langIndex]}) — ` +
    `menu=${langData.menuName.length}, params=${langData.param.length}`
  );
}

// ─── public API ──────────────────────────────────────────────────────────────

/**
 * Install the localization observer.
 * Must be called ONCE before waitForRuntimeConfig() so that when the PARAM
 * dump arrives from the ESP the observer fires, populates LANGS, and unblocks
 * the loading gate.
 *
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function initLocalizationEffect() {
  if (_unsub) {
    log.warn('🌍 [LocalizationEffect] already installed — skipping duplicate init');
    return;
  }

  // Store.subscribe(path, cb, immediate=true) — fires immediately with current
  // value.  At init time params is [], so _handleParamsChange returns early.
  // It will fire again when the ESP sends the PARAM dump.
  _unsub = Store.subscribe(Paths.CONFIG.PARAMS, _handleParamsChange);

  log.info('🌍 [LocalizationEffect] installed — observing CONFIG.PARAMS for lang changes');
}

/**
 * Remove the observer (call on page unload or full reset if needed).
 */
export function destroyLocalizationEffect() {
  if (_unsub) {
    _unsub();
    _unsub = null;
    log.debug('🌍 [LocalizationEffect] destroyed');
  }
}
