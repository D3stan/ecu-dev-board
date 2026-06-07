/**
 * TimeSlotEditorPage.js
 * ======================
 * Pagina di editing di un singolo time slot.
 * 
 * Contenuto:
 * - PageTopBar con titolo "Scheduler Setting" e pulsante back
 * - TimeSlotGauge component per selezionare ora inizio/fine e giorni
 * - Submit automatico via CommandManager
 * 
 * Modalità:
 * - create: Crea nuovo time slot (default: 12:30-18:30, Nessun giorno selezionato)
 * - modify: Modifica time slot esistente (carica dati da Store)
 * 
 * @author FogExtra Team
 * @version 2.0.0
 */

import { Page } from '../core/Page.js';
import { PageTopBar } from '../components/PageTopBar/PageTopBar.js';
import { TimeSlotGauge } from '../components/TimeSlotGauge/TimeSlotGauge.js';
import { modifyTimeSlot } from '../managers/commandManager.js';
import { NavigatorManager } from '../managers/navigatorManager.js';
import { Store } from '../core/store.js';
import { Paths } from '../utils/paths.js';
import { i18n } from '../utils/i18n.js';
import { log } from '../utils/logger.js';
import { WeekDayIndex } from '../utils/constants.js';

export class TimeSlotEditorPage extends Page {
  /**
   * Create TimeSlotEditorPage instance.
   * 
   * @param {Object} options - Page configuration
   * @param {string} options.mode - 'create' | 'modify'
   * @param {number} options.slotId - ID dello slot da modificare (solo per mode='modify')
   */
  constructor(options = {}) {
    super({
      id: 'timeSlotEditorPage',
      title: 'Scheduler Setting',
      showBackButton: true,
      ...options
    });

    // Configurazione modalità
    this.mode = options.mode || 'create'; // 'create' | 'modify'
    this.slotId = options.slotId || null; // Solo per mode='modify'

    // Componenti
    this.pageTopBar = null;
    this.timeSlotGauge = null;

    // Abilita aggiornamento automatico traduzioni (usa Component.js enableI18n)
    this.enableI18n(() => {
      this._updateAllTranslations();
    });

    log.debug('TimeSlotEditorPage', `Created - mode: ${this.mode}, slotId: ${this.slotId}`);
  }

  /**
   * Called when page is created.
   */
  onCreate() {
    super.onCreate();
    log.debug('TimeSlotEditorPage', 'onCreate');
  }

  /**
   * Called after skeleton is created to mount components.
   */
  createSkeleton() {
    const skeleton = super.createSkeleton(); // This calls renderContent()
    log.debug('TimeSlotEditorPage', 'createSkeleton - Mounting components');
    
    // Monta il PageTopBar
    this._mountPageTopBar();
    
    // Monta il TimeSlotGauge
    this._mountTimeSlotGauge();
    
    // Ritorna l'elemento skeleton per App.js
    return skeleton;
  }

  /**
   * Called when page is mounted to DOM.
   */
  onMount() {
    super.onMount();
    log.debug('TimeSlotEditorPage', 'onMount');
  }

  /**
   * Called when page becomes active/visible.
   * Riceve i dati da NavigatorManager (mode e slotId)
   */
  onActivate(data = {}) {
    super.onActivate();
    log.debug('TimeSlotEditorPage', 'onActivate with data:', data);

    // Aggiorna mode e slotId se passati da NavigatorManager
    if (data.mode) {
      this.mode = data.mode;
      log.debug('TimeSlotEditorPage', `Mode updated to: ${this.mode}`);
    }

    if (data.slotId !== undefined) {
      this.slotId = data.slotId;
      log.debug('TimeSlotEditorPage', `SlotId updated to: ${this.slotId}`);
    }

    // Se il gauge è già montato, aggiorna i suoi dati E la modalità
    if (this.timeSlotGauge) {
      // 1. Aggiorna la modalità (cambia label create/modify)
      this.timeSlotGauge.setMode(this.mode);
      
      // 2. Carica i dati dello slot (con ID se mode='modify')
      const initial = this._getInitialValues();
      this.timeSlotGauge.setState(initial);
      
      log.debug('TimeSlotEditorPage', `TimeSlotGauge updated - mode: ${this.mode}, id: ${initial.id || 'null'}`);
    }
  }

  /**
   * Called when page becomes inactive.
   */
  onDeactivate() {
    super.onDeactivate();
    log.debug('TimeSlotEditorPage', 'onDeactivate');
  }

  /**
   * Called when page is destroyed.
   */
  onDestroy() {
    super.onDestroy();
    log.debug('TimeSlotEditorPage', 'onDestroy');

    // Distruggi PageTopBar
    this._destroyComponents();
  }

  /**
   * Render page content.
   */
  renderContent() {
    return `
      <!-- PageTopBar Container -->
      <div id="page-top-bar-container"></div>

      <!-- TimeSlot Gauge Container -->
      <div id="timeslot-gauge-container"></div>
    `;
  }

  /**
   * Metodo update chiamato per aggiornare tutti i componenti figli
   */
  update() {
    log.debug('TimeSlotEditorPage', 'update() called');

    // Aggiorna PageTopBar
    if (this.pageTopBar && typeof this.pageTopBar.update === 'function') {
      this.pageTopBar.update();
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
    log.debug('TimeSlotEditorPage', '_mountPageTopBar called');
    
    if (!this.el) {
      log.error('TimeSlotEditorPage', 'Cannot mount PageTopBar: this.el is null');
      return;
    }
    
    const container = this.el.querySelector('#page-top-bar-container');
    if (!container) {
      log.error('TimeSlotEditorPage', 'PageTopBar container not found');
      return;
    }

    log.debug('TimeSlotEditorPage', 'PageTopBar container found:', container);

    // Crea PageTopBar con titolo tradotto (usa default navigation: goBack)
    this.pageTopBar = new PageTopBar({
      title: i18n.t('ui.titleSchedulerSetting')
    });

    log.debug('TimeSlotEditorPage', 'PageTopBar instance created');

    // PageTopBar ha già il suo enableI18n() interno, non serve aggiungerlo qui

    // Monta il componente
    this.pageTopBar.mount(container);

    log.debug('TimeSlotEditorPage', 'PageTopBar mounted successfully');
  }

  /**
   * Monta il TimeSlotGauge component
   * @private
   */
  _mountTimeSlotGauge() {
    log.debug('TimeSlotEditorPage', '_mountTimeSlotGauge called');
    
    if (!this.el) {
      log.error('TimeSlotEditorPage', 'Cannot mount TimeSlotGauge: this.el is null');
      return;
    }
    
    const container = this.el.querySelector('#timeslot-gauge-container');
    if (!container) {
      log.error('TimeSlotEditorPage', 'TimeSlotGauge container not found');
      return;
    }

    log.debug('TimeSlotEditorPage', 'TimeSlotGauge container found:', container);

    // Determina valori iniziali in base alla modalità
    const initial = this._getInitialValues();

    // Crea TimeSlotGauge (ora estende Component.js!)
    this.timeSlotGauge = new TimeSlotGauge({
      getWeekdayLetter: this._getWeekdayLetter.bind(this),
      mode: this.mode,
      snapMinutes: 15,
      initial,
      
      onSubmit: (payload) => {
        log.info('TimeSlotEditorPage', 'TimeSlot submitted:', payload);
        
        // Invia comando a ESP32
        modifyTimeSlot(payload);
        
        // Torna alla pagina Scheduler
        this._navigateBack();
      }
    });

    // Monta usando Component lifecycle
    this.timeSlotGauge.mount(container);
    
    // Bind events (nuovo lifecycle pattern)
    this.timeSlotGauge.bindEvents();
    
    // Activate (setup Store bindings se necessario)
    this.timeSlotGauge.activate();

    log.debug('TimeSlotEditorPage', 'TimeSlotGauge mounted successfully');
  }

  /**
   * Ottiene i valori iniziali per il gauge in base alla modalità
   * @private
   * @returns {Object} Initial values
   */
  _getInitialValues() {
    if (this.mode === 'modify' && this.slotId !== null) {
      // Carica slot esistente da Store
      const slots = Store.get(Paths.RUNTIME.SCHEDULER) || [];
      const slot = slots.find(s => s.id === this.slotId);
      
      if (slot) {
        log.debug('TimeSlotEditorPage', 'Loaded existing slot:', slot);
        return {
          id: slot.id,
          start: slot.start,
          stop: slot.stop,
          days: { ...slot.days }
        };
      } else {
        log.warn('TimeSlotEditorPage', `Slot ID ${this.slotId} not found in Store`);
      }
    }
    
    // Default per mode='create' o se slot non trovato
    log.debug('TimeSlotEditorPage', 'Using default values (create mode)');

    const start = new Date(Date.now() + 15 * 60000 - (Date.now() % (15 * 60000)));
    return {
      start: start.toTimeString().slice(0,5),
      stop: new Date(start.getTime() + 90 * 60000).toTimeString().slice(0,5),
      days: {
        mon: false,
        tue: false,
        wed: false,
        thu: false,
        fri: false,  
        sat: false,  
        sun: false   
      }
    };
  }

  /**
   * Crea un adapter per i18n compatibile con TimeSlotGauge
   * @private
   * @returns {Object} i18n adapter
   * 
   * DEPRECATED: Non più necessario dopo refactoring di TimeSlotGauge
   */
  _createI18nAdapter() {
    // Mantenuto per compatibilità ma non più usato
    return {
      t: (key) => i18n.t(key),
      subscribe: (callback) => i18n.onLanguageChange(callback),
      unsubscribe: (unsubscribeFn) => {
        if (typeof unsubscribeFn === 'function') {
          unsubscribeFn();
        }
      }
    };
  }

  /**
   * Ottiene la lettera localizzata per un giorno della settimana
   * @private
   * @param {string} dayKey - Chiave giorno ('mon', 'tue', ...)
   * @returns {string} Lettera singola localizzata
   */
  _getWeekdayLetter(dayKey) {
    // WeekDayIndex: { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 }
    const dayIndex = WeekDayIndex[dayKey];
    
    if (dayIndex === undefined) {
      log.warn('TimeSlotEditorPage', `Unknown day key: ${dayKey}`);
      return dayKey.charAt(0).toUpperCase();
    }
    
    // i18n.tDay ritorna il nome completo del giorno
    const fullDayName = i18n.tDay(dayIndex);
    
    // Prendi la prima lettera (maiuscola)
    return fullDayName.charAt(0).toUpperCase();
  }

  /**
   * Naviga indietro alla pagina precedente
   * @private
   */
  _navigateBack() {
    log.debug('TimeSlotEditorPage', 'Navigating back');
    
    // Usa NavigatorManager per tornare indietro
    NavigatorManager.goBack();
  }

  /**
   * Aggiorna tutte le traduzioni quando cambia lingua.
   * Chiamato automaticamente da Component.js enableI18n().
   * @private
   */
  _updateAllTranslations() {
    log.debug('TimeSlotEditorPage', '_updateAllTranslations called');

    // Aggiorna PageTopBar (ha il suo enableI18n interno)
    if (this.pageTopBar && typeof this.pageTopBar.setTitle === 'function') {
      this.pageTopBar.setTitle(i18n.t('ui.titleSchedulerSetting'));
    }

    // TimeSlotGauge ora gestisce le sue traduzioni automaticamente tramite Component.enableI18n()
    // Non serve più chiamare updateTranslations() manualmente!
    log.debug('TimeSlotEditorPage', 'TimeSlotGauge translations managed automatically by Component.enableI18n()');
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
    
    // Distruggi TimeSlotGauge
    if (this.timeSlotGauge && typeof this.timeSlotGauge.destroy === 'function') {
      this.timeSlotGauge.destroy();
      this.timeSlotGauge = null;
    }
  }
}
