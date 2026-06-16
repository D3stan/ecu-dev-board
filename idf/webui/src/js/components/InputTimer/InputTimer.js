/**
 * InputTimer.js
 * =============
 * Componente per modificare parametri di tipo TIME (timer).
 * 
 * Funzionalità:
 * - Visualizzazione dinamica ore/minuti/secondi in base al max
 * - Incremento/decremento ciclico con limiti dinamici
 * - Input manuale con validazione
 * - Pulsanti Default e Conferma
 * - Traduzione automatica delle label
 * - Subscription a parametro specifico nello Store
 * 
 * Props:
 * - paramId: ID del parametro TIME da modificare
 * - onConfirm: callback chiamato dopo invio comando (per navigazione)
 * 
 * Esempio d'uso:
 * ```js
 * const timerInput = new InputTimer({
 *   paramId: 1, // Timer ON
 *   onConfirm: () => NavigationManager.navigateTo('MenuSettingsPage')
 * });
 * timerInput.mount(container);
 * timerInput.activate();
 * ```
 * 
 * @author FogExtra Team
 * @version 1.0.0
 */

import { Component } from '../../core/Component.js';
import { Store } from '../../core/store.js';
import { Paths } from '../../utils/paths.js';
import { i18n } from '../../utils/i18n.js';
import { log } from '../../utils/logger.js';
import { CommandManager } from '../../managers/commandManager.js';
import { 
  secondsToHMS, 
  hmsToSeconds, 
  getMaxValues, 
  validateTotal,
  getValidatedValue 
} from './func.js';

export class InputTimer extends Component {
  /**
   * Crea un'istanza di InputTimer
   * @param {number} paramId - ID del parametro TIME
   * @param {Function} onConfirm - Callback per navigazione dopo conferma
   */
  constructor({ paramId, onConfirm = null }) {
    // NOTA: super() chiama onCreate(), quindi impostiamo props PRIMA
    super();
    
    // Valida paramId
    if (typeof paramId !== 'number') {
      log.error('InputTimer', 'paramId deve essere un numero', paramId);
      throw new Error('InputTimer: paramId obbligatorio');
    }
    
    this.paramId = paramId;
    this.onConfirm = onConfirm;
    
    // Config del parametro - DEVE essere caricato QUI prima di mount()!
    // mount() chiama render() che ha bisogno di this.config
    this.config = null;
    
    // State interno per ore/minuti/secondi
    this.state = {
      hours: 0,
      minutes: 0,
      seconds: 0
    };
    
    // Riferimenti DOM
    this.refs = {};
    
    // ⚠️ CRITICAL: Carica il parametro SUBITO dopo aver impostato paramId
    // Questo DEVE avvenire prima di mount() perché render() ne ha bisogno
    this._loadParameter();
    
    // Abilita aggiornamento automatico traduzioni
    this.enableI18n(() => this._updateLabels());
    
    log.debug('InputTimer', `Creato componente per parametro ID=${paramId}`);
  }

  /**
   * Lifecycle: componente creato
   */
  onCreate() {
    // Non caricare il parametro qui - this.paramId non è ancora impostato
    // Il caricamento avviene in onMount()
  }

  /**
   * Lifecycle: componente montato
   */
  onMount() {
    log.debug('InputTimer', 'onMount');
    
    // ⚠️ NON chiamare _loadParameter() qui - è già stato fatto nel constructor!
    // Se lo chiamiamo qui, this.config è già impostato
    
    // Se il parametro non è stato trovato, non procedere
    if (!this.config) {
      log.error('InputTimer', 'Cannot mount InputTimer without valid parameter config');
      return;
    }
    
    // Cache riferimenti DOM
    this._cacheRefs();
    
    // Bind eventi
    this._bindEvents();
    
    // Subscribe a cambio parametri
    this.subscribeToStore(Paths.CONFIG.PARAMS, (params) => {
      const updated = params.find(p => p.id === this.paramId);
      if (updated) {
        log.debug('InputTimer', `Parametro ${this.paramId} aggiornato`, updated);
        this.config = updated;
        this._updateFromStore();
      }
    });
  }

  /**
   * Lifecycle: componente attivato
   */
  onActivate() {
    log.debug('InputTimer', 'onActivate');
    // Force update UI con valore corrente
    this._updateDisplay();
  }

  /**
   * Lifecycle: componente distrutto
   */
  onDestroy() {
    log.debug('InputTimer', 'onDestroy');
    this.config = null;
    this.refs = {};
  }

  /**
   * Renderizza il componente
   */
  render() {
    if (!this.config) {
      return `<div class="timer-settings-card">Caricamento...</div>`;
    }
    
    const showHours = this.config.max >= 3600;
    const showMinutes = this.config.max >= 60;
    
    // Traduzioni per le label (usa lingua corrente)
    const hoursLabel = i18n.t('ui.timer.hours');
    const minutesLabel = i18n.t('ui.timer.minutes');
    const secondsLabel = i18n.t('ui.timer.seconds');
    const defaultLabel = i18n.t('ui.reset');
    const confirmLabel = i18n.t('ui.confirm');
    
    return `
      <div class="timer-settings-card">
        <!-- Timer Picker Section -->
        <div class="timer-picker-section">
          
          <!-- Hours Block -->
          <div class="timer-block ${showHours ? '' : 'hidden'}" data-ref="hoursBlock">
            <div class="timer-label" data-i18n="hours">${hoursLabel}</div>
            <svg class="timer-arrow" data-ref="hoursUp" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="18 15 12 9 6 15"></polyline>
            </svg>
            <div class="timer-value-settings" data-ref="hoursValue">00</div>
            <svg class="timer-arrow" data-ref="hoursDown" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>

          <!-- Separator Column 1 -->
          <div class="timer-separator-column ${showHours ? '' : 'hidden'}" data-ref="separator1">
            <div class="timer-separator">:</div>
          </div>

          <!-- Minutes Block -->
          <div class="timer-block ${showMinutes ? '' : 'hidden'}" data-ref="minutesBlock">
            <div class="timer-label" data-i18n="minutes">${minutesLabel}</div>
            <svg class="timer-arrow" data-ref="minutesUp" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="18 15 12 9 6 15"></polyline>
            </svg>
            <div class="timer-value-settings" data-ref="minutesValue">00</div>
            <svg class="timer-arrow" data-ref="minutesDown" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>

          <!-- Separator Column 2 -->
          <div class="timer-separator-column ${showMinutes ? '' : 'hidden'}" data-ref="separator2">
            <div class="timer-separator">:</div>
          </div>

          <!-- Seconds Block -->
          <div class="timer-block" data-ref="secondsBlock">
            <div class="timer-label" data-i18n="seconds">${secondsLabel}</div>
            <svg class="timer-arrow" data-ref="secondsUp" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="18 15 12 9 6 15"></polyline>
            </svg>
            <div class="timer-value-settings" data-ref="secondsValue">00</div>
            <svg class="timer-arrow" data-ref="secondsDown" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>

        </div>

        <!-- Action Buttons -->
        <div class="timer-action-bar">
          <button class="timer-btn timer-btn-default" data-ref="defaultBtn">${defaultLabel}</button>
          <button class="timer-btn timer-btn-confirm" data-ref="confirmBtn">${confirmLabel}</button>
        </div>
      </div>
    `;
  }

  // ============================================
  // PRIVATE METHODS - Setup
  // ============================================

  /**
   * Carica il parametro dallo Store
   * @private
   */
  _loadParameter() {
    const params = Store.get(Paths.CONFIG.PARAMS);
    this.config = params.find(p => p.id === this.paramId);
    
    if (!this.config) {
      log.error('InputTimer', `Parametro ${this.paramId} non trovato nello Store`);
      return;
    }
    
    // Inizializza state con valore corrente
    const hms = secondsToHMS(this.config.value);
    this.state.hours = hms.hours;
    this.state.minutes = hms.minutes;
    this.state.seconds = hms.seconds;
    
    log.debug('InputTimer', `Parametro caricato:`, this.config);
  }

  /**
   * Cache riferimenti DOM per performance
   * @private
   */
  _cacheRefs() {
    const elements = this.el.querySelectorAll('[data-ref]');
    elements.forEach(el => {
      const refName = el.getAttribute('data-ref');
      this.refs[refName] = el;
    });
    
    log.debug('InputTimer', `Cached ${Object.keys(this.refs).length} refs`);
  }

  /**
   * Bind eventi DOM
   * @private
   */
  _bindEvents() {
    if (!this.refs) return;
    
    // Arrows UP
    this._addClick('hoursUp', () => this._increment('hours'));
    this._addClick('minutesUp', () => this._increment('minutes'));
    this._addClick('secondsUp', () => this._increment('seconds'));
    
    // Arrows DOWN
    this._addClick('hoursDown', () => this._decrement('hours'));
    this._addClick('minutesDown', () => this._decrement('minutes'));
    this._addClick('secondsDown', () => this._decrement('seconds'));
    
    // Values (click to edit)
    this._addClick('hoursValue', () => this._makeEditable('hours'));
    this._addClick('minutesValue', () => this._makeEditable('minutes'));
    this._addClick('secondsValue', () => this._makeEditable('seconds'));
    
    // Buttons
    this._addClick('defaultBtn', () => this._handleDefault());
    this._addClick('confirmBtn', () => this._handleConfirm());
  }

  /**
   * Helper per aggiungere event listener
   * @private
   */
  _addClick(refName, handler) {
    const el = this.refs[refName];
    if (el) {
      el.addEventListener('click', handler);
    }
  }

  // ============================================
  // PRIVATE METHODS - Logica Timer
  // ============================================

  /**
   * Incrementa valore con logica ciclica
   * @private
   */
  _increment(type) {
    const maxValues = getMaxValues(this.config.max, this.state.hours, this.state.minutes);
    
    if (type === 'hours') {
      this.state.hours = (this.state.hours + 1) % (maxValues.hours + 1);
    } else if (type === 'minutes') {
      const nextMinutes = this.state.minutes + 1;
      if (nextMinutes > maxValues.minutes) {
        this.state.minutes = 0;
      } else {
        this.state.minutes = nextMinutes;
      }
    } else if (type === 'seconds') {
      const nextSeconds = this.state.seconds + 1;
      if (nextSeconds > maxValues.seconds) {
        this.state.seconds = 0;
      } else {
        this.state.seconds = nextSeconds;
      }
    }
    
    // Valida e aggiorna display
    this._validateAndUpdate();
  }

  /**
   * Decrementa valore con logica ciclica
   * @private
   */
  _decrement(type) {
    const maxValues = getMaxValues(this.config.max, this.state.hours, this.state.minutes);
    
    if (type === 'hours') {
      this.state.hours = this.state.hours === 0 ? maxValues.hours : this.state.hours - 1;
    } else if (type === 'minutes') {
      this.state.minutes = this.state.minutes === 0 ? maxValues.minutes : this.state.minutes - 1;
    } else if (type === 'seconds') {
      this.state.seconds = this.state.seconds === 0 ? maxValues.seconds : this.state.seconds - 1;
    }
    
    // Valida e aggiorna display
    this._validateAndUpdate();
  }

  /**
   * Rende un valore editabile tramite input
   * @private
   */
  _makeEditable(type) {
    const valueElement = this.refs[`${type}Value`];
    if (!valueElement) return;
    
    const currentValue = this.state[type];
    const maxValues = getMaxValues(this.config.max, this.state.hours, this.state.minutes);
    const maxValue = maxValues[type];
    
    // Crea input
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'timer-value-input';
    input.min = 0;
    input.max = maxValue;
    input.value = currentValue;
    
    // Sostituisci elemento
    valueElement.replaceWith(input);
    input.focus();
    input.select();
    
    // Handler per fine edit
    const finishEdit = () => {
      const newValue = getValidatedValue(input.value, currentValue, 0, maxValue);
      this.state[type] = newValue;
      
      // Ripristina elemento originale
      input.replaceWith(valueElement);
      
      // Valida e aggiorna
      this._validateAndUpdate();
    };
    
    // Eventi
    input.addEventListener('blur', finishEdit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        finishEdit();
      } else if (e.key === 'Escape') {
        // Annulla senza salvare
        input.replaceWith(valueElement);
        this._updateDisplay();
      }
    });
  }

  /**
   * Valida il totale e aggiorna display
   * @private
   */
  _validateAndUpdate() {
    const validated = validateTotal(this.state, this.config.max);
    this.state.hours = validated.hours;
    this.state.minutes = validated.minutes;
    this.state.seconds = validated.seconds;
    
    this._updateDisplay();
  }

  /**
   * Aggiorna il display dei valori
   * @private
   */
  _updateDisplay() {
    if (!this.refs.hoursValue) return;
    
    this.refs.hoursValue.textContent = String(this.state.hours).padStart(2, '0');
    this.refs.minutesValue.textContent = String(this.state.minutes).padStart(2, '0');
    this.refs.secondsValue.textContent = String(this.state.seconds).padStart(2, '0');
    
    log.debug('InputTimer', `Display aggiornato: ${this.state.hours}:${this.state.minutes}:${this.state.seconds}`);
  }

  // ============================================
  // PRIVATE METHODS - Actions
  // ============================================

  /**
   * Handler per pulsante Default
   * @private
   */
  _handleDefault() {
    if (!this.config) return;
    
    const hms = secondsToHMS(this.config.default);
    this.state.hours = hms.hours;
    this.state.minutes = hms.minutes;
    this.state.seconds = hms.seconds;
    
    this._updateDisplay();
    
    log.debug('InputTimer', `Reset a default: ${this.config.default}s`);
  }

  /**
   * Handler per pulsante Conferma
   * @private
   */
  _handleConfirm() {
    if (!this.config) return;
    
    const totalSeconds = hmsToSeconds(this.state.hours, this.state.minutes, this.state.seconds);
    
    // Validazione finale
    if (totalSeconds < this.config.min || totalSeconds > this.config.max) {
      log.error('InputTimer', `Valore fuori range: ${totalSeconds}s (min: ${this.config.min}, max: ${this.config.max})`);
      return;
    }
    
    // Invia comando a ESP
    log.debug('InputTimer', `Invio comando: MODIFY_PARAM ${this.paramId} = ${totalSeconds}s`);
    CommandManager.modifyParameter(this.paramId, totalSeconds);
    
    // Callback per navigazione
    if (this.onConfirm) {
      this.onConfirm();
    }
  }

  // ============================================
  // PRIVATE METHODS - Updates
  // ============================================

  /**
   * Aggiorna state da Store
   * @private
   */
  _updateFromStore() {
    if (!this.config) return;
    
    const hms = secondsToHMS(this.config.value);
    this.state.hours = hms.hours;
    this.state.minutes = hms.minutes;
    this.state.seconds = hms.seconds;
    
    this._updateDisplay();
  }

  /**
   * Aggiorna le label quando cambia lingua
   * @private
   */
  _updateLabels() {
    if (!this.el) return;
    
    // Aggiorna label tradotte
    const labels = this.el.querySelectorAll('[data-i18n]');
    labels.forEach(label => {
      const key = label.getAttribute('data-i18n');
      label.textContent = i18n.t(`ui.timer.${key}`);
    });
    
    // Aggiorna pulsanti
    if (this.refs.defaultBtn) {
      this.refs.defaultBtn.textContent = i18n.t('ui.reset');
    }
    if (this.refs.confirmBtn) {
      this.refs.confirmBtn.textContent = i18n.t('ui.confirm');
    }
    
    log.debug('InputTimer', 'Labels aggiornate');
  }
}
