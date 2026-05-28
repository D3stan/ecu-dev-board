/**
 * GanttChart.js
 * =============
 * Componente per visualizzare il grafico Gantt settimanale delle fasce orarie.
 * 
 * Features:
 * - 3 slides orizzontali (00-07, 08-15, 16-23)
 * - Touch swipe navigation
 * - Merge visivo degli slot sovrapposti
 * - Highlight giorno corrente e slot attivo
 * - Formattazione intelligente delle etichette
 * - Reactive: aggiorna automaticamente al cambio di scheduler, time, day, lingua
 * 
 * @extends Component
 */

import { Component } from '../../core/Component.js';
import { Store } from '../../core/store.js';
import { Paths } from '../../utils/paths.js';
import { i18n } from '../../utils/i18n.js';
import { log } from '../../utils/logger.js';
import { WeekDaysOrder, WeekDayIndex } from '../../utils/constants.js';

export class GanttChart extends Component {
  /**
   * Create GanttChart instance.
   * @param {Object} options - Component configuration
   * @param {Function} options.onSlotClick - Callback quando si clicca su uno slot (slot) => {}
   */
  constructor(options = {}) {
    super({
      id: 'gantt-chart',
      ...options
    });

    // Configurazione
    this.onSlotClick = options.onSlotClick || null;

    // Slides configuration (time ranges in minutes)
    this.slides = [
      { start: 0, end: 480, label: '00-07' },     // 00:00 - 07:59 (480min)
      { start: 480, end: 960, label: '08-15' },   // 08:00 - 15:59 (480min)
      { start: 960, end: 1440, label: '16-23' }   // 16:00 - 23:59 (480min)
    ];

    // State locale
    this.currentSlide = 0; // Indice slide corrente
    this.timeSlots = []; // Array di timeSlots dallo Store
    this.currentTime = null; // Tempo corrente "HH:MM"
    this.currentDay = null; // Giorno corrente "mon", "tue", ...

    // Touch/swipe tracking
    this.touchStartX = 0;
    this.touchEndX = 0;
    this.swipeThreshold = 50; // Minimum distance for swipe

    // DOM references
    this.carouselInner = null;
    this.dots = [];

    log.debug('[GanttChart] Component created');
  }

  // ============================================
  // LIFECYCLE HOOKS
  // ============================================

  onCreate() {
    log.debug('[GanttChart onCreate] Called');
  }

  onMount() {
    log.debug('[GanttChart onMount] Gantt mounted');

    // Setup Store subscriptions (reactive data)
    this._setupSubscriptions();

    // Setup swipe navigation
    this._setupSwipeNavigation();

    // Setup dot navigation
    this._setupDotNavigation();

    // Setup i18n for automatic translation updates
    this.enableI18n(() => this._render());
  }

  onActivate() {
    log.debug('[GanttChart onActivate] Called');
  }

  onDeactivate() {
    log.debug('[GanttChart onDeactivate] Called');
  }

  onDestroy() {
    log.debug('[GanttChart onDestroy] Cleanup');
    // Cleanup automatico tramite Component base class
  }

  // ============================================
  // RENDER
  // ============================================

  /**
   * Render method called by Component.mount()
   * @returns {string} HTML string
   */
  render() {
    return `
      <div class="gantt-section">
        <div class="gantt-carousel">
          <div class="gantt-carousel-inner" id="gantt-carousel-inner">
            ${this._renderSlides()}
          </div>
        </div>
        <div class="carousel-dots gantt-dots">
          ${this._renderDots()}
        </div>
      </div>
    `;
  }

  /**
   * Re-render del componente (aggiorna solo il DOM interno)
   * @private
   */
  _render() {
    if (!this.el) return;

    log.debug('[GanttChart] Re-rendering component');

    // Aggiorna slides
    const carouselInner = this.el.querySelector('#gantt-carousel-inner');
    if (carouselInner) {
      carouselInner.innerHTML = this._renderSlides();
    }

    // Aggiorna dots (per lingua)
    const dotsContainer = this.el.querySelector('.gantt-dots');
    if (dotsContainer) {
      dotsContainer.innerHTML = this._renderDots();
      this._setupDotNavigation(); // Re-bind events
    }

    // Re-applica posizione carousel
    this._updateCarouselPosition();

    // Re-setup click handlers sulle barre
    this._setupBarClickHandlers();
  }

  /**
   * Render delle 3 slides
   * @private
   * @returns {string} HTML
   */
  _renderSlides() {
    return this.slides.map((slide, index) => {
      return `
        <div class="gantt-slide" data-slide="${index}" data-range="${slide.label}">
          ${this._renderSlide(slide)}
        </div>
      `;
    }).join('');
  }

  /**
   * Render di una singola slide
   * @private
   * @param {Object} slide - Configurazione slide
   * @returns {string} HTML
   */
  _renderSlide(slide) {
    return `
      <div class="gantt-container">
        <!-- Header: time axis -->
        <div class="gantt-header">
          <div class="gantt-day-label"></div>
          <div class="gantt-time-axis">
            ${this._renderTimeMarkers(slide)}
          </div>
        </div>

        <!-- Body: days and bars -->
        <div class="gantt-body">
          ${this._renderDays(slide)}
        </div>
      </div>
    `;
  }

  /**
   * Render dei time markers (asse temporale)
   * @private
   * @param {Object} slide - Configurazione slide
   * @returns {string} HTML
   */
  _renderTimeMarkers(slide) {
    const startHour = Math.floor(slide.start / 60);
    const markers = [];

    // 8 markers (ogni ora)
    for (let i = 0; i < 8; i++) {
      const hour = startHour + i;
      markers.push(`<div class="time-marker">${String(hour).padStart(2, '0')}</div>`);
    }

    return markers.join('');
  }

  /**
   * Render delle 7 righe (giorni della settimana)
   * @private
   * @param {Object} slide - Configurazione slide
   * @returns {string} HTML
   */
  _renderDays(slide) {
    return WeekDaysOrder.map((dayKey, dayIndex) => {
      const dayLabel = i18n.tDay(WeekDayIndex[dayKey]);
      const isCurrentDay = this.currentDay === dayKey;

      return `
        <div class="gantt-row" data-day="${dayKey}">
          <div class="gantt-day-label ${isCurrentDay ? 'current-day' : ''}">
            ${dayLabel}
          </div>
          <div class="gantt-timeline">
            ${this._renderBarsForDay(dayKey, slide)}
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Render delle barre per un giorno specifico
   * @private
   * @param {string} dayKey - Chiave giorno (es: "mon")
   * @param {Object} slide - Configurazione slide
   * @returns {string} HTML
   */
  _renderBarsForDay(dayKey, slide) {
    // Ottieni gli slot per questo giorno
    const daySlots = this._getSlotsForDay(dayKey);

    if (daySlots.length === 0) {
      return ''; // Nessuno slot per questo giorno
    }

    // Merge degli slot sovrapposti (solo visivamente)
    const mergedSlots = this._mergeOverlappingSlots(daySlots);

    // Filtra solo gli slot che cadono in questa slide
    const visibleSlots = mergedSlots.filter(slot => {
      return slot.stopMin > slide.start && slot.startMin < slide.end;
    });

    // Render delle barre
    return visibleSlots.map(slot => {
      // Calcola parte visibile in questa slide
      const visibleStart = Math.max(slot.startMin, slide.start);
      const visibleStop = Math.min(slot.stopMin, slide.end);

      // Posizione e larghezza in percentuale
      const left = ((visibleStart - slide.start) / 480) * 100;
      const width = ((visibleStop - visibleStart) / 480) * 100;

      // Formatta label
      const label = this._formatBarLabel(slot, slide, visibleStart, visibleStop);

      // Check se è lo slot attivo
      const isActive = this._isSlotActive(slot, dayKey);

      // Slot ID per click handler
      const slotId = slot.originalSlots[0].id; // Usa il primo slot originale

      return `
        <div 
          class="gantt-bar ${isActive ? 'active' : ''}" 
          style="left: ${left}%; width: ${width}%;"
          data-slot-id="${slotId}"
          data-day="${dayKey}"
        >
          <span class="bar-time">${label}</span>
        </div>
      `;
    }).join('');
  }

  /**
   * Render dei dots di navigazione
   * @private
   * @returns {string} HTML
   */
  _renderDots() {
    return this.slides.map((slide, index) => {
      const isActive = index === this.currentSlide;
      return `<div class="gantt-dot ${isActive ? 'active' : ''}" data-slide="${index}"></div>`;
    }).join('');
  }

  // ============================================
  // DATA PROCESSING
  // ============================================

  /**
   * Ottiene gli slot per un giorno specifico
   * @private
   * @param {string} dayKey - Chiave giorno (es: "mon")
   * @returns {Array} Array di slot con startMin e stopMin
   */
  _getSlotsForDay(dayKey) {
    return this.timeSlots
      .filter(slot => slot.days && slot.days[dayKey])
      .map(slot => ({
        ...slot,
        startMin: this._timeToMinutes(slot.start),
        stopMin: this._timeToMinutes(slot.stop)
      }));
  }

  /**
   * Merge degli slot sovrapposti (solo visivamente)
   * @private
   * @param {Array} slots - Array di slot
   * @returns {Array} Array di slot merged
   */
  _mergeOverlappingSlots(slots) {
    if (slots.length === 0) return [];

    // Ordina per startMin
    const sorted = [...slots].sort((a, b) => a.startMin - b.startMin);

    const merged = [];
    let current = {
      startMin: sorted[0].startMin,
      stopMin: sorted[0].stopMin,
      originalSlots: [sorted[0]] // Traccia gli slot originali
    };

    for (let i = 1; i < sorted.length; i++) {
      const slot = sorted[i];

      if (slot.startMin <= current.stopMin) {
        // Overlap: estendi current
        current.stopMin = Math.max(current.stopMin, slot.stopMin);
        current.originalSlots.push(slot);
      } else {
        // No overlap: push current e inizia nuovo
        merged.push(current);
        current = {
          startMin: slot.startMin,
          stopMin: slot.stopMin,
          originalSlots: [slot]
        };
      }
    }

    // Push ultimo
    merged.push(current);

    return merged;
  }

  /**
   * Formatta l'etichetta di una barra
   * @private
   * @param {Object} slot - Slot merged
   * @param {Object} slide - Configurazione slide
   * @param {number} visibleStart - Inizio parte visibile (minuti)
   * @param {number} visibleStop - Fine parte visibile (minuti)
   * @returns {string} Label formattata
   */
  _formatBarLabel(slot, slide, visibleStart, visibleStop) {
    const totalDuration = slot.stopMin - slot.startMin;
    const visibleDuration = visibleStop - visibleStart;

    // Caso 1: Slot completamente dentro questa slide
    if (slot.startMin >= slide.start && slot.stopMin <= slide.end) {
      if (totalDuration < 45) {
        // < 45min → "30m"
        return `${totalDuration}m`;
      } else if (totalDuration >= 45 && totalDuration < 90) {
        // 45-90min → "09:00" (solo start)
        return this._minutesToTime(slot.startMin);
      } else {
        // ≥ 90min → "09:00 - 10:15"
        return `${this._minutesToTime(slot.startMin)} - ${this._minutesToTime(slot.stopMin)}`;
      }
    }

    // Caso 2: Slot a cavallo di due slides
    // Calcola quanta parte dello slot è in questa slide
    const durationInThisSlide = visibleStop - visibleStart;

    if (durationInThisSlide < 45) {
      // < 45min → mostra durata totale
      return `${totalDuration}m`;
    } else if (durationInThisSlide >= 45 && durationInThisSlide < 90) {
      // 45-90min → mostra solo orario (start o stop)
      if (slot.startMin >= slide.start) {
        // Start è in questa slide
        return this._minutesToTime(slot.startMin);
      } else {
        // Stop è in questa slide
        return this._minutesToTime(slot.stopMin);
      }
    } else {
      // ≥ 90min → mostra start - stop
      return `${this._minutesToTime(slot.startMin)} - ${this._minutesToTime(slot.stopMin)}`;
    }
  }

  /**
   * Check se uno slot è attivo (current time dentro lo slot)
   * @private
   * @param {Object} slot - Slot merged
   * @param {string} dayKey - Chiave giorno
   * @returns {boolean}
   */
  _isSlotActive(slot, dayKey) {
    if (!this.currentTime || !this.currentDay) return false;
    if (this.currentDay !== dayKey) return false;

    const currentMin = this._timeToMinutes(this.currentTime);
    return currentMin >= slot.startMin && currentMin < slot.stopMin;
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Converte "HH:MM" in minuti
   * @private
   * @param {string} time - Tempo in formato "HH:MM"
   * @returns {number} Minuti dal midnight
   */
  _timeToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Converte minuti in "HH:MM"
   * @private
   * @param {number} minutes - Minuti dal midnight
   * @returns {string} Tempo in formato "HH:MM"
   */
  _minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  // ============================================
  // STORE SUBSCRIPTIONS (REACTIVE)
  // ============================================

  /**
   * Setup delle subscription allo Store
   * @private
   */
  _setupSubscriptions() {
    // Subscribe to runtime.scheduler
    this.subscribeToStore(Paths.RUNTIME.SCHEDULER, (newSlots) => {
      log.debug('[GanttChart] Scheduler updated:', newSlots);
      this.timeSlots = newSlots || [];
      this._render();
    });

    // Subscribe to runtime.rtc.time
    this.subscribeToStore(Paths.RUNTIME.RTC.TIME, (newTime) => {
      log.debug('[GanttChart] Time updated:', newTime);
      this.currentTime = newTime;
      this._render();
    });

    // Subscribe to runtime.rtc.day
    this.subscribeToStore(Paths.RUNTIME.RTC.DAY, (newDay) => {
      log.debug('[GanttChart] Day updated:', newDay);
      this.currentDay = newDay;
      this._render();
    });

    // Initial load
    this.timeSlots = Store.get(Paths.RUNTIME.SCHEDULER) || [];
    this.currentTime = Store.get(Paths.RUNTIME.RTC.TIME) || null;
    this.currentDay = Store.get(Paths.RUNTIME.RTC.DAY) || null;

    log.debug('[GanttChart] Initial state:', {
      slots: this.timeSlots.length,
      time: this.currentTime,
      day: this.currentDay
    });
  }

  // ============================================
  // NAVIGATION (SWIPE & DOTS)
  // ============================================

  /**
   * Setup swipe navigation
   * @private
   */
  _setupSwipeNavigation() {
    if (!this.el) return;

    const carousel = this.el.querySelector('.gantt-carousel');
    if (!carousel) return;

    carousel.addEventListener('touchstart', (e) => {
      this.touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    carousel.addEventListener('touchend', (e) => {
      this.touchEndX = e.changedTouches[0].screenX;
      this._handleSwipe();
    }, { passive: true });

    log.debug('[GanttChart] Swipe navigation setup');
  }

  /**
   * Gestisce lo swipe gesture
   * @private
   */
  _handleSwipe() {
    const diff = this.touchStartX - this.touchEndX;

    if (Math.abs(diff) < this.swipeThreshold) return;

    if (diff > 0) {
      // Swipe left → next slide
      if (this.currentSlide < this.slides.length - 1) {
        this.currentSlide++;
        this._updateCarouselPosition();
      }
    } else {
      // Swipe right → previous slide
      if (this.currentSlide > 0) {
        this.currentSlide--;
        this._updateCarouselPosition();
      }
    }
  }

  /**
   * Setup dot navigation (click sui pallini)
   * @private
   */
  _setupDotNavigation() {
    if (!this.el) return;

    const dots = this.el.querySelectorAll('.gantt-dot');
    dots.forEach((dot, index) => {
      dot.addEventListener('click', () => {
        this.currentSlide = index;
        this._updateCarouselPosition();
      });
    });

    log.debug('[GanttChart] Dot navigation setup');
  }

  /**
   * Aggiorna la posizione del carousel
   * @private
   */
  _updateCarouselPosition() {
    if (!this.el) return;

    const carouselInner = this.el.querySelector('#gantt-carousel-inner');
    if (!carouselInner) return;

    const offset = -this.currentSlide * 100;
    carouselInner.style.transform = `translateX(${offset}%)`;

    // Aggiorna dots active state
    const dots = this.el.querySelectorAll('.gantt-dot');
    dots.forEach((dot, index) => {
      if (index === this.currentSlide) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });

    log.debug(`[GanttChart] Carousel moved to slide ${this.currentSlide}`);
  }

  // ============================================
  // CLICK HANDLERS
  // ============================================

  /**
   * Setup click handlers sulle barre
   * @private
   */
  _setupBarClickHandlers() {
    if (!this.el) return;

    const bars = this.el.querySelectorAll('.gantt-bar');
    bars.forEach(bar => {
      bar.addEventListener('click', (e) => {
        const slotId = parseInt(bar.dataset.slotId, 10);
        const dayKey = bar.dataset.day;

        log.debug(`[GanttChart] Bar clicked: slotId=${slotId}, day=${dayKey}`);

        // Trova lo slot originale
        const slot = this.timeSlots.find(s => s.id === slotId);

        if (slot) {
          // Callback esterna (se definita)
          if (typeof this.onSlotClick === 'function') {
            this.onSlotClick(slot, dayKey);
          }

          // Log per debug
          log.info('[GanttChart] Slot clicked:', slot);
        }
      });
    });

    log.debug('[GanttChart] Bar click handlers setup');
  }

  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Naviga a uno slide specifico
   * @param {number} slideIndex - Indice dello slide (0-2)
   */
  goToSlide(slideIndex) {
    if (slideIndex < 0 || slideIndex >= this.slides.length) {
      log.warn(`[GanttChart] Invalid slide index: ${slideIndex}`);
      return;
    }

    this.currentSlide = slideIndex;
    this._updateCarouselPosition();
  }

  /**
   * Aggiorna manualmente il componente
   */
  refresh() {
    log.debug('[GanttChart] Manual refresh');
    this._render();
  }
}

export default GanttChart;
