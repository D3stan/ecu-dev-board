/**
 * TimeSlotRender.js
 * =================
 * Container per la lista di time slots attivi.
 * 
 * Features:
 * - Titolo tradotto automaticamente (i18n)
 * - Lista scrollabile con AddTimeSlotButton sempre in cima
 * - Sottoscrizione reattiva a Store.runtime.scheduler
 * - Sottoscrizione reattiva a cambio lingua
 * - Riempie tutto lo spazio verticale disponibile sotto il Gantt
 * 
 * Struttura:
 * - Titolo sezione
 * - Container scrollabile con:
 *   - AddTimeSlotButton (sempre primo elemento)
 *   - Time slot cards (implementate in seguito)
 * 
 * @author FogExtra Team
 * @version 1.0.0
 */

import { Component } from '../../core/Component.js';
import { Store } from '../../core/store.js';
import { Paths } from '../../utils/paths.js';
import { i18n } from '../../utils/i18n.js';
import { log } from '../../utils/logger.js';
import { AddTimeSlotButton } from '../AddTimeSlotButton/AddTimeSlotButton.js';
import { TimeSlot } from '../TimeSlot/TimeSlot.js';
import { NavigatorManager } from '../../managers/navigatorManager.js';
import { MAX_TIME_SLOTS } from '../../utils/constants.js';

export class TimeSlotRender extends Component {
  /**
   * Create TimeSlotRender instance.
   * 
   * @param {Object} options - Component configuration
   * @param {Function} options.onAddTimeSlot - Callback per aggiungere nuovo time slot
   */
  constructor(options = {}) {
    super({
      id: options.id || 'timeslot-render',
      ...options
    });

    // Callback per aggiunta time slot
    this.onAddTimeSlot = options.onAddTimeSlot || (() => {
      log.warn('TimeSlotRender', 'No onAddTimeSlot callback provided');
    });

    // Riferimenti componenti figli
    this.addButton = null;
    this.timeSlotCards = []; // Array di TimeSlot components

    // Abilita aggiornamento automatico traduzioni
    this.enableI18n(() => this._updateTitle());

    log.debug('TimeSlotRender', 'Created');
  }

  /**
   * Called when component is created.
   */
  onCreate() {
    super.onCreate();
    log.debug('TimeSlotRender', 'onCreate');
  }

  /**
   * Render component HTML.
   * 
   * @returns {HTMLElement} Component element
   */
  render() {
    const container = document.createElement('div');
    container.className = 'timeslots-list-section';

    container.innerHTML = `
      <h2 class="section-title">${i18n.t('ui.activeTimeSlots')}</h2>
      <div class="timeslot-list-container">
        <!-- AddTimeSlotButton container -->
        <div id="add-btn-container"></div>
        
        <!-- Dynamic Time Slot Cards (rendered later) -->
        <div id="timeslots-cards-container">
          <!-- Time slot cards will be rendered here -->
        </div>
      </div>
    `;

    return container;
  }

  /**
   * Called when component is mounted to DOM.
   */
  onMount() {
    super.onMount();
    
    // Monta AddTimeSlotButton
    this._mountAddButton();

    log.debug('TimeSlotRender', 'onMount - AddButton mounted');
  }

  /**
   * Called when component becomes active/visible.
   * Setup reactive subscriptions to Store.
   */
  onActivate() {
    super.onActivate();
    
    // Sottoscrizione a runtime.scheduler (lista time slots)
    this.subscribeToStore(Paths.RUNTIME.SCHEDULER, (scheduler) => {
      log.debug('TimeSlotRender', 'Scheduler updated:', scheduler);
      this._renderTimeSlots(scheduler);
      this._updateAddButtonVisibility(scheduler);
    });

    // Force initial render
    const scheduler = Store.get(Paths.RUNTIME.SCHEDULER);
    this._renderTimeSlots(scheduler);
    this._updateAddButtonVisibility(scheduler);

    log.debug('TimeSlotRender', 'onActivate - Subscriptions setup');
  }

  /**
   * Update component (called when data changes).
   */
  update() {
    // Force re-render time slots
    const scheduler = Store.get(Paths.RUNTIME.SCHEDULER);
    this._renderTimeSlots(scheduler);
    this._updateAddButtonVisibility(scheduler);
  }

  /**
   * Monta il pulsante AddTimeSlotButton.
   * 
   * @private
   */
  _mountAddButton() {
    if (!this.el) {
      log.error('TimeSlotRender', 'Cannot mount AddButton: this.el is null');
      return;
    }

    const container = this.el.querySelector('#add-btn-container');
    if (!container) {
      log.error('TimeSlotRender', 'AddButton container not found');
      return;
    }

    // Crea AddTimeSlotButton con callback per create mode
    this.addButton = new AddTimeSlotButton({
      onClick: () => {
        log.debug('TimeSlotRender', 'AddButton clicked - Navigating to create mode');
        
        // Naviga a timeSlotEditorPage in modalità CREATE
        NavigatorManager.navigateTo('timeSlotEditorPage', {
          mode: 'create'
        });
      }
    });

    // Monta il componente
    this.addButton.mount(container);

    log.debug('TimeSlotRender', 'AddButton mounted successfully');
  }

  /**
   * Renderizza i time slot cards.
   * 
   * @private
   * @param {Array} scheduler - Array di time slots da Store
   */
  _renderTimeSlots(scheduler) {
    if (!this.el) return;

    const cardsContainer = this.el.querySelector('#timeslots-cards-container');
    if (!cardsContainer) {
      log.error('TimeSlotRender', 'Cards container not found');
      return;
    }

    // Distruggi i componenti TimeSlot esistenti
    this._destroyTimeSlotCards();

    // Clear existing cards
    cardsContainer.innerHTML = '';

    // Verifica se ci sono time slots
    if (!scheduler || scheduler.length === 0) {
      // Nessun time slot, mostra messaggio
      cardsContainer.innerHTML = `
        <div class="no-timeslots-message">
          <p>${i18n.t('ui.noData')}</p>
        </div>
      `;
      log.debug('TimeSlotRender', 'No time slots to render');
      return;
    }

    // Renderizza i time slot cards (mode "calendar")
    scheduler.forEach((slot, index) => {
      // Crea container per questa card
      const cardContainer = document.createElement('div');
      cardContainer.className = 'timeslot-card-wrapper';
      cardsContainer.appendChild(cardContainer);

      // Crea TimeSlot component in mode "calendar"
      const timeSlotCard = new TimeSlot({
        id: `timeslot-card-${slot.id}`,
        type: 'calendar',
        timeSlot: slot,
        onClick: () => this._handleTimeSlotClick(slot)
      });

      // Monta il componente
      timeSlotCard.mount(cardContainer);

      // Salva riferimento
      this.timeSlotCards.push(timeSlotCard);

      log.debug('TimeSlotRender', `TimeSlot card ${index + 1} mounted - ID: ${slot.id}`);
    });

    log.debug('TimeSlotRender', `Rendered ${scheduler.length} time slot cards`);
  }

  /**
   * Gestisce il click su una TimeSlot card (naviga a editor)
   * @private
   * @param {Object} slot - Time slot cliccato
   */
  _handleTimeSlotClick(slot) {
    log.info('TimeSlotRender', `TimeSlot card clicked - ID: ${slot.id}`);
    
    // Naviga a timeSlotEditorPage in modalità MODIFY
    NavigatorManager.navigateTo('timeSlotEditorPage', {
      mode: 'modify',
      slotId: slot.id
    });
  }

  /**
   * Distrugge tutti i TimeSlot cards
   * @private
   */
  _destroyTimeSlotCards() {
    this.timeSlotCards.forEach(card => {
      if (card && typeof card.destroy === 'function') {
        card.destroy();
      }
    });

    this.timeSlotCards = [];
    log.debug('TimeSlotRender', 'All TimeSlot cards destroyed');
  }

  /**
   * Aggiorna la visibilità del pulsante Add in base al numero di time slots.
   * Nasconde il pulsante se sono presenti >= MAX_TIME_SLOTS time slots.
   * 
   * @private
   * @param {Array} scheduler - Array di time slots da Store
   */
  _updateAddButtonVisibility(scheduler) {
    if (!this.addButton) {
      log.warn('TimeSlotRender', 'AddButton non ancora creato');
      return;
    }

    const currentCount = scheduler ? scheduler.length : 0;
    const isMaxReached = currentCount >= MAX_TIME_SLOTS;

    if (isMaxReached) {
      this.addButton.hide();
      log.info('TimeSlotRender', `Limite raggiunto: ${currentCount}/${MAX_TIME_SLOTS} - AddButton nascosto`);
    } else {
      this.addButton.show();
      log.debug('TimeSlotRender', `Time slots: ${currentCount}/${MAX_TIME_SLOTS} - AddButton visibile`);
    }
  }

  /**
   * Aggiorna il titolo tradotto.
   * Chiamato automaticamente al cambio lingua (via enableI18n).
   * 
   * @private
   */
  _updateTitle() {
    if (!this.el) return;

    const titleElement = this.el.querySelector('.section-title');
    if (titleElement) {
      titleElement.textContent = i18n.t('ui.activeTimeSlots');
      log.debug('TimeSlotRender', 'Title updated to:', titleElement.textContent);
    }

    const schedulers = Store.get(Paths.RUNTIME.SCHEDULER);
    if (!schedulers || schedulers.length === 0){
      const noDataLabel = this.el.querySelector(".no-timeslots-message").querySelector("p");
      noDataLabel.innerHTML = titleElement.textContent = i18n.t('ui.noData');
    }
  }

  /**
   * Called when component is destroyed.
   */
  onDestroy() {
    // Distruggi TimeSlot cards
    this._destroyTimeSlotCards();

    // Distruggi AddButton
    if (this.addButton && typeof this.addButton.destroy === 'function') {
      this.addButton.destroy();
      this.addButton = null;
    }

    super.onDestroy();
    log.debug('TimeSlotRender', 'onDestroy');
  }
}
