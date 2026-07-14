/**
 * InputNumber - Example Usage
 * ============================
 * Esempi di utilizzo del componente InputNumber
 * 
 * @author FogExtra Team
 * @version 1.0.0
 */

import { InputNumber } from './components/InputNumber/InputNumber.js';
import { NavigationManager } from './managers/navigationManager.js';

// ============================================
// ESEMPIO 1: Parametro numerico FLOAT
// ============================================
// Temperatura setpoint: ID=10, range 10-40°C, step 0.5, divisor 10
const temperatureInput = new InputNumber({
  paramId: 10,
  onConfirm: () => {
    console.log('Temperatura confermata!');
    NavigationManager.goBack();
  }
});

// Mount su container
const tempContainer = document.querySelector('#temperature-container');
temperatureInput.mount(tempContainer);
temperatureInput.activate();

// ============================================
// ESEMPIO 2: Parametro numerico INTEGER
// ============================================
// Pressione: ID=15, range 0-100 bar, step 1, divisor 1
const pressureInput = new InputNumber({
  paramId: 15,
  onConfirm: () => {
    console.log('Pressione confermata!');
    NavigationManager.goBack();
  }
});

const pressureContainer = document.querySelector('#pressure-container');
pressureInput.mount(pressureContainer);
pressureInput.activate();

// ============================================
// ESEMPIO 3: Parametro ENUM (RelayMode)
// ============================================
// RelayMode: ID=20, type=RELAY_MODE, valori: byPass/fan/dispenser/antibatterico
const relayModeInput = new InputNumber({
  paramId: 20,
  onConfirm: () => {
    console.log('RelayMode confermato!');
    NavigationManager.goBack();
  }
});

const relayContainer = document.querySelector('#relay-container');
relayModeInput.mount(relayContainer);
relayModeInput.activate();

// ============================================
// ESEMPIO 4: Cambio parametro dinamico
// ============================================
// Se vuoi riutilizzare lo stesso componente per parametri diversi:
function showParameterEditor(paramId) {
  // Distruggi il componente precedente se esiste
  if (window.currentParamEditor) {
    window.currentParamEditor.destroy();
  }
  
  // Crea nuovo componente
  window.currentParamEditor = new InputNumber({
    paramId: paramId,
    onConfirm: () => {
      console.log(`Parametro ${paramId} confermato!`);
      NavigationManager.goBack();
    }
  });
  
  // Mount su container globale
  const container = document.querySelector('#param-editor-container');
  window.currentParamEditor.mount(container);
  window.currentParamEditor.activate();
}

// Usa così:
// showParameterEditor(10); // Temperatura
// showParameterEditor(15); // Pressione
// showParameterEditor(20); // RelayMode

// ============================================
// ESEMPIO 5: Lifecycle completo
// ============================================
const paramEditor = new InputNumber({
  paramId: 10,
  onConfirm: () => NavigationManager.goBack()
});

// 1. Mount (renderizza e aggancia eventi)
paramEditor.mount(document.querySelector('#container'));

// 2. Activate (forza refresh UI)
paramEditor.activate();

// 3. Deactivate (quando navighi via, ma non distruggi)
paramEditor.deactivate();

// 4. Re-activate (quando torni alla pagina)
paramEditor.activate();

// 5. Destroy (quando rimuovi definitivamente)
paramEditor.destroy();
