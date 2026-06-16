/**
 * InputTimer - Esempio d'uso
 * ==========================
 * 
 * Questo file mostra come integrare InputTimer in una Page.
 */

import { Component } from '../../core/Component.js';
import { InputTimer } from '../../components/InputTimer/InputTimer.js';
import { NavigationManager } from '../../managers/navigationManager.js';
import { Store } from '../../core/store.js';
import { Paths } from '../../utils/paths.js';

// ============================================
// ESEMPIO 1: Uso Base
// ============================================

export class TimerEditorPageExample extends Component {
  onCreate() {
    this.timerInput = null;
    this.paramId = 1; // Timer ON (parametro fisso)
  }

  onMount() {
    // Crea InputTimer per parametro Timer ON
    this.timerInput = new InputTimer({
      paramId: this.paramId,
      onConfirm: () => {
        console.log('Timer confermato! Navigazione indietro...');
        NavigationManager.navigateTo('MenuSettingsPage');
      }
    });
    
    // Monta nel container
    const container = this.$('.timer-container');
    if (container) {
      this.timerInput.mount(container);
    }
  }

  onActivate() {
    // Attiva il componente quando la page diventa visibile
    if (this.timerInput) {
      this.timerInput.activate();
    }
  }

  onDeactivate() {
    // Disattiva il componente quando la page viene nascosta
    if (this.timerInput) {
      this.timerInput.deactivate();
    }
  }

  onDestroy() {
    // Distruggi il componente quando la page viene distrutta
    if (this.timerInput) {
      this.timerInput.destroy();
      this.timerInput = null;
    }
  }

  render() {
    return `
      <div class="page timer-editor-page">
        <div class="page-header">
          <button class="back-btn" data-action="back">←</button>
          <h1>Modifica Timer</h1>
        </div>
        <div class="page-content">
          <div class="timer-container"></div>
        </div>
      </div>
    `;
  }

  onBindEvents() {
    const backBtn = this.$('[data-action="back"]');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        NavigationManager.goBack();
      });
    }
  }
}

// ============================================
// ESEMPIO 2: Parametro Dinamico da Route
// ============================================

export class DynamicTimerEditorPage extends Component {
  onCreate() {
    this.timerInput = null;
    
    // Ottieni paramId dalla route (passato da MenuSettingsPage)
    // Esempio: NavigationManager.navigateTo('TimerEditorPage', { paramId: 9 })
    const routeParams = NavigationManager.getCurrentParams();
    this.paramId = routeParams?.paramId || 1; // Default Timer ON
  }

  onMount() {
    // Ottieni config parametro dallo Store
    const params = Store.get(Paths.CONFIG.PARAMS);
    const param = params.find(p => p.id === this.paramId);
    
    if (!param) {
      console.error(`Parametro ${this.paramId} non trovato!`);
      return;
    }
    
    // Aggiorna titolo page con nome parametro
    const titleEl = this.$('.page-title');
    if (titleEl) {
      titleEl.textContent = param.name || 'Modifica Timer';
    }
    
    // Crea InputTimer
    this.timerInput = new InputTimer({
      paramId: this.paramId,
      onConfirm: () => {
        console.log(`Timer ${param.name} confermato!`);
        NavigationManager.goBack();
      }
    });
    
    this.timerInput.mount(this.$('.timer-container'));
  }

  onActivate() {
    if (this.timerInput) {
      this.timerInput.activate();
    }
  }

  onDeactivate() {
    if (this.timerInput) {
      this.timerInput.deactivate();
    }
  }

  onDestroy() {
    if (this.timerInput) {
      this.timerInput.destroy();
      this.timerInput = null;
    }
  }

  render() {
    return `
      <div class="page timer-editor-page">
        <div class="page-header">
          <button class="back-btn" data-action="back">←</button>
          <h1 class="page-title">Modifica Timer</h1>
        </div>
        <div class="page-content">
          <div class="timer-container"></div>
        </div>
      </div>
    `;
  }

  onBindEvents() {
    this.$('[data-action="back"]')?.addEventListener('click', () => {
      NavigationManager.goBack();
    });
  }
}

// ============================================
// ESEMPIO 3: Custom Callback con Validazione
// ============================================

export class AdvancedTimerEditorPage extends Component {
  onCreate() {
    this.timerInput = null;
    this.paramId = 1;
  }

  onMount() {
    this.timerInput = new InputTimer({
      paramId: this.paramId,
      onConfirm: () => this._handleTimerConfirm()
    });
    
    this.timerInput.mount(this.$('.timer-container'));
  }

  /**
   * Handler custom per conferma timer
   * Può includere validazioni, analytics, ecc.
   */
  _handleTimerConfirm() {
    const params = Store.get(Paths.CONFIG.PARAMS);
    const param = params.find(p => p.id === this.paramId);
    
    if (!param) return;
    
    console.log(`✅ Timer modificato:`, {
      name: param.name,
      oldValue: param.value,
      newValue: param.value, // Verrà aggiornato dall'ESP
      timestamp: new Date().toISOString()
    });
    
    // Mostra toast di conferma (opzionale)
    // ToastManager.show(`${param.name} aggiornato!`, 'success');
    
    // Naviga indietro
    NavigationManager.goBack();
  }

  onActivate() {
    if (this.timerInput) {
      this.timerInput.activate();
    }
  }

  onDeactivate() {
    if (this.timerInput) {
      this.timerInput.deactivate();
    }
  }

  onDestroy() {
    if (this.timerInput) {
      this.timerInput.destroy();
      this.timerInput = null;
    }
  }

  render() {
    return `
      <div class="page timer-editor-page">
        <div class="page-header">
          <button class="back-btn" data-action="back">←</button>
          <h1>Modifica Timer</h1>
        </div>
        <div class="page-content">
          <div class="timer-container"></div>
          <div class="timer-info">
            <p class="info-text">
              Imposta il tempo desiderato e premi Conferma per salvare.
            </p>
          </div>
        </div>
      </div>
    `;
  }

  onBindEvents() {
    this.$('[data-action="back"]')?.addEventListener('click', () => {
      NavigationManager.goBack();
    });
  }
}

// ============================================
// ESEMPIO 4: Uso Standalone (senza Page)
// ============================================

/**
 * Esempio di utilizzo standalone in una modal o dialog
 */
export function createTimerDialog(paramId, onClose) {
  // Crea container
  const dialog = document.createElement('div');
  dialog.className = 'timer-dialog';
  dialog.innerHTML = `
    <div class="dialog-overlay"></div>
    <div class="dialog-content">
      <div class="dialog-header">
        <h2>Modifica Timer</h2>
        <button class="dialog-close">✕</button>
      </div>
      <div class="dialog-body"></div>
    </div>
  `;
  
  // Crea InputTimer
  const timerInput = new InputTimer({
    paramId,
    onConfirm: () => {
      timerInput.destroy();
      dialog.remove();
      if (onClose) onClose();
    }
  });
  
  // Monta e attiva
  const body = dialog.querySelector('.dialog-body');
  timerInput.mount(body);
  timerInput.activate();
  
  // Bind close button
  dialog.querySelector('.dialog-close').addEventListener('click', () => {
    timerInput.destroy();
    dialog.remove();
    if (onClose) onClose();
  });
  
  // Aggiungi al DOM
  document.body.appendChild(dialog);
  
  return {
    close: () => {
      timerInput.destroy();
      dialog.remove();
    }
  };
}

// Uso:
// const dialog = createTimerDialog(1, () => console.log('Dialog chiusa'));

// ============================================
// ESEMPIO 5: Multiple Timers in una Page
// ============================================

export class MultiTimerPage extends Component {
  onCreate() {
    this.timers = [];
  }

  onMount() {
    // Crea 3 InputTimer per Timer ON, Timer OFF, Timer Dispenser
    const timerParams = [1, 9, 17]; // IDs parametri timer
    const containers = this.$$('.timer-slot');
    
    timerParams.forEach((paramId, index) => {
      const timer = new InputTimer({
        paramId,
        onConfirm: () => {
          console.log(`Timer ${paramId} confermato`);
          // Non naviga, rimane nella stessa page
        }
      });
      
      if (containers[index]) {
        timer.mount(containers[index]);
        this.timers.push(timer);
      }
    });
  }

  onActivate() {
    this.timers.forEach(timer => timer.activate());
  }

  onDeactivate() {
    this.timers.forEach(timer => timer.deactivate());
  }

  onDestroy() {
    this.timers.forEach(timer => timer.destroy());
    this.timers = [];
  }

  render() {
    return `
      <div class="page multi-timer-page">
        <h1>Impostazioni Timer</h1>
        
        <div class="timer-section">
          <h2>Timer ON</h2>
          <div class="timer-slot"></div>
        </div>
        
        <div class="timer-section">
          <h2>Timer OFF</h2>
          <div class="timer-slot"></div>
        </div>
        
        <div class="timer-section">
          <h2>Timer Dispenser</h2>
          <div class="timer-slot"></div>
        </div>
      </div>
    `;
  }
}
