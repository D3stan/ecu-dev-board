/**
 * PageTopBar.js
 * =============
 * Componente per la barra superiore delle pagine con pulsante back e titolo
 * 
 * Utilizzo:
 * ```javascript
 * const topBar = new PageTopBar({
 *   title: "Settings",
 *   onBack: () => NavigatorManager.navigateTo('homePage')
 * });
 * ```
 * 
 * @extends Component
 */

import { Component } from '../../core/Component.js';
import { log } from '../../utils/logger.js';
import { goBack } from '../../managers/navigatorManager.js';
import { i18n } from '../../utils/i18n.js';

export class PageTopBar extends Component {
  /**
   * @param {Object} config - Configurazione del componente
   * @param {string} config.title - Titolo da visualizzare
   * @param {number} config.menuId - ID del menu per traduzione automatica (opzionale)
   * @param {function} config.onBack - Callback per il pulsante back
   */
  constructor(config = {}) {
    super(config);
    
    this.title = config.title || '';
    this.menuId = config.menuId || null; // Per aggiornamento automatico traduzioni
    this.onBack = config.onBack || null; // null = usa default (goBack)
    
    // Riferimenti DOM
    this.backBtn = null;
    
    // Abilita aggiornamento automatico traduzioni se c'è un menuId
    if (this.menuId !== null) {
      this.enableI18n(() => this._updateLabels());
    }
    
    log.debug('[PageTopBar] Component created');
  }

  // ============================================
  // LIFECYCLE HOOKS
  // ============================================

  onCreate() {
    log.debug('[PageTopBar onCreate] Called');
  }

  onMount() {
    log.debug('[PageTopBar onMount] PageTopBar mounted');
    
    // Bind events quando il componente viene montato
    this._bindEvents();
    
    // NOTA: La subscription al cambio lingua è gestita automaticamente da Component.enableI18n()
  }

  onBindEvents() {
    // Questo metodo non viene chiamato automaticamente per i Component
    // Lo teniamo per compatibilità ma il binding avviene in onMount()
    log.debug('[PageTopBar onBindEvents] Manual call - binding events');
    this._bindEvents();
  }

  /**
   * Bind degli eventi del componente
   * @private
   */
  _bindEvents() {
    log.debug('[PageTopBar _bindEvents] Binding events');
    
    // Salva riferimento al pulsante back
    this.backBtn = this.el.querySelector('.back-btn');
    
    // Click su back button
    if (this.backBtn) {
      this.backBtn.addEventListener('click', () => {
        log.debug('[PageTopBar] Back button clicked');
        
        // Se c'è una callback custom, usala; altrimenti usa il default (goBack)
        if (typeof this.onBack === 'function') {
          log.debug('[PageTopBar] Using custom onBack callback');
          this.onBack();
        } else {
          log.debug('[PageTopBar] Using default navigation (goBack)');
          goBack();
        }
      });
      log.debug('[PageTopBar] Back button listener attached');
    } else {
      log.warn('[PageTopBar] Back button not found in DOM');
    }
  }

  onActivate() {
    log.debug('[PageTopBar onActivate] Called');
  }

  onDeactivate() {
    log.debug('[PageTopBar onDeactivate] Called');
  }

  onDestroy() {
    log.debug('[PageTopBar onDestroy] Cleanup');
    
    // NOTA: La cleanup del cambio lingua è gestita automaticamente da Component._teardownI18nBinding()
  }

  // ============================================
  // RENDER
  // ============================================

  /**
   * Render method called by Component.mount()
   * @returns {string} HTML string
   */
  render() {
    return `
      <div class="sub-header">
        <button class="back-btn" aria-label="Go back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1 class="sub-header-title">${this.title}</h1>
      </div>
    `;
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  /**
   * Aggiorna il titolo quando cambia la lingua
   * @private
   */
  _updateLabels() {
    if (!this.el) return;
    
    // Se c'è un menuId, usa i18n.tMenu() per ottenere la traduzione corretta
    if (this.menuId !== null) {
      const menuTitle = i18n.tMenu(this.menuId);
      
      if (!menuTitle) {
        log.warn('[PageTopBar] No translation found for menuId', this.menuId);
        return;
      }
      
      // Aggiorna this.title con la nuova traduzione
      this.title = menuTitle;
      
      // Aggiorna il DOM
      const titleEl = this.el.querySelector('.sub-header-title');
      if (titleEl) {
        titleEl.textContent = this.title;
        log.debug(`[PageTopBar] Title updated to: ${this.title}`);
      }
    }
  }

  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Aggiorna il titolo della barra
   * @param {string} newTitle - Nuovo titolo
   */
  setTitle(newTitle) {
    this.title = newTitle;
    
    if (!this.el) {
      log.warn('[PageTopBar] setTitle called before mount');
      return;
    }
    
    const titleEl = this.el.querySelector('.sub-header-title');
    if (titleEl) {
      titleEl.textContent = newTitle;
      log.debug(`[PageTopBar] Title updated to: ${newTitle}`);
    }
  }

  /**
   * Imposta il menuId per l'aggiornamento automatico delle traduzioni
   * @param {number} menuId - ID del menu
   */
  setMenuId(menuId) {
    this.menuId = menuId;
    
    // Se non siamo ancora montati o non c'è i18n abilitato, abilitalo ora
    if (this.el && !this._i18nEnabled && this.menuId !== null) {
      this.enableI18n(() => this._updateLabels());
      log.debug(`[PageTopBar] menuId set to ${menuId}, i18n enabled`);
    } else {
      log.debug(`[PageTopBar] menuId set to ${menuId}`);
    }
    
    // Aggiorna subito il titolo con la traduzione corretta
    if (this.el && this.menuId !== null) {
      this._updateLabels();
    }
  }

  /**
   * Aggiorna la callback del pulsante back
   * @param {function} callback - Nuova callback
   */
  setOnBack(callback) {
    if (typeof callback === 'function') {
      this.onBack = callback;
      log.debug('[PageTopBar] onBack callback updated');
    }
  }
}

export default PageTopBar;
