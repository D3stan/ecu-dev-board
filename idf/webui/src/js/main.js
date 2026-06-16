/**
 * main.js
 * 
 * Entry point dell'applicazione FOG EXTRA.
 * Crea l'istanza App e avvia il bootstrap.
 */

// ============================================
// IMPORTS
// ============================================
import { App } from './core/App.js';
import { Store } from './core/store.js';
import { Paths } from './utils/paths.js';
import { 
  setupTemporaryListeners
} from './utils/animations.js';
import { log } from './utils/logger.js';

// ============================================
// CONFIGURAZIONE GLOBALE
// ============================================

/**
 * Legge la configurazione dall'oggetto globale window.APP_CONFIG
 * (definito in index.html — FASE 1: MAC rimosso, URL auto-detect)
 */
function getConfig() {
  // Config da HTML (con placeholder ESP32)
  const htmlConfig = window.APP_CONFIG || {};
  
  // 🧪 Auto-enable mock emulation when running locally via `npm run dev`
  // or when ?mock or ?demo is present in the URL.
  // This completely bypasses ESP WebSocket communication so you can
  // visualize + iterate on the frontend in isolation.
  const url = new URL(window.location.href);
  const forceMock = url.searchParams.has('mock') || url.searchParams.has('demo') || url.searchParams.has('emulator');
  const isLocal = window.location.hostname === 'localhost' || 
                  window.location.hostname === '127.0.0.1' ||
                  window.location.hostname === '';

  const useMockData = forceMock || isLocal || Boolean(htmlConfig.useMockData ?? htmlConfig.useMock);
  const autoConnectSocket = !useMockData && Boolean(htmlConfig.autoConnectSocket ?? true);

  return {
    socketUrl: htmlConfig.socketUrl || (window.location.host + "/ws"),
    appVersion: window.APP_VERSION || "dev", // 🔄 Versione app per cache busting
    
    // Opzioni app
    enableDebugLogs: Boolean(htmlConfig.enableLogs ?? htmlConfig.enableDebugLogs ?? false),

    // 🧪 MOCK / EMULATION MODE (no real ESP required)
    useMockData,
    autoConnectSocket,

    // If you need the real device while on localhost, use:
    //   http://localhost:5173/?mock=0
    // or temporarily set useMockData: false below.
  };
}

// ============================================
// INIZIALIZZAZIONE
// ============================================

/**
 * Funzione di inizializzazione principale dell'applicazione.
 */
async function init() {
  const config = getConfig();
  
  // Crea istanza App
  const app = new App(config);
  
  // Avvia bootstrap
  await app.bootstrap();
  
  // Setup UI temporaneo (animazioni temporanee - TODO: rimuovere quando Managers saranno completi)
  setupTemporaryListeners();
}

// ============================================
// AVVIO AUTOMATICO
// ============================================

// Aspetta che il DOM sia completamente caricato
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  // DOM già pronto
  init();
}
