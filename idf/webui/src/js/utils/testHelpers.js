/**
 * testHelpers.js
 * ==============
 * Helper per testare l'adapter e la comunicazione ESP senza hardware reale.
 * 
 * Funzioni disponibili da console:
 * - FogExtra.testMessage(raw) - Simula ricezione messaggio ESP
 * - FogExtra.testParamChange(id, value) - Simula cambio parametro
 * - FogExtra.testLangChange(index) - Simula cambio lingua
 * - FogExtra.testUpdate(data) - Simula messaggio UPDATE custom
 * 
 * @author FogExtra Team
 * @version 1.0.0
 */

import { dispatchMessage } from '../core/adapter.js';
import { Store } from '../core/store.js';
import { Paths } from '../utils/paths.js';
import { logSocketMessage } from './socketLogger.js';
import { MsgType, Separators } from './constants.js';

// ============================================
// MESSAGE SIMULATION
// ============================================

/**
 * Simula la ricezione di un messaggio ESP
 * @param {string} raw - Messaggio raw completo (es. "UPDATE|0,1,1,...")
 * @returns {void}
 */
export function testMessage(raw) {
  if (!raw || typeof raw !== 'string') {
    console.error('❌ testMessage: messaggio non valido');
    return;
  }
  
  // Log il messaggio (come se arrivasse da Socket)
  logSocketMessage(raw);
  
  // Dispatch all'adapter
  try {
    dispatchMessage(raw);
  } catch (error) {
    console.error('❌ Error processing message:', error);
  }
}

/**
 * Simula cambio valore parametro (MODIFY)
 * @param {number} paramId - ID parametro
 * @param {number} newValue - Nuovo valore
 * @returns {void}
 */
export function testParamChange(paramId, newValue) {
  if (typeof paramId !== 'number' || typeof newValue !== 'number') {
    console.error('❌ testParamChange: paramId e newValue devono essere numeri');
    return;
  }
  
  const params = Store.get(Paths.CONFIG.PARAMS) || [];
  const param = params.find(p => p.id === paramId);
  
  if (!param) {
    console.error(`❌ Parametro con ID ${paramId} non trovato`);
    return;
  }
  
  const oldValue = param.value;
  const message = `${MsgType.MODIFY}${Separators.CMD}${paramId}${Separators.VALUE}${newValue}`;
  
  testMessage(message);
}

/**
 * Simula cambio lingua (MODIFY del parametro ChangeLang)
 * @param {number} langIndex - Indice lingua (0-4)
 * @returns {void}
 */
export function testLangChange(langIndex) {
  if (typeof langIndex !== 'number' || langIndex < 0 || langIndex > 4) {
    console.error('❌ testLangChange: langIndex deve essere 0-4');
    return;
  }
  
  const CHANGE_LANG_PARAM_ID = 24;
  const langs = ['English', 'Italian', 'French', 'German', 'Spanish'];
  
  testParamChange(CHANGE_LANG_PARAM_ID, langIndex);
}

// ============================================
// UPDATE MESSAGE BUILDER
// ============================================

/**
 * Crea un messaggio UPDATE custom
 * @param {Object} data - Dati da includere nell'UPDATE
 * @returns {string} Messaggio UPDATE formattato
 */
export function buildUpdateMessage(data = {}) {
  // Defaults (tutti spenti/disconnessi)
  const defaults = {
    tempProbeConnected: false,
    enableTemp: false,
    activeTemp: false,
    humProbeConnected: false,
    enableHum: false,
    activeHum: false,
    enableTimer: false,
    activeTimer: false,
    enableCal: false,
    activeCal: false,
    enableAux: false,
    activeAux: false,
    enableWireless: false,
    activeWireless: false,
    extraRelayState: false,
    drainValveState: false,
    isModifing: false,
    pumpState: 0,
    pressureSwitch: 0,
    timerMode: 0,
    timerRelay: 0,
    sensorTemp: null,
    sensorHum: null
  };
  
  const merged = { ...defaults, ...data };
  
  // Converti booleani in 0/1
  const b = (val) => val ? '1' : '0';
  
  // Costruisci body UPDATE (ordine DEVE corrispondere a parseUpdate in adapter.js)
  const parts = [
    b(merged.tempProbeConnected),
    b(merged.enableTemp),
    b(merged.activeTemp),
    b(merged.humProbeConnected),
    b(merged.enableHum),
    b(merged.activeHum),
    b(merged.enableTimer),
    b(merged.activeTimer),
    b(merged.enableCal),
    b(merged.activeCal),
    b(merged.enableAux),
    b(merged.activeAux),
    b(merged.enableWireless),
    b(merged.activeWireless),
    b(merged.extraRelayState),
    b(merged.drainValveState),
    b(merged.isModifing),
    String(merged.pumpState),
    String(merged.pressureSwitch),
    String(merged.timerMode),
    String(merged.timerRelay),
    merged.sensorTemp !== null ? String(merged.sensorTemp) : '',
    merged.sensorHum !== null ? String(merged.sensorHum) : ''
  ];
  
  return `${MsgType.UPDATE}${Separators.CMD}${parts.join(Separators.VALUE)}`;
}

/**
 * Simula messaggio UPDATE con dati custom
 * @param {Object} data - Dati UPDATE
 * @returns {void}
 */
export function testUpdate(data = {}) {
  const message = buildUpdateMessage(data);
  testMessage(message);
}

// ============================================
// PRESET SCENARIOS
// ============================================

/**
 * Scenario: Sistema attivo con temperatura e umidità
 */
export function testScenarioActive() {
  testUpdate({
    tempProbeConnected: true,
    enableTemp: true,
    activeTemp: true,
    humProbeConnected: true,
    enableHum: true,
    activeHum: true,
    enableWireless: true,
    activeWireless: true,
    sensorTemp: 22.5,
    sensorHum: 65.3,
    pumpState: 1
  });
}

/**
 * Scenario: Sistema in modifica parametri
 */
export function testScenarioModifying() {
  testUpdate({
    isModifing: true,
    tempProbeConnected: true,
    humProbeConnected: true,
    sensorTemp: 20.0,
    sensorHum: 55.0
  });
}

/**
 * Scenario: Timer attivo
 */
export function testScenarioTimer() {
  testUpdate({
    enableTimer: true,
    activeTimer: true,
    timerMode: 1,
    timerRelay: 1,
    pumpState: 1
  });
}

/**
 * Scenario: Allarme pressione
 */
export function testScenarioPressureAlarm() {
  testUpdate({
    tempProbeConnected: true,
    enableTemp: true,
    activeTemp: true,
    pressureSwitch: 1, // PRESSURE_HIGH
    pumpState: 0
  });
}

// ============================================
// EXPORT
// ============================================

export const testHelpers = {
  testMessage,
  testParamChange,
  testLangChange,
  testUpdate,
  buildUpdateMessage,
  
  // Scenarios
  testScenarioActive,
  testScenarioModifying,
  testScenarioTimer,
  testScenarioPressureAlarm
};

export default testHelpers;
