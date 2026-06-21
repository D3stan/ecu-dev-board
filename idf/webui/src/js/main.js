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

const DIGITAL_TWIN_SERVER_URL = "https://ecu.0xpuddu.com";

/**
 * Legge la configurazione dall'oggetto globale window.APP_CONFIG
 * (definito in index.html — FASE 1: MAC rimosso, URL auto-detect)
 */
function getConfig() {
  const htmlConfig = window.APP_CONFIG || {};
  const url = new URL(window.location.href);
  const mockParam = url.searchParams.get('mock') ?? url.searchParams.get('demo') ?? url.searchParams.get('emulator');
  const hasMockOverride = mockParam !== null;
  const forceMock = hasMockOverride && !['0', 'false', 'off'].includes(String(mockParam).toLowerCase());
  const isLocal = window.location.hostname === 'localhost' || 
                  window.location.hostname === '127.0.0.1' ||
                  window.location.hostname === '';

  const useMockData = hasMockOverride
    ? forceMock
    : Boolean(htmlConfig.useMockData ?? htmlConfig.useMock ?? isLocal);
  const autoConnectSocket = !useMockData && Boolean(htmlConfig.autoConnectSocket ?? true);

  return {
    socketUrl: htmlConfig.socketUrl || (window.location.host + "/ws"),
    appVersion: window.APP_VERSION || "dev",
    digitalTwinServerUrl: DIGITAL_TWIN_SERVER_URL,
    
    enableDebugLogs: Boolean(htmlConfig.enableLogs ?? htmlConfig.enableDebugLogs ?? false),

    useMockData,
    autoConnectSocket,
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
