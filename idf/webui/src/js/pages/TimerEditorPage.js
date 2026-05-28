/**
 * TimerEditorPage.js
 * ===================
 * Pagina di editing timer (ore, minuti, secondi).
 * 
 * Contenuto:
 * - PageTopBar con nome del parametro (o fallback "Edit Timer")
 * - InputTimer component per modifica valore
 * - Visualizzazione tempo corrente
 * - Pulsanti "Annulla" e "Conferma"
 * 
 * @author FogExtra Team
 * @version 2.0.0
 */

import { Page } from '../core/Page.js';
import { PageTopBar } from '../components/PageTopBar/PageTopBar.js';
import { InputTimer } from '../components/InputTimer/InputTimer.js';
import { goBack } from '../managers/navigatorManager.js';
import { i18n } from '../utils/i18n.js';
import { log } from '../utils/logger.js';

export class TimerEditorPage extends Page {
  /**
   * Create TimerEditorPage instance.
   */
  constructor(options = {}) {
    super({
      id: 'timerEditorPage',
      title: 'Edit Timer',
      showBackButton: true,
      ...options
    });

    // Componenti
    this.pageTopBar = null;
    this.timerInput = null;
    
    // Parametro corrente (viene impostato tramite setParameter)
    this.param = null;

    log.debug('TimerEditorPage', 'Created');
  }

  /**
   * Called when page is created.
   */
  onCreate() {
    super.onCreate();
    log.debug('TimerEditorPage', 'onCreate');
  }

  /**
   * Called after skeleton is created to mount PageTopBar.
   */
  createSkeleton() {
    const skeleton = super.createSkeleton(); // This calls renderContent()
    log.debug('TimerEditorPage', 'createSkeleton - Mounting components');
    
    // Monta il PageTopBar dopo che il DOM è stato creato
    this._mountPageTopBar();
    
    // NON montare InputTimer qui - verrà montato in onActivate dopo aver ricevuto il parametro
    
    // Ritorna l'elemento skeleton per App.js
    return skeleton;
  }

  /**
   * Called when page is mounted to DOM.
   */
  onMount() {
    super.onMount();
    log.debug('TimerEditorPage', 'onMount');
  }

  /**
   * Called when page becomes active/visible.
   * @param {Object} data - Dati passati dalla navigazione (es: { param })
   */
  onActivate(data = {}) {
    super.onActivate();
    log.debug('TimerEditorPage', 'onActivate with data:', data);
    
    // Se riceviamo un parametro dalla navigazione, impostalo
    if (data.param) {
      this.setParameter(data.param);
    }
    
    // Aggiorna il titolo con il parametro corrente (se disponibile)
    this._updateTitle();
    
    // Monta InputTimer se non è ancora montato E abbiamo un parametro
    if (!this.timerInput && this.param && this.param.id !== undefined) {
      log.debug('TimerEditorPage', 'Mounting InputTimer on activation');
      this._mountInputTimer();
    }
    
    // Attiva InputTimer
    if (this.timerInput) {
      this.timerInput.activate();
    }
  }

  /**
   * Called when page becomes inactive.
   */
  onDeactivate() {
    super.onDeactivate();
    log.debug('TimerEditorPage', 'onDeactivate');
    
    // Disattiva InputTimer
    if (this.timerInput) {
      this.timerInput.deactivate();
    }
  }

  /**
   * Called when page is destroyed.
   */
  onDestroy() {
    super.onDestroy();
    log.debug('TimerEditorPage', 'onDestroy');

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
      log.error('TimerEditorPage', 'setParameter called with null/undefined parameter');
      return;
    }
    
    log.debug('TimerEditorPage', `Parameter set: ${param.name} (id: ${param.id})`);
    
    // Aggiorna il titolo se il componente è già montato
    if (this.pageTopBar) {
      this._updateTitle();
    }
    
    // Se InputTimer è già montato, distruggilo e ricrealo con il nuovo parametro
    if (this.timerInput) {
      log.debug('TimerEditorPage', 'Remounting InputTimer with new parameter');
      this._destroyInputTimer();
      this._mountInputTimer();
    }
  }

  /**
   * Render page content.
   */
  renderContent() {
    return `
      <!-- PageTopBar Container -->
      <div id="page-top-bar-container"></div>

      <!-- Timer Editor Content -->
      <div class="timer-editor-content">
        <!-- InputTimer Container -->
        <div id="timer-input-container"></div>
      </div>
    `;
  }

  /**
   * Metodo update chiamato per aggiornare tutti i componenti figli
   */
  update() {
    log.debug('TimerEditorPage', 'update() called');

    // Aggiorna PageTopBar
    if (this.pageTopBar && typeof this.pageTopBar.update === 'function') {
      this.pageTopBar.update();
    }
    
    // Aggiorna InputTimer (se necessario)
    if (this.timerInput && typeof this.timerInput.update === 'function') {
      this.timerInput.update();
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
    log.debug('TimerEditorPage', '_mountPageTopBar called');
    
    if (!this.el) {
      log.error('TimerEditorPage', 'Cannot mount PageTopBar: this.el is null');
      return;
    }
    
    const container = this.el.querySelector('#page-top-bar-container');
    if (!container) {
      log.error('TimerEditorPage', 'PageTopBar container not found');
      return;
    }

    log.debug('TimerEditorPage', 'PageTopBar container found:', container);

    // Determina il titolo iniziale
    const title = this._getTitle();

    // Crea PageTopBar (usa default navigation: goBack)
    this.pageTopBar = new PageTopBar({
      title: title
    });

    log.debug('TimerEditorPage', 'PageTopBar instance created with title:', title);

    // Se abbiamo un parametro, abilita aggiornamento automatico traduzioni
    if (this.param && this.param.id !== undefined) {
      this.pageTopBar.enableI18n(() => {
        this._updateTitle();
      });
    }

    // Monta il componente
    this.pageTopBar.mount(container);

    log.debug('TimerEditorPage', 'PageTopBar mounted successfully');
  }

  /**
   * Monta il InputTimer
   * @private
   */
  _mountInputTimer() {
    log.debug('TimerEditorPage', '_mountInputTimer called');
    
    if (!this.el) {
      log.error('TimerEditorPage', 'Cannot mount InputTimer: this.el is null');
      return;
    }
    
    // Verifica che abbiamo un parametro
    if (!this.param || this.param.id === undefined) {
      log.warn('TimerEditorPage', 'Cannot mount InputTimer: no parameter set');
      return;
    }
    
    const container = this.el.querySelector('#timer-input-container');
    if (!container) {
      log.error('TimerEditorPage', 'InputTimer container not found');
      return;
    }

    log.debug('TimerEditorPage', `InputTimer container found, creating for param ${this.param.id}`);

    // Crea InputTimer
    this.timerInput = new InputTimer({
      paramId: this.param.id,
      onConfirm: () => {
        log.debug('TimerEditorPage', 'Timer confermato, navigazione indietro');
        goBack();
      }
    });

    log.debug('TimerEditorPage', 'InputTimer instance created');

    // Monta il componente
    this.timerInput.mount(container);

    log.debug('TimerEditorPage', 'InputTimer mounted successfully');
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
      return translated.name || i18n.t('ui.timerEditorPage');
    }
    
    // Fallback: usa traduzione hardcoded
    log.warn('TimerEditorPage', 'No parameter set, using fallback title');
    return i18n.t('ui.timerEditorPage');
  }

  /**
   * Aggiorna il titolo della PageTopBar
   * @private
   */
  _updateTitle() {
    if (!this.pageTopBar) return;
    
    const title = this._getTitle();
    this.pageTopBar.setTitle(title);
    
    log.debug('TimerEditorPage', `Title updated to: ${title}`);
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
    
    // Distruggi InputTimer
    this._destroyInputTimer();
  }
  
  /**
   * Distrugge solo InputTimer (utile per remount)
   * @private
   */
  _destroyInputTimer() {
    if (this.timerInput && typeof this.timerInput.destroy === 'function') {
      this.timerInput.destroy();
      this.timerInput = null;
    }
  }
}
