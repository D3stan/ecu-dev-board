// menuMapping.js — ECU Menu configuration
import { Store } from '../core/store.js';
import { Paths } from './paths.js';

/**
 * Enum of menu types for the ECU
 */
export const MenuType = {
  DASHBOARD: 0,
  MAPS: 1,
  SETTINGS: 2,
};

/**
 * Hardcoded configuration for each menu item
 */
export const MENU_CONFIG = {
  [MenuType.DASHBOARD]: {
    assetKey: 'icon-timer',
    route: 'dashboardPage',
    iconType: 'img',
    onClickItem: null
  },
  [MenuType.MAPS]: {
    assetKey: 'icon-thermo',
    route: 'mapsPage',
    iconType: 'img',
    onClickItem: null
  },
  [MenuType.SETTINGS]: {
    assetKey: 'icon-setting',
    route: 'settingsPage',
    iconType: 'img',
    onClickItem: null,
    isSystemMenu: true
  }
};

/**
 * Get menu config by ID
 * @param {number} menuId
 * @returns {object|null}
 */
export function getMenuConfig(menuId) {
  return MENU_CONFIG[menuId] || null;
}

/**
 * Check if a menuId is valid
 * @param {number} menuId
 * @returns {boolean}
 */
export function isValidMenuId(menuId) {
  return menuId in MENU_CONFIG;
}

