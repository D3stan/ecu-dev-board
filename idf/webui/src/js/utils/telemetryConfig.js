import { Paths } from "./paths.js";

export const AppMode = Object.freeze({
  ECU: "ecu",
  DEVELOPMENT: "development",
});

export const TelemetryUiConfig = Object.freeze({
  defaultStateHz: 10,
  historyMaxSeconds: 600,
  defaultRangeSeconds: 120,
  rpmGaugeMax: 18000,
  recentEventsLimit: 6,
});

export const TELEMETRY_SIGNALS = [
  {
    id: "rpm",
    label: "Engine Speed",
    shortLabel: "RPM",
    valuePath: Paths.TELEMETRY.RPM,
    metaPath: Paths.TELEMETRY.RPM_META,
    unit: "rpm",
    precision: 0,
    chart: "line",
  },
  {
    id: "tps",
    label: "Throttle Position",
    shortLabel: "TPS",
    valuePath: Paths.TELEMETRY.TPS,
    metaPath: Paths.TELEMETRY.TPS_META,
    unit: "%",
    precision: 1,
    chart: "line",
  },
  {
    id: "egt",
    label: "Exhaust Gas Temperature",
    shortLabel: "EGT",
    valuePath: Paths.TELEMETRY.EGT,
    metaPath: Paths.TELEMETRY.EGT_META,
    unit: "C",
    precision: 1,
    chart: "line",
  },
  {
    id: "water",
    label: "Water Temperature",
    shortLabel: "Water",
    valuePath: Paths.TELEMETRY.WATER_TEMP,
    metaPath: Paths.TELEMETRY.WATER_META,
    unit: "C",
    precision: 1,
    chart: "line",
  },
  {
    id: "rpmAccel",
    label: "RPM Acceleration",
    shortLabel: "Accel",
    valuePath: Paths.TELEMETRY.RPM_ACCEL,
    metaPath: Paths.TELEMETRY.RPM_META,
    unit: "rpm/s",
    precision: 0,
    chart: "line",
  },
  {
    id: "qsActive",
    label: "Quick Shifter Active",
    shortLabel: "QS Active",
    valuePath: Paths.TELEMETRY.QS_ACTIVE,
    metaPath: Paths.TELEMETRY.QS_META,
    chart: "step",
    formatValue: (value) => (value ? "Active" : "Idle"),
    sampleValue: (value) => (value ? 1 : 0),
  },
  {
    id: "qsArmed",
    label: "Quick Shifter Armed",
    shortLabel: "QS Armed",
    valuePath: Paths.TELEMETRY.QS_ARMED,
    metaPath: Paths.TELEMETRY.QS_META,
    chart: "step",
    formatValue: (value) => (value ? "Armed" : "Not armed"),
    sampleValue: (value) => (value ? 1 : 0),
  },
  {
    id: "mapRequest",
    label: "Physical Map Request",
    shortLabel: "Map Request",
    valuePath: Paths.TELEMETRY.MAP_REQUEST,
    metaPath: Paths.TELEMETRY.MAP_META,
    chart: "step",
    formatValue: (value) => value || "Unknown",
    sampleValue: (value) => (value === "Secondary" ? 1 : 0),
  },
  {
    id: "knock",
    label: "Latest Knock",
    shortLabel: "Knock",
    valuePath: Paths.TELEMETRY.KNOCK,
    chart: "line",
    formatValue: (value) => {
      if (!value) return "No data";
      if (Number.isFinite(value.normalized_index)) {
        return value.normalized_index.toFixed(2);
      }
      return value.candidate_knock ? "Candidate" : "Present";
    },
    sampleValue: (value) => {
      if (!value || !Number.isFinite(value.normalized_index)) return null;
      return value.normalized_index;
    },
    getMeta: (value) => value || null,
  },
];

export function getSignalDefinition(signalId) {
  return TELEMETRY_SIGNALS.find((signal) => signal.id === signalId) || null;
}

export function getHistorySignals() {
  return TELEMETRY_SIGNALS.filter((signal) => signal.chart);
}
