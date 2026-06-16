/**
 * func.js
 * =======
 * Funzioni di utilità per il componente LanguageDropdown.
 * 
 * Responsabilità:
 * - Mapping tra indice lingua e dati lingua (label, flag, nome completo)
 * - Generazione lista lingue disponibili
 * - Path delle icone bandiera
 * 
 * NON gestisce:
 * - Interazioni DOM
 * - Store subscriptions
 * - Invio comandi a ESP
 * 
 * @author FogExtra Team
 * @version 1.0.0
 */

import { LangIndex } from '../../utils/i18n.js';

/**
 * Configurazione delle lingue supportate
 * Mappato su LangIndex da i18n.js
 */
const LANGUAGE_CONFIG = {
  [LangIndex.ENGLISH]: {
    code: 'en',
    label: 'ENG',
    fullName: 'English',
    flagIcon: 'icon-lang-en', // Era .png, ora è una chiave AssetManager valida
    enabled: true
  },
  [LangIndex.ITALIAN]: {
    code: 'it',
    label: 'ITA',
    fullName: 'Italiano',
    flagIcon: 'icon-lang-it',
    enabled: true
  },
  [LangIndex.FRENCH]: {
    code: 'fr',
    label: 'FRA',
    fullName: 'Français',
    flagIcon: 'icon-lang-fr', // Eventualmente da aggiungere a catalogo
    enabled: true
  },
  [LangIndex.GERMAN]: {
    code: 'de',
    label: 'DEU',
    fullName: 'Deutsch',
    flagIcon: 'icon-lang-de',
    enabled: false
  },
  [LangIndex.SPANISH]: {
    code: 'es',
    label: 'ESP',
    fullName: 'Español',
    flagIcon: 'icon-lang-es',
    enabled: false
  }
};

/**
 * Path base per le icone delle bandiere
 */
const FLAGS_BASE_PATH = 'assets/img/flags/';

/**
 * Ottiene la lista delle lingue disponibili per l'utente (solo quelle abilitate)
 * @returns {Array<{index: number, code: string, label: string, fullName: string, flagPath: string}>}
 */
export function getAvailableLanguages() {
  return Object.entries(LANGUAGE_CONFIG)
    .filter(([, config]) => config.enabled) // Solo lingue abilitate
    .map(([index, config]) => ({
      index: parseInt(index),
      code: config.code,
      label: config.label,
      fullName: config.fullName,
      flagPath: getFlagPath(parseInt(index))
    }));
}

/**
 * Ottiene l'Asset Key per la bandiera di una lingua (da usare con il nuovo ImageManager)
 * @param {number} langIndex - Indice della lingua (da LangIndex)
 * @returns {string} Chiave Asset. Esempio 'icon-lang-en'
 */
export function getFlagPath(langIndex) {
  const config = LANGUAGE_CONFIG[langIndex];
  if (!config) {
    console.warn(`[LanguageDropdown] Lingua non trovata per index: ${langIndex}`);
    return `icon-lang-en`; // Fallback a inglese
  }
  return config.flagIcon;
}

/**
 * Ottiene la label breve per una lingua (es: "ITA", "ENG")
 * @param {number} langIndex - Indice della lingua (da LangIndex)
 * @returns {string} Label breve
 */
export function getLangLabel(langIndex) {
  const config = LANGUAGE_CONFIG[langIndex];
  if (!config) {
    console.warn(`[LanguageDropdown] Lingua non trovata per index: ${langIndex}`);
    return 'ENG'; // Fallback
  }
  return config.label;
}

/**
 * Ottiene il nome completo per una lingua (es: "Italiano", "English")
 * @param {number} langIndex - Indice della lingua (da LangIndex)
 * @returns {string} Nome completo
 */
export function getLangFullName(langIndex) {
  const config = LANGUAGE_CONFIG[langIndex];
  if (!config) {
    console.warn(`[LanguageDropdown] Lingua non trovata per index: ${langIndex}`);
    return 'English'; // Fallback
  }
  return config.fullName;
}

/**
 * Ottiene il codice lingua ISO (es: "it", "en")
 * @param {number} langIndex - Indice della lingua (da LangIndex)
 * @returns {string} Codice ISO
 */
export function getLangCode(langIndex) {
  const config = LANGUAGE_CONFIG[langIndex];
  if (!config) {
    console.warn(`[LanguageDropdown] Lingua non trovata per index: ${langIndex}`);
    return 'en'; // Fallback
  }
  return config.code;
}

/**
 * Ottiene la configurazione completa di una lingua
 * @param {number} langIndex - Indice della lingua (da LangIndex)
 * @returns {Object|null} Configurazione lingua o null se non trovata
 */
export function getLangConfig(langIndex) {
  const config = LANGUAGE_CONFIG[langIndex];
  if (!config) {
    return null;
  }
  return {
    index: langIndex,
    ...config,
    flagPath: getFlagPath(langIndex)
  };
}

/**
 * Verifica se un indice lingua è valido
 * @param {number} langIndex - Indice da verificare
 * @returns {boolean} True se valido
 */
export function isValidLangIndex(langIndex) {
  return langIndex in LANGUAGE_CONFIG;
}

/**
 * Ottiene l'indice lingua di default
 * @returns {number} Indice della lingua di default (Italiano)
 */
export function getDefaultLangIndex() {
  return LangIndex.ITALIAN;
}
