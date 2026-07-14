/**
 * ParameterItem.js
 * ================
 * Componente per visualizzare un singolo parametro nell'applicazione FOG EXTRA.
 * 
 * Supporta due varianti:
 * - Normal: card cliccabile con valore (navigazione a timerEditorPage o parameterEditorPage)
 * - Switch: card con toggle switch per parametri BOOL (no navigazione, solo toggle)
 * 
 * Props:
 * - param: oggetto parametro {id, name, value, type, unit, divisor, offset, ds, menuType}
 * - onClick: callback per il click sulla card (solo variante Normal)
 * - onChange: callback per il cambio valore switch (solo variante Switch, parametri BOOL)
 * - onInfoClick: callback per il click sul pulsante info
 * 
 * @author FogExtra Team
 * @version 2.0.0
 */

import { Component } from '../../core/Component.js';
import { Paths } from '../../utils/paths.js';
import { i18n } from '../../utils/i18n.js';
import { log } from '../../utils/logger.js';
import { ParamType } from '../../utils/constants.js';
import { getMenuTypeIcon } from '../../utils/iconMapping.js';
import { getParameterDisplayValue, enrichParamWithTranslations } from '../../utils/paramHelpers.js';

export class ParameterItem extends Component {
  /**
   * Crea un'istanza di ParameterItem
   * @param {Object} param - Oggetto parametro
   * @param {Function} onClick - Callback per click su card (variante Normal)
   * @param {Function} onChange - Callback per cambio valore (variante Switch)
   * @param {Function} onInfoClick - Callback per click su info button
   */
  constructor(param, onClick = null, onChange = null, onInfoClick = null) {
    // Valida param PRIMA di chiamare super()
    // NOTA: param.id può essere 0 (SetTemp), quindi usiamo typeof per verificare
    if (!param || typeof param.id !== 'number') {
      log.error('ParameterItem', 'Parametro non valido', param);
      throw new Error('ParameterItem: parametro obbligatorio mancante');
    }

    // Imposta le proprietà PRIMA di chiamare super() così sono disponibili in onCreate()
    super();
    
    // 🌐 CRITICAL: Arricchisci parametro con traduzioni attuali
    // I parametri dallo Store hanno solo id, value, type, ecc.
    // Le traduzioni (name, ds) arrivano separatamente da LANG message
    this.param = enrichParamWithTranslations(param);
    this.onClick = onClick;
    this.onChange = onChange;
    this.onInfoClick = onInfoClick;

    // Stable delegated handlers on persistent root (avoid listener accumulation)
    this._listenersBound = false;
    this._onRootClick = (e) => {
      const infoBtn = e.target.closest('.parameter-info-btn');
      if (infoBtn && this.el && this.el.contains(infoBtn)) {
        e.stopPropagation();
        if (this.onInfoClick) {
          log.debug('ParameterItem', `Info clicked - ${this.param.name}`);
          this.onInfoClick(this.param);
        }
        return;
      }

      if (!this.isSwitch && this.onClick) {
        log.debug('ParameterItem', `Card clicked - ${this.param.name}`);
        this.onClick(this.param);
      }
    };

    this._onRootChange = (e) => {
      if (!this.isSwitch || !this.onChange) return;

      const switchInput = e.target.closest('.parameter-switch input');
      if (!switchInput || !this.el || !this.el.contains(switchInput)) return;

      const newValue = switchInput.checked ? 1 : 0;
      log.debug('ParameterItem', `Switch toggled - ${this.param.name} = ${newValue}`);
      this.onChange(this.param, newValue);
    };
    
    // Determina la variante in base al tipo di parametro
    this.isSwitch = param.type === ParamType.BOOL;
    
    // Abilita aggiornamento automatico traduzioni quando cambia lingua
    this.enableI18n(() => this._updateLabels());
    
    log.debug('ParameterItem', `Creato componente per parametro "${this.param.name}" (${this.isSwitch ? 'Switch' : 'Normal'})`);
  }

  /**
   * Lifecycle: componente creato
   */
  onCreate() {
    // Non accedere a this.param qui - viene impostato dopo super() nel constructor
    log.debug('ParameterItem', `onCreate called`);
  }

  /**
   * Lifecycle: componente montato nel DOM
   */
  onMount() {
    log.debug('ParameterItem', `onMount - ${this.param.name}`);
    
    // Bind eventi DOM
    this._bindEvents();
    
    // Subscribe a cambio parametri per aggiornare valore
    this.subscribeToStore(Paths.CONFIG.PARAMS, (params) => {
      log.debug('ParameterItem', `🔔 PARAMS changed notification for ${this.param.name} (ID: ${this.param.id})`);
      const updated = params.find(p => p.id === this.param.id);
      log.debug('ParameterItem', `   Found param: ${updated ? 'YES' : 'NO'}, current value: ${this.param.value}, new value: ${updated?.value}`);
      
      if (updated) {
        // 🔧 Aggiorna SEMPRE quando troviamo il parametro (non solo se value cambia)
        // Questo gestisce anche il caso in cui altri campi (min, max, ecc.) potrebbero essere cambiati
        const hasValueChanged = updated.value !== this.param.value;
        
        if (hasValueChanged) {
          log.debug('ParameterItem', `✨ Parameter value changed for ${this.param.name}: ${this.param.value} → ${updated.value}`);
        }
        
        // 🌐 Arricchisci parametro aggiornato con traduzioni correnti
        this.param = enrichParamWithTranslations(updated);
        
        // Aggiorna UI solo se necessario
        if (hasValueChanged) {
          this._updateValue();
        }
      } else {
        log.debug('ParameterItem', `   No change detected (param not found in update)`);
      }
    });
    
    // NOTA: La subscription al cambio lingua è gestita automaticamente da Component.enableI18n()
  }

  /**
   * Lifecycle: bind degli eventi (non chiamato automaticamente per Component)
   */
  onBindEvents() {
    // Questo metodo non viene chiamato automaticamente
    // Il binding avviene in onMount() via _bindEvents()
    log.debug('ParameterItem', `onBindEvents - ${this.param.name}`);
  }

  /**
   * Bind eventi DOM
   * @private
   */
  _bindEvents() {
    if (!this.el || this._listenersBound) return;

    this.addEventListener(this.el, 'click', this._onRootClick);
    this.addEventListener(this.el, 'change', this._onRootChange);
    this._listenersBound = true;
  }

  /**
   * Lifecycle: componente attivato
   */
  onActivate() {
    log.debug('ParameterItem', `onActivate - ${this.param.name}`);
  }

  /**
   * Lifecycle: componente disattivato
   */
  onDeactivate() {
    log.debug('ParameterItem', `onDeactivate - ${this.param.name}`);
  }

  /**
   * Lifecycle: componente distrutto
   */
  onDestroy() {
    log.debug('ParameterItem', `onDestroy - ${this.param.name}`);
    
    // NOTA: La cleanup delle subscriptions Store e del cambio lingua è gestita automaticamente da Component
    
    this.param = null;
    this.onClick = null;
    this.onChange = null;
    this.onInfoClick = null;
    this._listenersBound = false;
    this._onRootClick = null;
    this._onRootChange = null;
  }

  /**
   * Renderizza il componente
   * @returns {string} HTML del componente
   */
  render() {
    const assetKey = getMenuTypeIcon(this.param.menuType);
    
    // Variante Switch (parametri BOOL)
    if (this.isSwitch) {
      return this.renderSwitch(assetKey);
    }
    
    // Variante Normal (tutti gli altri parametri)
    return this.renderNormal(assetKey);
  }

  /**
   * Renderizza variante Normal (card cliccabile con valore)
   * @param {string} assetKey - Asset key dell'icona
   * @returns {string} HTML della variante Normal
   */
  renderNormal(assetKey) {
    const displayValue = getParameterDisplayValue(this.param);
    const unit = this.param.unit || '';
    
    // Separa valore e unità solo per tipi NUMBER e FLOAT
    const shouldSeparateUnit = (
      (this.param.type === ParamType.NUMBER || this.param.type === ParamType.FLOAT) &&
      unit !== ''
    );
    
    return `
      <div class="parameter-card clickable">
        <div class="parameter-icon">
          <img data-asset-key="${assetKey}" alt="${this.param.name}">
        </div>
        <div class="parameter-label">${this.param.name}</div>
        <div class="parameter-value-container">
          <span class="parameter-value">${displayValue}</span>
          ${shouldSeparateUnit ? `<span class="parameter-unit">${unit}</span>` : ''}
        </div>
        <button class="parameter-info-btn" aria-label="Info"></button>
      </div>
    `;
  }

  /**
   * Renderizza variante Switch (toggle per BOOL)
    * @param {string} assetKey - Asset key dell'icona
   * @returns {string} HTML della variante Switch
   */
    renderSwitch(assetKey) {
    const isChecked = this.param.value === 1 || this.param.value === true;
    const switchLabel = isChecked ? 'ON' : 'OFF';
    
    return `
      <div class="parameter-card">
        <div class="parameter-icon">
          <img data-asset-key="${assetKey}" alt="${this.param.name}">
        </div>
        <div class="parameter-label">${this.param.name}</div>
        <div class="parameter-switch-container">
          <label class="parameter-switch">
            <input type="checkbox" ${isChecked ? 'checked' : ''}>
            <span class="parameter-switch-slider"></span>
          </label>
          <!-- <span class="parameter-switch-label">${switchLabel}</span> -->
        </div>
        <button class="parameter-info-btn" aria-label="Info"></button>
      </div>
    `;
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  /**
   * Aggiorna le label quando cambia la lingua
   * @private
   */
  _updateLabels() {
    if (!this.el) return;
    
    // Usa i18n.tParam() per ottenere la traduzione corretta
    const translation = i18n.tParam(this.param.id);
    
    if (!translation || !translation.name) {
      log.warn('ParameterItem', `No translation found for param id ${this.param.id}`);
      return;
    }
    
    // Aggiorna this.param con le nuove traduzioni
    this.param.name = translation.name;
    this.param.ds = translation.ds || this.param.ds;
    
    // Aggiorna il DOM
    const labelEl = this.el.querySelector('.parameter-label');
    if (labelEl) {
      labelEl.textContent = this.param.name;
    }
    
    // Per la variante Switch, aggiorna anche l'alt dell'icona
    const iconEl = this.el.querySelector('.parameter-icon img');
    if (iconEl) {
      iconEl.alt = this.param.name;
    }
    
    // 🌐 CRITICAL: Per i parametri ENUM, aggiorna anche il valore visualizzato
    // perché dipende dalla lingua corrente (es. "Ventola", "ByPass", "Enero", ecc.)
    const enumTypes = [
      ParamType.PRESSURE_TYPE, 
      ParamType.RELAY_MODE, 
      ParamType.AUX_TYPE, 
      ParamType.LANG_TYPE, 
      ParamType.MONTH
    ];
    
    if (enumTypes.includes(this.param.type)) {
      log.debug('ParameterItem', `🌐 Updating ENUM value for ${this.param.name} due to language change`);
      this._updateValue();
    }
    
    log.debug('ParameterItem', `Labels updated to "${this.param.name}"`);
  }

  /**
   * Aggiorna solo il valore visualizzato (non re-renderizza tutto)
   * @private
   */
  _updateValue() {
    if (!this.el) {
      log.warn('ParameterItem', `_updateValue called but this.el is null!`);
      return;
    }
    
    log.debug('ParameterItem', `🔄 _updateValue called for ${this.param.name} (isSwitch: ${this.isSwitch})`);
    
    if (this.isSwitch) {
      // Aggiorna lo stato dello switch
      const switchInput = this.el.querySelector('.parameter-switch input');
      log.debug('ParameterItem', `   Switch input found: ${switchInput ? 'YES' : 'NO'}`);
      if (switchInput) {
        const newChecked = this.param.value === 1;
        log.debug('ParameterItem', `   Setting checked to: ${newChecked} (value: ${this.param.value})`);
        switchInput.checked = newChecked;
      }
    } else {
      // Aggiorna il valore nella variante Normal
      const valueEl = this.el.querySelector('.parameter-value');
      log.debug('ParameterItem', `   Value element found: ${valueEl ? 'YES' : 'NO'}`);
      if (valueEl) {
        const displayValue = getParameterDisplayValue(this.param);
        log.debug('ParameterItem', `   Display value: "${displayValue}"`);
        valueEl.textContent = displayValue;
        log.debug('ParameterItem', `✅ Value updated to "${displayValue}"`);
      }
    }
  }

  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Aggiorna il parametro
   * @param {Object} newParam - Nuovo oggetto parametro
   */
  updateParameter(newParam) {
    if (!newParam || !newParam.id) {
      log.error('ParameterItem', 'Parametro non valido per update', newParam);
      return;
    }
    
    this.param = newParam;
    
    // Re-render del componente
    if (this.element) {
      const newHtml = this.render();
      this.element.innerHTML = newHtml;
      this._bindEvents();
      this.refreshDeferredImages();
      log.debug('ParameterItem', `Parametro aggiornato - ${this.param.name}`);
    }
  }

  /**
   * Imposta il callback onClick
   * @param {Function} callback - Nuova funzione callback
   */
  setOnClick(callback) {
    this.onClick = callback;
    this._bindEvents();
  }

  /**
   * Imposta il callback onChange
   * @param {Function} callback - Nuova funzione callback
   */
  setOnChange(callback) {
    this.onChange = callback;
    this._bindEvents();
  }

  /**
   * Imposta il callback onInfoClick
   * @param {Function} callback - Nuova funzione callback
   */
  setOnInfoClick(callback) {
    this.onInfoClick = callback;
    this._bindEvents();
  }
}
