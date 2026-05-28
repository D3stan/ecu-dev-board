/**
 * HomePage.js
 * ============
 * Pagina principale (dashboard) dell'applicazione FOG EXTRA.
 * 
 * Contenuto:
 * - TimeSlot component (mostra slot attivo o prossimo)
 * - Pump cards (sensori temperatura/umidità, stato pompa) - TODO
 * - Mode selector (griglia modalità: temperatura, umidità, timer, calendario, aux, wireless) - TODO
 * - Timer display (se timer attivo) - TODO
 * 
 * @author FogExtra Team
 * @version 2.0.0
 */

import { Page } from '../core/Page.js';
import { TimeSlot } from '../components/TimeSlot/TimeSlot.js';
import { SensorsForm } from '../components/Sensors/SensorsForm/SensorsForm.js';
import { ModeSelector } from '../components/ModeSelector/ModeSelector.js';
import { PowerButton } from '../components/PowerButton/PowerButton.js';
import { Banner } from '../components/Banner/Banner.js';
import { NavigatorManager } from '../managers/navigatorManager.js';
import { Store } from '../core/store.js';
import { PumpState } from '../utils/constants.js';
import { log } from '../utils/logger.js';
import { Paths } from '../utils/paths.js';
import { i18n } from '../utils/i18n.js';

export class HomePage extends Page {
  /**
   * Create HomePage instance.
   */
  constructor(options = {}) {
    super({
      id: 'homePage',
      title: 'FOG EXTRA',
      showBackButton: false, // Home page non ha back button
      ...options
    });

    this.isHomePage = true;

    // Componenti
    this.sensorsForm = null;
    this.timeSlotHome = null;
    this.modeSelector = null;
    this.powerButton = null;

    // Banner components
    this.maintenanceBanner = null;
    this.pumpLowPressureBanner = null;
    this.pumpBlockedBanner = null;
    this.antibacterialBanner = null;

    // Previous pump state for transition detection
    this._previousPumpState = null;

    log.debug('HomePage', 'Created');
  }

  /**
   * Called when page is created.
   */
  onCreate() {
    super.onCreate();
    log.debug('HomePage', 'onCreate');
  }

  /**
   * Called after skeleton is created to mount components.
   */
  createSkeleton() {
    const skeleton = super.createSkeleton(); // This calls renderContent()
    log.debug('HomePage', 'createSkeleton - Mounting components');
    
    // Monta i banner PER PRIMI (devono essere in cima al content-area)
    this._mountBanners();
    
    // Poi monta gli altri componenti in ordine
    this._mountSensorsForm();
    this._mountTimeSlotHome();
    this._mountModeSelector();
    this._mountPowerButton();
    
    // Ritorna l'elemento skeleton per App.js
    return skeleton;
  }

  /**
   * Called when page is mounted to DOM.
   */
  onMount() {
    super.onMount();
    log.debug('HomePage', 'onMount');
  }

  /**
   * Called when page becomes active/visible.
   */
  onActivate() {
    super.onActivate();
    log.debug('HomePage', 'onActivate');
  }

  /**
   * Called when page becomes inactive.
   */
  onDeactivate() {
    super.onDeactivate();
    log.debug('HomePage', 'onDeactivate');
  }

  /**
   * Called when page is destroyed.
   */
  onDestroy() {
    super.onDestroy();
    log.debug('HomePage', 'onDestroy');

    // Distruggi TimeSlot
    this._destroyComponents();
  }

  /**
   * Render page content.
   */
  renderContent() {
    const content = `
      <!-- Sensors Form Container -->
      <div id="sensors-form-container"></div>

      <!-- TimeSlot Home Container -->
      <div id="timeslot-home-container"></div>

      <!-- Mode Selector Container -->
      <div id="mode-selector-container"></div>

      <!-- Power Button Container -->
      <div id="power-button-container"></div>
    `;
    return content;
  }

  /**
   * Metodo update chiamato per aggiornare tutti i componenti figli
   */
  update() {
    log.debug('HomePage', 'update() called');

    // Aggiorna SensorsForm
    if (this.sensorsForm && typeof this.sensorsForm.update === 'function') {
      this.sensorsForm.update();
    }

    // Aggiorna TimeSlot Home
    if (this.timeSlotHome && typeof this.timeSlotHome.refresh === 'function') {
      this.timeSlotHome.refresh();
    }

    // Aggiorna ModeSelector (se necessario)
    if (this.modeSelector && typeof this.modeSelector.update === 'function') {
      this.modeSelector.update();
    }
  }

  // ============================================
  // PRIVATE METHODS - Component Management
  // ============================================

  /**
   * Monta i banner per maintenance e pump status
   * @private
   */
  _mountBanners() {
    if (!this.el) {
      console.error('🚨 [BANNER-DEBUG] ERRORE: this.el is null!');
      log.error('HomePage', 'Cannot mount banners: this.el is null');
      return;
    }
    
    // I banner vengono iniettati direttamente nel content-area della page
    const container = this.el.querySelector('.content-area');
    
    if (!container) {
      console.error('🚨 [BANNER-DEBUG] ERRORE: Content area not found!');
      log.error('HomePage', 'Content area not found');
      return;
    }


    // Store reference to HomePage instance for callbacks
    const homePage = this;

    // 1. Maintenance Banner - sempre visibile all'inizio
    this.maintenanceBanner = new Banner({
      title: 't:banners.maintenance.title',
      label: 't:banners.maintenance.next',
      labelParams: { hours: '---' }, // Initial placeholder params
      type: "info",
      closable: true,
      subscriptions: [
        {
          path: Paths.RUNTIME.TIMERS.MAINTENANCE.TIME_LEFT,
          cb: (timeLeft, banner) => {
            const worksHours = Store.get(Paths.RUNTIME.TIMERS.MAINTENANCE.ABSOLUTE_TIME) || '---';
            const totalHours = worksHours + timeLeft;
            if (timeLeft <= 0) {
              banner.updateType("error");
              banner.updateLabel('t:banners.maintenance.required'); // Usa chiave i18n
              banner.resetDismissal();
              banner.open();
            } else if (timeLeft <= 3) {
              banner.updateType("warning");
              banner.updateLabel('t:banners.maintenance.warning', { worksHours, totalHours, remainingHours: timeLeft }); // Chiave + params
              if (banner.canShow()) {
                banner.open();
              }
            } else {
              banner.updateType("info");
              banner.updateLabel('t:banners.maintenance.next', { worksHours, totalHours, remainingHours: timeLeft }); // Chiave + params
            }
          }
        }
      ],
      onClose: () => {
        log.debug('HomePage', 'Maintenance banner closed by user');
      }
    });
    
    // 2. Pump Low Pressure Banner - nascosto di default
    this.pumpLowPressureBanner = new Banner({
      title: 't:banners.pump.lowPressure.title',
      label: 't:banners.pump.lowPressure.message',
      type: "warning", 
      closable: true,
      subscriptions: [
        {
          path: Paths.RUNTIME.OUTPUTS.PUMP,
          cb: (pumpState, banner) => {           
            // Se ora sono in low pressuore e prima non lo eroe e non sono blocked mi apro
            if (
              homePage._previousPumpState !== PumpState.LOW_PRESSURE && 
              pumpState === PumpState.LOW_PRESSURE &&
              pumpState !== PumpState.BLOCCKED 
            ) {
              banner.forceOpen(); // Force show on state transition
            } else if (pumpState !== PumpState.LOW_PRESSURE && pumpState !== PumpState.OFF) {
              banner.close();
            }
            
            // Update previous state for next transition detection
            homePage._previousPumpState = pumpState;
          }
        }
      ]
    });
    

    // 3. Pump Blocked Banner - nascosto di default, NON closable
    this.pumpBlockedBanner = new Banner({
      title: 't:banners.pump.blocked.title',
      label: 't:banners.pump.blocked.message',
      type: "error",
      closable: false, // Non può essere chiuso
      subscriptions: [
        {
          path: Paths.RUNTIME.OUTPUTS.PUMP,
          cb: (pumpState, banner) => {            
            // Detect rising edge transition to BLOCCKED (note: typo in PumpState constant)
            if (pumpState === PumpState.BLOCCKED) {
              banner.forceOpen(); // Force show on state transition (non-closable)
            } else if (pumpState !== PumpState.BLOCCKED) {
              banner.close();
            }
            
            // Note: _previousPumpState updated in lowPressure callback
          }
        }
      ]
    });

    // 4. AntiBacterial Error Banner - nascosto di default, NON closable
    this.antibacterialBanner = new Banner({
      title: 't:banners.antibacterial.title',
      label: 't:banners.antibacterial.message',
      type: "error",
      assetKey: 'icon-antibacterial',
      closable: false, // Non può essere chiuso
      subscriptions: [
        {
          path: Paths.RUNTIME.ALERTS.IS_ANTIBACTERIAL_ERROR,
          cb: (isError, banner) => {
            if (isError) {
              banner.forceOpen();
            } else {
              banner.close();
            }
          }
        }
      ]
    });

    // Monta tutti i banner nel content-area COME PRIMI ELEMENTI
    this.maintenanceBanner.mount(container);
    this.pumpLowPressureBanner.mount(container);
    this.pumpBlockedBanner.mount(container);
    this.antibacterialBanner.mount(container);
    
    // Sposta i banner all'inizio del content-area
    if (this.maintenanceBanner.element) {
      container.insertBefore(this.maintenanceBanner.element, container.firstChild);
    } else {
      console.error('🚨 [BANNER-DEBUG] maintenanceBanner.element is null!');
    }
    
    if (this.pumpLowPressureBanner.element) {
      container.insertBefore(this.pumpLowPressureBanner.element, container.firstChild);
    } else {
      console.error('🚨 [BANNER-DEBUG] pumpLowPressureBanner.element is null!');
    }
    
    if (this.pumpBlockedBanner.element) {
      container.insertBefore(this.pumpBlockedBanner.element, container.firstChild);
    } else {
      console.error('🚨 [BANNER-DEBUG] pumpBlockedBanner.element is null!');
    }
    
    if (this.antibacterialBanner.element) {
      container.insertBefore(this.antibacterialBanner.element, container.firstChild);
    } else {
      console.error('🚨 [BANNER-DEBUG] antibacterialBanner.element is null!');
    }

    // Initialize previous pump state (will be updated by subscription)
    this._previousPumpState = PumpState.OFF;
    
    // Leggi il valore corrente dallo Store PRIMA di aprire il banner
    const currentTimeLeft = Store.get(Paths.RUNTIME.TIMERS.MAINTENANCE.TIME_LEFT);
    
    if (currentTimeLeft !== undefined && currentTimeLeft !== null) {
      // Aggiorna il banner con il valore reale dallo Store
      if (currentTimeLeft <= 0) {
        this.maintenanceBanner.updateType("error");
        this.maintenanceBanner.updateLabel('t:banners.maintenance.required');
      } else if (currentTimeLeft <= 3) {
        this.maintenanceBanner.updateType("warning");
        this.maintenanceBanner.updateLabel('t:banners.maintenance.warning', { hours: currentTimeLeft });
      } else {
        this.maintenanceBanner.updateType("info");
        this.maintenanceBanner.updateLabel('t:banners.maintenance.next', { hours: currentTimeLeft });
      }
    }

    // Mostra il maintenance banner (ora con il valore corretto)
    this.maintenanceBanner.open();
    
    log.debug('HomePage', 'Maintenance banner initialized with current value and opened');

    // Pump banners start hidden (default state)
    // They will be shown only on state transitions
    try {
      Store.get(Paths.RUNTIME.OUTPUTS.PUMP);
    } catch (error) {
      console.error('🚨 [BANNER-DEBUG] Error reading pumpState from Store:', error);
    }
    
    try {
      Store.get(Paths.RUNTIME.TIMERS.MAINTENANCE.TIME_LEFT);
    } catch (error) {
      console.error('🚨 [BANNER-DEBUG] Error reading maintenance timeLeft from Store:', error);
    }

    log.debug('HomePage', 'All banners mounted successfully');
  }

  /**
   * Monta SensorsForm
   * @private
   */
  _mountSensorsForm() {
    log.debug('HomePage', '_mountSensorsForm called');
    
    if (!this.el) {
      log.error('HomePage', 'Cannot mount SensorsForm: this.el is null');
      return;
    }
    
    const container = this.el.querySelector('#sensors-form-container');
    if (!container) {
      log.error('HomePage', 'SensorsForm container not found');
      return;
    }

    log.debug('HomePage', 'SensorsForm container found:', container);

    // Crea SensorsForm
    this.sensorsForm = new SensorsForm({
      id: 'sensors-form-home'
    });

    log.debug('HomePage', 'SensorsForm instance created');

    // 1) Monta nel placeholder dedicato
    this.sensorsForm.mount(container);

    // 2) Registra ownership parent/child (lifecycle + isolamento subtree/assets)
    this.addChild(this.sensorsForm);

    log.debug('HomePage', 'SensorsForm mounted as child successfully');
  }

  /**
   * Monta il TimeSlot home
   * @private
   */
  _mountTimeSlotHome() {
    log.debug('HomePage', '_mountTimeSlotHome called');
    
    if (!this.el) {
      log.error('HomePage', 'Cannot mount TimeSlot: this.el is null');
      return;
    }
    
    const container = this.el.querySelector('#timeslot-home-container');
    if (!container) {
      log.error('HomePage', 'TimeSlot container not found');
      return;
    }

    log.debug('HomePage', 'TimeSlot container found:', container);

    // Crea TimeSlot in mode "home"
    this.timeSlotHome = new TimeSlot({
      type: 'home',
      onClick: () => this._handleTimeSlotClick()
    });

    log.debug('HomePage', 'TimeSlot instance created');

    // 1) Monta nel placeholder dedicato
    this.timeSlotHome.mount(container);

    // 2) Registra ownership parent/child (lifecycle + isolamento subtree/assets)
    this.addChild(this.timeSlotHome);

    log.debug('HomePage', 'TimeSlot mounted as child successfully');
  }

  /**
   * Gestisce il click sul TimeSlot home (naviga a timeSlotsPage)
   * @private
   */
  _handleTimeSlotClick() {
    log.info('HomePage', 'TimeSlot clicked - navigating to timeSlotsPage');
    NavigatorManager.navigateTo('timeSlotsPage');
  }

  /**
   * Monta il ModeSelector
   * @private
   */
  _mountModeSelector() {
    console
    log.debug('HomePage', '_mountModeSelector called');
    
    if (!this.el) {
      log.error('HomePage', 'Cannot mount ModeSelector: this.el is null');
      return;
    }
    
    const container = this.el.querySelector('#mode-selector-container');
    if (!container) {
      log.error('HomePage', 'ModeSelector container not found');
      return;
    }

    log.debug('HomePage', 'ModeSelector container found:', container);

    // Crea ModeSelector (non editabile in home page)
    this.modeSelector = new ModeSelector({
      id: 'mode-selector-home',
      isEditable: true // Solo visualizzazione nella home
    });

    log.debug('HomePage', 'ModeSelector instance created');

    // 1) Monta nel placeholder dedicato
    this.modeSelector.mount(container);

    // 2) Registra ownership parent/child (lifecycle + isolamento subtree/assets)
    this.addChild(this.modeSelector);

    log.debug('HomePage', 'ModeSelector mounted as child successfully');
  }

  /**
   * Monta il PowerButton
   * @private
   */
  _mountPowerButton() {
    log.debug('HomePage', '_mountPowerButton called');
    
    if (!this.el) {
      log.error('HomePage', 'Cannot mount PowerButton: this.el is null');
      return;
    }
    
    const container = this.el.querySelector('#power-button-container');
    if (!container) {
      log.error('HomePage', 'PowerButton container not found');
      return;
    }

    log.debug('HomePage', 'PowerButton container found:', container);

    // Crea PowerButton
    this.powerButton = new PowerButton({
      id: 'power-button-home',
      assetKey: 'icon-wifi'
    });

    // 1) Monta nel placeholder dedicato
    this.powerButton.mount(container);

    // 2) Registra ownership parent/child (lifecycle + isolamento subtree/assets)
    this.addChild(this.powerButton);

    log.debug('HomePage', 'PowerButton mounted as child successfully');
  }

  /**
   * Distrugge tutti i componenti figli
   * @private
   */
  _destroyComponents() {
    // Distruggi Banners
    if (this.maintenanceBanner && typeof this.maintenanceBanner.destroy === 'function') {
      this.maintenanceBanner.destroy();
      this.maintenanceBanner = null;
    }
    
    if (this.pumpLowPressureBanner && typeof this.pumpLowPressureBanner.destroy === 'function') {
      this.pumpLowPressureBanner.destroy();
      this.pumpLowPressureBanner = null;
    }
    
    if (this.pumpBlockedBanner && typeof this.pumpBlockedBanner.destroy === 'function') {
      this.pumpBlockedBanner.destroy();
      this.pumpBlockedBanner = null;
    }
    
    if (this.antibacterialBanner && typeof this.antibacterialBanner.destroy === 'function') {
      this.antibacterialBanner.destroy();
      this.antibacterialBanner = null;
    }

    // Rimuovi/distruggi SensorsForm via ownership parent/child
    if (this.sensorsForm) {
      this.removeChild(this.sensorsForm);
      this.sensorsForm = null;
    }

    // Rimuovi/distruggi TimeSlot via ownership parent/child
    if (this.timeSlotHome) {
      this.removeChild(this.timeSlotHome);
      this.timeSlotHome = null;
    }

    // Rimuovi/distruggi ModeSelector via ownership parent/child
    if (this.modeSelector) {
      this.removeChild(this.modeSelector);
      this.modeSelector = null;
    }

    // Rimuovi/distruggi PowerButton via ownership parent/child
    if (this.powerButton) {
      this.removeChild(this.powerButton);
      this.powerButton = null;
    }
  }
}
