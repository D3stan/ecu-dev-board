/**
 * App.js
 * ======
 * Main application orchestrator for ECU Simulator Control Center.
 * Manages initialization sequence, page registration, and UI setup.
 * 
 * Bootstrap Sequence:
 * 1. initSocket() - Start WebSocket communication
 * 2. loadMockData() - Setup initial offline values if in mock mode
 * 3. renderSkeleton() - Create page skeletons
 * 4. initManagers() - Initialize Navigator, Modal, Sidebar, Command managers
 * 5. registerPages() - Register pages in NavigatorManager
 * 6. initUI() - Create TopBar
 * 7. navigator.show('dashboardPage') - Activate dashboard
 */

import { log } from '../utils/logger.js';
import { Store } from './store.js';
import { Paths } from '../utils/paths.js';
import { i18n } from '../utils/i18n.js';
import { Socket } from './socket.js';
import { dispatchMessage } from './adapter.js';
import { SocketState } from '../utils/constants.js';

// Managers
import { NavigatorManager } from '../managers/navigatorManager.js';
import { ModalManager } from '../managers/modalManager.js';
import { SidebarManager } from '../managers/sidebarManager.js';
import { CommandManager } from '../managers/commandManager.js';

// UI Components
import { TopBar } from '../components/TopBar/TopBar.js';
import LoadingSpinner from '../components/LoadingSpinner/LoadingSpinner.js';

// Mock Data (development)
import { loadMockData, startMockEmulator } from '../utils/mockData.js';

// Pages
import { DashboardPage } from '../pages/DashboardPage.js';
import { RpmSettingsPage } from '../pages/RpmSettingsPage.js';
import { TpsSettingsPage } from '../pages/TpsSettingsPage.js';
import { EgtSettingsPage } from '../pages/EgtSettingsPage.js';

export class App {
  /**
   * Create App instance.
   * @param {Object} config - Application configuration
   */
  constructor(config = {}) {
    this.config = {
      socketUrl: config.socketUrl || "192.168.4.1/ws",
      appVersion: config.appVersion || "dev",
      enableDebugLogs: config.enableDebugLogs !== undefined ? config.enableDebugLogs : false,
      autoConnectSocket: config.autoConnectSocket !== undefined ? config.autoConnectSocket : false,
      useMockData: config.useMockData !== undefined ? config.useMockData : false
    };

    // Set logger debug mode
    log.setDebugMode(this.config.enableDebugLogs);

    this.UI = {};
    this.pages = [];
    this.managers = {};
    this.loadingSpinner = null;

    this.unsubSocketStatus = null;
    this.unsubSocketMessage = null;
    this._mockEmulatorStop = null;
    this._beforeUnloadCleanupBound = false;
  }

  /**
   * Main bootstrap method - initializes the entire application.
   * @returns {Promise<void>}
   */
  async bootstrap() {
    try {
      log.info('════════════════════════════════════════');
      log.info('  ECU Simulator WebUI - Bootstrap Start ');
      log.info(`  Version: ${this.config.appVersion}        `);
      log.info('════════════════════════════════════════');

      // 1. Init Socket (background communication)
      await this.initSocket();

      // 2. Load mock data & start emulator if offline/dev mode
      if (this.config.useMockData) {
        log.warn('🧪 Mock mode enabled - running local engine simulation');
        loadMockData(Store, Paths);
        this._mockEmulatorStop = startMockEmulator(Store, Paths);
      }

      // 3. Render all page skeletons (passive DOM injection)
      this.renderSkeleton();

      // 4. Init Managers
      this.initManagers();

      // 5. Register pages + bind events
      this.registerPages();

      // 6. Init always-active UI components (TopBar)
      this.initUI();

      // 7. Setup unload cleanup
      this._setupCleanup();

      // 8. Navigate to initial dashboard page
      this.managers.navigator.navigateTo('dashboardPage');

      log.info('✅ ECU Simulator bootstrap completed!');
      log.info('════════════════════════════════════════');

      // Expose globally for debugging
      if (this.config.enableDebugLogs || this.config.useMockData) {
        window.EcuSim = {
          App: this,
          Store,
          Socket,
          i18n,
          NavigatorManager: this.managers.navigator,
          SidebarManager: this.managers.sidebar,
          CommandManager: this.managers.command
        };
      }
    } catch (error) {
      log.error('❌ Bootstrap failed:', error);
      Store.set(Paths.APP?.ERROR || 'socket.state', 'Bootstrap failed');
    }
  }

  /**
   * Initialize WebSocket connection.
   * @returns {Promise<void>}
   */
  async initSocket() {
    log.info('🔌 Initializing Socket...');

    Socket.setConfig({
      url: this.config.socketUrl
    });

    // Handle connection status changes
    if (this.unsubSocketStatus) this.unsubSocketStatus();
    this.unsubSocketStatus = Socket.onStatus((status) => {
      log.debug(`📡 Socket status: ${status}`);
      Store.set(Paths.SOCKET.STATE, status);
    });

    // Handle incoming messages
    if (this.unsubSocketMessage) this.unsubSocketMessage();
    this.unsubSocketMessage = Socket.onMessage((raw) => {
      dispatchMessage(raw);
    });

    if (this.config.autoConnectSocket) {
      log.info('🔌 Connecting to WebSocket...');
      Socket.connect();
    } else if (this.config.useMockData) {
      Store.set(Paths.SOCKET.STATE, SocketState.CONNECTED);
    }
    log.info('✅ Socket initialized');
  }

  /**
   * Create all page skeletons and inject into DOM.
   */
  renderSkeleton() {
    log.info('🏗️ Rendering page skeletons...');

    const pagesContainer = document.querySelector('.pages-container');
    if (!pagesContainer) {
      log.error('❌ Pages container not found in DOM');
      return;
    }

    // Instantiate all ECU pages
    this.pages = [
      new DashboardPage(),
      new RpmSettingsPage(),
      new TpsSettingsPage(),
      new EgtSettingsPage()
    ];

    // Create and inject skeletons
    this.pages.forEach(page => {
      const skeleton = page.createSkeleton();
      pagesContainer.appendChild(skeleton);
      log.debug(`  ✓ ${page.pageId} skeleton created`);
    });

    log.info(`✅ ${this.pages.length} page skeletons rendered`);
  }

  /**
   * Initialize all managers.
   */
  initManagers() {
    log.info('🎛️ Initializing Managers...');

    NavigatorManager.init();
    this.managers.navigator = NavigatorManager;

    ModalManager.init();
    this.managers.modal = ModalManager;

    SidebarManager.init();
    this.managers.sidebar = SidebarManager;

    CommandManager.init();
    this.managers.command = CommandManager;

    // Link Sidebar to Navigator
    SidebarManager.setupNavigation(NavigatorManager);

    log.info('✅ Managers initialized');
  }

  /**
   * Register pages in NavigatorManager and bind DOM events.
   */
  registerPages() {
    log.info('📄 Registering pages...');

    this.pages.forEach(page => {
      NavigatorManager.registerPage(page.pageId, page);
      page.bindEvents();
      log.debug(`  ✓ ${page.pageId} registered`);
    });

    log.info(`✅ ${this.pages.length} pages registered`);
  }

  /**
   * Initialize TopBar.
   */
  initUI() {
    log.info('🧩 Initializing UI components...');

    const topBar = new TopBar({
      onThemeToggle: (theme) => {
        log.debug(`🎨 Theme changed: ${theme}`);
      },
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
      log.debug(`  ✓ TopBar created`);
    } else {
      log.error('❌ TopBar container not found');
    }

    log.info('✅ UI components initialized');
  }

  /**
   * Setup beforeunload cleanup listeners
   */
  _setupCleanup() {
    if (!this._beforeUnloadCleanupBound) {
      window.addEventListener('beforeunload', () => {
        if (this.unsubSocketStatus) this.unsubSocketStatus();
        if (this.unsubSocketMessage) this.unsubSocketMessage();
        if (this._mockEmulatorStop) {
          try { this._mockEmulatorStop(); } catch (_) {}
        }
      });
      this._beforeUnloadCleanupBound = true;
    }
  }
}
