/**
 * mockData.js — ECU Mock Data
 * 
 * Provides static config and dynamic telemetry simulation
 * for development without an actual ESP32 connection.
 */

import { MenuType } from './menuMapping.js';

/**
 * Load mock static configuration into the Store.
 * @param {Object} Store - The Store module
 * @param {Object} Paths - Store path constants
 */
export function loadMockData(Store, Paths) {
  // Firmware info
  Store.set(Paths.CONFIG.FIRMWARE_VERSION, '1.2.0-mock');
  Store.set(Paths.CONFIG.ACTIVE_MAP_ID, 0);
  Store.set(Paths.CONFIG.SYNC_PULSES, 5);
  Store.set(Paths.CONFIG.EGT_ALARM, 800);

  // Software & hardware details (used by Sidebar)
  Store.set(Paths.CONFIG.SOFTWARE.VERSION, '1.2.0-mock');
  Store.set(Paths.CONFIG.SOFTWARE.MAC_ADDRESS, 'A4:C1:38:DE:20:9A');

  // Localization (used by i18n)
  Store.set(Paths.LOCALIZATION.CURRENT_LANG_INDEX, 1); // 1 = ITALIAN

  // Menu configuration (used by Sidebar)
  Store.set(Paths.CONFIG.MENU, [
    { menuId: MenuType.DASHBOARD },
    { menuId: MenuType.MAPS },
    { menuId: MenuType.SETTINGS }
  ]);


  // Ignition maps
  Store.set(Paths.CONFIG.MAPS.IGNITION, [
    {
      id: 0,
      name: 'Stock',
      breakpoints: [
        { rpm: 1000, value: 5 },
        { rpm: 3000, value: 15 },
        { rpm: 6000, value: 25 },
        { rpm: 9000, value: 30 },
        { rpm: 12000, value: 28 }
      ]
    },
    {
      id: 1,
      name: 'Race',
      breakpoints: [
        { rpm: 1000, value: 8 },
        { rpm: 3000, value: 20 },
        { rpm: 6000, value: 32 },
        { rpm: 9000, value: 35 },
        { rpm: 12000, value: 30 }
      ]
    }
  ]);

  // Power Jet maps
  Store.set(Paths.CONFIG.MAPS.POWER_JET, [
    {
      id: 0,
      name: 'Stock',
      breakpoints: [
        { rpm: 1000, value: 0 },
        { rpm: 4000, value: 10 },
        { rpm: 8000, value: 40 },
        { rpm: 12000, value: 60 }
      ]
    }
  ]);

  // OTA
  Store.set(Paths.OTA.AVAILABLE, false);
  Store.set(Paths.OTA.REMOTE_VERSION, null);
  Store.set(Paths.OTA.CURRENT_VERSION, '1.2.0-mock');

  // Initial telemetry snapshot
  Store.set(Paths.TELEMETRY.SNAPSHOT, {
    rpm: 0,
    tps: 0,
    egt: 180,
    fsm: 'INIT',
    advance_deg: 0,
    pj_duty: 0,
    active_map: 0,
    ts: Date.now()
  });
}

/**
 * Start simulated telemetry at the given frequency.
 * Generates realistic single-cylinder engine data with
 * sinusoidal acceleration/deceleration patterns.
 * 
 * @param {Object} Store - The Store module
 * @param {Object} Paths - Store path constants
 * @param {number} hz - Update frequency (default: 10)
 * @returns {number} Interval ID (use clearInterval to stop)
 */
export function startMockTelemetry(Store, Paths, hz = 10) {
  let t = 0;
  let qsCooldown = 0;

  const intervalId = setInterval(() => {
    t += 1 / hz;

    // Sinusoidal cycle simulating laps (period ~20s)
    const cycle = Math.sin(t * 0.3) * 0.5 + 0.5; // 0..1

    // Engine values derived from throttle cycle
    const rpm = Math.round(800 + cycle * 11200);         // 800–12000
    const tps = Math.round(cycle * 100 * 10) / 10;       // 0.0–100.0
    const egt = Math.round(150 + cycle * 570);            // 150–720

    // FSM state derived from RPM
    let fsm;
    if (qsCooldown > 0) {
      fsm = 'IGNCUT';
      qsCooldown -= 1 / hz;
    } else if (rpm < 500) {
      fsm = 'INIT';
    } else if (rpm < 1500) {
      fsm = 'IDLE';
    } else {
      fsm = 'RUNNING';
    }

    // Advance and PJ from simplified lookup
    const advanceDeg = Math.round((5 + cycle * 25) * 10) / 10;  // 5–30°
    const pjDuty = Math.round(cycle * 60 * 10) / 10;            // 0–60%

    Store.set(Paths.TELEMETRY.SNAPSHOT, {
      rpm,
      tps,
      egt,
      fsm,
      advance_deg: advanceDeg,
      pj_duty: pjDuty,
      active_map: 0,
      ts: Date.now()
    });
  }, 1000 / hz);

  // Expose QS simulation trigger for dev
  window.__mockQsTrigger = () => {
    qsCooldown = 0.3; // 300ms of IGNCUT
    console.log('🧪 Mock QS triggered');
  };

  console.log(`🧪 Mock telemetry running at ${hz} Hz (interval ${intervalId})`);
  return intervalId;
}
