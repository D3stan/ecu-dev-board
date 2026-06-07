/**
 * WifiCredentialCard.js
 * =====================
 * Componente per l'invio delle credenziali WiFi (SSID + Password).
 * 
 * Funzionalità:
 * - Titolo = SSID della rete
 * - Input per password (precompilato se network.psw presente)
 * - Se rete aperta (secure=false) → input disabilitato, send abilitato
 * - Subscribe a Paths.WIFI.UI_WAITING per loader
 * - Usa flag selfTriggered per gestire loader solo se send partito da questo componente
 * 
 * @author FogExtra Team
 * @version 1.0.0
 */

import { WiFiCardInputSendBase } from './WiFiCardInputSendBase.js';
import { Store } from '../../core/store.js';
import { Paths } from '../../utils/paths.js';
import { log } from '../../utils/logger.js';
import { CommandManager } from '../../managers/commandManager.js';
import { validateWifiCredentials, getNetworkPassword } from './logic.js';

export class WifiCredentialCard extends WiFiCardInputSendBase {
  /**
   * Crea un'istanza di WifiCredentialCard
   * @param {Object} network - Oggetto network { ssid, rssi, secure, known, psw }
   */
  constructor({ network }) {
    super();
    
    // Valida network
    if (!network || !network.ssid) {
      throw new Error('WifiCredentialCard requires a valid network object with ssid');
    }
    
    this.network = network;
    
    // Flag per tracciare se il send è partito da questo componente
    this.selfTriggered = false;
    
    log.debug('WifiCredentialCard', `Created for SSID: "${network.ssid}"`);
  }

  /**
   * Lifecycle: componente montato
   */
  onMount() {
    super.onMount();
    
    // Subscribe a flag di attesa risultato connessione
    this.subscribeToStore(Paths.WIFI.UI_WAITING, (isWaiting) => {
      this._handleWaitingResult(isWaiting);
    });
    
    // Se rete aperta, disabilita input
    if (!this._isSecureNetwork()) {
      this._setInputDisabled(true);
    }
    
    log.debug('WifiCredentialCard', 'Mounted and subscribed to Store');
  }

  /**
   * Lifecycle: componente attivato
   */
  onActivate() {
    super.onActivate();
    
    log.debug('WifiCredentialCard', 'Activated');
  }

  // ============================================
  // OVERRIDE PROTECTED METHODS
  // ============================================

  /**
   * Restituisce il titolo del componente
   * @protected
   * @returns {string} SSID della rete
   */
  getTitle() {
    return this.network.ssid;
  }

  /**
   * Restituisce il placeholder dell'input
   * @protected
   * @returns {string} Placeholder
   */
  getPlaceholder() {
    if (!this._isSecureNetwork()) {
      return 'Open Network';
    }
    
    return 'Password';
  }

  /**
   * Restituisce il valore iniziale
   * @protected
   * @returns {string} Password salvata o vuota
   */
  getInitialValue() {
    return getNetworkPassword(this.network);
  }

  /**
   * Invia le credenziali WiFi all'ESP32
   * @protected
   * @param {string} password - Password inserita
   */
  send(password) {
    const ssid = this.network.ssid;
    const secure = this._isSecureNetwork();
    
    log.debug('WifiCredentialCard', `send() called - SSID: "${ssid}", secure: ${secure}`);
    
    // Valida credenziali
    const validation = validateWifiCredentials(ssid, password, secure);
    
    if (!validation.valid) {
      log.error('WifiCredentialCard', `Validation failed: ${validation.error}`);
      // TODO: Mostrare errore all'utente (toast o messaggio)
      return;
    }
    
    // Imposta flag per tracciare che il send è partito da qui
    this.selfTriggered = true;
    
    // Imposta flag waiting nello Store
    // NOTA: Questo è l'unico parametro impostato lato webApp
    Store.set(Paths.WIFI.UI_WAITING, true);
    
    // Mostra loader
    this._setWaiting(true);
    
    // Invia comando
    try {
      CommandManager.setWifiCredentials(ssid, password);
      log.info('WifiCredentialCard', `Credentials sent for SSID: "${ssid}"`);
    } catch (error) {
      log.error('WifiCredentialCard', `Error sending credentials:`, error);
      
      // Reset stato in caso di errore
      this.selfTriggered = false;
      Store.set(Paths.WIFI.UI_WAITING, false);
      this._setWaiting(false);
    }
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  /**
   * Gestisce cambio flag waiting result dallo Store
   * @private
   * @param {boolean} isWaiting - True se in attesa risultato
   */
  _handleWaitingResult(isWaiting) {
    log.debug('WifiCredentialCard', `IS_WAITING_RESULT changed: ${isWaiting}, selfTriggered: ${this.selfTriggered}`);
    
    // Gestisci loader solo se il send è partito da questo componente
    if (!this.selfTriggered) {
      return;
    }
    
    if (isWaiting) {
      // Mantieni loader attivo
      this._setWaiting(true);
    } else {
      // Risultato ricevuto, ferma loader
      this._setWaiting(false);
      
      // Reset flag
      this.selfTriggered = false;
      
      log.debug('WifiCredentialCard', 'Connection result received, loader stopped');
    }
  }

  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Aggiorna l'oggetto network
   * @param {Object} network - Nuovo oggetto network
   */
  updateNetwork(network) {
    if (!network || !network.ssid) {
      log.error('WifiCredentialCard', 'Invalid network object');
      return;
    }
    
    this.network = network;
    
    // Aggiorna titolo
    this.updateTitle(network.ssid);
    
    // Aggiorna valore
    this._updateInput(getNetworkPassword(network));
    
    // Aggiorna stato input (disabilita se rete aperta)
    this._setInputDisabled(!(network.secure ?? !network.isOpen));
    
    log.debug('WifiCredentialCard', `Network updated: "${network.ssid}"`);
  }

  _isSecureNetwork() {
    // New Wi-Fi store model uses `isOpen`; keep compatibility with `secure`.
    if (typeof this.network.secure === 'boolean') return this.network.secure;
    if (typeof this.network.isOpen === 'boolean') return !this.network.isOpen;
    return true;
  }
}
