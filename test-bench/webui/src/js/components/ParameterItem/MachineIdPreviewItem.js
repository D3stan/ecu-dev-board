/**
 * MachineIdPreviewItem.js
 * =======================
 * Componente speciale per visualizzare l'ID Macchina nell'applicazione FOG EXTRA.
 * 
 * Questo componente è una "vista speciale" sul parametro Modbus Device ID (id=40).
 * NON crea un nuovo parametro: usa esattamente il parametro 40 già esistente nello Store.
 * 
 * Caratteristiche:
 * - Estende ParameterItem per riutilizzare il comportamento base
 * - Rimuove l'icona a sinistra
 * - Aggiunge un "recap box" con le informazioni derivate dal valore:
 *   - Modbus ID: X
 *   - Wi-Fi AP: fogExtra-X
 *   - DNS locale: fogextra-X.local
 * 
 * - Click sulla card → naviga a parameterEditorPage per modificare il parametro 40
 * - Completamente reattivo: si aggiorna quando il parametro 40 cambia nello Store
 * - Supporta cambio lingua con traduzioni i18n
 * 
 * @author FogExtra Team
 * @version 1.0.0
 */

import { ParameterItem } from './ParameterItem.js';
import { Store } from '../../core/store.js';
import { Paths } from '../../utils/paths.js';
import { i18n } from '../../utils/i18n.js';
import { log } from '../../utils/logger.js';
import { MODBUS_DEVICE_ID_PARAM_ID, ParamType } from '../../utils/constants.js';
import { getParameterDisplayValue } from '../../utils/paramHelpers.js';

/**
 * Prefisso per l'Access Point Wi-Fi
 */
const WIFI_AP_PREFIX = 'FogExtra-';

/**
 * Prefisso per il DNS locale
 */
const DNS_PREFIX = 'fogextra-';

/**
 * Suffisso per il DNS locale
 */
const DNS_SUFFIX = '.local';

export class MachineIdPreviewItem extends ParameterItem {
  /**
   * Crea un'istanza di MachineIdPreviewItem
   * @param {Function} onClick - Callback per click su card (navigazione a editor)
   * @param {Function} onInfoClick - Callback per click su info button
   */
  constructor(onClick = null, onInfoClick = null) {
    // Ottieni il parametro Modbus Device ID dallo Store
    const params = Store.get(Paths.CONFIG.PARAMS) || [];
    let modbusParam = params.find(p => p.id === MODBUS_DEVICE_ID_PARAM_ID);
    
    // Se il parametro non è ancora disponibile, crea un placeholder
    if (!modbusParam) {
      log.warn('MachineIdPreviewItem', `Parameter ID ${MODBUS_DEVICE_ID_PARAM_ID} not found in Store, using placeholder`);
      modbusParam = {
        id: MODBUS_DEVICE_ID_PARAM_ID,
        value: 1,
        type: ParamType.NUMBER,
        min: 1,
        max: 247,
        unit: '',
        divisor: 1,
        offset: 0,
        menuType: 6  // OTHER
      };
    }
    
    // Chiama il costruttore di ParameterItem
    // Nota: ParameterItem applicherà enrichParamWithTranslations, ma noi sovrascriveremo name e ds
    super(modbusParam, onClick, null, onInfoClick);
    
    // Sovrascrivi nome e descrizione con traduzioni custom
    this._applyCustomTranslations();
    
    log.debug('MachineIdPreviewItem', `Created with value: ${this.param.value}`);
  }

  /**
   * Lifecycle: componente montato nel DOM
   */
  onMount() {
    log.debug('MachineIdPreviewItem', `onMount - ${this.param.name}`);
    
    // Bind eventi DOM
    this._bindEvents();
    
    // Subscribe a cambio parametri per aggiornare valore
    this.subscribeToStore(Paths.CONFIG.PARAMS, (params) => {
      log.debug('MachineIdPreviewItem', `🔔 PARAMS changed notification`);
      const updated = params.find(p => p.id === MODBUS_DEVICE_ID_PARAM_ID);
      
      if (updated) {
        const hasValueChanged = updated.value !== this.param.value;
        
        if (hasValueChanged) {
          log.debug('MachineIdPreviewItem', `✨ Value changed: ${this.param.value} → ${updated.value}`);
          
          // Aggiorna il parametro interno
          this.param = {
            ...updated,
            name: this.param.name,  // Mantieni nome custom
            ds: this.param.ds       // Mantieni descrizione custom
          };
          
          // Aggiorna UI (valore + recap box)
          this._updateValue();
          this._updateRecapBox();
        }
      }
    });
    
    // NOTA: La subscription al cambio lingua è gestita da Component.enableI18n() nel costruttore di ParameterItem
  }

  /**
   * Applica traduzioni custom (nome e descrizione specifici per questo componente)
   * @private
   */
  _applyCustomTranslations() {
    this.param.name = i18n.t('machineId.title');
    this.param.ds = i18n.t('machineId.description');
  }

  /**
   * Override: Aggiorna le label quando cambia la lingua
   * @private
   */
  _updateLabels() {
    if (!this.el) return;
    
    // Applica traduzioni custom
    this._applyCustomTranslations();
    
    // Aggiorna il DOM - label principale
    const labelEl = this.el.querySelector('.parameter-label');
    if (labelEl) {
      labelEl.textContent = this.param.name;
    }
    
    // Aggiorna il recap box con le nuove traduzioni
    this._updateRecapBox();
    
    log.debug('MachineIdPreviewItem', `Labels updated to "${this.param.name}"`);
  }

  /**
   * Aggiorna il recap box con il valore corrente
   * @private
   */
  _updateRecapBox() {
    if (!this.el) return;
    
    const recapBox = this.el.querySelector('.machine-id-recap');
    if (!recapBox) return;
    
    const value = this.param.value;
    
    // Aggiorna le righe del recap
    const modbusRow = recapBox.querySelector('.recap-modbus-value');
    const wifiRow = recapBox.querySelector('.recap-wifi-value');
    const dnsRow = recapBox.querySelector('.recap-dns-value');
    
    if (modbusRow) modbusRow.textContent = value;
    if (wifiRow) wifiRow.textContent = `${WIFI_AP_PREFIX}${value}`;
    if (dnsRow) dnsRow.textContent = `${DNS_PREFIX}${value}${DNS_SUFFIX}`;
    
    // Aggiorna anche le label tradotte
    const modbusLabel = recapBox.querySelector('.recap-modbus-label');
    const wifiLabel = recapBox.querySelector('.recap-wifi-label');
    const dnsLabel = recapBox.querySelector('.recap-dns-label');
    
    if (modbusLabel) modbusLabel.textContent = `${i18n.t('machineId.modbusId')}:`;
    if (wifiLabel) wifiLabel.textContent = `${i18n.t('machineId.wifiAp')}:`;
    if (dnsLabel) dnsLabel.textContent = `${i18n.t('machineId.dnsLocal')}:`;
    
    log.debug('MachineIdPreviewItem', `Recap box updated with value: ${value}`);
  }

  /**
   * Override: Renderizza il componente con layout custom (no icona, con recap box)
   * @returns {string} HTML del componente
   */
  render() {
    const value = this.param.value;
    const displayValue = getParameterDisplayValue(this.param);
    
    // Genera i valori derivati
    const wifiApName = `${WIFI_AP_PREFIX}${value}`;
    const dnsName = `${DNS_PREFIX}${value}${DNS_SUFFIX}`;
    
    return `
      <div class="parameter-card clickable machine-id-card">
        <div class="machine-id-header">
          <div class="parameter-label">${this.param.name}</div>
          <div class="parameter-value-container">
            <span class="parameter-value">${displayValue}</span>
          </div>
          <button class="parameter-info-btn" aria-label="Info"></button>
        </div>
        <div class="machine-id-recap">
          <div class="recap-row">
            <span class="recap-label recap-modbus-label">${i18n.t('machineId.modbusId')}:</span>
            <span class="recap-value recap-modbus-value">${value}</span>
          </div>
          <div class="recap-row">
            <span class="recap-label recap-wifi-label">${i18n.t('machineId.wifiAp')}:</span>
            <span class="recap-value recap-wifi-value">${wifiApName}</span>
          </div>
          <div class="recap-row">
            <span class="recap-label recap-dns-label">${i18n.t('machineId.dnsLocal')}:</span>
            <span class="recap-value recap-dns-value">${dnsName}</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Override: Non renderizzare variante Normal (usiamo sempre il render custom)
   */
  renderNormal() {
    return this.render();
  }

  /**
   * Override: Non renderizzare variante Switch (questo parametro non è BOOL)
   */
  renderSwitch() {
    return this.render();
  }

  /**
   * Override: Aggiorna il valore visualizzato
   * @private
   */
  _updateValue() {
    if (!this.el) return;
    
    const displayValue = getParameterDisplayValue(this.param);
    const valueEl = this.el.querySelector('.parameter-value');
    
    if (valueEl) {
      valueEl.textContent = displayValue;
      log.debug('MachineIdPreviewItem', `Value updated to "${displayValue}"`);
    }
  }

  /**
   * Restituisce l'ID del parametro associato (Modbus Device ID)
   * @returns {number} ID del parametro
   */
  getParamId() {
    return MODBUS_DEVICE_ID_PARAM_ID;
  }
}
