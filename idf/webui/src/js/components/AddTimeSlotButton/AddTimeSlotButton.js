/**
 * AddTimeSlotButton.js
 * ====================
 * Pulsante per aggiungere un nuovo time slot.
 * 
 * Features:
 * - Testo tradotto automaticamente (i18n)
 * - Callback onClick personalizzabile
 * - Stile dashed border con icona +
 * - Hover effect con brand color
 * 
 * @author FogExtra Team
 * @version 1.0.0
 */

import { Component } from '../../core/Component.js';
import { i18n } from '../../utils/i18n.js';
import { log } from '../../utils/logger.js';

export class AddTimeSlotButton extends Component {
  /**
   * Create AddTimeSlotButton instance.
   * 
   * @param {Object} options - Component configuration
   * @param {Function} options.onClick - Callback function when button is clicked
   */
  constructor(options = {}) {
    super({
      id: options.id || 'add-timeslot-btn',
      ...options
    });

    // Callback per click
    this.onClick = options.onClick || (() => {
      log.warn('AddTimeSlotButton', 'No onClick callback provided');
    });

    // Abilita aggiornamento automatico traduzioni
    this.enableI18n(() => this._updateText());

    log.debug('AddTimeSlotButton', 'Created');
  }

  /**
   * Called when component is created.
   */
  onCreate() {
    super.onCreate();
    log.debug('AddTimeSlotButton', 'onCreate');
  }

  /**
   * Render button HTML.
   * 
   * @returns {HTMLElement} Button element
   */
  render() {
    const button = document.createElement('button');
    button.className = 'add-timeslot-btn';
    button.type = 'button';

    // SVG + icon
    button.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      <span class="add-timeslot-text">${i18n.t('ui.addTimeSlot')}</span>
    `;

    return button;
  }

  /**
   * Called when component is mounted to DOM.
   */
  onMount() {
    super.onMount();
    
    // Registra evento click con cleanup automatico
    this.addEventListener(this.el, 'click', this._handleClick.bind(this));

    log.debug('AddTimeSlotButton', 'onMount - Event listener registered');
  }

  /**
   * Gestisce il click sul pulsante.
   * 
   * @private
   */
  _handleClick(event) {
    event.preventDefault();
    event.stopPropagation();

    log.debug('AddTimeSlotButton', 'Button clicked');

    // Chiama callback fornito dal parent
    if (typeof this.onClick === 'function') {
      this.onClick();
    }
  }

  /**
   * Aggiorna il testo tradotto.
   * Chiamato automaticamente al cambio lingua (via enableI18n).
   * 
   * @private
   */
  _updateText() {
    if (!this.el) return;

    const textSpan = this.el.querySelector('.add-timeslot-text');
    if (textSpan) {
      textSpan.textContent = i18n.t('ui.addTimeSlot');
      log.debug('AddTimeSlotButton', 'Text updated to:', textSpan.textContent);
    }
  }

  /**
   * Mostra il pulsante.
   * @public
   */
  show() {
    if (!this.el) return;
    
    this.el.style.display = '';
    log.debug('AddTimeSlotButton', 'Button shown');
  }

  /**
   * Nasconde il pulsante.
   * @public
   */
  hide() {
    if (!this.el) return;
    
    this.el.style.display = 'none';
    log.debug('AddTimeSlotButton', 'Button hidden');
  }

  /**
   * Called when component is destroyed.
   */
  onDestroy() {
    super.onDestroy();
    log.debug('AddTimeSlotButton', 'onDestroy');
  }
}
