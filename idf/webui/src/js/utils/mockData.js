import { dispatchMessage } from "../core/adapter.js";
import { log } from "./logger.js";

let qsActive = false;
let qsTimeoutId = null;
let tick = 0;
let mockGen = 0;

export function loadMockData(Store, Paths) {
  dispatchMessage(JSON.stringify({
    type: "capabilities",
    schema: "ecu.telemetry.v1",
    schema_version: 1,
    paths: ["state", "event"],
    state_hz: 10,
    events_per_batch: 8
  }));

  Store.set(Paths.OVERRIDES.TPS.ACTIVE, false);
  Store.set(Paths.OVERRIDES.TPS.VALUE, 0.0);
  Store.set(Paths.OVERRIDES.EGT.ACTIVE, false);
  Store.set(Paths.OVERRIDES.EGT.VALUE, 20.0);
  Store.set(Paths.OVERRIDES.RPM.ACTIVE, false);
  Store.set(Paths.OVERRIDES.RPM.VALUE, 1200.0);
  Store.set(Paths.OVERRIDES.EGT_FAULT.ACTIVE, false);

  dispatchMockTelemetry({
    rpm: 1200.0,
    tps: 0.0,
    egt: 20.0,
    advance: 15.0,
    rpmAccel: 0.0
  });

  Store.set(Paths.SOCKET.STATE, "connected");
}

export function startMockEmulator(Store, Paths) {
  tick = 0;

  const intervalId = setInterval(() => {
    tick += 1;

    const tpsOverridden = Store.get(Paths.OVERRIDES.TPS.ACTIVE) ?? false;
    const tpsVirtual = Store.get(Paths.OVERRIDES.TPS.VALUE) ?? 0.0;

    const rpmOverridden = Store.get(Paths.OVERRIDES.RPM.ACTIVE) ?? false;
    const rpmVirtual = Store.get(Paths.OVERRIDES.RPM.VALUE) ?? 1200.0;

    const egtOverridden = Store.get(Paths.OVERRIDES.EGT.ACTIVE) ?? false;
    const egtVirtual = Store.get(Paths.OVERRIDES.EGT.VALUE) ?? 20.0;
    const egtFault = Store.get(Paths.OVERRIDES.EGT_FAULT.ACTIVE) ?? false;

    const currentRpm = Store.get(Paths.TELEMETRY.RPM) ?? 1200.0;
    const currentEgt = Store.get(Paths.TELEMETRY.EGT) ?? 20.0;

    const physicalTps = 20.0 + 10.0 * Math.sin(tick * 0.0628);
    const activeTps = tpsOverridden ? tpsVirtual : physicalTps;

    let nextRpm = currentRpm;
    if (rpmOverridden) {
      nextRpm = rpmVirtual;
    } else {
      const rpmIdle = 1200.0;
      const rpmRedline = 18000.0;
      const tpsFraction = activeTps / 100.0;
      const targetRpm = rpmIdle + tpsFraction * (rpmRedline - rpmIdle);
      nextRpm += (targetRpm - nextRpm) * 0.2;
    }

    nextRpm = Math.max(0, Math.min(18000, nextRpm));

    let nextEgt = currentEgt;
    if (egtOverridden) {
      nextEgt = egtVirtual;
    } else if (egtFault) {
      nextEgt += (850.0 - nextEgt) * 0.4;
    } else {
      const egtAmbient = 20.0;
      const targetEgt = qsActive
        ? egtAmbient
        : egtAmbient + (activeTps * 4.0) + (nextRpm * 0.03);
      nextEgt += (targetEgt - nextEgt) * 0.1;
    }

    nextEgt = Math.max(20.0, Math.min(1000.0, nextEgt));

    const sparkAdvance = 15.0 + (nextRpm / 1000.0) * 1.2;
    const previousRpm = Number(currentRpm) || 0;
    const rpmAccel = (nextRpm - previousRpm) * 10;

    dispatchMockTelemetry({
      rpm: Number(nextRpm.toFixed(1)),
      tps: Number(activeTps.toFixed(1)),
      egt: Number(nextEgt.toFixed(1)),
      advance: Number(sparkAdvance.toFixed(2)),
      rpmAccel: Number(rpmAccel.toFixed(1))
    });
  }, 100);

  return () => {
    clearInterval(intervalId);
    if (qsTimeoutId) clearTimeout(qsTimeoutId);
  };
}

export function applyMockCommandEffect(raw, Store, Paths) {
  try {
    const payload = JSON.parse(raw);
    const { cmd, param, active, value, fault } = payload;

    log.debug("[MockEmulator] Received command:", payload);

    if (cmd === "toggle_override") {
      if (param === "tps") {
        Store.set(Paths.OVERRIDES.TPS.ACTIVE, !!active);
      } else if (param === "egt") {
        Store.set(Paths.OVERRIDES.EGT.ACTIVE, !!active);
      } else if (param === "rpm") {
        Store.set(Paths.OVERRIDES.RPM.ACTIVE, !!active);
      }
    } else if (cmd === "set_value") {
      if (param === "tps") {
        Store.set(Paths.OVERRIDES.TPS.VALUE, Number(value));
      } else if (param === "egt") {
        Store.set(Paths.OVERRIDES.EGT.VALUE, Number(value));
      } else if (param === "rpm") {
        Store.set(Paths.OVERRIDES.RPM.VALUE, Number(value));
      }
    } else if (cmd === "inject_fault") {
      if (fault === "egt_overheat") {
        Store.set(Paths.OVERRIDES.EGT_FAULT.ACTIVE, !!active);
      }
    } else if (cmd === "qs_trigger") {
      qsActive = true;
      Store.set(Paths.TELEMETRY.QS_ACTIVE, true);
      Store.set(Paths.TELEMETRY.SPARK_DETECTED, false);
      log.info("[MockEmulator] Quick shift cut activated (80ms)");

      if (qsTimeoutId) clearTimeout(qsTimeoutId);
      qsTimeoutId = setTimeout(() => {
        qsActive = false;
        Store.set(Paths.TELEMETRY.QS_ACTIVE, false);
        Store.set(Paths.TELEMETRY.SPARK_DETECTED, false);
        log.info("[MockEmulator] Quick shift cut ended");
      }, 80);
    }
  } catch (err) {
    log.error("[MockEmulator] Failed to apply command effect", err);
  }
}

export function installMockCommandEffects() {
  import("../core/socket.js").then(({ Socket }) => {
    const originalSend = Socket.send;
    if (originalSend && originalSend._isMockWrapped) return;

    const wrappedSend = (msg) => {
      import("../core/store.js").then(({ Store }) => {
        import("./paths.js").then(({ Paths }) => {
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

function dispatchMockTelemetry(values) {
  mockGen += 1;
  const nowUs = Date.now() * 1000;
  const rpm = values.rpm || 0;
  const periodUs = rpm > 0 ? 60000000 / rpm : 0;
  const egtState = values.egt >= 800 ? "Critical" : values.egt >= 700 ? "High" : "Normal";
  const egtRequest = values.egt >= 800
    ? "CriticalProtectionRequested"
    : values.egt >= 700
      ? "Warning"
      : "Normal";

  dispatchMessage(JSON.stringify({
    type: "telemetry",
    schema: "ecu.telemetry.v1",
    t_us: nowUs,
    gen: mockGen,
    state: {
      tps: {
        permille: Math.round(values.tps * 10),
        pct: values.tps,
        fallback_permille: 700,
        fallback_used: false,
        meta: mockMeta(nowUs)
      },
      rpm: {
        rpm: values.rpm,
        period_us: periodUs,
        accel_rpm_per_s: values.rpmAccel,
        synchronized: rpm > 100,
        crank_reference_trusted: rpm > 100,
        revolution_id: mockGen,
        reference_at_us: nowUs,
        meta: mockMeta(nowUs)
      },
      egt: {
        c: values.egt,
        rate_c_per_s: 0,
        max_c: Math.max(values.egt, 20),
        state: egtState,
        request: egtRequest,
        meta: mockMeta(nowUs)
      },
      water: {
        c: Math.max(20, Math.min(95, 65 + values.egt * 0.03)),
        rate_c_per_s: 0,
        max_c: 95,
        state: "Normal",
        request: "Normal",
        meta: mockMeta(nowUs)
      },
      quick_shifter: {
        active: qsActive,
        armed: !qsActive,
        meta: mockMeta(nowUs)
      },
      map_switch: {
        request: "Primary",
        meta: mockMeta(nowUs)
      },
      knock: {
        revolution_id: mockGen,
        pickup_edge_at_us: nowUs,
        window_opened_at_us: nowUs,
        window_closed_at_us: nowUs,
        read_at_us: nowUs,
        raw_integrator_count: 0,
        background_estimate: 0,
        normalized_index: 0,
        candidate_knock: false,
        valid: true,
        health: "Valid",
        quality: "Good",
        fault_bits: 0,
        rpm: values.rpm,
        tps_permille: Math.round(values.tps * 10),
        ignition_angle_deg: values.advance,
        config_generation: 1
      }
    },
    events: [],
    overflow: {
      quick_shift_events: 0,
      map_switch_events: 0,
      knock_measurements: 0,
      fault_events: 0
    },
    transport: {
      sent_frames: mockGen,
      dropped_frames: 0,
      send_errors: 0
    }
  }));
}

function mockMeta(nowUs) {
  return {
    acquired_at_us: nowUs,
    seq: mockGen,
    valid: true,
    health: "Valid",
    quality: "Good",
    fault_bits: 0
  };
}

installMockCommandEffects();
