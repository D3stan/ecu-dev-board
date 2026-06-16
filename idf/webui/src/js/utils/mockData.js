// mockData.js
import { log } from './logger.js';

let qsActive = false;
let qsTimeoutId = null;
let tick = 0;

/**
 * Load initial mock data into Store
 */
export function loadMockData(Store, Paths) {
  Store.set(Paths.TELEMETRY.RPM, 1200.0);
  Store.set(Paths.TELEMETRY.TPS, 0.0);
  Store.set(Paths.TELEMETRY.EGT, 20.0);
  Store.set(Paths.TELEMETRY.ECU_ADVANCE, 15.0);
  Store.set(Paths.TELEMETRY.SPARK_DETECTED, true);

  Store.set(Paths.OVERRIDES.TPS.ACTIVE, false);
  Store.set(Paths.OVERRIDES.TPS.VALUE, 0.0);
  Store.set(Paths.OVERRIDES.EGT.ACTIVE, false);
  Store.set(Paths.OVERRIDES.EGT.VALUE, 20.0);
  Store.set(Paths.OVERRIDES.RPM.ACTIVE, false);
  Store.set(Paths.OVERRIDES.RPM.VALUE, 1200.0);
  Store.set(Paths.OVERRIDES.EGT_FAULT.ACTIVE, false);

  Store.set(Paths.SOCKET.STATE, 'connected');
}

/**
 * Start mock engine physics simulation (10 Hz ticker)
 */
export function startMockEmulator(Store, Paths) {
  tick = 0;
  
  const intervalId = setInterval(() => {
    tick++;

    // Retrieve override settings
    const tpsOverridden = Store.get(Paths.OVERRIDES.TPS.ACTIVE) ?? false;
    const tpsVirtual = Store.get(Paths.OVERRIDES.TPS.VALUE) ?? 0.0;
    
    const rpmOverridden = Store.get(Paths.OVERRIDES.RPM.ACTIVE) ?? false;
    const rpmVirtual = Store.get(Paths.OVERRIDES.RPM.VALUE) ?? 1200.0;

    const egtOverridden = Store.get(Paths.OVERRIDES.EGT.ACTIVE) ?? false;
    const egtVirtual = Store.get(Paths.OVERRIDES.EGT.VALUE) ?? 20.0;
    const egtFault = Store.get(Paths.OVERRIDES.EGT_FAULT.ACTIVE) ?? false;

    // Current states
    let currentRpm = Store.get(Paths.TELEMETRY.RPM) ?? 1200.0;
    let currentEgt = Store.get(Paths.TELEMETRY.EGT) ?? 20.0;

    // 1. Simulate physical TPS oscillating slightly (as if a potentiometer drifts or is cycled)
    // Period: ~10 seconds
    const physicalTps = 20.0 + 10.0 * Math.sin(tick * 0.0628);
    const activeTps = tpsOverridden ? tpsVirtual : physicalTps;
    
    // 2. Engine RPM kinematics (flywheel inertia simulation)
    let nextRpm = currentRpm;
    if (rpmOverridden) {
      nextRpm = rpmVirtual;
    } else {
      const rpmIdle = 1200.0;
      const rpmRedline = 18000.0;
      const tpsFraction = activeTps / 100.0;
      const targetRpm = rpmIdle + tpsFraction * (rpmRedline - rpmIdle);
      // inertia lag
      nextRpm += (targetRpm - nextRpm) * 0.2;
    }
    
    // Clamp
    if (nextRpm < 0) nextRpm = 0;
    if (nextRpm > 18000) nextRpm = 18000;

    // 3. Thermodynamics (EGT)
    let nextEgt = currentEgt;
    if (egtOverridden) {
      nextEgt = egtVirtual;
    } else if (egtFault) {
      // Overheat fault: rapidly ramp to 850°C
      nextEgt += (850.0 - nextEgt) * 0.4;
    } else {
      const egtAmbient = 20.0;
      let targetEgt;
      if (qsActive) {
        targetEgt = egtAmbient; // Decays without spark
      } else {
        targetEgt = egtAmbient + (activeTps * 4.0) + (nextRpm * 0.03);
      }
      nextEgt += (targetEgt - nextEgt) * 0.1;
    }

    // Clamp
    if (nextEgt < 20.0) nextEgt = 20.0;
    if (nextEgt > 1000.0) nextEgt = 1000.0;

    // 4. Spark detection & advance angle
    const sparkDetected = nextRpm > 100 && !qsActive;
    const sparkAdvance = 15.0 + (nextRpm / 1000.0) * 1.2;

    // Update Store
    Store.set(Paths.TELEMETRY.TPS, Number(activeTps.toFixed(1)));
    Store.set(Paths.TELEMETRY.RPM, Number(nextRpm.toFixed(1)));
    Store.set(Paths.TELEMETRY.EGT, Number(nextEgt.toFixed(1)));
    Store.set(Paths.TELEMETRY.ECU_ADVANCE, Number(sparkAdvance.toFixed(2)));
    Store.set(Paths.TELEMETRY.SPARK_DETECTED, sparkDetected);
    
  }, 100);

  return () => {
    clearInterval(intervalId);
    if (qsTimeoutId) clearTimeout(qsTimeoutId);
  };
}

/**
 * Apply a local mock action when in full offline emulation mode
 */
export function applyMockCommandEffect(raw, Store, Paths) {
  try {
    const payload = JSON.parse(raw);
    const { cmd, param, active, value, fault } = payload;

    log.debug(`[MockEmulator] Received command:`, payload);

    if (cmd === 'toggle_override') {
      if (param === 'tps') {
        Store.set(Paths.OVERRIDES.TPS.ACTIVE, !!active);
      } else if (param === 'egt') {
        Store.set(Paths.OVERRIDES.EGT.ACTIVE, !!active);
      } else if (param === 'rpm') {
        Store.set(Paths.OVERRIDES.RPM.ACTIVE, !!active);
      }
    } 
    else if (cmd === 'set_value') {
      if (param === 'tps') {
        Store.set(Paths.OVERRIDES.TPS.VALUE, Number(value));
      } else if (param === 'egt') {
        Store.set(Paths.OVERRIDES.EGT.VALUE, Number(value));
      } else if (param === 'rpm') {
        Store.set(Paths.OVERRIDES.RPM.VALUE, Number(value));
      }
    } 
    else if (cmd === 'inject_fault') {
      if (fault === 'egt_overheat') {
        Store.set(Paths.OVERRIDES.EGT_FAULT.ACTIVE, !!active);
      }
    } 
    else if (cmd === 'qs_trigger') {
      // Simulate 80ms ignition cut
      qsActive = true;
      Store.set(Paths.TELEMETRY.SPARK_DETECTED, false);
      log.info(`[MockEmulator] ⚡ Quick shift cut activated (80ms)`);
      
      if (qsTimeoutId) clearTimeout(qsTimeoutId);
      qsTimeoutId = setTimeout(() => {
        qsActive = false;
        Store.set(Paths.TELEMETRY.SPARK_DETECTED, true);
        log.info(`[MockEmulator] ⚡ Quick shift cut ended`);
      }, 80);
    }
  } catch (err) {
    log.error(`[MockEmulator] Failed to apply command effect`, err);
  }
}

/**
 * Monkey patches Socket.send to feed commands directly to the emulator
 */
export function installMockCommandEffects() {
  import('../core/socket.js').then(({ Socket }) => {
    const originalSend = Socket.send;
    if (originalSend && originalSend._isMockWrapped) return;

    const wrappedSend = (msg) => {
      import('../core/store.js').then(({ Store }) => {
        import('./paths.js').then(({ Paths }) => {
          applyMockCommandEffect(msg, Store, Paths);
        });
      });
      try {
        originalSend.call(Socket, msg);
      } catch (_) {}
    };
    wrappedSend._isMockWrapped = true;
    Socket.send = wrappedSend;
  }).catch(() => {});
}

installMockCommandEffects();
