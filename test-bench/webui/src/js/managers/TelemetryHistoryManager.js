import { Paths } from "../utils/paths.js";
import { TelemetryUiConfig, getHistorySignals } from "../utils/telemetryConfig.js";

const state = {
  Store: null,
  signals: [],
  buffers: new Map(),
  events: [],
  eventKeys: new Set(),
  unsubscribers: [],
  scheduled: false,
  lastSampleKey: null,
  maxSeconds: TelemetryUiConfig.historyMaxSeconds,
  stateHz: TelemetryUiConfig.defaultStateHz,
  initialized: false,
};

export function init(options = {}) {
  stop();

  state.Store = options.Store;
  state.signals = options.signals || getHistorySignals();
  state.maxSeconds = options.maxSeconds || TelemetryUiConfig.historyMaxSeconds;
  state.stateHz = options.stateHz || TelemetryUiConfig.defaultStateHz;
  state.buffers = new Map(state.signals.map((signal) => [signal.id, []]));
  state.events = [];
  state.eventKeys = new Set();
  state.lastSampleKey = null;

  if (!state.Store) {
    throw new Error("TelemetryHistoryManager.init requires Store");
  }

  const paths = getSubscribedPaths(state.signals);
  state.unsubscribers = paths.map((path) =>
    state.Store.subscribe(path, scheduleSample, false)
  );

  state.initialized = true;
  scheduleSample();
}

export function stop() {
  state.unsubscribers.forEach((unsubscribe) => {
    if (typeof unsubscribe === "function") unsubscribe();
  });

  state.unsubscribers = [];
  state.scheduled = false;
  state.initialized = false;
}

export function clear() {
  state.buffers.forEach((buffer) => buffer.splice(0, buffer.length));
  state.events = [];
  state.eventKeys.clear();
  state.lastSampleKey = null;
}

export function getSeries(signalId, rangeSeconds = TelemetryUiConfig.defaultRangeSeconds) {
  const buffer = state.buffers.get(signalId) || [];
  return filterByRange(buffer, rangeSeconds).map((sample) => ({ ...sample }));
}

export function getEvents(rangeSeconds = TelemetryUiConfig.defaultRangeSeconds) {
  return filterByRange(state.events, rangeSeconds).map((event) => ({ ...event }));
}

export function getLatestSample(signalId) {
  const buffer = state.buffers.get(signalId) || [];
  const latest = buffer[buffer.length - 1];
  return latest ? { ...latest } : null;
}

export function _debug() {
  return {
    initialized: state.initialized,
    buffers: Object.fromEntries(
      Array.from(state.buffers.entries()).map(([key, value]) => [key, value.length])
    ),
    events: state.events.length,
    stateHz: state.stateHz,
    maxSeconds: state.maxSeconds,
    lastSampleKey: state.lastSampleKey,
  };
}

function scheduleSample() {
  if (state.scheduled) return;
  state.scheduled = true;
  queueMicrotask(flushSample);
}

function flushSample() {
  state.scheduled = false;
  if (!state.Store) return;

  const frameUs = read(Paths.TELEMETRY.TIMESTAMP, 0);
  const gen = read(Paths.TELEMETRY.GEN, 0);
  const sampleKey = `${gen}:${frameUs}`;

  updateStateHz();
  mergeEvents(read(Paths.TELEMETRY.EVENTS, []));

  if (!frameUs && !gen) {
    return;
  }

  if (sampleKey === state.lastSampleKey) {
    return;
  }

  state.lastSampleKey = sampleKey;

  for (const signal of state.signals) {
    const rawValue = read(signal.valuePath, null);
    const sampleValue = getSampleValue(signal, rawValue);
    if (sampleValue == null || Number.isNaN(sampleValue)) continue;

    const meta = signal.getMeta ? signal.getMeta(rawValue, read) : read(signal.metaPath, null);
    const buffer = state.buffers.get(signal.id);
    if (!buffer) continue;

    buffer.push({
      tUs: frameUs,
      gen,
      value: sampleValue,
      rawValue,
      meta,
    });
  }

  trimBuffers();
}

function getSubscribedPaths(signals) {
  const paths = new Set([
    Paths.TELEMETRY.TIMESTAMP,
    Paths.TELEMETRY.GEN,
    Paths.TELEMETRY.EVENTS,
    Paths.CONNECTION.STATE_HZ,
  ]);

  for (const signal of signals) {
    if (signal.valuePath) paths.add(signal.valuePath);
    if (signal.metaPath) paths.add(signal.metaPath);
  }

  return Array.from(paths);
}

function read(path, fallback = null) {
  try {
    const value = state.Store.get(path);
    return value == null ? fallback : value;
  } catch (_) {
    return fallback;
  }
}

function getSampleValue(signal, rawValue) {
  if (typeof signal.sampleValue === "function") {
    return signal.sampleValue(rawValue);
  }
  return rawValue;
}

function updateStateHz() {
  const nextHz = Number(read(Paths.CONNECTION.STATE_HZ, state.stateHz));
  if (Number.isFinite(nextHz) && nextHz > 0) {
    state.stateHz = nextHz;
  }
}

function mergeEvents(events) {
  if (!Array.isArray(events)) return;

  for (const event of events) {
    const key = getEventKey(event);
    if (state.eventKeys.has(key)) continue;
    state.eventKeys.add(key);
    state.events.push({ ...event, tUs: event.at_us });
  }

  trimEvents();
}

function getEventKey(event) {
  const seq = event?.meta?.seq ?? event?.seq ?? "";
  return `${event?.kind || "event"}:${event?.at_us ?? ""}:${seq}:${event?.fault || ""}:${event?.request || ""}`;
}

function trimBuffers() {
  const maxSamples = Math.max(1, Math.ceil(state.stateHz * state.maxSeconds));
  for (const buffer of state.buffers.values()) {
    if (buffer.length > maxSamples) {
      buffer.splice(0, buffer.length - maxSamples);
    }
  }
}

function trimEvents() {
  const latestUs = read(Paths.TELEMETRY.TIMESTAMP, null);
  if (Number.isFinite(latestUs)) {
    const minUs = latestUs - state.maxSeconds * 1000000;
    state.events = state.events.filter((event) => !Number.isFinite(event.tUs) || event.tUs >= minUs);
  }

  if (state.events.length > 500) {
    state.events = state.events.slice(-500);
  }

  state.eventKeys = new Set(state.events.map(getEventKey));
}

function filterByRange(items, rangeSeconds) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const latest = items[items.length - 1]?.tUs;
  if (!Number.isFinite(latest) || !Number.isFinite(rangeSeconds)) {
    return items;
  }
  const minUs = latest - rangeSeconds * 1000000;
  return items.filter((item) => !Number.isFinite(item.tUs) || item.tUs >= minUs);
}

export const TelemetryHistoryManager = {
  init,
  stop,
  clear,
  getSeries,
  getEvents,
  getLatestSample,
  _debug,
};
