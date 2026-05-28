/**
 * WifiPage.js
 * ===========
 * Pagina per la gestione della configurazione Wi-Fi.
 * 
 * Contenuto:
 * - PageTopBar con titolo "Wi-Fi" e pulsante back
 * - MachineIdPreviewItem (Machine ID / Modbus / AP / DNS)
 * - WifiConnectionCard (current network + available networks + connect form)
 * 
 * @author FogExtra Team
 * @version 2.0.0
 */

import { Page } from '../core/Page.js';
import { log } from '../utils/logger.js';
import { Store } from '../core/store.js';
import { Paths } from '../utils/paths.js';
import { MenuType } from '../utils/menuMapping.js';
import { PageTopBar } from '../components/PageTopBar/PageTopBar.js';
import { MachineIdPreviewItem } from '../components/ParameterItem/MachineIdPreviewItem.js';
import { WifiConnectionCard } from '../components/WifiConnectionCard/WifiConnectionCard.js';
import { i18n } from '../utils/i18n.js';
import { NavigatorManager } from '../managers/navigatorManager.js';
import { CommandManager } from '../managers/commandManager.js';
import { MODBUS_DEVICE_ID_PARAM_ID } from '../utils/constants.js';
import { ModalManager } from '../managers/modalManager.js';

export class WifiPage extends Page {
  /**
   * Create WifiPage instance.
   */
  constructor(options = {}) {
    super({
      id: 'wifiPage',
      title: 'Wi-Fi',
      showBackButton: true,
      ...options
    });

    // Componenti
    this.pageTopBar = null;
    this.machineIdPreviewItem = null;
    this.wifiConnectionCard = null;

    // Container reference
    this.wifiConnectionCardContainer = null;

    log.debug('WifiPage', 'Created');
  }

  /**
   * Called when page is created.
   */
  onCreate() {
    super.onCreate();
    log.debug('WifiPage', 'onCreate');
  }

  /**
   * Called after skeleton is created to mount PageTopBar.
   */
  createSkeleton() {
    const skeleton = super.createSkeleton(); // This calls renderContent()
    log.debug('WifiPage', 'createSkeleton - Mounting components');
    
    // Monta il PageTopBar dopo che il DOM è stato creato
    this._mountPageTopBar();
    
    // Salva riferimenti ai container
    this._saveContainerReferences();
    
    // Monta MachineIdPreviewItem
    this._mountMachineIdPreviewItem();

    // Monta WifiConnectionCard
    this._mountWifiConnectionCard();
    
    // Ritorna l'elemento skeleton per App.js
    return skeleton;
  }

  /**
   * Called when page is mounted to DOM.
   */
  onMount() {
    super.onMount();
    log.debug('WifiPage', 'onMount');
  }

  /**
   * Called when page becomes active/visible.
   */
  onActivate(data = {}) {
    super.onActivate();
    log.debug('WifiPage', 'onActivate with data:', data);
    
    // Request a full Wi-Fi snapshot (state + scan list) from ESP
    CommandManager.sendWifiGetWifi();
    
    log.debug('WifiPage', 'Wi-Fi page activated - CMD_GET_WIFI sent');
  }

  /**
   * Called when page becomes inactive.
   */
  onDeactivate() {
    super.onDeactivate();
    log.debug('WifiPage', 'onDeactivate');
    
    // Store subscriptions are cleaned up automatically by Component.js
  }

  /**
   * Called when page is destroyed.
   */
  onDestroy() {
    super.onDestroy();
    this._destroyComponents();
    log.debug('WifiPage', 'onDestroy');
  }

  /**
   * Render page content.
   */
  renderContent() {
    return `
      <!-- PageTopBar Container -->
      <div id="page-top-bar-container"></div>
      
      <!-- Wi-Fi Settings Content -->
      <div class="settings-content">
        
        <!-- 1. Machine ID Preview Item (ID Macchina) -->
        <div id="wifi-machine-id-component"></div>
        
        <!-- 2. Wi-Fi Connection Card -->
        <div id="wifi-connection-card-container"></div>
        
      </div>
    `;
  }

  /**
   * Metodo update chiamato per aggiornare tutti i componenti figli
   */
  update() {
    log.debug('WifiPage', 'update');
    
    if (this.pageTopBar) {
      this.pageTopBar.update();
    }
    
    if (this.wifiConnectionCard) {
      this.wifiConnectionCard.update();
    }
  }

  // ============================================
  // PRIVATE METHODS - Component Management
  // ============================================

  /**
   * Monta il PageTopBar
   * @private
   */
  _mountPageTopBar() {
    log.debug('WifiPage', '_mountPageTopBar called');
    
    if (!this.el) {
      log.error('WifiPage', 'Cannot mount PageTopBar: this.el is null');
      return;
    }
    
    const container = this.el.querySelector('#page-top-bar-container');
    if (!container) {
      log.error('WifiPage', 'PageTopBar container not found');
      return;
    }

    log.debug('WifiPage', 'PageTopBar container found:', container);

    // Crea PageTopBar con titolo tradotto (usa default navigation: goBack)
    this.pageTopBar = new PageTopBar({
      title: i18n.t('ui.titleWifi') // Usa traduzione hardcoded
    });

    log.debug('WifiPage', 'PageTopBar instance created');

    // Abilita aggiornamento automatico traduzioni
    this.pageTopBar.enableI18n(() => {
      this.pageTopBar.setTitle(i18n.t('ui.titleWifi'));
    });

    // Monta il componente
    this.pageTopBar.mount(container);

    log.debug('WifiPage', 'PageTopBar mounted successfully');
  }

  /**
   * Monta MachineIdPreviewItem
   * @private
   */
  _mountMachineIdPreviewItem() {
    log.debug('WifiPage', '_mountMachineIdPreviewItem called');
    
    if (!this.el) {
      log.error('WifiPage', 'Element not found for MachineIdPreviewItem mounting');
      return;
    }
    
    const container = this.el.querySelector('#wifi-machine-id-component');
    if (!container) {
      log.error('WifiPage', 'Container #wifi-machine-id-component not found');
      return;
    }

    log.debug('WifiPage', 'MachineIdPreviewItem container found:', container);

    // Crea MachineIdPreviewItem con callback per navigazione a editor
    this.machineIdPreviewItem = new MachineIdPreviewItem(
      // onClick: naviga a parameterEditorPage per modificare il parametro
      (param) => {
        log.debug('WifiPage', `MachineIdPreviewItem clicked, navigating to editor for param ${param.id}`);
        NavigatorManager.navigateTo('parameterEditorPage', { param: param });
      },
      // onInfoClick: mostra info del parametro
      (param) => {
        log.debug('WifiPage', `MachineIdPreviewItem info clicked for param ${param.id}`);
        this._showMachineIdInfoModal(param);
      }
    );

    log.debug('WifiPage', 'MachineIdPreviewItem instance created');

    // 1) Monta nel placeholder dedicato
    this.machineIdPreviewItem.mount(container);

    // 2) Registra ownership parent/child (lifecycle + isolamento subtree/assets)
    this.addChild(this.machineIdPreviewItem);

    log.debug('WifiPage', 'MachineIdPreviewItem mounted as child successfully');
  }

  /**
   * Monta WifiConnectionCard
   * @private
   */
  _mountWifiConnectionCard() {
    log.debug('WifiPage', '_mountWifiConnectionCard called');

    if (!this.wifiConnectionCardContainer) {
      log.error('WifiPage', 'Container #wifi-connection-card-container not found');
      return;
    }

    this.wifiConnectionCard = new WifiConnectionCard();

    // 1) Monta nel placeholder dedicato
    this.wifiConnectionCard.mount(this.wifiConnectionCardContainer);

    // 2) Registra ownership parent/child (lifecycle + isolamento subtree/assets)
    this.addChild(this.wifiConnectionCard);

    log.debug('WifiPage', 'WifiConnectionCard mounted as child successfully');
  }

  /**
   * Salva riferimenti ai container dei componenti Wi-Fi
   * @private
   */
  _saveContainerReferences() {
    if (!this.el) return;

    this.wifiConnectionCardContainer = this.el.querySelector('#wifi-connection-card-container');

    log.debug('WifiPage', 'Container references saved');
  }

  /**
   * Mostra il modal info per Machine ID
   * @private
   * @param {Object} param - Parametro
   */
  _showMachineIdInfoModal(param) {
    log.debug('WifiPage', `Showing info modal for Machine ID`);
    
    // Usa icona ingranaggio (settings)
    const assetKey = 'icon-setting';
    
    // Crea configurazione modal
    const modalConfig = {
      label: i18n.t('machineId.title'),
      ds: i18n.t('machineId.description'),
      type: 'info',
      assetKey,
      closable: true,
      preserveFormatting: true, // Preserva newline nella descrizione
      actionBtns: [],
      // Non usiamo paramId per le traduzioni automatiche, 
      // perché usiamo traduzioni custom da i18n.t()
      onClose: () => {
        log.debug('WifiPage', 'Machine ID info modal closed');
      }
    };
    
    // Mostra il modal
    ModalManager.show(modalConfig);
    
    log.info('WifiPage', 'Machine ID info modal shown');
  }

  /**
   * Distrugge tutti i componenti figli
   * @private
   */
  _destroyComponents() {
    if (this.pageTopBar && typeof this.pageTopBar.destroy === 'function') {
      this.pageTopBar.destroy();
      this.pageTopBar = null;
    }

    if (this.machineIdPreviewItem) {
      this.removeChild(this.machineIdPreviewItem);
      this.machineIdPreviewItem = null;
    }

    if (this.wifiConnectionCard) {
      this.removeChild(this.wifiConnectionCard);
      this.wifiConnectionCard = null;
    }

    log.debug('WifiPage', 'Components destroyed');
  }
}
