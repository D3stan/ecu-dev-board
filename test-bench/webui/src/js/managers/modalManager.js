/**
 * modalManager.js
 * 
 * Manager per gestione modal con sistema di code e priorità.
 * 
 * Funzionalità:
 * - Apertura/chiusura modal con animazioni
 * - Queue system: più modal possono essere accodati
 * - Priority system: modal con priorità alta interrompono quelli correnti
 * - Gestione lifecycle dei Modal components
 * - Coordinamento tra modal multipli
 * 
 * ARCHITETTURA:
 * - ModalManager = Orchestratore logico (queue, priorità, lifecycle)
 * - Modal.js = Component fisico (render, eventi, bindings)
 */

import { Modal } from '../components/Modal/Modal.js';

// ============================================
// STATE
// ============================================

const state = {
  queue: [],                 // Coda di configurazioni modal da mostrare
  currentModal: null,        // Istanza Modal Component attualmente visualizzata
  currentConfig: null,       // Config del modal corrente (per debug)
  isVisible: false,          // Flag visibilità
  container: null,           // Container DOM per i modal
  initialized: false,
  keydownHandler: null,
};

// ============================================
// PRIVATE HELPERS
// ============================================

/**
 * Crea e monta una nuova istanza di Modal Component
 * @param {Object} config - Configurazione del modal
 * @returns {Modal} Istanza del modal creato
 */
function createModalInstance(config) {
  // Crea istanza Modal con la configurazione fornita
  const modal = new Modal({
    label: config.label || config.title || 'Info',
    ds: config.ds || config.message || '',
    type: config.type || 'info',
    assetKey: config.assetKey || null,
    closable: config.closable !== false,
    actionBtns: config.actionBtns || [],
    paramId: config.paramId || null,
    preserveFormatting: config.preserveFormatting === true, // Passa il flag
    onClose: () => {
      // Callback onClose dell'utente
      if (typeof config.onClose === 'function') {
        try {
          config.onClose();
        } catch (error) {
          console.error('❌ Errore in modal.onClose:', error);
        }
      }
      
      // Chiudi il modal corrente
      closeCurrentModal();
    }
  });
  
  // Assicurati che il container esista (dovrebbe essere già nell'HTML)
  if (!state.container) {
    state.container = document.getElementById('modal-manager-container');
    
    // Fallback: crea container se non esiste nell'HTML
    if (!state.container) {
      console.warn('⚠️ #modal-manager-container non trovato nell\'HTML, lo creo dinamicamente');
      state.container = document.createElement('div');
      state.container.id = 'modal-manager-container';
      document.body.appendChild(state.container);
    }
  }
  
  // Pulisci container (rimuovi modal precedente se presente)
  state.container.innerHTML = '';
  
  // Monta il nuovo modal
  modal.mount(state.container);
  
  return modal;
}

/**
 * Mostra il prossimo modal nella queue
 */
function showNextModal() {
  if (state.queue.length === 0) {
    return;
  }
  
  // Ordina per priorità (più alta prima)
  state.queue.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  
  const nextConfig = state.queue.shift();
  state.currentConfig = nextConfig;
  
  // Imposta subito isVisible PRIMA di creare il modal
  state.isVisible = true;
  
  // Crea istanza Modal Component
  const modalInstance = createModalInstance(nextConfig);
  state.currentModal = modalInstance;
  
  // Attiva il modal (mostra con animazione)
  modalInstance.activate();
  
  // Callback onShow
  if (typeof nextConfig.onShow === 'function') {
    try {
      nextConfig.onShow();
    } catch (error) {
      console.error('❌ Errore in modal.onShow:', error);
    }
  }
}

/**
 * Chiude il modal corrente
 */
function closeCurrentModal() {
  if (!state.isVisible || !state.currentModal) return;
  
  // Deactivate modal (nasconde con animazione)
  state.currentModal.deactivate();
  
  state.isVisible = false;
  
  const closedConfig = state.currentConfig;
  
  // Distruggi il modal component dopo l'animazione
  setTimeout(() => {
    if (state.currentModal) {
      state.currentModal.destroy();
      state.currentModal = null;
      state.currentConfig = null;
    }
    
    // Mostra il prossimo modal nella queue (se presente)
    if (state.queue.length > 0) {
      showNextModal();
    }
  }, 300); // Durata animazione
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Mostra un modal (lo accoda se ce n'è già uno aperto)
 * @param {object} config - Configurazione del modal
 * @param {string} config.label - Titolo del modal (alias: title)
 * @param {string} config.ds - Descrizione/messaggio (alias: message)
 * @param {string} config.type - Tipo di modal (success|error|warning|info)
 * @param {string} config.icon - URL icona (opzionale)
 * @param {boolean} config.closable - Se true, mostra X e permette chiusura (default: true)
 * @param {Array} config.actionBtns - Array di bottoni [{cb, css, label}] (opzionale)
 * @param {number} config.paramId - ID parametro per traduzioni automatiche (opzionale)
 * @param {number} config.priority - Priorità (default: 0, più alto = più importante)
 * @param {function} config.onClose - Callback quando il modal viene chiuso
 * @param {function} config.onShow - Callback quando il modal viene mostrato
 */
export function show(config = {}) {
  if (!config.label && !config.title && !config.ds && !config.message) {
    console.warn('⚠️ Modal senza titolo né messaggio');
  }
  
  const priority = config.priority || 0;
  
  // Se c'è un modal corrente, controlla priorità
  if (state.currentConfig) {
    const currentPriority = state.currentConfig.priority || 0;
    
    // Se il nuovo modal ha priorità MAGGIORE del corrente
    if (priority > currentPriority) {
      // Rimetti il modal corrente in queue
      state.queue.push(state.currentConfig);
      
      // Aggiungi il nuovo modal in queue
      state.queue.push(config);
      
      // Chiudi il modal corrente (senza callback onClose)
      if (state.currentModal) {
        state.currentModal.deactivate();
        setTimeout(() => {
          if (state.currentModal) {
            state.currentModal.destroy();
            state.currentModal = null;
            state.currentConfig = null;
            state.isVisible = false;
          }
          
          // Mostra il prossimo (che sarà il più prioritario grazie al sort)
          showNextModal();
        }, 300);
      }
      return;
    }
  }
  
  // Altrimenti, accoda normalmente
  state.queue.push(config);
  
  // Ordina la queue per priorità
  state.queue.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  
  // Se non c'è un modal corrente, mostra il primo della queue
  if (!state.currentModal) {
    showNextModal();
  }
}

/**
 * Chiude il modal corrente
 */
export function hide() {
  if (!state.isVisible) {
    return;
  }
  
  closeCurrentModal();
}

/**
 * Chiude tutti i modal e pulisce la queue
 */
export function clearAll() {
  state.queue = [];
  
  if (state.isVisible && state.currentModal) {
    state.currentModal.deactivate();
    setTimeout(() => {
      if (state.currentModal) {
        state.currentModal.destroy();
        state.currentModal = null;
        state.currentConfig = null;
      }
    }, 300);
    state.isVisible = false;
  }
}

/**
 * Ottiene il modal corrente
 * @returns {Modal|null} Istanza del Modal Component corrente
 */
export function getCurrentModal() {
  return state.currentModal;
}

/**
 * Ottiene il numero di modal in coda
 * @returns {number}
 */
export function getQueueSize() {
  return state.queue.length;
}

/**
 * Verifica se c'è un modal visibile
 * @returns {boolean}
 */
export function isVisible() {
  return state.isVisible;
}

/**
 * Inizializza il ModalManager
 */
export function init() {
  if (state.initialized) {
    return;
  }
  
  // Trova il container nell'HTML (dovrebbe essere già presente)
  state.container = document.getElementById('modal-manager-container');
  
  if (!state.container) {
    console.warn('⚠️ #modal-manager-container non trovato nell\'HTML, lo creo dinamicamente');
    state.container = document.createElement('div');
    state.container.id = 'modal-manager-container';
    document.body.appendChild(state.container);
  }
  
  // ESC key chiude modal corrente
  state.keydownHandler = (e) => {
    if (e.key === 'Escape' && state.isVisible && state.currentModal) {
      // Il Modal Component gestisce già ESC, ma come fallback:
      closeCurrentModal();
    }
  };

  document.addEventListener('keydown', state.keydownHandler);
  state.initialized = true;
}

/**
 * Ottiene lo stato interno (per debug)
 */
export function _debug() {
  return {
    queueSize: state.queue.length,
    queue: state.queue.map(m => ({ 
      label: m.label || m.title, 
      priority: m.priority 
    })),
    current: state.currentConfig ? {
      label: state.currentConfig.label || state.currentConfig.title,
      priority: state.currentConfig.priority,
      type: state.currentConfig.type,
    } : null,
    currentModalInstance: state.currentModal ? 'Modal Component' : null,
    isVisible: state.isVisible,
  };
}

// Export default per import singolo
export const ModalManager = {
  init,
  show,
  hide,
  clearAll,
  getCurrentModal,
  getQueueSize,
  isVisible,
  _debug,
};
