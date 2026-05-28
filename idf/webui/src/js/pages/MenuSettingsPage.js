/**
 * MenuSettingsPage.js
 * ====================
 * Pagina per la gestione e configurazione parametri dell'applicazione FOG EXTRA.
 * 
 * Contenuto:
 * - PageTopBar con titolo del menu selezionato e pulsante back
 * - Lista parametri configurabili del menu corrente
 * - Ogni parametro è un ParameterItem (Normal o Switch)
 * 
 * Funzionalità:
 * - Si registra a Store.app.selectedMenu per caricare i parametri del menu corrente
 * - Se il menu viene eliminato (selectedMenu diventa null), torna alla home
 * - Click su parametro Normal → naviga a parameterEditorPage o timerEditorPage
 * - Toggle su parametro Switch → invia comando MODIFY
 * - Click su info button → apre InfoModal (TODO)
 * 
 * @author FogExtra Team
 * @version 2.0.0
 */

import { Page } from '../core/Page.js';
import { Store } from '../core/store.js';
import { Paths } from '../utils/paths.js';
import { PageTopBar } from '../components/PageTopBar/PageTopBar.js';
import { ParameterItem } from '../components/ParameterItem/ParameterItem.js';
import { ModalManager } from '../managers/modalManager.js';
import { ParamType, PIN_PARAM_ID } from '../utils/constants.js';
import { log } from '../utils/logger.js';
import { goBack, navigateTo } from '../managers/navigatorManager.js';
import { CommandManager } from '../managers/commandManager.js';
import { getMenuTypeIcon } from '../utils/iconMapping.js';

export class MenuSettingsPage extends Page {
  /**
   * Create MenuSettingsPage instance.
   */
  constructor(options = {}) {
    super({
      id: 'menuSettingsPage',
      title: 'Menu Settings',
      ...options
    });

    // Componenti
    this.pageTopBar = null;
    this.parameterItems = [];

    // Unsubscribe functions
    this.unsubSelectedMenu = null;

    log.debug('MenuSettingsPage', 'Created');
  }

  /**
   * Called when page is created.
   */
  onCreate() {
    super.onCreate();
    log.debug('MenuSettingsPage', 'onCreate');
  }

  /**
   * Called after skeleton is created to mount PageTopBar.
   */
  createSkeleton() {
    const skeleton = super.createSkeleton(); // This calls renderContent()
    log.debug('MenuSettingsPage', 'createSkeleton - Mounting PageTopBar');
    
    // Monta il PageTopBar dopo che il DOM è stato creato
    this._mountPageTopBar();
    
    // Ritorna l'elemento skeleton per App.js
    return skeleton;
  }

  /**
   * Called when page is bound to events.
   */
  onBindEvents() {
    super.onBindEvents();
    log.debug('MenuSettingsPage', 'onBindEvents');
  }

  /**
   * Called when page becomes active/visible.
   */
  onActivate() {
    super.onActivate();
    log.debug('MenuSettingsPage', 'onActivate');

    // Sottoscrizione a Store.app.selectedMenu
    this.unsubSelectedMenu = Store.subscribe(Paths.APP.SELECTED_MENU, (newMenuId, oldMenuId) => {
      log.debug('MenuSettingsPage', `selectedMenu changed: ${oldMenuId} → ${newMenuId}`);

      if (newMenuId === null) {
        // Menu eliminato → torna alla home
        log.warn('MenuSettingsPage', 'Selected menu removed, navigating to home');
        this._navigateToHome();
      } else {
        // Menu cambiato → aggiorna parametri
        this._updateMenuParameters(newMenuId);
      }
    });

    // Carica parametri del menu corrente (se presente)
    const currentMenuId = Store.get(Paths.APP.SELECTED_MENU);
    if (currentMenuId !== null) {
      this._updateMenuParameters(currentMenuId);
    } else {
      log.warn('MenuSettingsPage', 'No menu selected, showing empty state');
      this._showEmptyState();
    }
  }

  /**
   * Called when page becomes inactive.
   */
  onDeactivate() {
    super.onDeactivate();
    log.debug('MenuSettingsPage', 'onDeactivate');

    // Unsubscribe da Store
    if (this.unsubSelectedMenu) {
      this.unsubSelectedMenu();
      this.unsubSelectedMenu = null;
    }
  }

  /**
   * Called when page is destroyed.
   */
  onDestroy() {
    super.onDestroy();
    log.debug('MenuSettingsPage', 'onDestroy');

    // Distruggi tutti i componenti figli
    this._destroyComponents();
  }

  /**
   * Render page content.
   */
  renderContent() {
    return `
      <!-- PageTopBar Container -->
      <div id="page-top-bar-container"></div>

      <!-- Settings Content -->
      <div class="settings-content" id="parameters-container">
        <!-- I ParameterItem verranno montati qui dinamicamente -->
      </div>
    `;
  }

  /**
   * Metodo update chiamato per aggiornare tutti i componenti figli
   */
  update() {
    log.debug('MenuSettingsPage', 'update() called');

    // Aggiorna PageTopBar
    if (this.pageTopBar && typeof this.pageTopBar.update === 'function') {
      this.pageTopBar.update();
    }

    // Aggiorna tutti i ParameterItem
    this.parameterItems.forEach(item => {
      if (item && typeof item.update === 'function') {
        item.update();
      }
    });
  }

  // ============================================
  // PRIVATE METHODS - Component Management
  // ============================================

  /**
   * Monta il PageTopBar
   * @private
   */
  _mountPageTopBar() {
    log.debug('MenuSettingsPage', '_mountPageTopBar called');
    log.debug('MenuSettingsPage', 'this.el exists?', !!this.el);
    
    if (!this.el) {
      log.error('MenuSettingsPage', 'Cannot mount PageTopBar: this.el is null');
      return;
    }
    
    const container = this.el.querySelector('#page-top-bar-container');
    if (!container) {
      log.error('MenuSettingsPage', 'PageTopBar container not found');
      log.error('MenuSettingsPage', 'Available containers:', 
        Array.from(this.el.querySelectorAll('[id]')).map(el => el.id));
      return;
    }

    log.debug('MenuSettingsPage', 'PageTopBar container found:', container);

    // Crea PageTopBar (usa default navigation: goBack)
    this.pageTopBar = new PageTopBar({
      title: 'Settings' // Titolo di default (verrà aggiornato)
    });

    log.debug('MenuSettingsPage', 'PageTopBar instance created');

    // Monta il componente
    this.pageTopBar.mount(container);

    log.debug('MenuSettingsPage', 'PageTopBar mounted successfully');
  }

  /**
   * Aggiorna i parametri visualizzati in base al menu selezionato
   * @private
   * @param {number} menuId - ID del menu (MenuType)
   */
  _updateMenuParameters(menuId) {
    log.debug('MenuSettingsPage', `Updating parameters for menu: ${menuId}`);

    // Aggiorna titolo PageTopBar con nome menu tradotto
    if (this.pageTopBar) {
      // Imposta il menuId per l'aggiornamento automatico delle traduzioni
      this.pageTopBar.setMenuId(menuId);
      
      // Opzionale: imposta anche il titolo manualmente (setMenuId già lo fa)
      // const menuTitle = i18n.tMenu(menuId);
      // this.pageTopBar.setTitle(menuTitle);
    }

    // Ottieni configurazione del menu da Store
    const menuConfig = Store.get(Paths.CONFIG.MENU) || [];
    const currentMenu = menuConfig.find(m => m.menuId === menuId);

    if (!currentMenu || !currentMenu.params || currentMenu.params.length === 0) {
      log.warn('MenuSettingsPage', `No parameters found for menu: ${menuId}`);
      this._showEmptyState();
      return;
    }

    // Ottieni tutti i parametri da Store
    const allParams = Store.get(Paths.CONFIG.PARAMS) || [];

    log.debug('MenuSettingsPage', `currentMenu.params IDs:`, currentMenu.params);
    log.debug('MenuSettingsPage', `Total params in Store:`, allParams.length);

    // Filtra solo i parametri di questo menu (escludi PIN param)
    const menuParams = currentMenu.params
      .filter(paramId => paramId !== PIN_PARAM_ID)
      .map(paramId => {
        const found = allParams.find(p => p.id === paramId);
        if (!found) {
          log.warn('MenuSettingsPage', `Parameter with id ${paramId} not found in Store`);
        }
        return found;
      }).filter(p => p !== undefined);

    log.debug('MenuSettingsPage', `Valid params found:`, menuParams.length);
    log.debug('MenuSettingsPage', `First param:`, menuParams[0]);

    if (menuParams.length === 0) {
      log.warn('MenuSettingsPage', `No valid parameters found for menu: ${menuId}`);
      this._showEmptyState();
      return;
    }

    // Distruggi i vecchi ParameterItem
    this._destroyParameterItems();

    // Crea i nuovi ParameterItem
    this._createParameterItems(menuParams);

    log.debug('MenuSettingsPage', `Rendered ${menuParams.length} parameters for menu ${menuId}`);
  }

  /**
   * Crea e monta i ParameterItem
   * @private
   * @param {Array} params - Array di parametri
   */
  _createParameterItems(params) {
    // Verifica che this.el esista
    if (!this.el) {
      log.error('MenuSettingsPage', 'Page element not mounted yet, cannot create ParameterItems');
      return;
    }

    log.debug('MenuSettingsPage', '_createParameterItems - Looking for #parameters-container');
    log.debug('MenuSettingsPage', '_createParameterItems - this.el.innerHTML:', this.el.innerHTML.substring(0, 300));

    const container = this.el.querySelector('#parameters-container');
    if (!container) {
      log.error('MenuSettingsPage', 'Parameters container not found');
      log.error('MenuSettingsPage', 'Available IDs in DOM:', 
        Array.from(this.el.querySelectorAll('[id]')).map(el => el.id));
      return;
    }

    // Pulisci il container
    container.innerHTML = '';

    params.forEach((param, index) => {
      log.debug('MenuSettingsPage', `Creating ParameterItem ${index}:`, param);
      log.debug('MenuSettingsPage', `Param has name?`, !!param.name, 'name value:', param.name);
      
      // Crea ParameterItem
      const item = new ParameterItem(
        param,
        (p) => this._handleParameterClick(p),    // onClick
        (p, value) => this._handleParameterChange(p, value), // onChange
        (p) => this._handleInfoClick(p)          // onInfoClick
      );

      // Crea wrapper div per il mounting
      const wrapper = document.createElement('div');
      container.appendChild(wrapper);

      // Monta il componente
      item.mount(wrapper);

      // Registra ownership parent/child (lifecycle + asset bridge isolation)
      this.addChild(item);

      // Salva riferimento
      this.parameterItems.push(item);
    });

    log.debug('MenuSettingsPage', `Created ${params.length} ParameterItem components`);
  }

  /**
   * Distrugge tutti i ParameterItem
   * @private
   */
  _destroyParameterItems() {
    this.parameterItems.forEach(item => {
      if (item) {
        this.removeChild(item);
      }
    });
    this.parameterItems = [];

    log.debug('MenuSettingsPage', 'All ParameterItem destroyed');
  }

  /**
   * Distrugge tutti i componenti figli
   * @private
   */
  _destroyComponents() {
    // Distruggi PageTopBar
    if (this.pageTopBar && typeof this.pageTopBar.destroy === 'function') {
      this.pageTopBar.destroy();
      this.pageTopBar = null;
    }

    // Distruggi ParameterItem
    this._destroyParameterItems();
  }

  /**
   * Mostra stato vuoto (nessun parametro)
   * @private
   */
  _showEmptyState() {
    // Verifica che this.el esista
    if (!this.el) {
      log.error('MenuSettingsPage', 'Page element not mounted yet, cannot show empty state');
      return;
    }

    const container = this.el.querySelector('#parameters-container');
    if (!container) return;

    container.innerHTML = `
      <div class="settings-placeholder">
        <div class="placeholder-text">No parameters available</div>
      </div>
    `;

    log.debug('MenuSettingsPage', 'Showing empty state');
  }

  // ============================================
  // PRIVATE METHODS - Event Handlers
  // ============================================

  /**
   * Gestisce il click su un parametro (variante Normal)
   * @private
   * @param {Object} param - Parametro cliccato
   */
  _handleParameterClick(param) {
    log.debug('MenuSettingsPage', `Parameter clicked: ${param.name} (id: ${param.id}, type: ${param.type})`);

    // Determina la pagina di destinazione in base al tipo
    const targetPage = param.type === ParamType.TIME ? 'timerEditorPage' : 'parameterEditorPage';
    
    log.info('MenuSettingsPage', `Navigating to ${targetPage} with param:`, param);
    
    // Naviga alla pagina di editing passando il parametro
    navigateTo(targetPage, { param });
  }

  /**
   * Gestisce il cambio valore di un parametro (variante Switch)
   * @private
   * @param {Object} param - Parametro modificato
   * @param {number} newValue - Nuovo valore (0 o 1)
   */
  _handleParameterChange(param, newValue) {
    log.debug('MenuSettingsPage', `Parameter switch changed: ${param.name} = ${newValue}`);
    
    // Invia comando MODIFY via CommandManager
    CommandManager.modifyParameter(param.id, newValue);

    log.info('MenuSettingsPage', `MODIFY command sent: id=${param.id}, value=${newValue}`);
  }

  /**
   * Gestisce il click sul pulsante info
   * @private
   * @param {Object} param - Parametro di cui mostrare info
   */
  _handleInfoClick(param) {
    log.debug('MenuSettingsPage', `Info button clicked for: ${param.name}`);
    
    // Ottieni icona dal menuType del parametro
    const assetKey = getMenuTypeIcon(param.menuType);
    
    // Crea configurazione modal e passala al ModalManager
    const modalConfig = {
      label: param.name,
      ds: param.ds || 'Nessuna descrizione disponibile.',
      type: 'info',
      assetKey,
      closable: true,
      actionBtns: [], // Nessun bottone azione, solo chiusura
      paramId: param.id, // Per aggiornamento automatico traduzioni
      onClose: () => {
        log.debug('MenuSettingsPage', `Modal closed for param: ${param.name}`);
      }
    };
    
    // Passa al ModalManager che gestirà mounting, queue, lifecycle, etc.
    ModalManager.show(modalConfig);
    
    log.info('MenuSettingsPage', `Modal config sent to ModalManager for param: ${param.name}`);
  }

  /**
   * Naviga alla home page
   * @private
   */
  _navigateToHome() {
    log.debug('MenuSettingsPage', 'Back button clicked - navigating back');
    goBack();
  }
}
