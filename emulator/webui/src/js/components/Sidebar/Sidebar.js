/**
 * Sidebar.js
 * ==========
 * Component per la sidebar di navigazione.
 * 
 * Responsabilità:
 * - Rendering della struttura HTML della sidebar
 * - Gestione dello stato aperto/chiuso
 * - Rendering dinamico dei menu items da Store
 * - Gestione active state degli items
 * - Event binding per interazioni (click, ESC, overlay)
 * - Aggiornamento automatico al cambio lingua
 * 
 * NON gestisce:
 * - Navigazione (delegata a NavigatorManager tramite SidebarManager)
 * - Logica di business (delegata a SidebarManager)
 * 
 * @extends Component
 */

import {Component} from '../../core/Component.js';
import { log } from '../../utils/logger.js';
import { Store } from '../../core/store.js';
import { Paths } from '../../utils/paths.js';
import { i18n } from '../../utils/i18n.js';
import { getMenuConfig } from '../../utils/menuMapping.js';
import { LanguageDropdown } from '../LanguageDropdown/LanguageDropdown.js';

export class Sidebar extends Component {
  /**
   * @param {Object} config - Configurazione sidebar
   * @param {string} config.activeItemId - ID item attivo
   * @param {function} config.onItemClick - Callback per click su item
   * @param {function} config.onClose - Callback per chiusura sidebar
   */
  constructor(config = {}) {
    super(config);
    
    this.activeItemId = config.activeItemId || null;
    this.onItemClick = config.onItemClick || (() => {});
    this.onClose = config.onClose || (() => {});
    
    // Riferimenti DOM
    this.overlayEl = null;
    this.sidebarEl = null;
    this.closeBtn = null;
    this.versionEl = null;
    
    // Child component: LanguageDropdown
    this.languageDropdown = null;
    
    // Abilita aggiornamento automatico traduzioni quando cambia lingua
    this.enableI18n(() => this._updateMenuLabels());
    
    log.debug('📂 Sidebar component created');
  }

  // ============================================
  // LIFECYCLE HOOKS
  // ============================================

  onCreate() {
    log.debug('[Sidebar onCreate] Called');
  }

  onMount() {
    log.debug('[Sidebar onMount] Sidebar mounted');
  }

  onBindEvents() {
    log.debug('[Sidebar onBindEvents] Binding events');
    
    // Salva riferimenti DOM (ora disponibili dopo render)
    this.overlayEl = this.el.querySelector('.sidebar-overlay');
    this.sidebarEl = this.el.querySelector('.sidebar');
    this.closeBtn = this.el.querySelector('.sidebar-close-btn');
    this.macEl = this.el.querySelector('.sidebar-mac');
    this.versionEl = this.el.querySelector('.sidebar-version');
    
    // Monta e attiva il LanguageDropdown
    this._mountLanguageDropdown();
    
    // Click su overlay → chiudi
    if (this.overlayEl) {
      this.overlayEl.addEventListener('click', () => {
        log.debug('[Sidebar] Overlay clicked');
        this.close();
      });
    }
    
    // Click su close button → chiudi
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => {
        log.debug('[Sidebar] Close button clicked');
        this.close();
      });
    }
    
    // ESC key → chiudi
    this._handleEscKey = (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        log.debug('[Sidebar] ESC pressed');
        this.close();
      }
    };
    document.addEventListener('keydown', this._handleEscKey);
    
    // Click sui menu items
    this._bindMenuItems();
  }

  onActivate() {
    log.debug('[Sidebar onActivate] Setting up Store subscriptions');
    
    // Sottoscrizione cambio menu (in caso ESP invii aggiornamenti runtime)
    this.subscribeToStore(Paths.CONFIG.MENU, (menuConfig) => {
      log.warn('[Sidebar] Menu configuration changed - re-rendering sidebar', {
        hasConfig: !!menuConfig,
        phase: this.phase,
        mounted: !!this.el
      });
      this._reRenderMenu();
    });
    
    // Sottoscrizione cambio versione software
    this.subscribeToStore(Paths.CONFIG.SOFTWARE.VERSION, (version) => {
      log.debug(`[Sidebar] Software version changed: ${version}`);
      this._updateVersion(version);
    });

    // Sottoscrizione cambio MAC address software
    this.subscribeToStore(Paths.CONFIG.SOFTWARE.MAC_ADDRESS, (macAddress) => {
      log.debug(`[Sidebar] Software MAC address changed: ${macAddress}`);
      this._updateMacAddress(macAddress);
    });
    
    // NOTA: La subscription al cambio lingua è gestita automaticamente da Component.enableI18n()
  }

  onDeactivate() {
    log.warn('[Sidebar onDeactivate] Sidebar deactivated; subscriptions will be cleaned by base component');
  }

  onDestroy() {
    log.debug('[Sidebar onDestroy] Cleanup');
    
    // Rimuovi ESC listener
    if (this._handleEscKey) {
      document.removeEventListener('keydown', this._handleEscKey);
    }
    
    // Distruggi LanguageDropdown
    if (this.languageDropdown) {
      this.languageDropdown.destroy();
      this.languageDropdown = null;
    }
    
    // NOTA: La cleanup delle subscriptions Store e del cambio lingua è gestita automaticamente da Component
  }

  // ============================================
  // RENDER
  // ============================================

  /**
   * Render method called by Component.mount()
   * @returns {string} HTML string
   */
  render() {
    return this.renderContent();
  }

  renderContent() {
    const macAddress = Store.get(Paths.CONFIG.SOFTWARE.MAC_ADDRESS) || '--:--:--:--:--:--';
    const version = Store.get(Paths.CONFIG.SOFTWARE.VERSION) || '0.0.0';
    
    return `
      <div class="sidebar-wrapper">
        <!-- Sidebar Overlay -->
        <div class="sidebar-overlay"></div>
        
        <!-- Sidebar -->
        <div class="sidebar">
          <div class="sidebar-header">
            <img data-asset-key="logo-product" alt="FOG EXTRA" class="sidebar-logo" />
            
            <!-- Language Dropdown Container -->
            <div class="sidebar-header-actions">
              <div id="sidebar-language-dropdown"></div>
            </div>
            
            <button class="sidebar-close-btn" aria-label="Close menu">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          
          <div class="sidebar-content">
            <nav class="sidebar-menu">
              ${this._renderMenuItems()}
            </nav>
          </div>
          
          <div class="sidebar-footer">
            <div class="sidebar-mac">MAC ${macAddress}</div>
            <div class="sidebar-version">Software Rev ${version}</div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Renderizza i menu items dinamicamente da Store
   * @private
   */
  _renderMenuItems() {
    // Ottiene configurazione menu da Store (popolata da ESP)
    const menuConfig = Store.get(Paths.CONFIG.MENU) || [];    
    if (menuConfig.length === 0) {
      return '<div class="sidebar-empty">No menu items available</div>';
    }
    
    // Separa menu normali da menu SYSTEM
    const normalMenus = [];
    const systemMenus = [];
    
    menuConfig.forEach(({ menuId }) => {
      const config = getMenuConfig(menuId);
      if (config) {
        if (config.isSystemMenu) {
          systemMenus.push(menuId);
        } else {
          normalMenus.push(menuId);
        }
      }
    });
    
    let html = '';
    
    // Renderizza menu normali
    normalMenus.forEach(menuId => {
      html += this._renderMenuItem(menuId);
    });
    
    // Renderizza sezione SYSTEM se ci sono menu system
    if (systemMenus.length > 0) {
      html += `
        <div class="sidebar-divider"></div>
        <div class="sidebar-section-title">SYSTEM</div>
      `;
      
      systemMenus.forEach(menuId => {
        html += this._renderMenuItem(menuId);
      });
    }
    
    return html;
  }

  /**
   * Renderizza singolo menu item
   * @private
   * @param {number} menuId - ID del menu (MenuType enum)
   */
  _renderMenuItem(menuId) {
    // Ottieni configurazione hardcoded (icon, route)
    const config = getMenuConfig(menuId);
    if (!config) {
      log.warn(`[Sidebar] No config found for menuId: ${menuId}`);
      return '';
    }
    
    // Ottieni label tradotta da Store (ricevuta da ESP)
    const label = i18n.tMenu(menuId);
    
    // Determina se attivo
    const isActive = String(menuId) === String(this.activeItemId);
    const activeClass = isActive ? 'active' : '';
    
    return `
      <div class="sidebar-item ${activeClass}" 
           data-menu-id="${menuId}" 
           data-route="${config.route}">
        <div class="sidebar-item-icon">
          ${this._renderIcon(config.assetKey || config.icon)}
        </div>
        <span class="sidebar-item-label">${label}</span>
      </div>
    `;
  }

  /**
   * Renderizza icona (non più SVG/IMG mixed, usa il sistema asset manager unificato)
   * Adegua l'uso di config.icon (che prima era src url, ora diventa data-asset-key esplicito se matcha, altrimenti fallback o conversione a chiave nota)
   * @private
   */
  _renderIcon(iconKey) {
    if (!iconKey) return '';
    return `<img data-asset-key="${iconKey}" alt="icon" />`;
  }

  /**
   * Icona di default se non specificata
   * @private
   */
  _getDefaultIcon() {
    return `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
      </svg>
    `;
  }

  // ============================================
  // EVENT HANDLERS
  // ============================================

  /**
   * Bind click events sui menu items
   * @private
   */
  _bindMenuItems() {
    const itemElements = this.el.querySelectorAll('.sidebar-item[data-menu-id]');
    
    itemElements.forEach(element => {
      element.addEventListener('click', () => {
        const menuId = parseInt(element.getAttribute('data-menu-id'));
        const route = element.getAttribute('data-route');
        
        log.debug(`[Sidebar] Menu clicked: ${menuId} → ${route}`);
        
        // Ottieni configurazione menu
        const config = getMenuConfig(menuId);
        
        // Esegui callback custom se presente
        if (config && config.onClickItem && typeof config.onClickItem === 'function') {
          log.debug(`[Sidebar] Executing onClickItem callback for menu ${menuId}`);
          config.onClickItem(menuId, config);
        }
        
        // Callback al SidebarManager (navigazione)
        this.onItemClick({
          menuId,
          route,
          element
        });
      });
    });
  }

  /**
   * Aggiorna le label dei menu al cambio lingua
   * @private
   */
  _updateMenuLabels() {
    if (!this.el) return;
    
    const items = this.el.querySelectorAll('.sidebar-item[data-menu-id]');
    
    items.forEach(item => {
      const menuId = parseInt(item.getAttribute('data-menu-id'));
      const label = i18n.tMenu(menuId);
      const labelEl = item.querySelector('.sidebar-item-label');
      
      if (labelEl) {
        labelEl.textContent = label;
      }
    });
    
    log.debug('[Sidebar] Menu labels updated');
  }

  /**
   * Re-renderizza completamente il menu (se la configurazione cambia)
   * @private
   */
  _reRenderMenu() {
    if (!this.el) return;
    
    const menuEl = this.el.querySelector('.sidebar-menu');
    if (menuEl) {
      menuEl.innerHTML = this._renderMenuItems();
      this._bindMenuItems();
      // Il DOM è cambiato. Deve riallineare il listener manager immagini.
      this.refreshDeferredImages();
      log.debug('[Sidebar] Menu re-rendered');
    }
  }

  /**
   * Monta il LanguageDropdown nell'header della sidebar
   * @private
   */
  _mountLanguageDropdown() {
    const container = this.el.querySelector('#sidebar-language-dropdown');
    if (!container) {
      log.warn('[Sidebar] Language dropdown container not found');
      return;
    }
    
    // Crea il LanguageDropdown come VERO Child Component (senza passare 'el')
    this.languageDropdown = new LanguageDropdown({
        id: `${this.id}::lang-dropdown`
    });
    
    // 1. Montalo nel DOM nel suo placeholder specifico
    // Questo forza l'esecuzione di render() interno e la valorizzazione di this.el
    this.languageDropdown.mount(container);
    
    // 2. Registralo nell'albero parent/child
    // addChild() vedrà che il figlio è già 'mounted' e non forzerà uno spostamento sul root del parente.
    // L'esecuzione di bindEvents e activate avverrà in automatico a cascata grazie a Component.js
    this.addChild(this.languageDropdown);
    
    log.debug('[Sidebar] LanguageDropdown mounted as child');
  }

  /**
   * Aggiorna la versione software visualizzata
   * @private
   * @param {string} version - Versione software
   */
  _updateVersion(version) {
    if (!this.versionEl) return;
    
    this.versionEl.textContent = `Software Rev ${version}`;
    log.debug(`[Sidebar] Version updated: ${version}`);
  }

  /**
   * Aggiorna il MAC address visualizzato
   * @private
   * @param {string} macAddress - MAC address software
   */
  _updateMacAddress(macAddress) {
    if (!this.macEl) return;

    const safeMac = macAddress && String(macAddress).trim().length > 0
      ? String(macAddress).trim().toUpperCase()
      : '--:--:--:--:--:--';

    this.macEl.textContent = `MAC ${safeMac}`;
    log.debug(`[Sidebar] MAC updated: ${safeMac}`);
  }

  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Apre la sidebar
   */
  open() {
    if (this.isOpen()) {
      log.debug('[Sidebar] Already open');
      return;
    }
    
    if (this.overlayEl) this.overlayEl.classList.add('active');
    if (this.sidebarEl) this.sidebarEl.classList.add('active');
    
    log.debug('[Sidebar] Opened');
  }

  /**
   * Chiude la sidebar
   */
  close() {
    if (!this.isOpen()) {
      log.debug('[Sidebar] Already closed');
      return;
    }
    
    if (this.overlayEl) this.overlayEl.classList.remove('active');
    if (this.sidebarEl) this.sidebarEl.classList.remove('active');
    
    // Callback
    this.onClose();
    
    log.debug('[Sidebar] Closed');
  }

  /**
   * Toggle sidebar
   */
  toggle() {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Verifica se la sidebar è aperta
   * @returns {boolean}
   */
  isOpen() {
    return this.sidebarEl && this.sidebarEl.classList.contains('active');
  }

  /**
   * Imposta l'item attivo
   * @param {number|string} menuId - ID menu da attivare (MenuType)
   */
  setActiveItem(menuId) {
    this.activeItemId = String(menuId);
    
    // Aggiorna classi CSS solo se montato
    if (!this.el) {
      log.debug('[Sidebar] setActiveItem called before mount, skipping');
      return;
    }
    
    const items = this.el.querySelectorAll('.sidebar-item');
    items.forEach(item => {
      const id = item.getAttribute('data-menu-id');
      if (id === String(menuId)) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
    
    log.debug(`[Sidebar] Active item set to: ${menuId}`);
  }
}

export default Sidebar;
