// menuMapping.js
import { Store } from '../core/store.js';
import { Paths } from './paths.js';



/**
 * Enum dei tipi di menu (corrispondente a MenuElementType in ESP)
 * L'ordine DEVE corrispondere esattamente all'ordine in menuName[] ricevuto da ESP
 */
export const MenuType = {
  TEMPERATURE: 0,    // temperature - Controllo temperatura
  HUMIDITY: 1,       // humidity - Controllo umidità
  TIMER: 2,          // timer - Timer programmabile
  CALENDAR: 3,       // calendar - Calendario/schedulazione
  CLOCK: 4,          // clock - Impostazioni orologio
  CONSTANT: 5,       // constant - Parametri costanti/settings
  MODE_ENABLE: 6,    // modeEnable - Attivazione modalità
  WIFI: 7,           // wifi - Impostazioni Wi-Fi (local menu, not from ESP)
  FAN: 8,            // fan - Controllo ventola
  DISPENSER: 9,       // dispenser - Dosatore
  ANTIBACTERIAL: 10, // Antibatterico
  MODBUS: 11,        // Modbus

};

/**
 * Configurazione hardcoded per ogni tipo di menu
 * - icon: percorso icona (relativo a /data/app/index.html)
 * - route: route della pagina (corrispondente ai PageId)
 * - iconType: 'img' | 'svg'
 * - onClickItem: callback eseguita al click (opzionale)
 * - isSystemMenu: true se appartiene alla sezione SYSTEM (opzionale)
 */
export const MENU_CONFIG = {
  [MenuType.TEMPERATURE]: {
    assetKey: 'icon-thermo',
    route: 'menuSettingsPage',
    iconType: 'img',
    onClickItem: (menuId) => {
      Store.set(Paths.APP.SELECTED_MENU, menuId);
    }
  },
  [MenuType.HUMIDITY]: {
    assetKey: 'icon-humidity',
    route: 'menuSettingsPage',
    iconType: 'img',
    onClickItem: (menuId) => {
      Store.set(Paths.APP.SELECTED_MENU, menuId);
    }
  },
  [MenuType.TIMER]: {
    assetKey: 'icon-timer',
    route: 'menuSettingsPage',
    iconType: 'img',
    onClickItem: (menuId) => {
      Store.set(Paths.APP.SELECTED_MENU, menuId);
    }
  },
  [MenuType.CALENDAR]: {
    assetKey: 'icon-calendar',
    route: 'timeSlotsPage',
    iconType: 'img',
    onClickItem: null
  },
  [MenuType.WIFI]: {
    assetKey: 'icon-wifi-free',
    route: 'wifiPage',
    iconType: 'img',
    onClickItem: null,
    isSystemMenu: true  // Sezione SYSTEM
  },
  [MenuType.CONSTANT]: {
    assetKey: 'icon-setting',
    route: 'menuSettingsPage',
    iconType: 'img',
    onClickItem: (menuId) => {
      Store.set(Paths.APP.SELECTED_MENU, menuId);
    }
  },
  [MenuType.FAN]: {
    assetKey: 'icon-fan',
    route: 'menuSettingsPage',
    iconType: 'img',
    onClickItem: (menuId) => {
      Store.set(Paths.APP.SELECTED_MENU, menuId);
    }
  },
  [MenuType.DISPENSER]: {
    assetKey: 'icon-dispenser',
    route: 'menuSettingsPage',
    iconType: 'img',
    onClickItem: (menuId) => {
      Store.set(Paths.APP.SELECTED_MENU, menuId);
    }
  },
  [MenuType.ANTIBACTERIAL]: {
    assetKey: 'icon-antibacterial',
    route: 'menuSettingsPage',
    iconType: 'img',
    onClickItem: (menuId) => {
      Store.set(Paths.APP.SELECTED_MENU, menuId);
    }
  },
  [MenuType.MODBUS]: {
    assetKey: 'icon-modbus',
    route: 'menuSettingsPage',
    iconType: 'img',
    onClickItem: (menuId) => {
      Store.set(Paths.APP.SELECTED_MENU, menuId);
    }
  }
};

/**
 * Ottiene la configurazione di un menu dato il suo ID
 * @param {number} menuId - ID del menu (MenuType)
 * @returns {object|null} Configurazione del menu o null se non trovato
 */
export function getMenuConfig(menuId) {
  return MENU_CONFIG[menuId] || null;
}

/**
 * Verifica se un menuId è valido
 * @param {number} menuId - ID del menu
 * @returns {boolean}
 */
export function isValidMenuId(menuId) {
  return menuId in MENU_CONFIG;
}
