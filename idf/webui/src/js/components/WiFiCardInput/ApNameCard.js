/**
 * ApNameCard.js
 * =============
 * Componente per la modifica del nome Access Point dell'ESP32.
 * 
 * Funzionalità:
 * - Mostra titolo tradotto (i18n)
 * - Mostra valore attuale da Store (config.paramsStr[AP_NAME_PARAM_ID_STR])
 * - Permette modifica e invio via CommandManager
 * - Mostra loader durante invio
 * - Aggiorna automaticamente quando arriva ACK
 * 
 * @author FogExtra Team
 * @version 1.0.0
 */

import { WiFiCardInputSendBase } from './WiFiCardInputSendBase.js';
import { Store } from '../../core/store.js';
import { Paths } from '../../utils/paths.js';
import { i18n } from '../../utils/i18n.js';
import { log } from '../../utils/logger.js';
import { CommandManager } from '../../managers/commandManager.js';
import { AP_NAME_PARAM_ID_STR } from '../../utils/constants.js';
import { shouldSend, truncateString, validateStringParam } from './logic.js';

export class ApNameCard extends WiFiCardInputSendBase {
  /**
   * Crea un'istanza di ApNameCard
   */
  constructor() {
    super();
    
    // Valore precedente per confronto
    this.previousValue = '';
    
    // Abilita aggiornamento automatico traduzioni
    this.enableI18n(() => this._updateLabels());
    
    log.debug('ApNameCard', 'Created');
  }

  /**
   * Lifecycle: componente montato
   */
  onMount() {
    super.onMount();
    
    // Subscribe a cambio parametri stringa
    this.subscribeToStore(Paths.CONFIG.PARAMS_STR, (paramsStr) => {
      this._handleParamsStrUpdate(paramsStr);
    });
    
    log.debug('ApNameCard', 'Mounted and subscribed to Store');
  }

  /**
   * Lifecycle: componente attivato
   */
  onActivate() {
    super.onActivate();
    
    // Carica valore iniziale dallo Store
    const paramsStr = Store.get(Paths.CONFIG.PARAMS_STR);
    this._handleParamsStrUpdate(paramsStr);
    
    log.debug('ApNameCard', 'Activated');
  }

  // ============================================
  // OVERRIDE PROTECTED METHODS
  // ============================================

  /**
   * Restituisce il titolo del componente
   * @protected
   * @returns {string} Titolo tradotto
   */
  getTitle() {
    return i18n.t('paramsStr.apName');
  }

  /**
   * Restituisce il placeholder dell'input
   * @protected
   * @returns {string} Placeholder
   */
  getPlaceholder() {
    return 'Enter AP name...';
  }

  /**
   * Restituisce il valore iniziale
   * @protected
   * @returns {string} Valore dallo Store
   */
  getInitialValue() {
    const paramsStr = Store.get(Paths.CONFIG.PARAMS_STR);
    
    if (!paramsStr || !Array.isArray(paramsStr)) {
      log.warn('ApNameCard', 'paramsStr not available in Store');
      return '';
    }
    
    const param = paramsStr[AP_NAME_PARAM_ID_STR];
    
    if (!param || !param.value) {
      log.warn('ApNameCard', `Param ID ${AP_NAME_PARAM_ID_STR} not found`);
      return '';
    }
    
    return param.value;
  }

  /**
   * Invia il nuovo valore all'ESP32
   * @protected
   * @param {string} value - Valore da inviare
   */
  send(value) {
    log.debug('ApNameCard', `send() called with value: "${value}"`);
    
    // Valida il valore
    const validation = validateStringParam(value);
    
    if (!validation.valid) {
      log.error('ApNameCard', `Validation failed: ${validation.error}`);
      return;
    }
    
    const validValue = validation.value;
    
    // Tronca se necessario
    const truncated = truncateString(validValue);
    
    // Verifica se serve inviare
    if (!shouldSend(truncated, this.previousValue)) {
      log.debug('ApNameCard', 'Value unchanged, skipping send');
      return;
    }
    
    // Mostra loader
    this._setWaiting(true);
    
    // Invia comando
    try {
      CommandManager.modifyStringParameter(AP_NAME_PARAM_ID_STR, truncated);
      log.info('ApNameCard', `Command sent: AP Name = "${truncated}"`);
    } catch (error) {
      log.error('ApNameCard', `Error sending command:`, error);
      this._setWaiting(false);
    }
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  /**
   * Gestisce aggiornamento parametri stringa dallo Store
   * @private
   * @param {Array} paramsStr - Array parametri stringa
   */
  _handleParamsStrUpdate(paramsStr) {
    if (!paramsStr || !Array.isArray(paramsStr)) {
      log.warn('ApNameCard', 'Invalid paramsStr received');
      return;
    }
    
    const param = paramsStr[AP_NAME_PARAM_ID_STR];
    
    if (!param || !param.value) {
      log.warn('ApNameCard', `Param ID ${AP_NAME_PARAM_ID_STR} not found in update`);
      return;
    }
    
    const newValue = param.value;
    
    log.debug('ApNameCard', `Store updated: AP Name = "${newValue}"`);
    
    // Aggiorna input se valore cambiato
    if (newValue !== this._getCurrentValue()) {
      this._updateInput(newValue);
      this.previousValue = newValue;
    }
    
    // Disattiva loader (ACK ricevuto)
    if (this.state.isWaiting) {
      this._setWaiting(false);
      log.debug('ApNameCard', 'ACK received, loader stopped');
    }
  }

  /**
   * Aggiorna le label quando cambia lingua
   * @private
   */
  _updateLabels() {
    const newTitle = this.getTitle();
    this.updateTitle(newTitle);
    
    log.debug('ApNameCard', `Labels updated: "${newTitle}"`);
  }
}
