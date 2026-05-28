/**
 * main.js
 * =======
 * Entry point for the ECU Dashboard application.
 * Creates the App instance and starts the bootstrap sequence.
 */

import { App } from './core/App.js';

// ============================================
// CONFIGURATION
// ============================================

function getConfig() {
  const htmlConfig = window.APP_CONFIG || {};

  return {
    socketUrl: htmlConfig.socketUrl || (window.location.host + '/ws'),
    appVersion: window.APP_VERSION || 'dev',
    enableDebugLogs: Boolean(htmlConfig.enableDebugLogs ?? false),

    // ── Production settings ──
    // useMockData: false,
    // autoConnectSocket: true,

    // ── Development settings ──
    useMockData: true,
    autoConnectSocket: false,
  };
}

// ============================================
// INITIALIZATION
// ============================================

async function init() {
  const config = getConfig();
  const app = new App(config);
  await app.bootstrap();
}

// ============================================
// AUTO-START
// ============================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
