/**
 * ParameterEditorPage.js
 * =======================
 * Pagina di editing di un parametro (temperatura, umidità, etc.).
 * 
 * Contenuto:
 * - PageTopBar con nome del parametro (o fallback "Edit Parameter")
 * - InputNumber component per modifica valore
 * - Visualizzazione valore corrente
 * - Pulsanti "Default" e "Conferma"
 * 
 * @author FogExtra Team
 * @version 2.0.0
 */

import { Page } from '../core/Page.js';
import { PageTopBar } from '../components/PageTopBar/PageTopBar.js';
import { InputNumber } from '../components/InputNumber/InputNumber.js';
import { goBack } from '../managers/navigatorManager.js';
import { i18n } from '../utils/i18n.js';
import { log } from '../utils/logger.js';

export class ParameterEditorPage extends Page {
  /**
   * Create ParameterEditorPage instance.
   */
  constructor(options = {}) {
    super({
      id: 'parameterEditorPage',
      title: 'Edit Parameter',
      showBackButton: true,
      ...options
    });

    // Componenti
    this.pageTopBar = null;
    this.parameterInput = null;
    
    // Parametro corrente (viene impostato tramite setParameter)
    this.param = null;

    log.debug('ParameterEditorPage', 'Created');
  }

  /**
   * Called when page is created.
   */
  onCreate() {
    super.onCreate();
    log.debug('ParameterEditorPage', 'onCreate');
  }

  /**
   * Called after skeleton is created to mount PageTopBar.
   */
  createSkeleton() {
    const skeleton = super.createSkeleton(); // This calls renderContent()
    log.debug('ParameterEditorPage', 'createSkeleton - Mounting components');
    
    // Monta il PageTopBar dopo che il DOM è stato creato
    this._mountPageTopBar();
    
    // NON montare InputNumber qui - verrà montato in onActivate dopo aver ricevuto il parametro
    
    // Ritorna l'elemento skeleton per App.js
    return skeleton;
  }

  /**
   * Called when page is mounted to DOM.
   */
  onMount() {
    super.onMount();
    log.debug('ParameterEditorPage', 'onMount');
  }

  /**
   * Called when page becomes active/visible.
   * @param {Object} data - Dati passati dalla navigazione (es: { param })
   */
  onActivate(data = {}) {
    super.onActivate();
    log.debug('ParameterEditorPage', 'onActivate with data:', data);
    
    // Se riceviamo un parametro dalla navigazione, impostalo
    if (data.param) {
      this.setParameter(data.param);
    }
    
    // Aggiorna il titolo con il parametro corrente (se disponibile)
    this._updateTitle();
    
    // Monta InputNumber se non è ancora montato E abbiamo un parametro
    if (!this.parameterInput && this.param && this.param.id !== undefined) {
      log.debug('ParameterEditorPage', 'Mounting InputNumber on activation');
      this._mountInputNumber();
    }
    
    // Attiva InputNumber
    if (this.parameterInput) {
      this.parameterInput.activate();
    }
  }

  /**
   * Called when page becomes inactive.
   */
  onDeactivate() {
    super.onDeactivate();
    log.debug('ParameterEditorPage', 'onDeactivate');
    
    // Disattiva InputNumber
    if (this.parameterInput) {
      this.parameterInput.deactivate();
    }
  }

  /**
   * Called when page is destroyed.
   */
  onDestroy() {
    super.onDestroy();
    log.debug('ParameterEditorPage', 'onDestroy');

    // Distruggi PageTopBar
    this._destroyComponents();
  }

  /**
   * Imposta il parametro corrente per l'editor.
   * @param {Object} param - Parametro da editare
   */
  setParameter(param) {
    super.setParameter(param);
    
    if (!param) {
      log.error('ParameterEditorPage', 'setParameter called with null/undefined parameter');
      return;
    }
    
    log.debug('ParameterEditorPage', `Parameter set: ${param.name} (id: ${param.id})`);
    
    // Aggiorna il titolo se il componente è già montato
    if (this.pageTopBar) {
      this._updateTitle();
    }
    
    // Se InputNumber è già montato, distruggilo e ricrealo con il nuovo parametro
    if (this.parameterInput) {
      log.debug('ParameterEditorPage', 'Remounting InputNumber with new parameter');
      this._destroyInputNumber();
      this._mountInputNumber();
    }
  }

  /**
   * Render page content.
   */
  renderContent() {
    return `
      <!-- PageTopBar Container -->
      <div id="page-top-bar-container"></div>

      <!-- Parameter Editor Content -->
      <div class="parameter-editor-content">
        <!-- InputNumber Container -->
        <div id="parameter-input-container"></div>
      </div>
    `;
  }

  /**
   * Metodo update chiamato per aggiornare tutti i componenti figli
   */
  update() {
    log.debug('ParameterEditorPage', 'update() called');

    // Aggiorna PageTopBar
    if (this.pageTopBar && typeof this.pageTopBar.update === 'function') {
      this.pageTopBar.update();
    }
    
    // Aggiorna InputNumber (se necessario)
    if (this.parameterInput && typeof this.parameterInput.update === 'function') {
      this.parameterInput.update();
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
    log.debug('ParameterEditorPage', '_mountPageTopBar called');
    
    if (!this.el) {
      log.error('ParameterEditorPage', 'Cannot mount PageTopBar: this.el is null');
      return;
    }
    
    const container = this.el.querySelector('#page-top-bar-container');
    if (!container) {
      log.error('ParameterEditorPage', 'PageTopBar container not found');
      return;
    }

    log.debug('ParameterEditorPage', 'PageTopBar container found:', container);

    // Determina il titolo iniziale
    const title = this._getTitle();

    // Crea PageTopBar (usa default navigation: goBack)
    this.pageTopBar = new PageTopBar({
      title: title
    });

    log.debug('ParameterEditorPage', 'PageTopBar instance created with title:', title);

    // Se abbiamo un parametro, abilita aggiornamento automatico traduzioni
    if (this.param && this.param.id !== undefined) {
      this.pageTopBar.enableI18n(() => {
        this._updateTitle();
      });
    }

    // Monta il componente
    this.pageTopBar.mount(container);

    log.debug('ParameterEditorPage', 'PageTopBar mounted successfully');
  }

  /**
   * Ottiene il titolo da visualizzare (nome parametro o fallback)
   * @private
   * @returns {string} Titolo
   */
  _getTitle() {
    if (this.param && this.param.id !== undefined) {
      // Usa traduzione del parametro da ESP
      const translated = i18n.tParam(this.param.id);
      return translated.name || i18n.t('ui.parameterEditorPage');
    }
    
    // Fallback: usa traduzione hardcoded
    log.warn('ParameterEditorPage', 'No parameter set, using fallback title');
    return i18n.t('ui.parameterEditorPage');
  }

  /**
   * Aggiorna il titolo della PageTopBar
   * @private
   */
  _updateTitle() {
    if (!this.pageTopBar) return;
    
    const title = this._getTitle();
    this.pageTopBar.setTitle(title);
    
    log.debug('ParameterEditorPage', `Title updated to: ${title}`);
  }

  /**
   * Monta il InputNumber
   * @private
   */
  _mountInputNumber() {
    log.debug('ParameterEditorPage', '_mountInputNumber called');
    
    if (!this.el) {
      log.error('ParameterEditorPage', 'Cannot mount InputNumber: this.el is null');
      return;
    }
    
    // Verifica che abbiamo un parametro
    if (!this.param || this.param.id === undefined) {
      log.warn('ParameterEditorPage', 'Cannot mount InputNumber: no parameter set');
      return;
    }
    
    const container = this.el.querySelector('#parameter-input-container');
    if (!container) {
      log.error('ParameterEditorPage', 'InputNumber container not found');
      return;
    }

    log.debug('ParameterEditorPage', `InputNumber container found, creating for param ${this.param.id}`);

    // Crea InputNumber
    this.parameterInput = new InputNumber({
      paramId: this.param.id,
      onConfirm: () => {
        log.debug('ParameterEditorPage', 'Parametro confermato, navigazione indietro');
        goBack();
      }
    });

    log.debug('ParameterEditorPage', 'InputNumber instance created');

    // Monta il componente
    this.parameterInput.mount(container);

    log.debug('ParameterEditorPage', 'InputNumber mounted successfully');
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
    
    // Distruggi InputNumber
    this._destroyInputNumber();
  }
  
  /**
   * Distrugge solo InputNumber (utile per remount)
   * @private
   */
  _destroyInputNumber() {
    if (this.parameterInput && typeof this.parameterInput.destroy === 'function') {
      this.parameterInput.destroy();
      this.parameterInput = null;
    }
  }
}
