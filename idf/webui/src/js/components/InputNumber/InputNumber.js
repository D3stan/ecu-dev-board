/**
 * InputNumber.js
 * ==============
 * Componente parametrico per modificare parametri numerici o enum.
 * 
 * Funzionalità:
 * - Visualizzazione adattiva: slider + input per numerici, solo frecce per enum
 * - Incremento/decremento ciclico con limiti dinamici
 * - Input manuale con validazione e arrotondamento a step
 * - Gestione divisor per float (valore interno intero)
 * - Traduzione automatica delle label e valori enum
 * - Subscription a parametro specifico nello Store
 * - Pulsanti Default e Conferma
 * 
 * Props:
 * - paramId: ID del parametro da modificare
 * - onConfirm: callback chiamato dopo invio comando (per navigazione)
 * 
 * Esempio d'uso:
 * ```js
 * const numberInput = new InputNumber({
 *   paramId: 10, // Setpoint temperatura
 *   onConfirm: () => NavigationManager.goBack()
 * });
 * numberInput.mount(container);
 * numberInput.activate();
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
  isEnumType,
  internalToDisplay,
  displayToInternal,
  getValidatedInputValue,
  incrementValue,
  decrementValue,
  formatDisplayValue,
  getSliderPercentage
} from './func.js';

export class InputNumber extends Component {
  /**
   * Crea un'istanza di InputNumber
   * @param {number} paramId - ID del parametro da modificare
   * @param {Function} onConfirm - Callback per navigazione dopo conferma
   */
  constructor({ paramId, onConfirm = null }) {
    super();
    
    // Valida paramId
    if (typeof paramId !== 'number') {
      log.error('InputNumber', 'paramId deve essere un numero', paramId);
      throw new Error('InputNumber: paramId obbligatorio');
    }
    
    this.paramId = paramId;
    this.onConfirm = onConfirm;
    
    // Config del parametro (caricato da Store)
    this.config = null;
    
    // State interno (valore display in float)
    this.state = {
      displayValue: 0  // Valore visualizzato (già convertito con divisor)
    };
    
    // Flag per determinare se è enum
    this.isEnum = false;
    
    // Riferimenti DOM
    this.refs = {};
    
    // ⚠️ CRITICAL: Carica il parametro SUBITO
    this._loadParameter();
    
    // Abilita aggiornamento automatico traduzioni
    this.enableI18n(() => this._updateLabels());
    
    log.debug('InputNumber', `Creato componente per parametro ID=${paramId}`, this.config);
  }

  /**
   * Lifecycle: componente creato
   */
  onCreate() {
    // Il caricamento parametro avviene nel constructor
  }

  /**
   * Lifecycle: componente montato
   */
  onMount() {
    log.debug('InputNumber', 'onMount');
    
    if (!this.config) {
      log.error('InputNumber', 'Cannot mount InputNumber without valid parameter config');
      return;
    }
    
    // Cache riferimenti DOM
    this._cacheRefs();
    
    // Bind eventi
    this._bindEvents();
    
    // Subscribe a cambio parametri nello Store
    this.subscribeToStore(Paths.CONFIG.PARAMS, (params) => {
      const updated = params.find(p => p.id === this.paramId);
      if (updated) {
        log.debug('InputNumber', `Parametro ${this.paramId} aggiornato`, updated);
        this.config = updated;
        this._updateFromStore();
      }
    });
  }

  /**
   * Lifecycle: componente attivato
   */
  onActivate() {
    log.debug('InputNumber', 'onActivate');
    this._updateDisplay();
  }

  /**
   * Lifecycle: componente distrutto
   */
  onDestroy() {
    log.debug('InputNumber', 'onDestroy');
    this.config = null;
    this.refs = {};
  }

  /**
   * Renderizza il componente
   */
  render() {
    if (!this.config) {
      return `<div class="parameter-settings-card">Caricamento...</div>`;
    }

    // Traduzioni (usa lingua corrente)
    const defaultLabel = i18n.t('ui.reset');
    const confirmLabel = i18n.t('ui.confirm');
    
    // Determina se mostrare lo slider (solo per numerici, non per enum)
    const showSlider = !this.isEnum;
    
    return `
      <div class="parameter-settings-card">
        <!-- Value and Slider Container -->
        <div class="parameter-value-slider-container">
          
          <!-- Value Display with Arrows -->
          <div class="parameter-display-section">
            <!-- Left Arrow -->
            <button class="parameter-arrow-btn" data-ref="leftArrow" aria-label="Decrease value">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            
            <!-- Value Display -->
            <div class="parameter-value-display" data-ref="valueDisplay">--</div>
            
            <!-- Right Arrow -->
            <button class="parameter-arrow-btn" data-ref="rightArrow" aria-label="Increase value">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>

          <!-- Slider Section (hidden for enum types) -->
          <div class="parameter-slider-section ${showSlider ? '' : 'hidden'}" data-ref="sliderSection">
            <div class="parameter-slider-container">
              <input 
                type="range" 
                class="parameter-slider" 
                data-ref="slider"
                min="0" 
                max="100" 
                step="0.1" 
                value="50"
              >
            </div>
            <div class="parameter-slider-labels">
              <span class="parameter-slider-label" data-ref="minLabel">0</span>
              <span class="parameter-slider-label" data-ref="maxLabel">100</span>
            </div>
          </div>

        </div>

        <!-- Action Buttons -->
        <div class="parameter-action-bar">
          <button class="parameter-btn parameter-btn-default" data-ref="defaultBtn">${defaultLabel}</button>
          <button class="parameter-btn parameter-btn-confirm" data-ref="confirmBtn">${confirmLabel}</button>
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
      log.error('InputNumber', `Parametro ${this.paramId} non trovato nello Store`);
      return;
    }
    
    // Determina se è enum
    this.isEnum = isEnumType(this.config.type);
    
    // Inizializza state con valore corrente (convertito a display)
    this.state.displayValue = internalToDisplay(
      this.config.value,
      this.config.divisor || 1
    );
    
    log.debug('InputNumber', `Parametro caricato (enum: ${this.isEnum}):`, this.config);
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
    
    log.debug('InputNumber', `Cached ${Object.keys(this.refs).length} refs`);
  }

  /**
   * Bind eventi DOM
   * @private
   */
  _bindEvents() {
    if (!this.refs) return;
    
    // Arrows
    this._addClick('leftArrow', () => this._decrement());
    this._addClick('rightArrow', () => this._increment());
    
    // Value display (click to edit - solo per numerici)
    if (!this.isEnum) {
      this._addClick('valueDisplay', () => this._makeEditable());
    }
    
    // Slider (solo per numerici)
    if (!this.isEnum && this.refs.slider) {
      this.refs.slider.addEventListener('input', (e) => this._handleSliderChange(e));
    }
    
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
  // PRIVATE METHODS - Logica Parametro
  // ============================================

  /**
   * Incrementa valore con logica ciclica
   * @private
   */
  _increment() {
    if (this.isEnum) {
      // Per enum: ciclo tra valori discreti
      const maxEnumValue = this.config.max;
      this.state.displayValue = (this.state.displayValue + 1) % (maxEnumValue + 1);
    } else {
      // Per numerici: incremento con step
      const min = internalToDisplay(this.config.min, this.config.divisor || 1);
      const max = internalToDisplay(this.config.max, this.config.divisor || 1);
      const step = internalToDisplay(this.config.step, this.config.divisor || 1);
      
      this.state.displayValue = incrementValue(this.state.displayValue, min, max, step);
    }
    
    this._updateDisplay();
  }

  /**
   * Decrementa valore con logica ciclica
   * @private
   */
  _decrement() {
    if (this.isEnum) {
      // Per enum: ciclo tra valori discreti
      const maxEnumValue = this.config.max;
      this.state.displayValue = this.state.displayValue === 0 
        ? maxEnumValue 
        : this.state.displayValue - 1;
    } else {
      // Per numerici: decremento con step
      const min = internalToDisplay(this.config.min, this.config.divisor || 1);
      const max = internalToDisplay(this.config.max, this.config.divisor || 1);
      const step = internalToDisplay(this.config.step, this.config.divisor || 1);
      
      this.state.displayValue = decrementValue(this.state.displayValue, min, max, step);
    }
    
    this._updateDisplay();
  }

  /**
   * Handler per cambio slider
   * @private
   */
  _handleSliderChange(event) {
    const value = parseFloat(event.target.value);
    const step = internalToDisplay(this.config.step, this.config.divisor || 1);
    
    // Arrotonda allo step
    this.state.displayValue = Math.round(value / step) * step;
    
    this._updateDisplay();
  }

  /**
   * Rende il valore editabile tramite input (solo numerici)
   * @private
   */
  _makeEditable() {
    if (this.isEnum) return; // Non editabile per enum
    
    const valueElement = this.refs.valueDisplay;
    if (!valueElement) return;
    
    const currentValue = this.state.displayValue;
    const min = internalToDisplay(this.config.min, this.config.divisor || 1);
    const max = internalToDisplay(this.config.max, this.config.divisor || 1);
    const step = internalToDisplay(this.config.step, this.config.divisor || 1);
    
    // Crea input
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'parameter-value-input';
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = currentValue;
    
    // Sostituisci elemento
    valueElement.replaceWith(input);
    input.focus();
    input.select();
    
    // Handler per fine edit
    const finishEdit = () => {
      const newValue = getValidatedInputValue(
        input.value,
        currentValue,
        min,
        max,
        step
      );
      
      this.state.displayValue = newValue;
      
      // Ripristina elemento originale
      input.replaceWith(valueElement);
      
      // Aggiorna display
      this._updateDisplay();
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
   * Aggiorna il display del valore
   * @private
   */
  _updateDisplay() {
    if (!this.refs.valueDisplay) return;
    
    if (this.isEnum) {
      // Per enum: mostra label tradotta usando i18n.tEnum()
      const enumLabel = i18n.tEnum(this.config.type, this.state.displayValue);
      this.refs.valueDisplay.textContent = enumLabel;
    } else {
      // Per numerici: formatta con decimali e unità
      const step = internalToDisplay(this.config.step, this.config.divisor || 1);
      const formatted = formatDisplayValue(
        this.state.displayValue,
        step,
        this.config.unit || ''
      );
      this.refs.valueDisplay.textContent = formatted;
      
      // Aggiorna slider
      if (this.refs.slider) {
        const min = internalToDisplay(this.config.min, this.config.divisor || 1);
        const max = internalToDisplay(this.config.max, this.config.divisor || 1);
        
        this.refs.slider.min = min;
        this.refs.slider.max = max;
        this.refs.slider.step = step;
        this.refs.slider.value = this.state.displayValue;
        
        // Aggiorna progress color
        this._updateSliderProgress();
      }
      
      // Aggiorna label min/max
      if (this.refs.minLabel && this.refs.maxLabel) {
        const min = internalToDisplay(this.config.min, this.config.divisor || 1);
        const max = internalToDisplay(this.config.max, this.config.divisor || 1);
        
        this.refs.minLabel.textContent = formatDisplayValue(min, step, this.config.unit || '');
        this.refs.maxLabel.textContent = formatDisplayValue(max, step, this.config.unit || '');
      }
    }
    
    log.debug('InputNumber', `Display aggiornato: ${this.state.displayValue}`);
  }

  /**
   * Aggiorna il colore del progresso dello slider
   * @private
   */
  _updateSliderProgress() {
    if (!this.refs.slider || this.isEnum) return;
    
    const min = internalToDisplay(this.config.min, this.config.divisor || 1);
    const max = internalToDisplay(this.config.max, this.config.divisor || 1);
    const percentage = getSliderPercentage(this.state.displayValue, min, max);
    
    this.refs.slider.style.background = `linear-gradient(to right, var(--brand) 0%, var(--brand) ${percentage}%, var(--border) ${percentage}%, var(--border) 100%)`;
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
    
    // Imposta valore di default (convertito a display)
    this.state.displayValue = internalToDisplay(
      this.config.default,
      this.config.divisor || 1
    );
    
    this._updateDisplay();
    
    log.debug('InputNumber', `Reset a default: ${this.config.default}`);
  }

  /**
   * Handler per pulsante Conferma
   * @private
   */
  _handleConfirm() {
    if (!this.config) return;
    
    // Converti valore display in valore interno (intero)
    const internalValue = displayToInternal(
      this.state.displayValue,
      this.config.divisor || 1
    );
    
    // Validazione finale
    if (internalValue < this.config.min || internalValue > this.config.max) {
      log.error('InputNumber', `Valore fuori range: ${internalValue} (min: ${this.config.min}, max: ${this.config.max})`);
      return;
    }
    
    // Invia comando a ESP
    log.debug('InputNumber', `Invio comando: MODIFY_PARAM ${this.paramId} = ${internalValue}`);
    CommandManager.modifyParameter(this.paramId, internalValue);
    
    // Callback per navigazione
    if (this.onConfirm) {
      this.onConfirm();
    }
  }

  // ============================================
  // PRIVATE METHODS - Updates
  // ============================================

  /**
   * Aggiorna state da Store (quando ESP risponde con ACK)
   * @private
   */
  _updateFromStore() {
    if (!this.config) return;
    
    // Aggiorna state con nuovo valore (convertito a display)
    this.state.displayValue = internalToDisplay(
      this.config.value,
      this.config.divisor || 1
    );
    
    this._updateDisplay();
  }

  /**
   * Aggiorna le label quando cambia lingua
   * @private
   */
  _updateLabels() {
    if (!this.el) return;
    
    // Aggiorna pulsanti
    if (this.refs.defaultBtn) {
      this.refs.defaultBtn.textContent = i18n.t('ui.reset');
    }
    if (this.refs.confirmBtn) {
      this.refs.confirmBtn.textContent = i18n.t('ui.confirm');
    }
    
    // Se è enum, rigenera il display (per label tradotte)
    if (this.isEnum) {
      this._updateDisplay();
    }
    
    log.debug('InputNumber', 'Labels aggiornate');
  }
}
