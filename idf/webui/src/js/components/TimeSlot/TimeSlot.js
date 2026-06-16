/**
 * TimeSlot.js
 * ===========
 * Componente parametrico per visualizzare time slots.
 * 
 * Due modalità:
 * - "home": Vista semplificata con icona calendario, mostra slot corrente o prossimo
 * - "calendar": Vista completa con pulsante elimina, mostra slot specifico
 * 
 * Features:
 * - Reactive: si aggiorna automaticamente con scheduler, time, day, lingua
 * - Placeholder quando non ci sono scheduler (solo mode "home")
 * - Click card → callback onClick()
 * - Delete button (solo mode "calendar") → CommandManager.deleteTimeSlot()
 * 
 * @extends Component
 * @author FogExtra Team
 * @version 1.0.0
 */

import { Component } from '../../core/Component.js';
import { Store } from '../../core/store.js';
import { Paths } from '../../utils/paths.js';
import { i18n } from '../../utils/i18n.js';
import { log } from '../../utils/logger.js';
import { WeekDaysOrder, WeekDayIndex } from '../../utils/constants.js';
import { CommandManager } from '../../managers/commandManager.js';
import { findActiveSlot, findNextSlot } from './func.js';

export class TimeSlot extends Component {
  /**
   * Create TimeSlot instance.
   * 
   * @param {Object} options - Component configuration
   * @param {string} options.type - "home" | "calendar"
   * @param {Object} options.timeSlot - Time slot data (required for "calendar" mode)
   * @param {number} options.timeSlot.id - Slot ID
   * @param {string} options.timeSlot.start - Start time "HH:MM"
   * @param {string} options.timeSlot.stop - Stop time "HH:MM"
   * @param {Object} options.timeSlot.days - Days object { mon: true, tue: false, ... }
   * @param {Function} options.onClick - Callback quando la card viene cliccata
   */
  constructor(options = {}) {
    super({
      id: options.id || `timeslot-${options.type || 'home'}`,
      ...options
    });

    // Configurazione
    this.type = options.type || 'home'; // "home" | "calendar"
    this.slot = options.timeSlot || null; // Solo per mode "calendar"
    this.onClick = options.onClick || (() => {
      log.warn('[TimeSlot] No onClick callback provided');
    });

    // State locale (solo per mode "home")
    this.currentTime = null;
    this.currentDay = null;
    this.allTimeSlots = []; // Lista completa schedulers (solo per "home")
    this.displaySlot = null; // Slot da visualizzare (attivo o prossimo)

    // Listener guard: root listener must be bound only once across re-renders
    this._listenersBound = false;
    this._onRootClick = (e) => {
      // Previeni propagazione se click su delete button
      if (e.target.closest('[data-delete-btn]')) {
        return;
      }

      log.debug(`[TimeSlot] Card clicked - type: ${this.type}`);
      this.onClick();
    };

    // Abilita aggiornamento automatico traduzioni
    this.enableI18n(() => this._render());

    log.debug(`[TimeSlot] Created - type: ${this.type}`);
  }

  // ============================================
  // LIFECYCLE HOOKS
  // ============================================

  onCreate() {
    super.onCreate();
    log.debug(`[TimeSlot] onCreate - type: ${this.type}`);
  }

  onMount() {
    super.onMount();
    log.debug(`[TimeSlot] onMount - type: ${this.type}`);

    // Setup event listeners
    this._setupEventListeners();

    // Setup Store subscriptions (solo per mode "home")
    if (this.type === 'home') {
      this._setupSubscriptions();
    }
  }

  onActivate() {
    super.onActivate();
    log.debug(`[TimeSlot] onActivate - type: ${this.type}`);
  }

  onDeactivate() {
    super.onDeactivate();
    log.debug(`[TimeSlot] onDeactivate - type: ${this.type}`);
  }

  onDestroy() {
    if (this.el && this._listenersBound && this._onRootClick) {
      this.el.removeEventListener('click', this._onRootClick);
    }
    this._listenersBound = false;
    this._onRootClick = null;
    super.onDestroy();
    log.debug(`[TimeSlot] onDestroy - type: ${this.type}`);
  }

  // ============================================
  // RENDERING
  // ============================================

  /**
   * Render component HTML.
   * @returns {HTMLElement} Component element
   */
  render() {
    const container = document.createElement('div');
    container.className = `timeslot-card ${this.type}`;

    // Determina quale slot mostrare
    let slotToDisplay = null;
    let isPlaceholder = false;

    if (this.type === 'calendar') {
      // Mode "calendar": mostra lo slot passato come prop
      slotToDisplay = this.slot;
    } else {
      // Mode "home": mostra slot attivo o prossimo
      if (!this.allTimeSlots || this.allTimeSlots.length === 0) {
        // Nessun scheduler: mostra placeholder
        isPlaceholder = true;
      } else {
        // Calcola slot da mostrare
        this.displaySlot = this._calculateDisplaySlot();
        slotToDisplay = this.displaySlot ? this.displaySlot.slot : null;

        if (!slotToDisplay) {
          isPlaceholder = true;
        }
      }
    }

    // Aggiungi classe placeholder se necessario
    if (isPlaceholder) {
      container.classList.add('placeholder');
    }

    // Render HTML interno
    container.innerHTML = this._renderContent(slotToDisplay, isPlaceholder);

    return container;
  }

  /**
   * Render content HTML (interno alla card).
   * @private
   * @param {Object|null} slot - Time slot da visualizzare
   * @param {boolean} isPlaceholder - Se true, mostra placeholder
   * @returns {string} HTML content
   */
  _renderContent(slot, isPlaceholder) {
    // Icona calendario (solo mode "home")
    const calendarIcon = this.type === 'home'
      ? `<div class="timeslot-icon">
           <img data-asset-key="icon-calendar" alt="Calendar" draggable="false">
         </div>`
      : '';

    // Orari (placeholder o reali)
    const startTime = isPlaceholder ? '-- : --' : (slot ? slot.start : '-- : --');
    const stopTime = isPlaceholder ? '-- : --' : (slot ? slot.stop : '-- : --');

    // Giorni della settimana
    const daysHTML = this._renderDays(slot, isPlaceholder);

    // Pulsante delete (solo mode "calendar")
    const deleteButton = this.type === 'calendar'
      ? `<button class="timeslot-delete-btn" data-delete-btn aria-label="Delete">
           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <polyline points="3 6 5 6 21 6"></polyline>
             <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
             <line x1="10" y1="11" x2="10" y2="17"></line>
             <line x1="14" y1="11" x2="14" y2="17"></line>
           </svg>
         </button>`
      : '';

    return `
      <div class="timeslot-row">
        ${calendarIcon}
        <span class="timeslot-time-start">${startTime}</span>
        <span class="timeslot-time-end">${stopTime}</span>
        <div class="timeslot-days">
          ${daysHTML}
        </div>
        ${deleteButton}
      </div>
    `;
  }

  /**
   * Render giorni della settimana.
   * @private
   * @param {Object|null} slot - Time slot
   * @param {boolean} isPlaceholder - Se true, nessun giorno attivo
   * @returns {string} HTML giorni
   */
  _renderDays(slot, isPlaceholder) {
    return WeekDaysOrder.map((dayKey, index) => {
      const dayLabel = i18n.tDay(WeekDayIndex[dayKey]);
      const isActive = !isPlaceholder && slot && slot.days && slot.days[dayKey];

      return `<span class="day-badge ${isActive ? 'active' : ''}">${dayLabel}</span>`;
    }).join('');
  }

  /**
   * Re-render del componente (aggiorna solo il DOM interno).
   * @private
   */
  _render() {
    if (!this.el) {
      log.warn('[TimeSlot] Cannot render: element not mounted');
      return;
    }

    log.info('[TimeSlot] 🎨 Re-rendering - type:', this.type);

    // Determina quale slot mostrare
    let slotToDisplay = null;
    let isPlaceholder = false;

    if (this.type === 'calendar') {
      slotToDisplay = this.slot;
      log.debug('[TimeSlot] Calendar mode - using prop slot:', slotToDisplay);
    } else {
      log.debug('[TimeSlot] Home mode - calculating display slot...');
      log.debug('[TimeSlot] Current state:', {
        allSlotsCount: this.allTimeSlots ? this.allTimeSlots.length : 0,
        currentTime: this.currentTime,
        currentDay: this.currentDay
      });
      
      if (!this.allTimeSlots || this.allTimeSlots.length === 0) {
        log.warn('[TimeSlot] No slots available - showing placeholder');
        isPlaceholder = true;
      } else {
        this.displaySlot = this._calculateDisplaySlot();
        slotToDisplay = this.displaySlot ? this.displaySlot.slot : null;

        if (!slotToDisplay) {
          log.warn('[TimeSlot] No slot to display - showing placeholder');
          isPlaceholder = true;
        } else {
          log.info('[TimeSlot] ✅ Displaying slot:', slotToDisplay);
        }
      }
    }

    // Aggiorna classe placeholder
    if (isPlaceholder) {
      this.el.classList.add('placeholder');
    } else {
      this.el.classList.remove('placeholder');
    }

    // Aggiorna contenuto
    this.el.innerHTML = this._renderContent(slotToDisplay, isPlaceholder);

    // DOM subtree recreated: rescan deferred image bridge before rebinding events
    this.refreshDeferredImages();

    // Re-setup event listeners
    this._setupEventListeners();
    
    log.debug('[TimeSlot] Render complete');
  }

  // ============================================
  // EVENT HANDLERS
  // ============================================

  /**
   * Setup event listeners.
   * @private
   */
  _setupEventListeners() {
    if (!this.el) return;

    // Click sulla card → callback onClick (bind only once on persistent root)
    if (!this._listenersBound) {
      this.el.addEventListener('click', this._onRootClick);
      this._listenersBound = true;
    }

    // Click sul pulsante delete (solo mode "calendar")
    if (this.type === 'calendar') {
      const deleteBtn = this.el.querySelector('[data-delete-btn]');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation(); // Previeni click sulla card
          this._handleDelete();
        });
      }
    }
  }

  /**
   * Gestisce il click sul pulsante delete.
   * @private
   */
  _handleDelete() {
    
    if (!this.slot || (this.slot.id === 0 ? false : !this.slot.id)) {
      log.error('[TimeSlot] Cannot delete: slot or slot.id is missing');
      return;
    }

    log.info(`[TimeSlot] Deleting slot ID: ${this.slot.id}`);

    // Chiama CommandManager per eliminare lo slot
    CommandManager.deleteTimeSlot(this.slot.id);

    // Nota: Lo Store verrà aggiornato automaticamente dal socket adapter
    // e il componente parent (TimeSlotRender) si aggiornerà di conseguenza
  }

  // ============================================
  // STORE SUBSCRIPTIONS (solo mode "home")
  // ============================================

  /**
   * Setup Store subscriptions (solo per mode "home").
   * @private
   */
  _setupSubscriptions() {
    if (this.type !== 'home') return;

    log.debug('[TimeSlot] Setting up Store subscriptions (home mode)');
    
    // Verifica il path
    log.debug('[TimeSlot] Subscribing to path:', Paths.RUNTIME.SCHEDULER);

    // Subscribe to runtime.scheduler
    this.subscribeToStore(Paths.RUNTIME.SCHEDULER, (newSlots) => {
      log.info('[TimeSlot] 🔔 Scheduler updated! Length:', newSlots ? newSlots.length : 0, 'Data:', newSlots);
      this.allTimeSlots = newSlots || [];
      this._render();
    });

    // Subscribe to runtime.rtc.time
    this.subscribeToStore(Paths.RUNTIME.RTC.TIME, (newTime) => {
      log.debug('[TimeSlot] Time updated:', newTime);
      this.currentTime = newTime;
      this._render();
    });

    // Subscribe to runtime.rtc.day
    this.subscribeToStore(Paths.RUNTIME.RTC.DAY, (newDay) => {
      log.debug('[TimeSlot] 🗓️ Day updated - raw value:', newDay, 'type:', typeof newDay, 'isEmpty:', newDay === '');
      this.currentDay = newDay;
      this._render();
    });

    // Initial load
    const initialSlots = Store.get(Paths.RUNTIME.SCHEDULER);
    const initialTime = Store.get(Paths.RUNTIME.RTC.TIME);
    const initialDay = Store.get(Paths.RUNTIME.RTC.DAY);
    
    this.allTimeSlots = initialSlots || [];
    this.currentTime = initialTime || null;
    this.currentDay = initialDay || null;

    log.info('[TimeSlot] 📊 Initial state loaded:', {
      path: Paths.RUNTIME.SCHEDULER,
      slotsCount: this.allTimeSlots.length,
      slots: this.allTimeSlots,
      time: this.currentTime,
      day: this.currentDay
    });
    
    // Force immediate render with initial data
    if (this.allTimeSlots.length > 0) {
      log.info('[TimeSlot] ✅ Initial slots found, rendering...');
      this._render();
    } else {
      log.warn('[TimeSlot] ⚠️ No initial slots found in Store');
    }
  }

  // ============================================
  // LOGIC (solo mode "home")
  // ============================================

  /**
   * Calcola quale slot mostrare (attivo o prossimo).
   * @private
   * @returns {Object|null} { slot, dayKey } o null
   */
  _calculateDisplaySlot() {
    log.debug('[TimeSlot] _calculateDisplaySlot called');
    
    if (!this.allTimeSlots || this.allTimeSlots.length === 0) {
      log.warn('[TimeSlot] No time slots available');
      return null;
    }

    // Check robusto per currentDay: deve essere un numero valido (0-6) o una stringa non vuota
    // NOTA: 0 (Domenica) è un valore valido, quindi non possiamo usare !this.currentDay
    const isDayValid = (typeof this.currentDay === 'number' && this.currentDay >= 0 && this.currentDay <= 6) ||
                       (typeof this.currentDay === 'string' && this.currentDay.length > 0);
    
    if (!this.currentTime || !isDayValid) {
      log.warn('[TimeSlot] ⚠️ Missing time or invalid day - time:', this.currentTime, 'day:', this.currentDay, 'isDayValid:', isDayValid);
      return null;
    }

    log.debug('[TimeSlot] Calculating with:', {
      slotsCount: this.allTimeSlots.length,
      currentTime: this.currentTime,
      currentDay: this.currentDay
    });

    // 1. Cerca slot attivo
    const activeSlot = findActiveSlot(this.allTimeSlots, this.currentTime, this.currentDay);

    if (activeSlot) {
      log.info('[TimeSlot] ✅ Active slot found:', activeSlot);
      return activeSlot;
    }

    // 2. Cerca prossimo slot
    const nextSlot = findNextSlot(this.allTimeSlots, this.currentTime, this.currentDay);

    if (nextSlot) {
      log.info('[TimeSlot] ⏭️ Next slot found:', nextSlot);
      return nextSlot;
    }

    // Nessun slot trovato
    log.warn('[TimeSlot] ⚠️ No active or next slot found');
    return null;
  }

  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Aggiorna il time slot (solo per mode "calendar").
   * @param {Object} newSlot - Nuovo time slot
   */
  setTimeSlot(newSlot) {
    if (this.type !== 'calendar') {
      log.warn('[TimeSlot] setTimeSlot() can only be used in "calendar" mode');
      return;
    }

    this.slot = newSlot;
    this._render();
  }

  /**
   * Forza un refresh del componente.
   */
  refresh() {
    log.debug('[TimeSlot] Manual refresh');
    this._render();
  }
}

export default TimeSlot;
