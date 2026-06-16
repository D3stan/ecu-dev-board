// iconMapping.js
/**
 * Mapping tra MenuTypeParam (enum) e asset key
 * Corrispondente a MenuTypes enum in Parameter.h
 */

import { MenuTypeParam } from './constants.js';

/**
 * Map

pa MenuTypeParam → icon path
 */
export const MenuTypeIcon = {
  [MenuTypeParam.TIME]: 'icon-timer',
  [MenuTypeParam.DATE]: 'icon-calendar',
  [MenuTypeParam.TEMPERATURE]: 'icon-thermo',
  [MenuTypeParam.HUMIDITY]: 'icon-humidity',
  [MenuTypeParam.RTC]: 'icon-timer',
  [MenuTypeParam.WIFI]: 'icon-wifi-free',
  [MenuTypeParam.OTHER]: 'icon-setting'  // settings icon
};

/**
 * Ottiene l'asset key dell'icona dato un MenuTypeParam
 * @param {number} menuType - Valore enum MenuTypeParam
 * @returns {string} Asset key dell'icona
 */
export function getMenuTypeIcon(menuType) {
  return MenuTypeIcon[menuType] || MenuTypeIcon[MenuTypeParam.OTHER];
}
