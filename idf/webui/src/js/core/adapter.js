import { Store } from "./store.js";
import { Paths } from "../utils/paths.js";

const MAX_EVENTS_LOG = 100;

let _rawTelemetryHook = null;
let _runStartedHook = null;
let _runEndedHook = null;

export function setRawTelemetryHook(fn) { _rawTelemetryHook = fn; }
export function setRunStartedHook(fn)   { _runStartedHook   = fn; }
export function setRunEndedHook(fn)     { _runEndedHook     = fn; }

/**
 * Parses and dispatches incoming WebSocket JSON frames from the ECU.
 * V1 frames are "capabilities" and "telemetry"; unknown types are ignored.
 *
 * @param {string} raw Raw WebSocket text frame
 */
export function dispatchMessage(raw) {
  if (typeof raw !== "string") return;

  const text = raw.trim();
  if (!text.startsWith("{")) return;

  let payload;
  try {
    payload = JSON.parse(text);
  } catch (err) {
    console.error("[Adapter] JSON parse error:", err, raw);
    return;
  }

  switch (payload.type) {
    case "capabilities":
      handleCapabilities(payload);
      break;
    case "telemetry":
      handleTelemetry(payload);
      break;
    case "recording_config":
      handleRecordingConfig(payload);
      break;
    case "run_started":
      if (_runStartedHook) _runStartedHook(payload);
      break;
    case "run_ended":
      if (_runEndedHook) _runEndedHook(payload);
      break;
    default:
      break;
  }
}

function handleCapabilities(capabilities) {
  console.info(
    "[Adapter] ECU capabilities:",
    capabilities.schema,
    `v${capabilities.schema_version ?? 1}`,
    `@ ${capabilities.state_hz ?? 10} Hz`
  );

  Store.set(Paths.CONNECTION.SCHEMA_VERSION, capabilities.schema_version ?? 1);
  Store.set(Paths.CONNECTION.STATE_HZ, capabilities.state_hz ?? 10);
  Store.set(Paths.CONNECTION.EVENTS_PER_BATCH, capabilities.events_per_batch ?? 8);

  if (capabilities.device && typeof capabilities.device === "object") {
    Store.set(Paths.CONNECTION.DEVICE, {
      hwid: capabilities.device.hwid ?? null,
      hardware_revision: capabilities.device.hardware_revision ?? null,
      chip_model: capabilities.device.chip_model ?? null,
      flash_size_bytes: capabilities.device.flash_size_bytes ?? null,
    });
  }
  if (capabilities.recording && typeof capabilities.recording === "object") {
    Store.set(Paths.CONNECTION.RECORDING_CONFIG, {
      auto_enabled: !!capabilities.recording.auto_enabled,
      rpm_threshold: capabilities.recording.rpm_threshold ?? 300,
      start_debounce_ms: capabilities.recording.start_debounce_ms ?? 1000,
      stop_debounce_ms: capabilities.recording.stop_debounce_ms ?? 3000,
    });
  }
}

function handleTelemetry(frame) {
  if (_rawTelemetryHook) _rawTelemetryHook(frame);

  Store.set(Paths.TELEMETRY.TIMESTAMP, frame.t_us ?? 0);
  Store.set(Paths.TELEMETRY.GEN, frame.gen ?? 0);

  const state = frame.state ?? {};

  if (state.tps != null) {
    Store.set(Paths.TELEMETRY.TPS, normalizeTpsPercent(state.tps));
    Store.set(Paths.TELEMETRY.TPS_FALLBACK_USED, !!state.tps.fallback_used);
    Store.set(Paths.TELEMETRY.TPS_META, normalizeMeta(state.tps.meta));
  }

  if (state.rpm != null) {
    Store.set(Paths.TELEMETRY.RPM, state.rpm.rpm ?? 0);
    Store.set(Paths.TELEMETRY.RPM_ACCEL, state.rpm.accel_rpm_per_s ?? 0);
    Store.set(Paths.TELEMETRY.RPM_SYNCHRONIZED, !!state.rpm.synchronized);
    Store.set(Paths.TELEMETRY.RPM_META, normalizeMeta(state.rpm.meta));
  }

  if (state.egt != null) {
    Store.set(Paths.TELEMETRY.EGT, state.egt.c ?? 0);
    Store.set(Paths.TELEMETRY.EGT_STATE, state.egt.state ?? "Unknown");
    Store.set(Paths.TELEMETRY.EGT_REQUEST, state.egt.request ?? "Normal");
    Store.set(Paths.TELEMETRY.EGT_META, normalizeMeta(state.egt.meta));
  }

  if (state.water != null) {
    Store.set(Paths.TELEMETRY.WATER_TEMP, state.water.c ?? 0);
    Store.set(Paths.TELEMETRY.WATER_STATE, state.water.state ?? "Unknown");
    Store.set(Paths.TELEMETRY.WATER_REQUEST, state.water.request ?? "Normal");
    Store.set(Paths.TELEMETRY.WATER_META, normalizeMeta(state.water.meta));
  }

  if (state.quick_shifter != null) {
    Store.set(Paths.TELEMETRY.QS_ACTIVE, !!state.quick_shifter.active);
    Store.set(Paths.TELEMETRY.QS_ARMED, !!state.quick_shifter.armed);
    Store.set(Paths.TELEMETRY.QS_META, normalizeMeta(state.quick_shifter.meta));
  }

  if (state.map_switch != null) {
    Store.set(Paths.TELEMETRY.MAP_REQUEST, state.map_switch.request ?? "Primary");
    Store.set(Paths.TELEMETRY.MAP_META, normalizeMeta(state.map_switch.meta));
  }

  if ("knock" in state) {
    Store.set(Paths.TELEMETRY.KNOCK, state.knock ?? null);
    Store.set(Paths.TELEMETRY.ECU_ADVANCE, state.knock?.ignition_angle_deg ?? 0);
  }

  Store.set(Paths.TELEMETRY.SPARK_DETECTED, false);

  if (frame.overflow != null) {
    Store.set(Paths.TELEMETRY.OVERFLOW, frame.overflow);
  }

  if (frame.transport != null) {
    Store.set(Paths.TELEMETRY.TRANSPORT, frame.transport);
  }

  if (Array.isArray(frame.events) && frame.events.length > 0) {
    const current = Store.get(Paths.TELEMETRY.EVENTS) ?? [];
    const merged = [...current, ...frame.events];
    Store.set(
      Paths.TELEMETRY.EVENTS,
      merged.length > MAX_EVENTS_LOG ? merged.slice(-MAX_EVENTS_LOG) : merged
    );
  }
}

function normalizeTpsPercent(tps) {
  if (Number.isFinite(tps.pct)) return tps.pct;
  return (tps.permille ?? 0) / 10;
}

function normalizeMeta(meta) {
  if (!meta) return null;
  return {
    acquiredAtUs: meta.acquired_at_us ?? 0,
    seq: meta.seq ?? 0,
    valid: !!meta.valid,
    health: meta.health ?? "Unknown",
    quality: meta.quality ?? "Unknown",
    faultBits: meta.fault_bits ?? 0,
  };
}

function handleRecordingConfig(payload) {
  Store.set(Paths.CONNECTION.RECORDING_CONFIG, {
    auto_enabled: !!payload.auto_enabled,
    rpm_threshold: payload.rpm_threshold ?? 300,
    start_debounce_ms: payload.start_debounce_ms ?? 1000,
    stop_debounce_ms: payload.stop_debounce_ms ?? 3000,
  });
}

export function setBootstrapProcessedNotifier(_fn) {}
