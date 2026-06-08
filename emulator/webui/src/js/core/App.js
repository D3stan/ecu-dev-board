/**
 * App.js
 * ======
 * Main application orchestrator for FOG EXTRA WebApp.
 * Manages initialization sequence, page registration, and UI setup.
 * 
 * Bootstrap Sequence:
 * 1. initSocket() - Start WebSocket communication (background)
 * 2. waitForRuntimeConfig() - Wait for ESP32 configuration (langs, params, menu)
 * 3. renderSkeleton() - Create all page skeletons (passive DOM injection)
 * 4. initManagers() - Initialize NavigatorManager, ModalManager, SidebarManager
 * 5. registerPages() - Register pages in NavigatorManager + bindEvents()
 * 6. initUI() - Create TopBar and Banner (always-active components)
 * 7. navigator.show('homePage') - Activate home page (bindings + first update)
 * 
 * @author FogExtra Team
 * @version 2.0.0
 */

import { log } from '../utils/logger.js';
import { Store } from './store.js';
import { Paths } from '../utils/paths.js';
import { i18n } from '../utils/i18n.js';
import { Socket } from './socket.js';
import { dispatchMessage, setBootstrapProcessedNotifier } from './adapter.js';
import { initLocalizationEffect } from './localizationEffect.js';
import { initAuthGuard, isLocked } from './authGuard.js';
import { logSocketMessage, socketLogger } from '../utils/socketLogger.js';
import { testHelpers } from '../utils/testHelpers.js';
import { AUTO_CLOCK_UPDATE_PARAM_ID, SocketState, ConnectionMode } from '../utils/constants.js';

// Managers
import { NavigatorManager } from '../managers/navigatorManager.js';
import { ModalManager } from '../managers/modalManager.js';
import { SidebarManager } from '../managers/sidebarManager.js';
import { CommandManager } from '../managers/commandManager.js';
import { BootstrapRequestPipeline } from '../managers/BootstrapRequestPipeline.js';

// UI Components
import { TopBar } from '../components/TopBar/TopBar.js';
import Banner from '../components/Banner/Banner.js';
import LoadingSpinner from '../components/LoadingSpinner/LoadingSpinner.js';

// Mock Data (development)
import { loadMockData, startMockEmulator, installMockCommandEffects } from '../utils/mockData.js';

// Pages
import { HomePage } from '../pages/HomePage.js';
import { MenuSettingsPage } from '../pages/MenuSettingsPage.js';
import { TimeSlotsPage } from '../pages/TimeSlotsPage.js';
import { TimeSlotEditorPage } from '../pages/TimeSlotEditorPage.js';
import { TimerEditorPage } from '../pages/TimerEditorPage.js';
import { ParameterEditorPage } from '../pages/ParameterEditorPage.js';
import { WifiPage } from '../pages/WifiPage.js';
import { PinPage } from '../pages/PinPage.js';

// ============================================
// APP CLASS
// ============================================

export class App {
  /**
   * Create App instance.
   * @param {Object} config - Application configuration
   */
  constructor(config = {}) {
    this.config = {
      socketUrl: config.socketUrl || "192.168.4.1/ws",
      socketMac: config.socketMac || "00:00:00:00:00:00",
      appVersion: config.appVersion || "dev",
      enableDebugLogs: config.enableDebugLogs !== undefined ? config.enableDebugLogs : false,
      autoConnectSocket: config.autoConnectSocket !== undefined ? config.autoConnectSocket : false,
      useMockData: config.useMockData !== undefined ? config.useMockData : false // 🧪 Mock data mode
    };

    // Set logger debug mode
    log.setDebugMode(this.config.enableDebugLogs);

    // UI components namespace (TopBar, Banner - NOT Sidebar/Modal)
    this.UI = {};

    // Pages instances
    this.pages = [];

    // Managers references
    this.managers = {};

    // Loading spinner
    this.loadingSpinner = null;

    // Auto Clock Update (RTC sync)
    this.rtcAutoUpdateInterval = null; // Interval timer for RTC updates
    this.unsubAutoClockUpdate = null;  // Unsubscribe function for Store
    this.unsubSocketOpen = null;       // Unsubscribe function for Socket.onOpen
    this.unsubSocketStatus = null;     // Unsubscribe function for Socket.onStatus
    this.unsubSocketMessage = null;    // Unsubscribe function for Socket.onMessage
    this._beforeUnloadCleanupBound = false;
    this._handleBeforeUnloadCleanup = null;

    // Bootstrap Snapshot Alignment (5 bootstrap messages per WS open cycle)
    this.bootstrapSnapshot = {
      hello: false,
      menu: false,
      param: false,
      timeSlot: false,
      update: false
    };
    this._bootstrapCycleCompleted = false;
    this._isFirstBootstrap = true;
    this._configBootstrapReady = false;
    this._snapshotBootstrapReady = false;

    // Pull-based REQ_MSG bootstrap manager
    this.bootstrapRequestPipeline = null;
  }

  // ============================================
  // BOOTSTRAP
  // ============================================

  /**
   * Main bootstrap method - initializes the entire application.
   * @returns {Promise<void>}
   */
  async bootstrap() {
    try {
      log.info('');
      log.info('════════════════════════════════════════');
      log.info('   FOG EXTRA WebApp - Bootstrap Start   ');
      log.info(`   Version: ${this.config.appVersion}        `);
      log.info('════════════════════════════════════════');
      log.info('');

      // 0. Bootstrap wiring (must be ready before socket can process bootstrap messages)
      this._initBootstrapRequestPipeline();
      setBootstrapProcessedNotifier(this.notifyBootstrapMessageProcessed.bind(this));
      this.unsubSocketOpen = Socket.onOpen(() => {
        this._resetBootstrapSnapshotTracking();
        if (this.bootstrapRequestPipeline) {
          this.bootstrapRequestPipeline.start();
        }
      });

      // 1. Init Socket (background communication)
      await this.initSocket();

      // 1b. Install localization observer — must be registered BEFORE
      //     waitForRuntimeConfig() so that when the PARAM dump arrives from
      //     the ESP the observer fires, populates LOCALIZATION.LANGS and
      //     CURRENT_LANG_INDEX, and unblocks the loading gate.
      initLocalizationEffect();

      // 1c. Install auth guard observer — reacts to PIN param (#41)
      //     to lock/unlock app based on localStorage PIN match.
      initAuthGuard();

      // 2. Wait for runtime configuration from ESP32 (with spinner)
      if (this.config.autoConnectSocket) {
        await this.waitForRuntimeConfig();
      } else {
        log.warn('⏸️ [BOOTSTRAP] autoConnectSocket=false: skipping automatic bootstrap wait (manual/dev mode)');
        this._configBootstrapReady = true;
        this._snapshotBootstrapReady = true;
        this._tryHideInitialLoader();
      }

      // 3. Render all page skeletons (passive DOM injection)
      this.renderSkeleton();

      // 4. Init Managers
      this.initManagers();

      // 5. Register pages + bind events
      this.registerPages();

      // 6. Init always-active UI components (TopBar, Banner)
      this.initUI();

      // 7. Setup Auto Clock Update (RTC sync from browser)
      this._setupAutoClockUpdate();

      // 8. Navigate to the right initial page
      //    If the PIN guard has locked the app, show pinPage instead of home.
      const startPage = isLocked() ? 'pinPage' : 'homePage';
      this.managers.navigator.navigateTo(startPage);

      log.info('');
      log.info('✅ FOG EXTRA WebApp bootstrap completed!');
      log.info('════════════════════════════════════════');
      log.info('');

      // Expose to global for debugging
      if (this.config.enableDebugLogs) {
        window.FogExtra = {
          App: this,
          Store,
          Socket,
          i18n, // 🌐 Internationalization helper
          socketLogger, // 📊 Socket message logger & stats
          NavigatorManager: this.managers.navigator,
          ModalManager: this.managers.modal,
          SidebarManager: this.managers.sidebar,
          CommandManager: this.managers.command,
          UI: this.UI,
          
          // 🔄 Device commands
          softReset: () => this.managers.command.softReset("WEB_CONSOLE"),
          
          // 🧪 Test helpers (message simulation)
          testMessage: testHelpers.testMessage,
          testUpdate: testHelpers.testUpdate,
          testScenarioActive: testHelpers.testScenarioActive,
          testScenarioModifying: testHelpers.testScenarioModifying,
          testScenarioTimer: testHelpers.testScenarioTimer,
          testScenarioPressureAlarm: testHelpers.testScenarioPressureAlarm,
          
          // 🧪 Mock / Emulation controls (only meaningful when useMockData)
          mock: {
            stopEmulator: () => { if (this._mockEmulatorStop) { this._mockEmulatorStop(); this._mockEmulatorStop = null; console.log('🛑 Mock emulator stopped'); } },
            startEmulator: () => {
              if (this._mockEmulatorStop) this._mockEmulatorStop();
              try {
                this._mockEmulatorStop = startMockEmulator(Store, Paths);
                console.log('🎮 Mock emulator (re)started');
              } catch (e) { console.warn('Could not start emulator', e); }
            }
          },

          // 🔍 Debug helpers
          debugLangParsing: () => {
            const langs = Store.get(Paths.LOCALIZATION.LANGS);
            if (!langs || langs.length === 0) {
              console.warn('⚠️ No languages in Store yet');
              return null;
            }

            return langs.map((lang, langIdx) => {
              const params = Array.isArray(lang?.param) ? lang.param : [];
              const emptyNames = params.filter(p => !p.name || p.name.trim() === '').length;
              if (emptyNames > 0) {
                console.error(`❌ Language ${langIdx}: found ${emptyNames} params with empty names`);
              }

              return {
                langIdx,
                menuCount: lang?.menuName?.length || 0,
                dayLettersCount: lang?.daysLetter?.length || 0,
                paramsCount: params.length,
                sampleParams: params.slice(0, 3).map(p => ({
                  name: p.name,
                  dsPreview: (p.ds || '').substring(0, 40)
                })),
                emptyNames
              };
            });
          },
          
          debugRawLangMessage: () => {
            const langMsg = socketLogger.getLastMessage('LANG');
            if (!langMsg) {
              console.error('❌ No LANG message received yet');
              return null;
            }

            // Conta occorrenze
            const counts = {
              '☺': (langMsg.raw.match(/☺/g) || []).length,
              '☻': (langMsg.raw.match(/☻/g) || []).length,
              '♥': (langMsg.raw.match(/♥/g) || []).length,
              '♦': (langMsg.raw.match(/♦/g) || []).length
            };

            // Split test
            const [header, body] = langMsg.raw.split('|');
            const langBlocks = body.split('♦').filter(b => b.trim().length > 0);

            const details = {
              rawLength: langMsg.raw.length,
              contains: {
                '☺': langMsg.raw.includes('☺'),
                '☻': langMsg.raw.includes('☻'),
                '♥': langMsg.raw.includes('♥'),
                '♦': langMsg.raw.includes('♦')
              },
              separatorCounts: counts,
              languageBlocks: langBlocks.length,
              header: header || null
            };

            if (langBlocks.length > 0) {
              const firstBlock = langBlocks[0];
              const sections = firstBlock.split('☻');
              details.firstLanguageSections = sections.length;

              if (sections.length >= 3) {
                const paramsSection = sections[2];
                const paramPairs = paramsSection.split('☺');
                details.firstLanguageParamPairs = paramPairs.length;
                details.firstParamPairs = paramPairs.slice(0, 3).map((pair, i) => {
                  const [name, desc] = pair.split('♥', 2);
                  return {
                    index: i,
                    name,
                    descriptionPreview: (desc || '').substring(0, 30)
                  };
                });
              }
            }

            return {
              messageType: langMsg.type,
              timestamp: langMsg.timestamp,
              details
            };
          },
          
          // Test helpers (legacy - keep for compatibility)
          testParamChange: (paramId, newValue) => {
            const params = Store.get(Paths.CONFIG.PARAMS) || [];
            const paramIndex = params.findIndex(p => p.id === paramId);
            
            if (paramIndex === -1) {
              console.error(`❌ Parametro con ID ${paramId} non trovato`);
              return;
            }
            
            const oldValue = params[paramIndex].value;
            
            // IMPORTANTE: Crea un NUOVO array con spread operator
            // Altrimenti Store non triggera i subscriber (strict equality check)
            const newParams = params.map((p, index) => 
              index === paramIndex ? { ...p, value: newValue } : p
            );
            
            Store.set(Paths.CONFIG.PARAMS, newParams);

            return {
              ok: true,
              paramId,
              oldValue,
              newValue,
              name: params[paramIndex].name || i18n.tParam(paramId)?.name || 'N/A'
            };
          },
          
          testLangChange: (langIndex) => {
            if (langIndex < 0 || langIndex > 4) {
              console.error(`❌ Indice lingua non valido: ${langIndex} (deve essere 0-4)`);
              return;
            }
            
            const oldLang = Store.get(Paths.LOCALIZATION.CURRENT_LANG_INDEX);
            Store.set(Paths.LOCALIZATION.CURRENT_LANG_INDEX, langIndex);
            
            const langs = ['English', 'Italian', 'French', 'German', 'Spanish'];

            return {
              ok: true,
              from: langs[oldLang],
              to: langs[langIndex],
              oldLang,
              langIndex
            };
          }
        };
        log.debug('🐛 FogExtra exposed globally for debugging');
      }

    } catch (error) {
      log.error('❌ Bootstrap failed:', error);
      
      // Hide spinner on error
      if (this.loadingSpinner) {
        this.loadingSpinner.hide();
      }
      
      // Show error to user
      Store.set(Paths.APP.ERROR, error.message || 'Bootstrap failed');
    }
  }

  // ============================================
  // PHASE 1: SOCKET INITIALIZATION
  // ============================================

  /**
   * Initialize WebSocket connection.
   * Runs in background, independent of UI rendering.
   * @returns {Promise<void>}
   */
  async initSocket() {
    log.info('🔌 [1/6] Initializing Socket...');

    // Configure Socket (AsyncWebSocket on /ws port 80)
    Socket.setConfig({
      url: this.config.socketUrl
    });

    // Handler for connection status changes
    if (this.unsubSocketStatus) {
      this.unsubSocketStatus();
      this.unsubSocketStatus = null;
    }

    this.unsubSocketStatus = Socket.onStatus((status) => {
      log.debug(`📡 Socket status: ${status}`);
      
      // Reset connection mode when disconnected (HELLO not yet received)
      if (status === SocketState.DISCONNECTED || status === SocketState.RECONNECTING) {
        Store.set(Paths.WIFI.CONNECTION_MODE, ConnectionMode.UNKNOWN);
      }

      // TODO: This will be handled by ConnectionBadge component later
      // For now, just update Store
      Store.set(Paths.SOCKET.STATE, status);
    });

    // Handler for incoming messages
    if (this.unsubSocketMessage) {
      this.unsubSocketMessage();
      this.unsubSocketMessage = null;
    }

    this.unsubSocketMessage = Socket.onMessage((raw) => {
      // Log e salva messaggio per debugging
      logSocketMessage(raw);
      
      // Dispatch to Store via Adapter
      dispatchMessage(raw);
    });

    // Auto-connect if enabled
    if (this.config.autoConnectSocket) {
      log.info('🔌 Connecting to Socket...');
      Socket.connect();
    } else if (this.config.useMockData) {
      log.info('🧪 Mock mode — socket auto-connect disabled. Using local emulation.');
      // Make socket state look healthy for any UI that watches it
      Store.set(Paths.SOCKET.STATE, 'connected');
      document.body.style.opacity = '1';
    } else {
      log.info('⏸️ Auto-connect disabled (development mode): no automatic ws.onopen/bootstrap snapshot cycle');
    }

    log.info('✅ Socket initialized');
  }

  // ============================================
  // PHASE 2: WAIT FOR RUNTIME CONFIGURATION
  // ============================================

  /**
   * Wait for runtime configuration from ESP32.
   * Shows loading spinner until all required data is received.
   * NO TIMEOUT - waits indefinitely until ESP32 responds.
   * @returns {Promise<void>}
   */
  async waitForRuntimeConfig() {
    log.info('⏳ [2/7] Waiting for runtime configuration...');

    // 🧪 MOCK MODE: Carica dati fittizi immediatamente + avvia emulatore live
    if (this.config.useMockData) {
      log.warn('🧪 MOCK MODE ENABLED - Loading mock data instead of waiting for ESP32');
      loadMockData(Store, Paths);

      // Install command short-circuit so buttons (power, params, modes, time slots) have immediate visible effect
      try { installMockCommandEffects(); } catch (_) {}

      // Start gentle live simulator (drifting sensors, advancing clock, pump cycling...)
      try {
        this._mockEmulatorStop = startMockEmulator(Store, Paths);
        log.info('🎮 Mock live emulator started — values will change over time');
      } catch (e) {
        log.warn('Mock emulator failed to start:', e);
      }

      this._configBootstrapReady = true;
      this._tryHideInitialLoader();
      log.info('✅ Mock data loaded successfully');

      // Force a "connected-like" experience even without real WS
      Store.set(Paths.SOCKET.STATE, 'connected');
      // Make sure body is not dimmed
      document.body.style.opacity = '1';

      console.log(
        '%c🧪 EMULATION MODE ACTIVE — no ESP communication.\n' +
        '   • Frontend fully interactive\n' +
        '   • Commands are simulated locally\n' +
        '   • Use ?mock=0 in the URL to force real device mode',
        'color:#22c55e; font-family:monospace'
      );

      return Promise.resolve();
    }

    // Create and mount loading spinner
    this.loadingSpinner = new LoadingSpinner();
    this.loadingSpinner.mount(document.body);
    this.loadingSpinner.show();

    return new Promise((resolve) => {
      const startTime = Date.now();
      const unsubscribes = [];

      /**
       * Check if all required configuration is received
       */
      const checkComplete = () => {
        const langs = Store.get(Paths.LOCALIZATION.LANGS);
        const params = Store.get(Paths.CONFIG.PARAMS);
        const menu = Store.get(Paths.CONFIG.MENU);
        const langIndex = Store.get(Paths.LOCALIZATION.CURRENT_LANG_INDEX);

        const hasLangs = langs && langs.length > 0;
        const hasParams = params && params.length > 0;
        const hasMenu = menu && menu.length > 0;
        const hasLangIndex = langIndex !== undefined && langIndex !== null;

        log.debug(`Config status - Langs: ${hasLangs}, Params: ${hasParams}, Menu: ${hasMenu}, LangIndex: ${hasLangIndex}`);

        // All required data received?
        if (hasLangs && hasParams && hasMenu && hasLangIndex) {
          const elapsed = Date.now() - startTime;
          log.info(`✅ Runtime configuration loaded in ${elapsed}ms`);

          this._configBootstrapReady = true;
          this._tryHideInitialLoader();
          
          unsubscribeAll();

          resolve();
        }
      };

      /**
       * Unsubscribe from all Store listeners
       */
      const unsubscribeAll = () => {
        unsubscribes.forEach(unsub => unsub());
      };

      // Subscribe to required Store paths
      unsubscribes.push(
        Store.subscribe(Paths.LOCALIZATION.LANGS, checkComplete),
        Store.subscribe(Paths.CONFIG.PARAMS, checkComplete),
        Store.subscribe(Paths.CONFIG.MENU, checkComplete),
        Store.subscribe(Paths.LOCALIZATION.CURRENT_LANG_INDEX, checkComplete)
      );

      // Check immediately in case data is already there
      checkComplete();
    });
  }

  // ============================================
  // PHASE 3: RENDER SKELETON (PASSIVE DOM)
  // ============================================

  /**
   * Create all page skeletons and inject into DOM.
   * Pages are created with minimal structure (no content, no events).
   */
  renderSkeleton() {
    log.info('🏗️ [3/7] Rendering page skeletons...');

    const pagesContainer = document.querySelector('.pages-container');
    if (!pagesContainer) {
      log.error('❌ Pages container not found in DOM');
      return;
    }

    // Instantiate all pages
    this.pages = [
      new HomePage(),
      new MenuSettingsPage(),
      new TimeSlotsPage(),
      new TimeSlotEditorPage(),
      new TimerEditorPage(),
      new ParameterEditorPage(),
      new WifiPage(),
      new PinPage()
    ];

    // Create and inject skeletons
    this.pages.forEach(page => {
      const skeleton = page.createSkeleton();
      pagesContainer.appendChild(skeleton);
      log.debug(`  ✓ ${page.pageId} skeleton created (phase: ${page.phase})`);
    });

    log.info(`✅ ${this.pages.length} page skeletons rendered`);
  }

  // ============================================
  // PHASE 4: INIT MANAGERS
  // ============================================

  /**
   * Initialize all managers (Navigator, Modal, Sidebar, Command).
   */
  initManagers() {
    log.info('🎛️ [4/7] Initializing Managers...');

    // Init NavigatorManager
    NavigatorManager.init();
    this.managers.navigator = NavigatorManager;
    log.debug('  ✓ NavigatorManager initialized');

    // Init ModalManager
    ModalManager.init();
    this.managers.modal = ModalManager;
    log.debug('  ✓ ModalManager initialized');

    // Init SidebarManager
    SidebarManager.init();
    this.managers.sidebar = SidebarManager;
    log.debug('  ✓ SidebarManager initialized');

    // Init CommandManager
    CommandManager.init();
    this.managers.command = CommandManager;
    log.debug('  ✓ CommandManager initialized');

    // Link Sidebar to Navigator for automatic navigation
    SidebarManager.setupNavigation(NavigatorManager);
    log.debug('  ✓ Sidebar linked to Navigator');

    log.info('✅ Managers initialized');
  }

  // ============================================
  // PHASE 5: REGISTER PAGES + BIND EVENTS
  // ============================================

  /**
   * Register pages in NavigatorManager and bind DOM events.
   * After this phase, pages are ready to be activated.
   */
  registerPages() {
    log.info('📄 [5/7] Registering pages...');

    this.pages.forEach(page => {
      // Register in NavigatorManager
      NavigatorManager.registerPage(page.pageId, page);

      // Bind DOM events (addEventListener)
      page.bindEvents();

      log.debug(`  ✓ ${page.pageId} registered + events bound (phase: ${page.phase})`);
    });

    log.info(`✅ ${this.pages.length} pages registered`);
  }

  // ============================================
  // PHASE 6: INIT UI COMPONENTS
  // ============================================

  /**
   * Initialize always-active UI components (TopBar, Banner).
   * These components are rendered, events bound, AND bindings activated immediately.
   */
  initUI() {
    log.info('🧩 [6/7] Initializing UI components...');

    // TopBar
    const topBar = new TopBar({
      onThemeToggle: (theme) => {
        log.debug(`🎨 Theme changed: ${theme}`);
      },
      onMenuClick: () => {
        log.debug('📱 Menu button clicked');
        this.managers.sidebar.open();
      }
    });

    const topBarContainer = document.querySelector('.top-bar');
    if (topBarContainer) {
      topBarContainer.innerHTML = ''; // Clear placeholder
      topBar.mount(topBarContainer);
      topBar.bindEvents();
      topBar.activate(); // Always active
      this.UI.topbar = topBar;
      log.debug(`  ✓ TopBar created (phase: ${topBar.phase})`);
    } else {
      log.error('❌ TopBar container not found');
    }

    // Banner (test banner for now)
    const banner = new Banner({
      text: "GeneriCon 2023 · Join us in Denver from June 7 – 9 to see what's coming next",
      closable: true,
      onClose: () => {
        log.debug('📢 Banner closed by user');
      }
    });

    // TODO: Banner will be added to HomePage when we populate it
    // For now, we just store the instance
    this.UI.banner = banner;
    log.debug(`  ✓ Banner created (not mounted yet)`);

    log.info('✅ UI components initialized');
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Get page instance by ID.
   * @param {string} pageId - Page ID
   * @returns {Page|undefined} Page instance
   */
  getPage(pageId) {
    return this.pages.find(p => p.pageId === pageId);
  }

  /**
   * Get all registered pages.
   * @returns {Array<Page>} Array of page instances
   */
  getPages() {
    return [...this.pages];
  }

  // ============================================
  // BOOTSTRAP SNAPSHOT ALIGNMENT
  // ============================================

  _initBootstrapRequestPipeline() {
    this.bootstrapRequestPipeline = new BootstrapRequestPipeline({
      sendRequest: (type) => CommandManager.sendBootstrapRequest(type),
      onCompleted: () => {
        log.info('✅ [BOOTSTRAP_PIPELINE] Request pipeline completed');
      },
      onFailed: (reason) => {
        log.error(`❌ [BOOTSTRAP_PIPELINE] Failed: ${reason}`);
      }
    });
  }

  _resetBootstrapSnapshotTracking() {
    this.bootstrapSnapshot.hello = false;
    this.bootstrapSnapshot.menu = false;
    this.bootstrapSnapshot.param = false;
    this.bootstrapSnapshot.timeSlot = false;
    this.bootstrapSnapshot.update = false;
    this._bootstrapCycleCompleted = false;
    this._snapshotBootstrapReady = false;

    if (this.bootstrapRequestPipeline) {
      this.bootstrapRequestPipeline.reset();
    }

    log.info('🔁 [BOOTSTRAP] New ws.onopen detected - bootstrap snapshot tracking reset');
  }

  notifyBootstrapMessageProcessed(type) {
    const snapshotKeyByType = {
      HELLO: 'hello',
      PARAM: 'param',
      MENU: 'menu',
      TIME_SLOT: 'timeSlot',
      UPDATE: 'update',
      hello: 'hello',
      param: 'param',
      menu: 'menu',
      timeSlot: 'timeSlot',
      update: 'update'
    };

    const snapshotKey = snapshotKeyByType[type];
    if (!snapshotKey) {
      return;
    }

    if (this.bootstrapRequestPipeline) {
      this.bootstrapRequestPipeline.onMessageProcessed(String(type).toUpperCase());
    }

    if (this._bootstrapCycleCompleted) {
      return;
    }

    if (this.bootstrapSnapshot[snapshotKey]) {
      return;
    }

    this.bootstrapSnapshot[snapshotKey] = true;
    log.info(`📥 [BOOTSTRAP] Processed: ${snapshotKey}`);
    log.debug(`📊 [BOOTSTRAP] State: hello=${this.bootstrapSnapshot.hello}, menu=${this.bootstrapSnapshot.menu}, param=${this.bootstrapSnapshot.param}, timeSlot=${this.bootstrapSnapshot.timeSlot}, update=${this.bootstrapSnapshot.update}`);

    this._tryCompleteBootstrapSnapshotCycle();
  }

  _hasAllBootstrapMessages() {
    return this.bootstrapSnapshot.hello
      && this.bootstrapSnapshot.menu
      && this.bootstrapSnapshot.param
      && this.bootstrapSnapshot.timeSlot
      && this.bootstrapSnapshot.update;
  }

  _tryCompleteBootstrapSnapshotCycle() {
    if (this._bootstrapCycleCompleted) {
      return;
    }

    if (!this._hasAllBootstrapMessages()) {
      return;
    }

    log.info('✅ [BOOTSTRAP] Snapshot cycle complete - starting Store.updateAllListeners()');
    Store.updateAllListeners();
    this._bootstrapCycleCompleted = true;
    this._snapshotBootstrapReady = true;
    log.info('✅ [BOOTSTRAP] Store.updateAllListeners() completed');

    if (this._isFirstBootstrap) {
      this._tryHideInitialLoader();
      return;
    }

    log.info('🔄 [BOOTSTRAP] Reconnect bootstrap complete - replay executed (no loader changes)');
  }

  _tryHideInitialLoader() {
    if (!this._isFirstBootstrap) {
      return;
    }

    if (!this._configBootstrapReady || !this._snapshotBootstrapReady) {
      log.debug(`⏳ [BOOTSTRAP] Initial loader gate pending - configReady=${this._configBootstrapReady}, snapshotReady=${this._snapshotBootstrapReady}`);
      return;
    }

    if (this.loadingSpinner) {
      this.loadingSpinner.hide();
    }

    this._isFirstBootstrap = false;
    log.info('👋 [BOOTSTRAP] Initial loader hidden (config + snapshot ready)');
  }

  // ============================================
  // AUTO CLOCK UPDATE (RTC SYNC)
  // ============================================

  /**
   * Setup automatic RTC clock update based on parameter #36.
   * Monitors Store for AUTO_CLOCK_UPDATE parameter changes.
   * When enabled, sends updateRTC() every 60 seconds via WebSocket.
   * 
   * @private
   */
  _setupAutoClockUpdate() {
    log.info('🕐 [7/8] Setting up Auto Clock Update...');

    // Helper function to handle AUTO_CLOCK_UPDATE state changes
    const handleAutoClockUpdate = (params) => {
      // Find AUTO_CLOCK_UPDATE parameter (ID 36)
      const autoClockParam = params.find(p => p.id === AUTO_CLOCK_UPDATE_PARAM_ID);

      if (!autoClockParam) {
        // Parameter not yet received from ESP32
        log.debug('Auto Clock Update parameter not found yet');
        return;
      }

      const isEnabled = autoClockParam.value === true || autoClockParam.value === 1;

      if (isEnabled) {
        // Enable RTC auto-update
        if (!this.rtcAutoUpdateInterval) {
          log.info('✅ Auto Clock Update ENABLED - Starting 60s interval');
          
          // 🚀 SEND IMMEDIATELY on first enable
          CommandManager.updateRTC();
          log.info('🕐 First RTC update sent immediately');
          
          // Then send every 60 seconds
          this.rtcAutoUpdateInterval = setInterval(() => {
            CommandManager.updateRTC();
            log.debug('🕐 RTC auto-update sent to ESP32');
          }, 60_000); // 60 seconds
        }
      } else {
        // Disable RTC auto-update
        if (this.rtcAutoUpdateInterval) {
          log.info('⏸️ Auto Clock Update DISABLED - Stopping interval');
          clearInterval(this.rtcAutoUpdateInterval);
          this.rtcAutoUpdateInterval = null;
        }
      }
    };

    // 🔥 CHECK CURRENT VALUE IMMEDIATELY (params already loaded in step 2)
    try {
      const currentParams = Store.get(Paths.CONFIG.PARAMS);
      if (currentParams && currentParams.length > 0) {
        log.debug('📊 Checking current AUTO_CLOCK_UPDATE value...');
        handleAutoClockUpdate(currentParams);
      }
    } catch (error) {
      log.debug('⚠️ Params not yet loaded, will wait for subscription trigger');
    }

    // Subscribe to future config.params changes
    this.unsubAutoClockUpdate = Store.subscribe(Paths.CONFIG.PARAMS, handleAutoClockUpdate);

    // Cleanup on page unload
    if (!this._beforeUnloadCleanupBound) {
      this._handleBeforeUnloadCleanup = () => {
        if (this.unsubSocketOpen) {
          this.unsubSocketOpen();
          this.unsubSocketOpen = null;
          log.debug('🧹 Socket.onOpen unsubscribed (page unload)');
        }

        if (this.unsubSocketStatus) {
          this.unsubSocketStatus();
          this.unsubSocketStatus = null;
          log.debug('🧹 Socket.onStatus unsubscribed (page unload)');
        }

        if (this.unsubSocketMessage) {
          this.unsubSocketMessage();
          this.unsubSocketMessage = null;
          log.debug('🧹 Socket.onMessage unsubscribed (page unload)');
        }

        if (this.rtcAutoUpdateInterval) {
          clearInterval(this.rtcAutoUpdateInterval);
          this.rtcAutoUpdateInterval = null;
          log.debug('🧹 RTC auto-update interval cleared (page unload)');
        }

        if (this.unsubAutoClockUpdate) {
          this.unsubAutoClockUpdate();
          this.unsubAutoClockUpdate = null;
          log.debug('🧹 Auto Clock Update unsubscribed (page unload)');
        }

        if (this._mockEmulatorStop) {
          try { this._mockEmulatorStop(); } catch (_) {}
          this._mockEmulatorStop = null;
          log.debug('🧹 Mock emulator stopped (page unload)');
        }
      };

      window.addEventListener('beforeunload', this._handleBeforeUnloadCleanup);
      this._beforeUnloadCleanupBound = true;
    }

    log.info('✅ Auto Clock Update setup complete');
  }
}
