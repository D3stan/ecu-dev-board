/**
 * App.js
 * ======
 * Main application orchestrator for ECU Dashboard.
 * Manages initialization sequence, page registration, and UI setup.
 *
 * Bootstrap Sequence:
 * 1. initSocket()          — Start WebSocket communication
 * 2. waitForConfig()       — Wait for ECU config (get_config → config response)
 * 3. renderSkeleton()      — Create all page skeletons
 * 4. initManagers()        — Initialize Navigator, Modal, Sidebar, Command
 * 5. registerPages()       — Register pages + bind events
 * 6. initUI()              — Create TopBar with ConnectionBadge
 * 7. navigateTo('dashboard') — Show main dashboard
 */

import { log } from '../utils/logger.js';
import { Store } from './store.js';
import { Paths } from '../utils/paths.js';
import { Socket } from './socket.js';
import { dispatchMessage } from './adapter.js';
import { logSocketMessage, socketLogger } from '../utils/socketLogger.js';
import { SocketState } from '../utils/constants.js';

// Managers
import { NavigatorManager } from '../managers/navigatorManager.js';
import { ModalManager } from '../managers/modalManager.js';
import { SidebarManager } from '../managers/sidebarManager.js';
import { CommandManager } from '../managers/commandManager.js';

// UI Components
import { TopBar } from '../components/topBar/TopBar.js';
import LoadingSpinner from '../components/LoadingSpinner/LoadingSpinner.js';

// Mock Data (development)
import { loadMockData, startMockTelemetry } from '../utils/mockData.js';

// Pages
import { DashboardPage } from '../pages/DashboardPage.js';
import { MapsPage } from '../pages/MapsPage.js';
import { SettingsPage } from '../pages/SettingsPage.js';

// ============================================
// APP CLASS
// ============================================

export class App {
  /**
   * @param {Object} config - Application configuration
   */
  constructor(config = {}) {
    this.config = {
      socketUrl: config.socketUrl || '192.168.4.1/ws',
      appVersion: config.appVersion || 'dev',
      enableDebugLogs: config.enableDebugLogs ?? false,
      autoConnectSocket: config.autoConnectSocket ?? false,
      useMockData: config.useMockData ?? false
    };

    log.setDebugMode(this.config.enableDebugLogs);

    this.UI = {};
    this.pages = [];
    this.managers = {};
    this.loadingSpinner = null;
    this._mockTelemetryInterval = null;

    // Socket lifecycle
    this._unsubSocketStatus = null;
    this._unsubSocketMessage = null;
    this._unsubSocketOpen = null;
  }

  // ============================================
  // BOOTSTRAP
  // ============================================

  async bootstrap() {
    try {
      log.info('');
      log.info('════════════════════════════════════════');
      log.info('     ECU Dashboard — Bootstrap Start     ');
      log.info(`     Version: ${this.config.appVersion}  `);
      log.info('════════════════════════════════════════');
      log.info('');

      // 1. Init Socket
      await this.initSocket();

      // 2. Wait for config (or load mock data)
      if (this.config.autoConnectSocket) {
        await this.waitForConfig();
      } else if (this.config.useMockData) {
        log.warn('🧪 MOCK MODE — Loading mock data');
        loadMockData(Store, Paths);
        this._mockTelemetryInterval = startMockTelemetry(Store, Paths, 10);
      } else {
        log.warn('⏸️ No socket, no mock — running empty');
      }

      // 3. Render page skeletons
      this.renderSkeleton();

      // 4. Init Managers
      this.initManagers();

      // 5. Register pages + bind events
      this.registerPages();

      // 6. Init always-active UI
      this.initUI();

      // 7. Navigate to dashboard
      this.managers.navigator.navigateTo('dashboardPage');

      log.info('');
      log.info('✅ ECU Dashboard bootstrap completed!');
      log.info('════════════════════════════════════════');

      // Expose for debugging
      if (this.config.enableDebugLogs) {
        window.ECU = {
          App: this,
          Store,
          Socket,
          socketLogger,
          Navigator: this.managers.navigator,
          Command: this.managers.command
        };
        log.debug('🐛 ECU debug object exposed globally');
      }

    } catch (error) {
      log.error('❌ Bootstrap failed:', error);
      if (this.loadingSpinner) this.loadingSpinner.hide();
      Store.set(Paths.APP.ERROR, error.message || 'Bootstrap failed');
    }
  }

  // ============================================
  // PHASE 1: SOCKET INIT
  // ============================================

  async initSocket() {
    log.info('🔌 [1/7] Initializing Socket...');

    Socket.setConfig({ url: this.config.socketUrl });

    // Status handler
    this._unsubSocketStatus = Socket.onStatus((status) => {
      log.debug(`📡 Socket status: ${status}`);
      Store.set(Paths.SOCKET.STATE, status);
    });

    // Message handler — parse JSON and dispatch to Store
    this._unsubSocketMessage = Socket.onMessage((raw) => {
      logSocketMessage(raw);
      dispatchMessage(raw);
    });

    // On connection open, request config
    this._unsubSocketOpen = Socket.onOpen(() => {
      log.info('🔌 WebSocket connected — requesting config...');
      CommandManager.sendGetConfig();
    });

    if (this.config.autoConnectSocket) {
      log.info('🔌 Connecting to Socket...');
      Socket.connect();
    } else {
      log.info('⏸️ Auto-connect disabled (dev mode)');
    }

    log.info('✅ Socket initialized');
  }

  // ============================================
  // PHASE 2: WAIT FOR CONFIG
  // ============================================

  async waitForConfig() {
    log.info('⏳ [2/7] Waiting for ECU config...');

    if (this.config.useMockData) {
      log.warn('🧪 MOCK MODE — Loading mock data');
      loadMockData(Store, Paths);
      this._mockTelemetryInterval = startMockTelemetry(Store, Paths, 10);
      log.info('✅ Mock data loaded');
      return;
    }

    // Show loading spinner
    this.loadingSpinner = new LoadingSpinner();
    this.loadingSpinner.mount(document.body);
    this.loadingSpinner.show();

    return new Promise((resolve) => {
      const startTime = Date.now();

      const unsub = Store.subscribe(Paths.CONFIG.FIRMWARE_VERSION, (version) => {
        if (version) {
          const elapsed = Date.now() - startTime;
          log.info(`✅ ECU config received in ${elapsed}ms (firmware: ${version})`);

          if (this.loadingSpinner) this.loadingSpinner.hide();
          unsub();
          resolve();
        }
      });

      // Check if already available
      const existing = Store.get(Paths.CONFIG.FIRMWARE_VERSION);
      if (existing) {
        if (this.loadingSpinner) this.loadingSpinner.hide();
        unsub();
        resolve();
      }
    });
  }

  // ============================================
  // PHASE 3: RENDER SKELETON
  // ============================================

  renderSkeleton() {
    log.info('🏗️ [3/7] Rendering page skeletons...');

    const pagesContainer = document.querySelector('.pages-container');
    if (!pagesContainer) {
      log.error('❌ Pages container not found');
      return;
    }

    this.pages = [
      new DashboardPage(),
      new MapsPage(),
      new SettingsPage()
    ];

    this.pages.forEach(page => {
      const skeleton = page.createSkeleton();
      pagesContainer.appendChild(skeleton);
      log.debug(`  ✓ ${page.pageId} skeleton created`);
    });

    log.info(`✅ ${this.pages.length} page skeletons rendered`);
  }

  // ============================================
  // PHASE 4: INIT MANAGERS
  // ============================================

  initManagers() {
    log.info('🎛️ [4/7] Initializing Managers...');

    NavigatorManager.init();
    this.managers.navigator = NavigatorManager;
    // Expose for page back-buttons
    window.__ecuNavigator = NavigatorManager;

    ModalManager.init();
    this.managers.modal = ModalManager;

    SidebarManager.init();
    this.managers.sidebar = SidebarManager;

    CommandManager.init();
    this.managers.command = CommandManager;

    SidebarManager.setupNavigation(NavigatorManager);

    log.info('✅ Managers initialized');
  }

  // ============================================
  // PHASE 5: REGISTER PAGES
  // ============================================

  registerPages() {
    log.info('📄 [5/7] Registering pages...');

    this.pages.forEach(page => {
      NavigatorManager.registerPage(page.pageId, page);
      page.bindEvents();
      log.debug(`  ✓ ${page.pageId} registered`);
    });

    log.info(`✅ ${this.pages.length} pages registered`);
  }

  // ============================================
  // PHASE 6: INIT UI
  // ============================================

  initUI() {
    log.info('🧩 [6/7] Initializing UI...');

    const topBar = new TopBar({
      onMenuClick: () => {
        this.managers.sidebar.open();
      }
    });

    const topBarContainer = document.querySelector('.top-bar');
    if (topBarContainer) {
      topBarContainer.innerHTML = '';
      topBar.mount(topBarContainer);
      topBar.bindEvents();
      topBar.activate();
      this.UI.topbar = topBar;
      log.debug('  ✓ TopBar created');
    }

    log.info('✅ UI initialized');
  }

  // ============================================
  // CLEANUP
  // ============================================

  destroy() {
    if (this._mockTelemetryInterval) {
      clearInterval(this._mockTelemetryInterval);
    }
    if (this._unsubSocketStatus) this._unsubSocketStatus();
    if (this._unsubSocketMessage) this._unsubSocketMessage();
    if (this._unsubSocketOpen) this._unsubSocketOpen();
  }
}
