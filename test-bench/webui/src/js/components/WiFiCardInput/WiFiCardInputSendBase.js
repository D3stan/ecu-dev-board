/**
 * WiFiCardInputSendBase.js
 * =========================
 * Classe base per i componenti WiFi Card Input.
 * 
 * Gestisce:
 * - UI comune (titolo, input, bottone send)
 * - Stati (waiting, value)
 * - Rendering loader animato
 * - Eventi input e click
 * 
 * I componenti derivati implementano:
 * - send(value): logica di invio specifica
 * - getTitle(): titolo del componente
 * - getPlaceholder(): placeholder dell'input
 * - getInitialValue(): valore iniziale
 * 
 * @author FogExtra Team
 * @version 1.0.0
 */

import { Component } from '../../core/Component.js';
import { log } from '../../utils/logger.js';

export class WiFiCardInputSendBase extends Component {
  /**
   * Crea un'istanza di WiFiCardInputSendBase
   */
  constructor() {
    super();
    
    // Stato interno
    this.state = {
      isWaiting: false,        // Flag loader attivo
      currentValue: '',        // Valore corrente input
      inputDisabled: false     // Flag input disabilitato
    };
    
    // Riferimenti DOM
    this.refs = {
      titleEl: null,
      inputEl: null,
      btnEl: null,
      btnContentEl: null
    };
    
    log.debug('WiFiCardInputSendBase', 'Created');
  }

  /**
   * Lifecycle: componente creato
   */
  onCreate() {
    log.debug('WiFiCardInputSendBase', 'onCreate');
  }

  /**
   * Lifecycle: componente montato
   */
  onMount() {
    log.debug('WiFiCardInputSendBase', 'onMount');
    
    // Cache riferimenti DOM
    this._cacheRefs();
    
    // Bind eventi
    this._bindEvents();
    
    // Imposta valore iniziale
    this._updateInput(this.getInitialValue());
  }

  /**
   * Lifecycle: componente attivato
   */
  onActivate() {
    log.debug('WiFiCardInputSendBase', 'onActivate');
  }

  /**
   * Lifecycle: componente distrutto
   */
  onDestroy() {
    log.debug('WiFiCardInputSendBase', 'onDestroy');
    this.refs = {};
  }

  /**
   * Renderizza il componente
   * @returns {string} HTML del componente
   */
  render() {
    const title = this.getTitle();
    const placeholder = this.getPlaceholder();
    
    return `
      <div class="wifi-card-input">
        <h3 class="card-title">${title}</h3>
        <div class="input-row">
          <div class="input-wrapper">
            <input 
              type="text" 
              class="value-input" 
              placeholder="${placeholder}"
            />
          </div>
          <button class="send-btn">
            ${this._renderButtonIcon()}
          </button>
        </div>
      </div>
    `;
  }

  // ============================================
  // PROTECTED METHODS (Override in subclass)
  // ============================================

  /**
   * Restituisce il titolo del componente
   * @protected
   * @returns {string} Titolo
   */
  getTitle() {
    return 'WiFi Card';
  }

  /**
   * Restituisce il placeholder dell'input
   * @protected
   * @returns {string} Placeholder
   */
  getPlaceholder() {
    return 'Enter value...';
  }

  /**
   * Restituisce il valore iniziale
   * @protected
   * @returns {string} Valore iniziale
   */
  getInitialValue() {
    return '';
  }

  /**
   * Metodo astratto: invia il valore
   * Implementato dalle classi derivate
   * @protected
   * @param {string} value - Valore da inviare
   */
  send(value) {
    log.warn('WiFiCardInputSendBase', 'send() not implemented in subclass');
  }

  // ============================================
  // PROTECTED METHODS (Usabili da subclass)
  // ============================================

  /**
   * Imposta lo stato waiting (mostra/nascondi loader)
   * @protected
   * @param {boolean} state - True per mostrare loader
   */
  _setWaiting(state) {
    this.state.isWaiting = state;
    
    if (!this.refs.btnContentEl) return;
    
    // Aggiorna contenuto bottone
    this.refs.btnContentEl.innerHTML = this._renderButtonIcon();

    // Button subtree changed (icon/loader): rescan deferred image bridge
    this.refreshDeferredImages();
    
    // Disabilita input durante attesa
    if (this.refs.inputEl) {
      this.refs.inputEl.disabled = state;
    }
    
    log.debug('WiFiCardInputSendBase', `Waiting state: ${state}`);
  }

  /**
   * Aggiorna il valore dell'input
   * @protected
   * @param {string} value - Nuovo valore
   */
  _updateInput(value) {
    this.state.currentValue = value;
    
    if (this.refs.inputEl) {
      this.refs.inputEl.value = value;
    }
    
    log.debug('WiFiCardInputSendBase', `Input updated: "${value}"`);
  }

  /**
   * Disabilita/abilita l'input
   * @protected
   * @param {boolean} disabled - True per disabilitare
   */
  _setInputDisabled(disabled) {
    this.state.inputDisabled = disabled;
    
    if (this.refs.inputEl) {
      this.refs.inputEl.disabled = disabled;
    }
    
    log.debug('WiFiCardInputSendBase', `Input disabled: ${disabled}`);
  }

  /**
   * Ottiene il valore corrente dell'input
   * @protected
   * @returns {string} Valore corrente
   */
  _getCurrentValue() {
    return this.refs.inputEl ? this.refs.inputEl.value : this.state.currentValue;
  }

  // ============================================
  // PRIVATE METHODS - DOM Management
  // ============================================

  /**
   * Cache riferimenti DOM
   * @private
   */
  _cacheRefs() {
    if (!this.el) return;
    
    this.refs.titleEl = this.el.querySelector('.card-title');
    this.refs.inputEl = this.el.querySelector('.value-input');
    this.refs.btnEl = this.el.querySelector('.send-btn');
    
    // Il contenuto del bottone cambia dinamicamente (icona ↔ loader)
    // Per evitare di ricreare tutto il bottone, usiamo un wrapper
    if (this.refs.btnEl) {
      this.refs.btnContentEl = this.refs.btnEl;
    }
    
    log.debug('WiFiCardInputSendBase', 'DOM refs cached');
  }

  /**
   * Bind eventi DOM
   * @private
   */
  _bindEvents() {
    if (!this.refs.btnEl || !this.refs.inputEl) return;
    
    // Click su bottone Send
    this.refs.btnEl.addEventListener('click', () => this._handleSendClick());
    
    // Enter nell'input
    this.refs.inputEl.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this._handleSendClick();
      }
    });
    
    log.debug('WiFiCardInputSendBase', 'Events bound');
  }

  /**
   * Handler click su bottone Send
   * @private
   */
  _handleSendClick() {
    if (this.state.isWaiting) {
      log.debug('WiFiCardInputSendBase', 'Send clicked but already waiting');
      return;
    }
    
    const value = this._getCurrentValue();
    
    log.debug('WiFiCardInputSendBase', `Send clicked with value: "${value}"`);
    
    // Chiama il metodo send() implementato dalla subclass
    this.send(value);
  }

  /**
   * Renderizza l'icona del bottone o il loader
   * @private
   * @returns {string} HTML icona/loader
   */
  _renderButtonIcon() {
    if (this.state.isWaiting) {
      return this._renderLoader();
    }
    
    return `<img data-asset-key="icon-send" class="icon-send" alt="Send" />`;
  }

  /**
   * Renderizza il loader animato
   * @private
   * @returns {string} HTML loader
   */
  _renderLoader() {
    return `<div class="loader"></div>`;
  }

  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Aggiorna il titolo
   * @param {string} title - Nuovo titolo
   */
  updateTitle(title) {
    if (this.refs.titleEl) {
      this.refs.titleEl.textContent = title;
    }
  }

  /**
   * Aggiorna il valore visualizzato
   * @param {string} value - Nuovo valore
   */
  updateValue(value) {
    this._updateInput(value);
  }
}
