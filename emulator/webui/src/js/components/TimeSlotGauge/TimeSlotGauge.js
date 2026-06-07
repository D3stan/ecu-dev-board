/**
 * TimeSlotGauge.js
 * 
 * Componente per creare/modificare time slot con gauge circolare draggabile.
 * 
 * Features:
 * - Gauge circolare 24h con 2 handle draggabili (start/stop)
 * - Touch-friendly con protezione iOS Safari pull-to-refresh
 * - Input nativo per selezione precisa degli orari
 * - Selezione giorni settimana con i18n
 * - Validazione e submit con callback
 * - Mobile-first responsive design
 * 
 * @extends Component
 * @author FogExtra Team
 * @version 2.0.0
 */

import { Component } from '../../core/Component.js';
import { i18n } from '../../utils/i18n.js';
import { log } from '../../utils/logger.js';
import { 
  timeToAngle, 
  angleToTime, 
  angleToCoords, 
  calculateDuration,
  GAUGE_RADIUS,
  GAUGE_CENTER,
  GAUGE_CIRCUMFERENCE
} from './TimeSlotGaugeFunctions.js';

// ============================================
// CONSTANTS
// ============================================

const NEW_TIME_SLOT_ID = 255;

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const I18N_KEYS = {
  DAYS_LABEL: 'ui.daysOfWeek',
  START_LABEL: 'ui.start',
  STOP_LABEL: 'ui.stop',
  CREATE_BTN: 'ui.create',
  MODIFY_BTN: 'ui.modify',
  ERROR_NO_DAYS: 'ui.errorNoDays',
  START_HANDLE_ARIA: 'ui.startHandle',
  STOP_HANDLE_ARIA: 'ui.stopHandle',
};

// ============================================
// CLASS: TimeSlotGauge
// ============================================

export class TimeSlotGauge extends Component {
  /**
   * Create TimeSlotGauge instance.
   * 
   * @param {Object} options - Component configuration
   * @param {Function} options.getWeekdayLetter - Function to get localized weekday letter
   * @param {Function} options.onSubmit - Callback when time slot is submitted
   * @param {string} options.mode - 'create' | 'modify'
   * @param {number} options.snapMinutes - Snap interval in minutes (default: 15)
   * @param {Object} options.initial - Initial values { id, start, stop, days }
   */
  constructor(options = {}) {
    super({
      id: options.id || 'timeslot-gauge',
      ...options
    });

    // Validazione opzioni
    if (!options.getWeekdayLetter) {
      throw new Error('TimeSlotGauge: getWeekdayLetter è obbligatorio');
    }
    if (!options.onSubmit) {
      throw new Error('TimeSlotGauge: onSubmit è obbligatorio');
    }

    // Setup properties
    this.getWeekdayLetter = options.getWeekdayLetter;
    this.onSubmitCallback = options.onSubmit;
    this.mode = options.mode || 'create'; // 'create' | 'modify'

    // State
    this.data = {
      id: options.initial?.id ?? null,
      start: options.initial?.start || '08:30',
      stop: options.initial?.stop || '12:30',
      snapMinutes: options.snapMinutes || 15,
      days: {
        mon: false,
        tue: false,
        wed: false,
        thu: false,
        fri: false,
        sat: false,
        sun: false,
        ...options.initial?.days
      },
      dragging: null, // 'start' | 'stop' | null
    };

    // Drag state
    this.dragState = {
      gaugeCenter: { x: 0, y: 0 },
      rafId: null,
    };

    // Bind methods
    this._handleDragMove = this._handleDragMove.bind(this);
    this._handleDragEnd = this._handleDragEnd.bind(this);
    this._preventTouchDefault = this._preventTouchDefault.bind(this);

    // Abilita aggiornamento automatico traduzioni
    this.enableI18n(() => this._updateTranslations());

    log.debug('TimeSlotGauge', `Created - mode: ${this.mode}`);
  }

  // ============================================
  // LIFECYCLE HOOKS
  // ============================================

  /**
   * Called when component is created.
   */
  onCreate() {
    super.onCreate();
    log.debug('TimeSlotGauge', 'onCreate');
  }

  /**
   * Called when component is mounted to DOM.
   */
  onMount() {
    super.onMount();
    log.debug('TimeSlotGauge', 'onMount');

    // Cache DOM refs
    this._cacheRefs();

    // Initial gauge update
    this._updateGauge();
  }

  /**
   * Called to bind event listeners.
   */
  onBindEvents() {
    super.onBindEvents();
    log.debug('TimeSlotGauge', 'onBindEvents');

    // Drag handlers - START HANDLE
    this.addEventListener(this.$('[data-ref="startHandle"]'), 'mousedown', (e) => {
      e.preventDefault();
      this._handleDragStart('start');
    });

    this.addEventListener(this.$('[data-ref="startHandle"]'), 'touchstart', (e) => {
      this._handleDragStart('start');
    }, { passive: false });

    // Drag handlers - STOP HANDLE
    this.addEventListener(this.$('[data-ref="stopHandle"]'), 'mousedown', (e) => {
      e.preventDefault();
      this._handleDragStart('stop');
    });

    this.addEventListener(this.$('[data-ref="stopHandle"]'), 'touchstart', (e) => {
      this._handleDragStart('stop');
    }, { passive: false });

    // Input time nativi (change events)
    this.addEventListener(this.$('[data-ref="startTimeInput"]'), 'change', (e) => {
      this._handleTimeInputChange('start', e.target.value);
    });

    this.addEventListener(this.$('[data-ref="stopTimeInput"]'), 'change', (e) => {
      this._handleTimeInputChange('stop', e.target.value);
    });

    // Toggle giorni
    this.$$('[data-day]').forEach(block => {
      this.addEventListener(block, 'click', () => {
        const day = block.getAttribute('data-day');
        this._toggleDay(day, block);
      });
    });

    // Submit button
    this.addEventListener(this.$('[data-ref="submitBtn"]'), 'click', () => {
      this._handleSubmit();
    });

    // iOS Safari: prevent pull-to-refresh on gauge container
    const gaugeContainer = this.$('[data-ref="gaugeContainer"]');
    if (gaugeContainer) {
      this.addEventListener(gaugeContainer, 'touchmove', this._preventTouchDefault, { passive: false });
    }
  }

  /**
   * Called when component is destroyed.
   */
  onDestroy() {
    log.debug('TimeSlotGauge', 'onDestroy');

    // Remove global listeners (se ancora presenti)
    document.removeEventListener('mousemove', this._handleDragMove);
    document.removeEventListener('touchmove', this._handleDragMove);
    document.removeEventListener('mouseup', this._handleDragEnd);
    document.removeEventListener('touchend', this._handleDragEnd);

    // Ripristina body styles
    document.body.style.cursor = '';
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';

    // Cancel RAF
    if (this.dragState.rafId) {
      cancelAnimationFrame(this.dragState.rafId);
    }

    super.onDestroy();
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
    container.className = 'timeslot-settings-card';

    container.innerHTML = `
      <!-- Gauge Section -->
      <div class="gauge-section">
        <div class="gauge-container" data-ref="gaugeContainer">
          <!-- SVG Gauge -->
          <svg class="gauge-svg" viewBox="0 0 200 200" data-ref="gaugeSvg">
            <!-- Track (background circle) -->
            <circle class="gauge-track" cx="100" cy="100" r="80"/>
            
            <!-- Arc (filled based on duration) -->
            <circle 
              class="gauge-arc" 
              data-ref="gaugeArc"
              cx="100" 
              cy="100" 
              r="80" 
              stroke-dasharray="${GAUGE_CIRCUMFERENCE}" 
              stroke-dashoffset="${GAUGE_CIRCUMFERENCE}"
            />
            
            <!-- Start Handle -->
            <g class="gauge-handle" data-ref="startHandle" role="button" tabindex="0">
              <!-- Hit area invisibile per mobile touch -->
              <circle class="gauge-handle-hitarea" cx="0" cy="0" r="25" fill="transparent" pointer-events="all"/>
              <!-- Cerchio visibile -->
              <circle class="gauge-handle-circle start" cx="0" cy="0" r="8"/>
            </g>
            
            <!-- Stop Handle -->
            <g class="gauge-handle" data-ref="stopHandle" role="button" tabindex="0">
              <!-- Hit area invisibile per mobile touch -->
              <circle class="gauge-handle-hitarea" cx="0" cy="0" r="25" fill="transparent" pointer-events="all"/>
              <!-- Cerchio visibile -->
              <circle class="gauge-handle-circle stop" cx="0" cy="0" r="8"/>
            </g>
          </svg>

          <!-- Time Labels (Fake Labels = Real Inputs Styled) -->
          <div class="gauge-time-block start" data-ref="startTimeBlock">
            <div class="gauge-time-text" data-ref="startLabel">${i18n.t(I18N_KEYS.START_LABEL)}</div>
            <input 
              type="time" 
              class="gauge-time-input-styled" 
              data-ref="startTimeInput" 
              value="${this.data.start}"
              aria-label="${i18n.t(I18N_KEYS.START_LABEL)}"
            >
          </div>

          <div class="gauge-time-block stop" data-ref="stopTimeBlock">
            <input 
              type="time" 
              class="gauge-time-input-styled" 
              data-ref="stopTimeInput" 
              value="${this.data.stop}"
              aria-label="${i18n.t(I18N_KEYS.STOP_LABEL)}"
            >
            <div class="gauge-time-text" data-ref="stopLabel">${i18n.t(I18N_KEYS.STOP_LABEL)}</div>
          </div>

          <!-- Center Duration -->
          <div class="gauge-center">
            <div class="gauge-duration" data-ref="gaugeDuration">4h 0m</div>
          </div>
        </div>

        <!-- Hidden Time Inputs (Fallback) -->
        <div class="gauge-times">
          <!-- Questi input servono solo come fallback se i precedenti non funzionano -->
        </div>
      </div>

      <!-- Days Section -->
      <div class="days-section">
        <div class="days-label" data-ref="daysLabel">${i18n.t(I18N_KEYS.DAYS_LABEL)}</div>
        <div class="days-grid" data-ref="daysGrid">
          ${DAY_KEYS.map(dayKey => `
            <button 
              class="day-block ${this.data.days[dayKey] ? 'active' : ''}" 
              data-day="${dayKey}"
              aria-pressed="${this.data.days[dayKey]}"
              role="button"
              type="button"
            >
              ${this.getWeekdayLetter(dayKey)}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Create/Modify Button -->
      <button 
        class="create-timeslot-btn" 
        data-ref="submitBtn"
        type="button"
        aria-label="${i18n.t(this.mode === 'create' ? I18N_KEYS.CREATE_BTN : I18N_KEYS.MODIFY_BTN)}"
      >
        ${i18n.t(this.mode === 'create' ? I18N_KEYS.CREATE_BTN : I18N_KEYS.MODIFY_BTN)}
      </button>
    `;

    return container;
  }

  /**
   * Cache DOM references.
   * @private
   */
  _cacheRefs() {
    // Nota: Non serve più this.refs perché usiamo this.$() e this.$$()
    // ma manteniamo per compatibilità con metodi esistenti
    this.refs = {};
    
    this.$$('[data-ref]').forEach(el => {
      const refName = el.getAttribute('data-ref');
      this.refs[refName] = el;
    });

    log.debug('TimeSlotGauge', `Cached ${Object.keys(this.refs).length} refs`);
  }

  // ============================================
  // EVENT HANDLERS
  // ============================================

  _preventTouchDefault(e) {
    // Previeni pull-to-refresh solo durante il drag
    if (this.data.dragging) {
      e.preventDefault();
    }
  }

  // ============================================
  // DRAG LOGIC
  // ============================================

  _handleDragStart(handle) {
    this.data.dragging = handle;
    
    // Calcola centro gauge UNA SOLA VOLTA (performance)
    const gaugeContainer = this.$('[data-ref="gaugeContainer"]');
    const rect = gaugeContainer.getBoundingClientRect();
    this.dragState.gaugeCenter = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };

    // Visual feedback
    document.body.style.cursor = 'grabbing';
    gaugeContainer.classList.add('dragging');

    // iOS: blocca scroll della pagina durante drag
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';

    // Attach global listeners
    document.addEventListener('mousemove', this._handleDragMove);
    document.addEventListener('touchmove', this._handleDragMove, { passive: false });
    document.addEventListener('mouseup', this._handleDragEnd);
    document.addEventListener('touchend', this._handleDragEnd);

    log.debug('TimeSlotGauge', `🎯 Drag start: ${handle}`);
  }

  _handleDragMove(e) {
    if (!this.data.dragging) return;

    // Throttle con requestAnimationFrame
    if (this.dragState.rafId) return;

    this.dragState.rafId = requestAnimationFrame(() => {
      this.dragState.rafId = null;

      // Estrai coordinate
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      // Calcola angolo dal centro
      const dx = clientX - this.dragState.gaugeCenter.x;
      const dy = clientY - this.dragState.gaugeCenter.y;
      const angleRad = Math.atan2(dy, dx);
      let degrees = (angleRad * 180 / Math.PI + 90 + 360) % 360;

      // Converti angolo in tempo (con snap)
      const newTime = angleToTime(degrees, this.data.snapMinutes);

      // Aggiorna stato con auto-adjust
      if (this.data.dragging === 'start') {
        this.data.start = newTime;
        const startInput = this.$('[data-ref="startTimeInput"]');
        if (startInput) startInput.value = newTime;

        // Auto-adjust: se start >= stop, sposta stop a start + 1min
        this._enforceStartBeforeStop('start');
      } else {
        this.data.stop = newTime;
        const stopInput = this.$('[data-ref="stopTimeInput"]');
        if (stopInput) stopInput.value = newTime;

        // Auto-adjust: se stop <= start, sposta start a stop - 1min
        this._enforceStartBeforeStop('stop');
      }

      // Update visual
      this._updateGauge();
    });
  }

  _handleDragEnd() {
    if (!this.data.dragging) return;

    log.debug('TimeSlotGauge', `🎯 Drag end: ${this.data.dragging}`);

    this.data.dragging = null;

    // Cleanup visual
    document.body.style.cursor = '';
    const gaugeContainer = this.$('[data-ref="gaugeContainer"]');
    if (gaugeContainer) gaugeContainer.classList.remove('dragging');

    // iOS: ripristina scroll
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';

    // Remove global listeners
    document.removeEventListener('mousemove', this._handleDragMove);
    document.removeEventListener('touchmove', this._handleDragMove);
    document.removeEventListener('mouseup', this._handleDragEnd);
    document.removeEventListener('touchend', this._handleDragEnd);

    // Cancel RAF se pendente
    if (this.dragState.rafId) {
      cancelAnimationFrame(this.dragState.rafId);
      this.dragState.rafId = null;
    }
  }

  // ============================================
  // TIME INPUT HANDLERS
  // ============================================

  _handleTimeInputChange(type, value) {
    if (type === 'start') {
      this.data.start = value;
      this._enforceStartBeforeStop('start');
    } else {
      this.data.stop = value;
      this._enforceStartBeforeStop('stop');
    }

    this._updateGauge();
  }

  // ============================================
  // VALIDATION & AUTO-ADJUST
  // ============================================

  _enforceStartBeforeStop(changed) {
    const [startH, startM] = this.data.start.split(':').map(Number);
    const [stopH, stopM] = this.data.stop.split(':').map(Number);
    const startTotal = startH * 60 + startM;
    const stopTotal = stopH * 60 + stopM;

    // Get input references once
    const startInput = this.$('[data-ref="startTimeInput"]');
    const stopInput = this.$('[data-ref="stopTimeInput"]');

    if (changed === 'start') {
      // Se start >= stop, sposta stop a start + 1min
      if (startTotal >= stopTotal) {
        const newStopTotal = (startTotal + 1) % (24 * 60);
        const newStopH = Math.floor(newStopTotal / 60);
        const newStopM = newStopTotal % 60;
        this.data.stop = `${String(newStopH).padStart(2, '0')}:${String(newStopM).padStart(2, '0')}`;
        if (stopInput) stopInput.value = this.data.stop;
      }
    } else {
      // Se stop <= start, sposta start a stop - 1min
      if (stopTotal <= startTotal) {
        const newStartTotal = (stopTotal - 1 + 24 * 60) % (24 * 60);
        const newStartH = Math.floor(newStartTotal / 60);
        const newStartM = newStartTotal % 60;
        this.data.start = `${String(newStartH).padStart(2, '0')}:${String(newStartM).padStart(2, '0')}`;
        if (startInput) startInput.value = this.data.start;
      }
    }
  }

  // ============================================
  // DAY TOGGLE
  // ============================================

  _toggleDay(dayKey, blockElement) {
    this.data.days[dayKey] = !this.data.days[dayKey];
    blockElement.classList.toggle('active');
    blockElement.setAttribute('aria-pressed', this.data.days[dayKey]);
  }

  // ============================================
  // GAUGE UPDATE
  // ============================================

  _updateGauge() {
    const startAngle = timeToAngle(this.data.start);
    const stopAngle = timeToAngle(this.data.stop);

    // Posiziona le maniglie sulla circonferenza
    const startCoords = angleToCoords(startAngle);
    const stopCoords = angleToCoords(stopAngle);

    const startHandle = this.$('[data-ref="startHandle"]');
    const stopHandle = this.$('[data-ref="stopHandle"]');
    
    if (startHandle) startHandle.setAttribute('transform', `translate(${startCoords.x}, ${startCoords.y})`);
    if (stopHandle) stopHandle.setAttribute('transform', `translate(${stopCoords.x}, ${stopCoords.y})`);

    // Calcola l'arco
    let arcAngle = stopAngle - startAngle;
    if (arcAngle < 0) arcAngle += 360;

    const arcLength = (arcAngle / 360) * GAUGE_CIRCUMFERENCE;
    const offset = GAUGE_CIRCUMFERENCE - arcLength;

    const gaugeArc = this.$('[data-ref="gaugeArc"]');
    if (gaugeArc) {
      gaugeArc.style.strokeDashoffset = offset;
      gaugeArc.setAttribute('transform', `rotate(${startAngle} 100 100)`);
    }

    // Aggiorna input values (sono gli elementi visibili ora)
    const startTimeInput = this.$('[data-ref="startTimeInput"]');
    const stopTimeInput = this.$('[data-ref="stopTimeInput"]');
    
    if (startTimeInput) startTimeInput.value = this.data.start;
    if (stopTimeInput) stopTimeInput.value = this.data.stop;
    
    // Sincronizza input values
    const startInput = this.$('[data-ref="startTimeInput"]');
    const stopInput = this.$('[data-ref="stopTimeInput"]');
    
    if (startInput && startInput.value !== this.data.start) startInput.value = this.data.start;
    if (stopInput && stopInput.value !== this.data.stop) stopInput.value = this.data.stop;

    // Aggiorna durata
    const duration = calculateDuration(this.data.start, this.data.stop);
    const gaugeDuration = this.$('[data-ref="gaugeDuration"]');
    if (gaugeDuration) gaugeDuration.textContent = `${duration.hours}h ${duration.minutes}m`;
  }

  // ============================================
  // SUBMIT
  // ============================================

  _handleSubmit() {
    // Validazione: almeno 1 giorno selezionato
    const hasDay = Object.values(this.data.days).some(d => d);
    
    if (!hasDay) {
      const errorMsg = i18n.t(I18N_KEYS.ERROR_NO_DAYS) || 'Seleziona almeno un giorno della settimana';
      alert(errorMsg); // TODO: sostituire con toast/modal custom
      return;
    }

    // Validazione: start < stop (già garantito da auto-adjust, ma doppio check)
    const [startH, startM] = this.data.start.split(':').map(Number);
    const [stopH, stopM] = this.data.stop.split(':').map(Number);
    const startTotal = startH * 60 + startM;
    const stopTotal = stopH * 60 + stopM;

    if (startTotal >= stopTotal) {
      alert('L\'orario di Start deve essere precedente allo Stop');
      return;
    }

    // Build payload
    // CRITICAL: Se mode = 'create', usa sempre NEW_TIME_SLOT_ID (255)
    // Se mode = 'modify', mantieni l'id esistente
    const payload = {
      id: this.mode === 'create' ? NEW_TIME_SLOT_ID : (this.data.id ?? NEW_TIME_SLOT_ID),
      start: this.data.start,
      stop: this.data.stop,
      days: { ...this.data.days }
    };

    log.info('TimeSlotGauge', '📤 TimeSlot submit:', {
      mode: this.mode,
      id: payload.id,
      start: payload.start,
      stop: payload.stop,
      days: payload.days
    });

    // Callback
    this.onSubmitCallback(payload);
  }

  // ============================================
  // I18N UPDATE
  // ============================================

  /**
   * Aggiorna tutte le label tradotte.
   * Chiamato automaticamente quando cambia lingua (via Component.enableI18n).
   * @private
   */
  _updateTranslations() {
    if (!this.el) {
      log.warn('TimeSlotGauge', 'Cannot update translations - component not mounted');
      return;
    }

    // Update i18n-driven texts
    const daysLabel = this.$('[data-ref="daysLabel"]');
    const startLabel = this.$('[data-ref="startLabel"]');
    const stopLabel = this.$('[data-ref="stopLabel"]');
    const submitBtn = this.$('[data-ref="submitBtn"]');
    
    if (daysLabel) daysLabel.textContent = i18n.t(I18N_KEYS.DAYS_LABEL);
    if (startLabel) startLabel.textContent = i18n.t(I18N_KEYS.START_LABEL);
    if (stopLabel) stopLabel.textContent = i18n.t(I18N_KEYS.STOP_LABEL);
    
    // CRITICAL: Aggiorna il pulsante in base alla modalità corrente
    if (submitBtn) {
      const buttonKey = this.mode === 'create' ? I18N_KEYS.CREATE_BTN : I18N_KEYS.MODIFY_BTN;
      submitBtn.textContent = i18n.t(buttonKey);
      submitBtn.setAttribute('aria-label', i18n.t(buttonKey));
    }

    // Update day letters
    this.$$('[data-day]').forEach(block => {
      const dayKey = block.getAttribute('data-day');
      block.textContent = this.getWeekdayLetter(dayKey);
    });

    log.debug('TimeSlotGauge', `🌐 Translations updated (mode: ${this.mode})`);
  }

  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Aggiorna lo stato del componente (es. per edit).
   * @param {Object} newState - Nuovo stato
   */
  setState(newState) {
    if (newState.id !== undefined) this.data.id = newState.id;
    if (newState.start) this.data.start = newState.start;
    if (newState.stop) this.data.stop = newState.stop;
    if (newState.snapMinutes) this.data.snapMinutes = newState.snapMinutes;
    if (newState.days) {
      Object.assign(this.data.days, newState.days);
      
      // Update UI
      this.$$('[data-day]').forEach(block => {
        const dayKey = block.getAttribute('data-day');
        if (this.data.days[dayKey]) {
          block.classList.add('active');
        } else {
          block.classList.remove('active');
        }
        block.setAttribute('aria-pressed', this.data.days[dayKey]);
      });
    }

    // Update inputs (sia quelli nei time blocks che eventuali fallback)
    const startInput = this.$('[data-ref="startTimeInput"]');
    const stopInput = this.$('[data-ref="stopTimeInput"]');
    
    if (startInput) startInput.value = this.data.start;
    if (stopInput) stopInput.value = this.data.stop;
    
    // Update anche eventuali input duplicati (se esistono)
    const allStartInputs = this.$$('input[data-ref="startTimeInput"]');
    const allStopInputs = this.$$('input[data-ref="stopTimeInput"]');
    
    allStartInputs.forEach(input => input.value = this.data.start);
    allStopInputs.forEach(input => input.value = this.data.stop);

    // Update gauge
    this._updateGauge();
    
    log.debug('TimeSlotGauge', 'State updated:', newState);
  }

  /**
   * Aggiorna la modalità del componente (create/modify) e aggiorna UI.
   * @param {string} newMode - 'create' | 'modify'
   */
  setMode(newMode) {
    if (newMode !== 'create' && newMode !== 'modify') {
      log.error('TimeSlotGauge', 'Invalid mode. Use "create" or "modify"');
      return;
    }
    
    this.mode = newMode;
    
    // Aggiorna testo del pulsante
    const submitBtn = this.$('[data-ref="submitBtn"]');
    if (submitBtn) {
      const buttonText = i18n.t(this.mode === 'create' ? I18N_KEYS.CREATE_BTN : I18N_KEYS.MODIFY_BTN);
      submitBtn.textContent = buttonText;
      submitBtn.setAttribute('aria-label', buttonText);
    }
    
    log.debug('TimeSlotGauge', `🔄 Mode changed to "${newMode}"`);
  }

  /**
   * Ottiene lo stato corrente.
   * @returns {Object} Current state
   */
  getState() {
    return {
      id: this.data.id,
      start: this.data.start,
      stop: this.data.stop,
      days: { ...this.data.days }
    };
  }
}

// Export default
export default TimeSlotGauge;
