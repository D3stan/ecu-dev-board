/**
 * sidebarManager.js
 * 
 * Manager per gestione della sidebar di navigazione.
 * 
 * Responsabilità:
 * - Coordinamento del componente Sidebar
 * - Gestione menu items registry
 * - Integrazione con NavigatorManager
 * - API pubbliche per apertura/chiusura
 * 
 * @version 2.0.0 - Refactored per usare Sidebar component
 */

import { log } from '../utils/logger.js';
import { Sidebar } from '../components/Sidebar/Sidebar.js';

// ============================================
// STATE
// ============================================

const state = {
  sidebar: null,              // Istanza Sidebar component
  activeItemId: null,         // Item correntemente attivo
  navigatorManager: null,     // Riferimento a NavigatorManager
  initialized: false,
};

// ============================================
// PRIVATE HELPERS
// ============================================

/**
 * Callback per click su menu item
 * @private
 */
function handleItemClick({ menuId, route }) {
  log.debug(`[SidebarManager] Menu clicked: ${menuId} → ${route}`);
  
  // Naviga alla route (se presente)
  if (route && state.navigatorManager) {
    state.navigatorManager.navigateTo(route);
  }
  
  // Aggiorna active state
  setActiveItem(menuId);
  
  // Chiudi sidebar
  close();
}

/**
 * Callback per chiusura sidebar
 * @private
 */
function handleClose() {
  log.debug('[SidebarManager] Sidebar closed');
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Apre la sidebar
 */
export function open() {
  if (!state.sidebar) {
    log.warn('[SidebarManager] Sidebar component not initialized');
    return;
  }
  
  state.sidebar.open();
  log.info('📂 Sidebar opened');
}

/**
 * Chiude la sidebar
 */
export function close() {
  if (!state.sidebar) {
    log.warn('[SidebarManager] Sidebar component not initialized');
    return;
  }
  
  state.sidebar.close();
  log.info('📁 Sidebar closed');
}

/**
 * Toggle sidebar (apre/chiude)
 */
export function toggle() {
  if (!state.sidebar) {
    log.warn('[SidebarManager] Sidebar component not initialized');
    return;
  }
  
  state.sidebar.toggle();
}

/**
 * Imposta l'item attivo nella sidebar
 * @param {number} menuId - ID del menu da attivare (MenuType)
 */
export function setActiveItem(menuId) {
  state.activeItemId = menuId;
  
  if (state.sidebar) {
    state.sidebar.setActiveItem(menuId);
  }
  
  log.debug(`✨ Sidebar active menu: "${menuId}"`);
}

/**
 * Verifica se la sidebar è aperta
 * @returns {boolean}
 */
export function isOpen() {
  return state.sidebar ? state.sidebar.isOpen() : false;
}

/**
 * Ottiene l'item attivo corrente
 * @returns {number|null}
 */
export function getActiveItem() {
  return state.activeItemId;
}

/**
 * Inizializza il SidebarManager
 */
export function init() {
  if (state.initialized) {
    log.warn('[SidebarManager] already initialized — skipping duplicate init');
    return;
  }

  log.info('📂 SidebarManager initializing...');
  
  // Crea il componente Sidebar
  state.sidebar = new Sidebar({
    activeItemId: state.activeItemId,
    onItemClick: handleItemClick,
    onClose: handleClose
  });
  
  // Mount nel DOM (cerca container esistente o crea placeholder)
  let container = document.getElementById('sidebar-container');
  
  if (!container) {
    // Crea container temporaneo se non esiste
    container = document.createElement('div');
    container.id = 'sidebar-container';
    document.body.appendChild(container);
    log.debug('[SidebarManager] Created sidebar-container');
  }
  
  // Mount, bind, activate
  state.sidebar.mount(container);
  state.sidebar.bindEvents();
  state.sidebar.activate();
  
  // Nota: Menu items vengono caricati dinamicamente da Store
  // Non serve più registerDefaultMenuItems()
  
  log.info('✅ SidebarManager initialized');
  state.initialized = true;
}

/**
 * Setup integrazione con NavigatorManager (chiamare dopo init dei manager)
 * @param {object} navigatorManager - Istanza NavigatorManager
 */
export function setupNavigation(navigatorManager) {
  if (!navigatorManager) {
    log.warn('[SidebarManager] NavigatorManager not provided, navigation disabled');
    return;
  }
  
  state.navigatorManager = navigatorManager;
  log.debug('🔗 Sidebar navigation linked to NavigatorManager');
}

/**
 * Ottiene lo stato interno (per debug)
 */
export function _debug() {
  return {
    isOpen: isOpen(),
    activeItemId: state.activeItemId,
    sidebarPhase: state.sidebar ? state.sidebar.phase : 'not-created'
  };
}

// Export default per import singolo
export const SidebarManager = {
  init,
  open,
  close,
  toggle,
  setActiveItem,
  isOpen,
  getActiveItem,
  setupNavigation,
  _debug,
};
