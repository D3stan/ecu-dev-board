/**
 * Modal.js
 * ========
 * Componente Modal generico e parametrico.
 * 
 * Tipi supportati:
 * - success: Banner verde con spunta
 * - error: Banner rosso con warning
 * - warning: Banner giallo con warning
 * - info: Per dettagli parametri (con icona custom)
 * 
 * Props (come da modal.md):
 * - label: Titolo del modal
 * - ds: Descrizione/messaggio
 * - type: Tipo di modal (success|error|warning|info)
 * - assetKey: Asset key icona (opzionale, solo per type='info')
 * - closable: Se true, mostra X e permette chiusura con click fuori (default: true)
 * - actionBtns: Array di bottoni [{cb, css, label}] (opzionale)
 * 
 * @author FogExtra Team
 * @version 2.0.0
 */

import { Component } from '../../core/Component.js';
import { log } from '../../utils/logger.js';
import { i18n } from '../../utils/i18n.js';

export class Modal extends Component {
  /**
   * @param {Object} config - Configurazione del modal
   * @param {string} config.label - Titolo del modal
   * @param {string} config.ds - Descrizione/messaggio
   * @param {string} config.type - Tipo di modal (success|error|warning|info)
  * @param {string} config.assetKey - Asset key icona (opzionale, solo per type='info')
   * @param {boolean} config.closable - Se true, mostra X e permette chiusura (default: true)
   * @param {Array} config.actionBtns - Array di bottoni [{cb, css, label}]
   * @param {number} config.paramId - ID parametro per traduzione automatica (opzionale)
   * @param {boolean} config.preserveFormatting - Se true, preserva newline nel testo (default: false)
   */
  constructor(config = {}) {
    super();
    
    this.label = config.label || 'Info';
    this.ds = config.ds || '';
    this.type = config.type || 'info';
    this.assetKey = config.assetKey || null;
    this.closable = config.closable !== false; // Default true
    this.actionBtns = config.actionBtns || [];
    this.onCloseCallback = config.onClose || null;
    this.paramId = config.paramId || null; // Per aggiornamento automatico traduzioni
    this.preserveFormatting = config.preserveFormatting === true; // Default false
    
    // 🌐 Se è un modal per un parametro, carica traduzioni subito
    if (this.paramId !== null) {
      const translation = i18n.tParam(this.paramId);
      if (translation && translation.name) {
        this.label = translation.name;
        this.ds = translation.ds || this.ds;
        log.debug('Modal', `✅ Loaded translations for param ${this.paramId}: "${this.label}"`);
      } else {
        log.warn('Modal', `⚠️ No translation found for param ${this.paramId}, using fallback: "${this.label}"`);
      }
    }
    
    // Abilita sempre aggiornamento automatico traduzioni
    // Il metodo _updateTranslations() controllerà internamente se c'è un paramId
    this.enableI18n(() => this._updateTranslations());
    
    log.debug('Modal', `Created modal: "${this.label}" (type: ${this.type})`);
  }

  /**
   * Lifecycle: componente creato
   */
  onCreate() {
    log.debug('Modal', 'onCreate');
  }

  /**
   * Lifecycle: componente montato
   */
  onMount() {
    log.debug('Modal', 'onMount');
    
    // NON aggiungere .modal-backdrop perché this.el è già il container!
    // Il render() già crea la struttura corretta
    
    this._bindEvents();
    
    // NOTA: La subscription al cambio lingua è gestita automaticamente da Component.enableI18n()
  }

  /**
   * Lifecycle: componente attivato
   */
  onActivate() {
    log.debug('Modal', 'onActivate - showing modal');
    // Mostra il modal con animazione
    if (this.el) {
      // this.el È il .modal-backdrop, aggiungi .active
      this.el.classList.add('active');
      document.body.style.overflow = 'hidden'; // Blocca scroll
      
      const container = this.el.querySelector('.modal-container');
      if (!container) {
        log.warn('Modal', 'Modal container not found on activate');
      }
    }
  }

  /**
   * Lifecycle: componente disattivato
   */
  onDeactivate() {
    log.debug('Modal', 'onDeactivate - hiding modal');
    // Nascondi il modal con animazione
    if (this.el) {
      this.el.classList.remove('active');
      document.body.style.overflow = ''; // Ripristina scroll
    }
  }

  /**
   * Lifecycle: componente distrutto
   */
  onDestroy() {
    log.debug('Modal', 'onDestroy');
    document.body.style.overflow = ''; // Assicurati di ripristinare scroll
    
    // NOTA: La cleanup del cambio lingua è gestita automaticamente da Component._teardownI18nBinding()
    
    this.onCloseCallback = null;
    this.actionBtns = [];
  }

  /**
   * Aggiorna traduzioni quando cambia lingua
   * @private
   */
  _updateTranslations() {
    if (!this.el) return;
    
    // Se il modal è per un parametro, aggiorna traduzioni dal sistema i18n
    if (this.paramId !== null) {
      const translation = i18n.tParam(this.paramId);
      if (translation && translation.name) {
        // Aggiorna label e descrizione
        this.label = translation.name;
        this.ds = translation.ds || this.ds;
      }
    }
    
    // Aggiorna DOM
    const titleEl = this.el.querySelector('.modal-title');
    const messageEl = this.el.querySelector('.modal-message');
    
    if (titleEl) titleEl.textContent = this.label;
    if (messageEl) {
      // Rispetta il flag preserveFormatting
      if (this.preserveFormatting) {
        messageEl.innerHTML = this.ds.replace(/\n/g, '<br>').trim();
      } else {
        messageEl.textContent = this.ds;
      }
    }

    log.debug('Modal', `Translations updated${this.paramId !== null ? ' for param ' + this.paramId : ''}: ${this.label}`);
  }

  /**
   * Bind eventi DOM
   * @private
   */
  _bindEvents() {
    if (!this.el) return;
    
    // Click sul backdrop chiude il modal (solo se closable)
    // this.el è il .modal-backdrop
    if (this.closable) {
      this.el.addEventListener('click', (e) => {
        // Chiudi solo se click diretto sul backdrop, non sui figli (.modal-container)
        if (e.target === this.el) {
          this.close();
        }
      });
      
      // Bottone X di chiusura
      const closeBtn = this.el.querySelector('.modal-close-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          this.close();
        });
      }
    }
    
    // Bottoni azione
      const actionBtns = this.el.querySelectorAll('.modal-action-btn');
    actionBtns.forEach((btn, index) => {
      const config = this.actionBtns[index];
      if (config && typeof config.cb === 'function') {
        btn.addEventListener('click', () => {
          log.debug('Modal', `Action button clicked: ${config.label}`);
          config.cb();
          // Chiudi il modal dopo l'azione (puoi cambiare questo comportamento)
          this.close();
        });
      }
    });    // ESC key chiude il modal (solo se closable)
    if (this.closable) {
      this._handleEscKey = (e) => {
        if (e.key === 'Escape') {
          this.close();
        }
      };
      document.addEventListener('keydown', this._handleEscKey);
    }
  }

  /**
   * Chiude il modal
   */
  close() {
    log.debug('Modal', 'Closing modal');
    
    // Callback onClose
    if (typeof this.onCloseCallback === 'function') {
      this.onCloseCallback();
    }
    
    // Deactivate e rimuovi da DOM
    this.onDeactivate();
    
    // Rimuovi event listener ESC
    if (this._handleEscKey) {
      document.removeEventListener('keydown', this._handleEscKey);
      this._handleEscKey = null;
    }
    
    // Distruggi il componente
    setTimeout(() => {
      this.destroy();
    }, 300); // Aspetta fine animazione
  }

  /**
   * Renderizza il componente
   * 
   * Returns HTML-in-JS template string with CORRECT structure:
   * The Component.js will make the ROOT of this HTML the this.el element.
   * So we render the BACKDROP as root, with container inside.
   * 
   * Structure (this is what Component.js will create):
   * this.el → <div class="modal-backdrop">           ← Root element (overlay)
   *             <div class="modal-container modal-{type}">  ← Inner container (box)
   *               {closable ? closeButton : ''}
   *               <header>icon + title</header>
   *               <body>message</body>
   *               {actionBtns.length ? footer : ''}
   *             </div>
   *           </div>
   * 
   * @returns {string} HTML template string
   */
  render() {
    const iconHtml = this._getIconHtml();
    const closeBtnHtml = this.closable ? this._getCloseBtnHtml() : '';
    const actionBtnsHtml = this._getActionBtnsHtml();
    
    // Formatta il testo: se preserveFormatting=true, converti \n in <br>, altrimenti rimuovi
    const formattedLabel = this.label.replace(/\n/g, " ").trim();
    const formattedDs = this.preserveFormatting 
      ? this.ds.replace(/\n/g, '<br>').trim()
      : this.ds.replace(/\n/g, " ").trim();
    
    // 🔧 FIX: Render backdrop come ROOT, container dentro!
    return `
      <div class="modal-backdrop">
        <div class="modal-container modal-${this.type}">
          ${closeBtnHtml}
          
          <div class="modal-header">
            ${iconHtml}
            <h2 class="modal-title">${formattedLabel}</h2>
          </div>
          
          <div class="modal-body">
            <p class="modal-message">${formattedDs}</p>
          </div>
          
          ${actionBtnsHtml}
        </div>
      </div>
    `;
  }

  /**
   * Genera SVG inline per tipo success (check mark in circle)
   * @private
   * @returns {string}
   */
  _getSuccessSvg() {
    return `
      <svg viewBox="0 0 48 48" fill="none" role="img" aria-label="Success">
        <circle cx="24" cy="24" r="22" stroke="currentColor" stroke-width="3" fill="none"/>
        <path d="M14 24l8 8 12-16" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }

  /**
   * Genera SVG inline per tipo error (X in circle)
   * @private
   * @returns {string}
   */
  _getErrorSvg() {
    return `
      <svg viewBox="0 0 48 48" fill="none" role="img" aria-label="Error">
        <circle cx="24" cy="24" r="22" stroke="currentColor" stroke-width="3" fill="none"/>
        <path d="M16 16l16 16M32 16L16 32" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
      </svg>
    `;
  }

  /**
   * Genera SVG inline per tipo warning (triangle with exclamation)
   * @private
   * @returns {string}
   */
  _getWarningSvg() {
    return `
      <svg viewBox="0 0 48 48" fill="none" role="img" aria-label="Warning">
        <path d="M24 4L44 40H4L24 4Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round" fill="none"/>
        <path d="M24 18v10M24 32v2" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
      </svg>
    `;
  }

  /**
   * Genera HTML icona in base al tipo
   * Maps config.type to appropriate icon:
   * - success/error/warning → inline SVG (no external files)
  * - info → custom asset key from config.assetKey or fallback
   * 
   * @private
   * @returns {string} HTML for .modal-icon container with SVG or <img>
   */
  _getIconHtml() {
    let iconContent = '';
    
    switch (this.type) {
      case 'success':
        iconContent = this._getSuccessSvg();
        break;
      case 'error':
        iconContent = this._getErrorSvg();
        break;
      case 'warning':
        iconContent = this._getWarningSvg();
        break;
      case 'info':
        // For info type, use custom asset key if provided, otherwise fallback
        const infoAssetKey = this.assetKey || 'icon-setting';
        iconContent = `<img data-asset-key="${infoAssetKey}" alt="${this.label}" draggable="false">`;
        break;
      default:
        // Fallback to info key
        const defaultAssetKey = this.assetKey || 'icon-setting';
        iconContent = `<img data-asset-key="${defaultAssetKey}" alt="${this.label}" draggable="false">`;
    }
    
    return `
      <div class="modal-icon">
        ${iconContent}
      </div>
    `;
  }

  /**
   * Genera HTML bottone chiusura (X button in top-right corner)
   * Only rendered when config.closable === true
   * 
   * @private
   * @returns {string} HTML for close button with inline X SVG
   */
  _getCloseBtnHtml() {
    return `
      <button class="modal-close-btn" aria-label="Close modal">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;
  }

  /**
   * Genera HTML bottoni azione (footer buttons)
   * Maps config.actionBtns array to <button> elements
   * Each button uses its own CSS class variant (primary/secondary/danger)
   * 
   * @private
   * @returns {string} HTML for .modal-footer with action buttons, or empty string
   */
  _getActionBtnsHtml() {
    if (!this.actionBtns || this.actionBtns.length === 0) {
      return '';
    }
    
    const btnsHtml = this.actionBtns.map((btn) => {
      const cssClass = btn.css || 'modal-btn-primary';
      const label = btn.label || 'OK';
      return `<button class="modal-action-btn ${cssClass}">${label}</button>`;
    }).join('');
    
    return `
      <div class="modal-footer">
        ${btnsHtml}
      </div>
    `;
  }
}
