/**
 * navigatorManager.js
 * 
 * Manager per la navigazione SPA (Single Page Application).
 * Gestisce lo stack delle pagine, animazioni di transizione e history management.
 * 
 * Funzionalità:
 * - Navigazione tra pagine con animazioni slide
 * - Stack navigation (max 2-3 livelli)
 * - History management (browser back button)
 * - Passaggio dati tra pagine
 * - Lifecycle hooks (onActivate, onDeactivate)
 */

import { Store } from '../core/store.js';
import { Paths } from '../utils/paths.js';

// ============================================
// STATE
// ============================================

const state = {
  pages: new Map(),           // Map<pageId, pageInstance>
  navigationStack: [],        // Array di pageId
  currentPageId: null,        // pageId corrente
  maxStackDepth: 3,          // Massimo livello stack (home + 2)
  isNavigating: false,       // Flag per prevenire navigazioni multiple
  initialized: false,
  popstateHandler: null,
};

// ============================================
// PRIVATE HELPERS
// ============================================

/**
 * Ottiene l'elemento DOM di una pagina
 */
function getPageElement(pageId) {
  return document.getElementById(pageId);
}

/**
 * Applica l'animazione di ingresso/uscita alle pagine
 * 
 * LOGICA (copiata da index.html):
 * - Pagina ATTIVA: .active → left: 0 (visibile)
 * - Pagina NASCOSTA: .left → left: -120% (fuori a sinistra)
 * - Pagina NASCOSTA: .right → left: 120% (fuori a destra) [non usata al momento]
 * 
 * FORWARD (es: Home → Settings):
 *   - fromPage (Home): .active → .left (scorre a sinistra e scompare)
 *   - toPage (Settings): .left → .active (entra da destra)
 * 
 * BACKWARD (es: Settings → Home):
 *   - fromPage (Settings): .active → .left (scorre a sinistra e scompare)
 *   - toPage (Home): .left → .active (entra da destra)
 */
function applyPageTransition(fromPageId, toPageId, direction = 'forward') {
  const fromPage = fromPageId ? getPageElement(fromPageId) : null;
  const toPage = getPageElement(toPageId);
  
  if (!toPage) {
    console.error(`❌ Pagina "${toPageId}" non trovata nel DOM`);
    return;
  }
  
  // IMPORTANTE: Per l'effetto sliding, TUTTE le pagine escono verso sinistra
  // e TUTTE entrano da destra (rimuovendo .left e aggiungendo .active)
  
  // 1. La pagina corrente (se esiste) esce verso sinistra
  if (fromPage) {
    fromPage.classList.remove('active', 'right');
    fromPage.classList.add('left');
  }
  
  // 2. La nuova pagina entra (rimuovi .left/.right, aggiungi .active)
  toPage.classList.remove('left', 'right');
  toPage.classList.add('active');
}

/**
 * Chiama il lifecycle hook onActivate di una pagina
 */
function activatePage(pageId, data = {}) {
  const pageInstance = state.pages.get(pageId);
  
  if (pageInstance && typeof pageInstance.activate === 'function') {
    try {
      pageInstance.activate(data);
    } catch (error) {
      console.error(`❌ Errore in ${pageId}.activate():`, error);
    }
  }
}

/**
 * Chiama il lifecycle hook onDeactivate di una pagina
 */
function deactivatePage(pageId) {
  const pageInstance = state.pages.get(pageId);
  
  if (pageInstance && typeof pageInstance.deactivate === 'function') {
    try {
      pageInstance.deactivate();
    } catch (error) {
      console.error(`❌ Errore in ${pageId}.deactivate():`, error);
    }
  }
}

/**
 * Pulisce lo stack se supera la profondità massima
 * IMPORTANTE: La home page (primo elemento) non viene mai rimossa
 */
function cleanupStack() {
  if (state.navigationStack.length > state.maxStackDepth) {
    // Rimuovi il secondo elemento (mantieni sempre home come primo)
    state.navigationStack.splice(1, 1);
  }
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Registra una pagina nel navigator
 * @param {string} pageId - ID della pagina (deve corrispondere all'ID DOM)
 * @param {object} pageInstance - Istanza della pagina con lifecycle hooks (opzionale)
 */
export function registerPage(pageId, pageInstance = null) {
  if (!pageId) {
    console.error('❌ NavigatorManager.registerPage: pageId è obbligatorio');
    return;
  }
  
  // Verifica che la pagina esista nel DOM
  const pageElement = getPageElement(pageId);
  if (!pageElement) {
    console.warn(`⚠️ Pagina "${pageId}" non trovata nel DOM, registrata comunque`);
  }
  
  state.pages.set(pageId, pageInstance);
  
  // Se è la prima pagina e non c'è current, impostala come corrente
  // IMPORTANTE: Controlla anche che non sia già nello stack
  if (!state.currentPageId && pageElement && pageElement.classList.contains('active') && !state.navigationStack.includes(pageId)) {
    state.currentPageId = pageId;
    state.navigationStack.push(pageId);
  }
}

/**
 * Naviga verso una pagina
 * @param {string} pageId - ID della pagina di destinazione
 * @param {object} data - Dati da passare alla pagina (opzionale)
 * @param {boolean} replace - Se true, sostituisce la pagina corrente nello stack invece di aggiungerla
 */
export function navigateTo(pageId, data = {}, replace = false) {
  // PIN GUARD: if app is locked, only allow navigation to pinPage
  if (pageId !== 'pinPage') {
    try {
      const isLocked = Store.get(Paths.APP.AUTH.LOCKED);
      if (isLocked) {
        console.warn(`\uD83D\uDD12 [NavigatorManager] Navigation to "${pageId}" blocked \u2014 PIN required`);
        // replace=true: pinPage sostituisce la pagina corrente nello stack,
        // non viene aggiunta come pagina storica.
        if (state.currentPageId !== 'pinPage') {
          navigateTo('pinPage', {}, true);
        }
        return;
      }
    } catch (e) {
      // Store not yet initialized \u2014 allow navigation
    }
  }

  if (state.isNavigating) {
    console.warn('⚠️ Navigazione già in corso, richiesta ignorata');
    return;
  }
  
  if (!pageId) {
    console.error('❌ NavigatorManager.navigateTo: pageId è obbligatorio');
    return;
  }
  
  const pageElement = getPageElement(pageId);
  if (!pageElement) {
    console.error(`❌ Pagina "${pageId}" non trovata nel DOM`);
    return;
  }
  
  // Se è già la pagina corrente, non fare nulla
  if (state.currentPageId === pageId) {
    return;
  }
  
  state.isNavigating = true;
  
  const fromPageId = state.currentPageId;
  
  // Deactivate pagina corrente
  if (fromPageId) {
    deactivatePage(fromPageId);
  }
  
  // Applica transizione
  applyPageTransition(fromPageId, pageId, 'forward');
  
  // Aggiorna stack
  if (replace && state.navigationStack.length > 0) {
    state.navigationStack[state.navigationStack.length - 1] = pageId;
  } else {
    state.navigationStack.push(pageId);
    cleanupStack();
  }
  
  // Aggiorna stato
  state.currentPageId = pageId;
  
  // Activate nuova pagina
  activatePage(pageId, data);
  
  // Aggiorna browser history (opzionale)
  if (window.history) {
    window.history.pushState({ pageId }, '', `#${pageId}`);
  }
  
  // Reset flag dopo animazione
  setTimeout(() => {
    state.isNavigating = false;
  }, 300); // Durata animazione CSS (--transition-base: 250ms + buffer)
}

/**
 * Torna alla pagina precedente nello stack
 */
export function goBack() {
  // PIN GUARD: block goBack when locked
  try {
    const isLocked = Store.get(Paths.APP.AUTH.LOCKED);
    if (isLocked) {
      console.warn('\uD83D\uDD12 [NavigatorManager] goBack() blocked \u2014 PIN required');
      return;
    }
  } catch (e) { /* Store not ready */ }

  if (state.isNavigating) {
    console.warn('⚠️ Navigazione già in corso, richiesta ignorata');
    return;
  }
  
  if (state.navigationStack.length <= 1) {
    return;
  }
  
  state.isNavigating = true;
  
  // Rimuovi pagina corrente dallo stack
  const fromPageId = state.navigationStack.pop();
  const toPageId = state.navigationStack[state.navigationStack.length - 1];
  
  // Deactivate pagina corrente
  deactivatePage(fromPageId);
  
  // Applica transizione indietro
  applyPageTransition(fromPageId, toPageId, 'backward');
  
  // Aggiorna stato
  state.currentPageId = toPageId;
  
  // Activate pagina precedente
  activatePage(toPageId, {});
  
  // Aggiorna browser history
  if (window.history) {
    window.history.back();
  }
  
  // Reset flag dopo animazione
  setTimeout(() => {
    state.isNavigating = false;
  }, 300);
}

/**
 * Torna alla home page e pulisce lo stack
 */
export function goHome() {
  // PIN GUARD: block goHome when locked
  try {
    const isLocked = Store.get(Paths.APP.AUTH.LOCKED);
    if (isLocked) {
      console.warn('\uD83D\uDD12 [NavigatorManager] goHome() blocked \u2014 PIN required');
      return;
    }
  } catch (e) { /* Store not ready */ }

  if (state.navigationStack.length === 0) {
    console.warn('⚠️ Nessuna pagina home definita');
    return;
  }
  
  if (state.isNavigating) {
    console.warn('⚠️ Navigazione già in corso, richiesta ignorata');
    return;
  }
  
  // La home page è sempre la prima nello stack
  const homePageId = state.navigationStack[0];
  
  if (!homePageId) {
    console.error('❌ Home page non trovata nello stack');
    return;
  }
  
  // Se siamo già sulla home, non fare nulla
  if (state.currentPageId === homePageId) {
    // Ma assicurati che lo stack abbia solo home
    if (state.navigationStack.length > 1) {
      state.navigationStack = [homePageId];
    }
    return;
  }
  
  state.isNavigating = true;
  
  const fromPageId = state.currentPageId;
  
  // Deactivate pagina corrente
  if (fromPageId) {
    deactivatePage(fromPageId);
  }
  
  // Applica transizione
  applyPageTransition(fromPageId, homePageId, 'backward');
  
  // Pulisci stack (solo home rimane)
  state.navigationStack = [homePageId];
  
  // Aggiorna stato
  state.currentPageId = homePageId;
  
  // Activate home page
  activatePage(homePageId, {});
  
  // Reset flag dopo animazione
  setTimeout(() => {
    state.isNavigating = false;
  }, 300);
}

/**
 * Ottiene la pagina corrente
 * @returns {string|null} pageId corrente
 */
export function getCurrentPage() {
  return state.currentPageId;
}

/**
 * Ottiene lo stack di navigazione corrente
 * @returns {Array<string>} Array di pageId
 */
export function getNavigationStack() {
  return [...state.navigationStack];
}

/**
 * Imposta la profondità massima dello stack
 * @param {number} depth - Profondità massima (default: 3)
 */
export function setMaxStackDepth(depth) {
  if (typeof depth !== 'number' || depth < 1) {
    console.warn('⚠️ setMaxStackDepth: depth deve essere un numero >= 1');
    return;
  }
  
  state.maxStackDepth = depth;
}

/**
 * Inizializza il NavigatorManager
 */
export function init() {
  if (state.initialized) {
    return;
  }
  
  // Setup browser back button handler
  state.popstateHandler = (event) => {
    // PIN GUARD: block browser back when locked
    try {
      const isLocked = Store.get(Paths.APP.AUTH.LOCKED);
      if (isLocked) {
        window.history.pushState({ pageId: 'pinPage' }, '', '#pinPage');
        return;
      }
    } catch (e) { /* Store not ready */ }

    if (event.state && event.state.pageId) {
      // TODO: Gestire back button del browser
    }
  };

  window.addEventListener('popstate', state.popstateHandler);
  
  // Auto-registra pagine esistenti nel DOM e sistema le classi iniziali
  const pageElements = document.querySelectorAll('.page');
  pageElements.forEach(pageElement => {
    const pageId = pageElement.id;
    if (pageId && !state.pages.has(pageId)) {
      registerPage(pageId);
    }
    
    // IMPORTANTE: Assicura che le pagine non attive abbiano la classe .left
    // (per nasconderle fuori schermo a sinistra)
    if (!pageElement.classList.contains('active')) {
      pageElement.classList.remove('right');
      pageElement.classList.add('left');
    }
  });
  state.initialized = true;
}

/**
 * Ottiene lo stato interno (per debug)
 */
export function _debug() {
  return {
    pages: Array.from(state.pages.keys()),
    stack: state.navigationStack,
    current: state.currentPageId,
    maxDepth: state.maxStackDepth,
    isNavigating: state.isNavigating,
  };
}

/**
 * Resetta completamente lo stato del NavigatorManager (solo per test)
 */
export function _reset() {
  if (state.popstateHandler) {
    window.removeEventListener('popstate', state.popstateHandler);
    state.popstateHandler = null;
  }
  state.pages.clear();
  state.navigationStack = [];
  state.currentPageId = null;
  state.maxStackDepth = 3;
  state.isNavigating = false;
  state.initialized = false;
}

// Export default per import singolo
export const NavigatorManager = {
  init,
  registerPage,
  navigateTo,
  goBack,
  goHome,
  getCurrentPage,
  getNavigationStack,
  setMaxStackDepth,
  _debug,
  _reset,
};
