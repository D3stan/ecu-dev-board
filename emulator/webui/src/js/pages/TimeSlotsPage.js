/**
 * TimeSlotsPage.js
 * =================
 * Pagina di gestione time slots (fasce orarie programmabili).
 * 
 * Contenuto:
 * - PageTopBar con titolo "Scheduler" e pulsante back
 * - Gantt chart settimanale (visualizzazione grafica fasce orarie)
 * - Lista time slots con pulsanti modifica/elimina
 * - Pulsante "Aggiungi nuovo time slot"
 * 
 * @author FogExtra Team
 * @version 2.0.0
 */

import { Page } from '../core/Page.js';
import { PageTopBar } from '../components/PageTopBar/PageTopBar.js';
import { GanttChart } from '../components/GanttChart/GanttChart.js';
import { TimeSlotRender } from '../components/TimeSlotRender/TimeSlotRender.js';
import { i18n } from '../utils/i18n.js';
import { log } from '../utils/logger.js';
import { NavigatorManager } from '../managers/navigatorManager.js';

export class TimeSlotsPage extends Page {
  /**
   * Create TimeSlotsPage instance.
   */
  constructor(options = {}) {
    super({
      id: 'timeSlotsPage',
      title: 'Scheduler',
      showBackButton: true,
      ...options
    });

    // Componenti
    this.pageTopBar = null;
    this.ganttChart = null;
    this.timeSlotRender = null;

    log.debug('TimeSlotsPage', 'Created');
  }

  /**
   * Called when page is created.
   */
  onCreate() {
    super.onCreate();
    log.debug('TimeSlotsPage', 'onCreate');
  }

  /**
   * Called after skeleton is created to mount components.
   */
  createSkeleton() {
    const skeleton = super.createSkeleton(); // This calls renderContent()
    log.debug('TimeSlotsPage', 'createSkeleton - Mounting components');
    
    // Monta il PageTopBar dopo che il DOM è stato creato
    this._mountPageTopBar();
    
    // Monta il GanttChart
    this._mountGanttChart();
    
    // Monta il TimeSlotRender
    this._mountTimeSlotRender();
    
    // Ritorna l'elemento skeleton per App.js
    return skeleton;
  }

  /**
   * Called when page is mounted to DOM.
   */
  onMount() {
    super.onMount();
    log.debug('TimeSlotsPage', 'onMount');
  }

  /**
   * Called when page becomes active/visible.
   */
  onActivate() {
    super.onActivate();
    log.debug('TimeSlotsPage', 'onActivate');
  }

  /**
   * Called when page becomes inactive.
   */
  onDeactivate() {
    super.onDeactivate();
    log.debug('TimeSlotsPage', 'onDeactivate');
  }

  /**
   * Called when page is destroyed.
   */
  onDestroy() {
    super.onDestroy();
    log.debug('TimeSlotsPage', 'onDestroy');

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

      <!-- Gantt Chart Container -->
      <div id="gantt-chart-container"></div>

      <!-- TimeSlots List Container -->
      <div id="timeslot-render-container"></div>
    `;
  }

  /**
   * Metodo update chiamato per aggiornare tutti i componenti figli
   */
  update() {
    log.debug('TimeSlotsPage', 'update() called');

    // Aggiorna PageTopBar
    if (this.pageTopBar && typeof this.pageTopBar.update === 'function') {
      this.pageTopBar.update();
    }

    // Aggiorna GanttChart
    if (this.ganttChart && typeof this.ganttChart.refresh === 'function') {
      this.ganttChart.refresh();
    }

    // Aggiorna TimeSlotRender
    if (this.timeSlotRender && typeof this.timeSlotRender.update === 'function') {
      this.timeSlotRender.update();
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
    log.debug('TimeSlotsPage', '_mountPageTopBar called');
    
    if (!this.el) {
      log.error('TimeSlotsPage', 'Cannot mount PageTopBar: this.el is null');
      return;
    }
    
    const container = this.el.querySelector('#page-top-bar-container');
    if (!container) {
      log.error('TimeSlotsPage', 'PageTopBar container not found');
      return;
    }

    log.debug('TimeSlotsPage', 'PageTopBar container found:', container);

    // Crea PageTopBar con titolo tradotto (usa default navigation: goBack)
    this.pageTopBar = new PageTopBar({
      title: i18n.t('ui.titleScheduler') // Usa traduzione hardcoded
    });

    log.debug('TimeSlotsPage', 'PageTopBar instance created');

    // Abilita aggiornamento automatico traduzioni
    this.pageTopBar.enableI18n(() => {
      this.pageTopBar.setTitle(i18n.t('ui.titleScheduler'));
    });

    // Monta il componente
    this.pageTopBar.mount(container);

    log.debug('TimeSlotsPage', 'PageTopBar mounted successfully');
  }

  /**
   * Monta il GanttChart
   * @private
   */
  _mountGanttChart() {
    log.debug('TimeSlotsPage', '_mountGanttChart called');
    
    if (!this.el) {
      log.error('TimeSlotsPage', 'Cannot mount GanttChart: this.el is null');
      return;
    }
    
    const container = this.el.querySelector('#gantt-chart-container');
    if (!container) {
      log.error('TimeSlotsPage', 'GanttChart container not found');
      return;
    }

    log.debug('TimeSlotsPage', 'GanttChart container found:', container);

    // Crea GanttChart con callback per click su slot
    this.ganttChart = new GanttChart({
      onSlotClick: (slot, dayKey) => this._handleSlotClick(slot, dayKey)
    });

    log.debug('TimeSlotsPage', 'GanttChart instance created');

    // Monta il componente
    this.ganttChart.mount(container);

    // Attiva il componente (setup reactive subscriptions)
    this.ganttChart.activate();

    log.debug('TimeSlotsPage', 'GanttChart mounted and activated successfully');
  }

  /**
   * Gestisce il click su uno slot del Gantt
   * @private
   * @param {Object} slot - Time slot cliccato
   * @param {string} dayKey - Giorno della settimana (es: "mon")
   */
  _handleSlotClick(slot, dayKey) {
    log.info('TimeSlotsPage', `Gantt slot clicked:`, { slot, dayKey });
    
    // TODO: Naviga a timeSlotEditorPage passando lo slot
    // navigateTo('timeSlotEditorPage', { slot, dayKey });
    
    // Per ora logga solo
    log.debug('TimeSlotsPage', `Slot ID: ${slot.id}, Day: ${dayKey}, Time: ${slot.start} - ${slot.stop}`);
  }

  /**
   * Gestisce il click sul pulsante "Aggiungi Time Slot"
   * @private
   */
  _handleAddTimeSlot() {
    log.info('TimeSlotsPage', 'Add Time Slot button clicked');
    
    // Naviga a timeSlotEditorPage in modalità creazione
    NavigatorManager.navigateTo('timeSlotEditorPage', { mode: 'create' });
  }

  /**
   * Monta il TimeSlotRender
   * @private
   */
  _mountTimeSlotRender() {
    log.debug('TimeSlotsPage', '_mountTimeSlotRender called');
    
    if (!this.el) {
      log.error('TimeSlotsPage', 'Cannot mount TimeSlotRender: this.el is null');
      return;
    }
    
    const container = this.el.querySelector('#timeslot-render-container');
    if (!container) {
      log.error('TimeSlotsPage', 'TimeSlotRender container not found');
      return;
    }

    log.debug('TimeSlotsPage', 'TimeSlotRender container found:', container);

    // Crea TimeSlotRender con callback per aggiunta time slot
    this.timeSlotRender = new TimeSlotRender({
      onAddTimeSlot: () => this._handleAddTimeSlot()
    });

    log.debug('TimeSlotsPage', 'TimeSlotRender instance created');

    // Monta il componente
    this.timeSlotRender.mount(container);

    // Attiva il componente (setup reactive subscriptions)
    this.timeSlotRender.activate();

    log.debug('TimeSlotsPage', 'TimeSlotRender mounted and activated successfully');
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

    // Distruggi GanttChart
    if (this.ganttChart && typeof this.ganttChart.destroy === 'function') {
      this.ganttChart.destroy();
      this.ganttChart = null;
    }

    // Distruggi TimeSlotRender
    if (this.timeSlotRender && typeof this.timeSlotRender.destroy === 'function') {
      this.timeSlotRender.destroy();
      this.timeSlotRender = null;
    }
  }
}
