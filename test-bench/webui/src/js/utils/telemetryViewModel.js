import { Paths } from "./paths.js";
import { TelemetryUiConfig } from "./telemetryConfig.js";

const SENSOR_AGE_WARN_MS = 500;
const SENSOR_AGE_DANGER_MS = 2000;

export function buildStatusStripModel(read) {
  const socketState = read(Paths.SOCKET.STATE);
  const schemaVersion = read(Paths.CONNECTION.SCHEMA_VERSION);
  const stateHz = read(Paths.CONNECTION.STATE_HZ);
  const gen = read(Paths.TELEMETRY.GEN);
  const tUs = read(Paths.TELEMETRY.TIMESTAMP);
  const transport = read(Paths.TELEMETRY.TRANSPORT) || {};

  return {
    socketState: socketState || "disconnected",
    schemaLabel: schemaVersion ? `v${schemaVersion}` : "v-",
    cadenceLabel: `${stateHz || TelemetryUiConfig.defaultStateHz} Hz`,
    generationLabel: Number.isFinite(gen) ? `#${gen}` : "#-",
    frameTimeLabel: formatDurationUs(tUs),
    transportLabel: formatTransport(transport),
    transportSeverity: getTransportSeverity(transport),
  };
}

export function buildSensorCardModel(signal, read) {
  const value = read(signal.valuePath);
  const frameUs = read(Paths.TELEMETRY.TIMESTAMP);
  const meta = signal.getMeta ? signal.getMeta(value, read) : read(signal.metaPath);
  const health = buildHealthModel(meta);
  const ageMs = getSensorAgeMs(frameUs, meta);

  return {
    id: signal.id,
    label: signal.label,
    shortLabel: signal.shortLabel || signal.label,
    value,
    displayValue: formatSignalValue(signal, value),
    unit: signal.unit || "",
    health,
    ageMs,
    ageLabel: formatAge(ageMs),
    stale: ageMs != null && ageMs >= SENSOR_AGE_WARN_MS,
    faulted: health.faultBits !== 0 || health.severity === "danger",
  };
}

export function buildHealthModel(meta) {
  const faultBits = Number(meta?.faultBits ?? meta?.fault_bits ?? 0);
  const valid = meta?.valid ?? meta?.valid_for_control ?? null;
  const health = meta?.health || "Unknown";
  const quality = meta?.quality || "Unknown";

  let severity = "unknown";
  if (valid === false || quality === "Bad" || health === "Failed") {
    severity = "danger";
  } else if (
    faultBits !== 0 ||
    health === "Degraded" ||
    health === "Stale" ||
    quality === "Suspect"
  ) {
    severity = "warning";
  } else if (valid === true && health === "Valid" && quality === "Good") {
    severity = "ok";
  }

  return {
    valid,
    health,
    quality,
    faultBits,
    severity,
    label: buildHealthLabel({ valid, health, quality, faultBits }),
  };
}

export function formatSignalValue(signal, value) {
  if (typeof signal.formatValue === "function") {
    return signal.formatValue(value);
  }

  if (value == null || value === "") {
    return "--";
  }

  if (typeof value === "boolean") {
    return value ? "On" : "Off";
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const precision = signal.precision ?? 0;
    return value.toLocaleString(undefined, {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    });
  }

  return String(value);
}

export function buildRecentEventsModel(events, frameUs, limit = TelemetryUiConfig.recentEventsLimit) {
  if (!Array.isArray(events) || events.length === 0) {
    return [];
  }

  return events.slice(-limit).map((event) => ({
    ...event,
    title: formatEventTitle(event),
    summary: formatEventSummary(event),
    ageLabel: formatEventAge(event, frameUs),
  }));
}

export function formatFaultBits(faultBits) {
  const value = Number(faultBits || 0);
  if (!value) return "0";
  return `0x${value.toString(16).toUpperCase()}`;
}

export function getSensorAgeMs(frameUs, meta) {
  const acquiredAtUs = meta?.acquiredAtUs ?? meta?.acquired_at_us;
  if (!Number.isFinite(frameUs) || !Number.isFinite(acquiredAtUs)) {
    return null;
  }
  return Math.max(0, Math.round((frameUs - acquiredAtUs) / 1000));
}

export function formatAge(ageMs) {
  if (ageMs == null) return "age --";
  if (ageMs < 1000) return `${ageMs} ms`;
  return `${(ageMs / 1000).toFixed(1)} s`;
}

export function formatDurationUs(tUs) {
  if (!Number.isFinite(tUs) || tUs <= 0) return "t --";

  const totalSeconds = Math.floor(tUs / 1000000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes < 60) {
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}:${String(remainingMinutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function getAgeSeverity(ageMs) {
  if (ageMs == null) return "unknown";
  if (ageMs >= SENSOR_AGE_DANGER_MS) return "danger";
  if (ageMs >= SENSOR_AGE_WARN_MS) return "warning";
  return "ok";
}

function buildHealthLabel({ valid, health, quality, faultBits }) {
  if (faultBits) return `Fault ${formatFaultBits(faultBits)}`;
  if (valid === false) return "Invalid";
  if (health && health !== "Unknown") return health;
  return quality || "Unknown";
}

function formatTransport(transport) {
  const dropped = Number(transport.dropped_frames || 0);
  const errors = Number(transport.send_errors || 0);
  if (dropped || errors) {
    return `${dropped} dropped / ${errors} errors`;
  }
  const sent = Number(transport.sent_frames || 0);
  return `${sent} sent`;
}

function getTransportSeverity(transport) {
  const dropped = Number(transport?.dropped_frames || 0);
  const errors = Number(transport?.send_errors || 0);
  if (errors > 0) return "danger";
  if (dropped > 0) return "warning";
  return "ok";
}

function formatEventTitle(event) {
  switch (event?.kind) {
    case "QuickShiftRequest":
      return "Quick shift";
    case "MapSwitchChange":
      return "Map request";
    case "FaultTransition":
      return "Fault";
    default:
      return event?.kind || "Event";
  }
}

function formatEventSummary(event) {
  switch (event?.kind) {
    case "QuickShiftRequest":
      return event.active ? "Request active" : `Released after ${event.duration_us || 0} us`;
    case "MapSwitchChange":
      return `Physical request: ${event.request || "Unknown"}`;
    case "FaultTransition":
      return `${event.fault || "Unknown"} -> ${event.health || "Unknown"}`;
    default:
      return "";
  }
}

function formatEventAge(event, frameUs) {
  const atUs = event?.at_us;
  if (!Number.isFinite(atUs) || !Number.isFinite(frameUs)) {
    return "";
  }
  return formatAge(Math.max(0, Math.round((frameUs - atUs) / 1000)));
}
