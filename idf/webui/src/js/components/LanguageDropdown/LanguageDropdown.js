/**
 * LanguageDropdown.js
 * ===================
 * Componente dropdown per la selezione della lingua.
 * 
 * Responsabilità:
 * - Rendering del trigger (bandiera + label + chevron)
 * - Rendering del menu dropdown con lista lingue
 * - Gestione apertura/chiusura con animazioni
 * - Event binding (click trigger, click fuori, ESC, selezione lingua)
 * - Subscription a Store per lingua corrente
 * - Invio comando MODIFY_PARAM al cambio lingua
 * 
 * NON gestisce:
 * - Logica mapping lingue (delegata a func.js)
 * - Navigazione
 * 
 * @extends Component
 * @author FogExtra Team
 * @version 1.0.0
 */

import { Component } from '../../core/Component.js';
import { Store } from '../../core/store.js';
import { Paths } from '../../utils/paths.js';
import { log } from '../../utils/logger.js';
import {
  getAvailableLanguages,
  getFlagPath,
  getLangLabel,
  getLangFullName,
  isValidLangIndex
} from './func.js';

export class LanguageDropdown extends Component {
  /**
   * Crea un'istanza di LanguageDropdown
   * @param {Object} config - Configurazione opzionale
   */
  constructor(config = {}) {
    super(config);
    
    // Stato interno
    this._isOpen = false;
    
    // Riferimenti DOM
    this.triggerEl = null;
    this.menuEl = null;
    this.chevronEl = null;
    this.flagEl = null;
    this.labelEl = null;
    
    // Bound handlers (per poterli rimuovere)
    this._handleClickOutside = this._onClickOutside.bind(this);
    this._handleEscKey = this._onEscKey.bind(this);
    
    log.debug('[LanguageDropdown] Component created');
  }

  // ============================================
  // LIFECYCLE HOOKS
  // ============================================

  onCreate() {
    log.debug('[LanguageDropdown onCreate] Called');
  }

  onMount() {
    log.debug('[LanguageDropdown onMount] Mounted');
  }

  onBindEvents() {
    log.debug('[LanguageDropdown onBindEvents] Binding events');
    
    // Cache riferimenti DOM
    this.triggerEl = this.el.querySelector('.lang-dropdown-trigger');
    this.menuEl = this.el.querySelector('.lang-dropdown-menu');
    this.chevronEl = this.el.querySelector('.lang-dropdown-chevron');
    this.flagEl = this.el.querySelector('.lang-dropdown-flag');
    this.labelEl = this.el.querySelector('.lang-dropdown-label');
    
    // Click su trigger → toggle
    if (this.triggerEl) {
      this.triggerEl.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggle();
      });
    }
    
    // Click sulle opzioni lingua
    this._bindLanguageOptions();
    
    // Click fuori → chiudi (aggiunto su document)
    document.addEventListener('click', this._handleClickOutside);
    
    // ESC → chiudi
    document.addEventListener('keydown', this._handleEscKey);
  }

  onActivate() {
    log.debug('[LanguageDropdown onActivate] Setting up Store subscriptions');
    
    // Sottoscrizione cambio lingua
    this.subscribeToStore(Paths.LOCALIZATION.CURRENT_LANG_INDEX, (langIndex) => {
      log.debug(`[LanguageDropdown] Language changed to index: ${langIndex}`);
      this._updateTriggerDisplay(langIndex);
      this._updateActiveOption(langIndex);
    });
  }

  onDeactivate() {
    log.debug('[LanguageDropdown onDeactivate] Deactivating');
    // Chiudi il menu se aperto
    if (this._isOpen) {
      this.close();
    }
  }

  onDestroy() {
    log.debug('[LanguageDropdown onDestroy] Cleanup');
    
    // Rimuovi event listeners globali
    document.removeEventListener('click', this._handleClickOutside);
    document.removeEventListener('keydown', this._handleEscKey);
    
    // Pulisci riferimenti
    this.triggerEl = null;
    this.menuEl = null;
    this.chevronEl = null;
    this.flagEl = null;
    this.labelEl = null;
  }

  // ============================================
  // RENDER
  // ============================================

  /**
   * Render method called by Component.mount()
   * @returns {string} HTML string
   */
  render() {
    const currentLangIndex = Store.get(Paths.LOCALIZATION.CURRENT_LANG_INDEX) || 1; // Default: Italian
    const currentFlagPath = getFlagPath(currentLangIndex);
    const currentLabel = getLangLabel(currentLangIndex);
    const languages = getAvailableLanguages();
    
    return `
      <div class="lang-dropdown">
        <!-- Trigger Button -->
        <button class="lang-dropdown-trigger" aria-label="Select language" aria-expanded="false">
          <div class="lang-dropdown-flag-wrapper">
            <img 
              data-asset-key="${currentFlagPath}" 
              alt="${currentLabel}" 
              class="lang-dropdown-flag"
            />
          </div>
          <span class="lang-dropdown-label">${currentLabel}</span>
          <svg class="lang-dropdown-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        
        <!-- Dropdown Menu -->
        <div class="lang-dropdown-menu">
          ${this._renderLanguageOptions(languages, currentLangIndex)}
        </div>
      </div>
    `;
  }

  /**
   * Renderizza le opzioni lingua nel menu
   * @private
   * @param {Array} languages - Lista lingue disponibili
   * @param {number} currentLangIndex - Indice lingua corrente
   * @returns {string} HTML string
   */
  _renderLanguageOptions(languages, currentLangIndex) {
    return languages.map(lang => {
      const isActive = lang.index === currentLangIndex;
      const activeClass = isActive ? 'active' : '';
      
      return `
        <button 
          class="lang-dropdown-option ${activeClass}" 
          data-lang-index="${lang.index}"
          aria-selected="${isActive}"
        >
          <div class="lang-dropdown-option-flag-wrapper">
            <img 
              data-asset-key="${lang.flagPath}" 
              alt="${lang.label}" 
              class="lang-dropdown-option-flag"
            />
          </div>
          <span class="lang-dropdown-option-label">${lang.fullName}</span>
        </button>
      `;
    }).join('');
  }

  // ============================================
  // EVENT HANDLERS
  // ============================================

  /**
   * Bind click events sulle opzioni lingua
   * @private
   */
  _bindLanguageOptions() {
    const options = this.el.querySelectorAll('.lang-dropdown-option');
    
    options.forEach(option => {
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        
        const langIndex = parseInt(option.getAttribute('data-lang-index'), 10);
        
        if (isValidLangIndex(langIndex)) {
          this._selectLanguage(langIndex);
        }
      });
    });
  }

  /**
   * Handler per click fuori dal dropdown
   * @private
   * @param {Event} e - Click event
   */
  _onClickOutside(e) {
    if (!this._isOpen) return;
    
    // Controlla se il click è dentro il componente
    if (this.el && !this.el.contains(e.target)) {
      this.close();
    }
  }

  /**
   * Handler per tasto ESC
   * @private
   * @param {KeyboardEvent} e - Keyboard event
   */
  _onEscKey(e) {
    if (e.key === 'Escape' && this._isOpen) {
      this.close();
    }
  }

  /**
   * Seleziona una nuova lingua
   * @private
   * @param {number} langIndex - Indice della lingua selezionata
   */
  _selectLanguage(langIndex) {
    const currentLangIndex = Store.get(Paths.LOCALIZATION.CURRENT_LANG_INDEX);
    
    // Se la lingua è già selezionata, chiudi soltanto
    if (langIndex === currentLangIndex) {
      this.close();
      return;
    }
    
    log.debug(`[LanguageDropdown] Selecting language index locally: ${langIndex}`);
    
    // Aggiorna lo Store locale con la nuova lingua
    Store.set(Paths.LOCALIZATION.CURRENT_LANG_INDEX, langIndex);
    
    // Chiudi il menu
    this.close();
  }

  // ============================================
  // UI UPDATES
  // ============================================

  /**
   * Aggiorna il display del trigger (bandiera + label)
   * @private
   * @param {number} langIndex - Indice lingua corrente
   */
  _updateTriggerDisplay(langIndex) {
    if (!this.flagEl || !this.labelEl) return;
    
    const flagKey = getFlagPath(langIndex); // Restituisce asset key, non percorso fisico
    const label = getLangLabel(langIndex);
    
    this.flagEl.alt = label;
    this.labelEl.textContent = label;
    
    // Siccome cambia la bandiera dinamicamente, modifichiamo il key e diamo in pasto al bridge
    if (this.flagEl.getAttribute('data-asset-key') !== flagKey) {
      this.flagEl.setAttribute('data-asset-key', flagKey);
      this.refreshDeferredImages();
    }
  }

  /**
   * Aggiorna l'opzione attiva nel menu
   * @private
   * @param {number} langIndex - Indice lingua corrente
   */
  _updateActiveOption(langIndex) {
    if (!this.menuEl) return;
    
    const options = this.menuEl.querySelectorAll('.lang-dropdown-option');
    
    options.forEach(option => {
      const optionLangIndex = parseInt(option.getAttribute('data-lang-index'), 10);
      const isActive = optionLangIndex === langIndex;
      
      option.classList.toggle('active', isActive);
      option.setAttribute('aria-selected', isActive.toString());
    });
  }

  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Apre il dropdown menu
   */
  open() {
    if (this._isOpen) return;
    
    log.debug('[LanguageDropdown] Opening');
    
    this._isOpen = true;
    
    // Aggiungi classe .open al container (this.el È il .lang-dropdown)
    if (this.el) {
      this.el.classList.add('open');
    }
    
    // Aggiorna aria-expanded
    if (this.triggerEl) {
      this.triggerEl.setAttribute('aria-expanded', 'true');
    }
  }

  /**
   * Chiude il dropdown menu
   */
  close() {
    if (!this._isOpen) return;
    
    log.debug('[LanguageDropdown] Closing');
    
    this._isOpen = false;
    
    // Rimuovi classe .open dal container (this.el È il .lang-dropdown)
    if (this.el) {
      this.el.classList.remove('open');
    }
    
    // Aggiorna aria-expanded
    if (this.triggerEl) {
      this.triggerEl.setAttribute('aria-expanded', 'false');
    }
  }

  /**
   * Toggle del dropdown menu
   */
  toggle() {
    if (this._isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Verifica se il dropdown è aperto
   * @returns {boolean}
   */
  isOpen() {
    return this._isOpen;
  }
}

export default LanguageDropdown;
