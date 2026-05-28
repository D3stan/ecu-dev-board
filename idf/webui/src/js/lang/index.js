/**
 * index.js — Language loader
 *
 * Maps LangIndex (0=EN, 1=IT, 2=FR, 3=DE, 4=ES) to the corresponding static
 * language module and builds the exact Store shape that parseLang() used to produce:
 *
 *   { menuName: string[], daysLetter: string[], param: { name, ds }[] }
 *
 * No network fetch. No async import races. Pure synchronous static imports.
 */

import en from './en.js';
import it from './it.js';
import fr from './fr.js';
import de from './de.js';
import es from './es.js';

/** Ordered by LangIndex: 0=EN 1=IT 2=FR 3=DE 4=ES */
const LANG_MODULES = [en, it, fr, de, es];

/** Human-readable names for debug logs */
export const LANG_NAMES = ['EN', 'IT', 'FR', 'DE', 'ES'];

/**
 * Strip leading/trailing whitespace and remove a trailing dot, matching the
 * behaviour of adapter.js clean() that was applied when parsing the LANG payload.
 * @param {string|undefined} str
 * @returns {string}
 */
function clean(str) {
  return str?.trim().replace(/\.$/, '') || '';
}

/**
 * Build the Store-compatible language data object for a given language index.
 * Returned shape is identical to what parseLang() used to write into the Store:
 *   { menuName: string[], daysLetter: string[], param: { name: string, ds: string }[] }
 *
 * @param {number} langIndex  0=EN  1=IT  2=FR  3=DE  4=ES
 * @returns {{ menuName: string[], daysLetter: string[], param: { name: string, ds: string }[] } | null}
 */
export function buildLangData(langIndex) {
  const mod = LANG_MODULES[langIndex];
  if (!mod) return null;

  return {
    menuName:   mod.menuName,
    daysLetter: mod.daysLetter,
    param:      mod.param.map(p => ({
      name: clean(p.name),
      ds:   clean(p.ds)
    }))
  };
}
