export function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function formatNumber(value, decimals = 0, fallback = "--") {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return number.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

export function formatRpm(value) {
  return formatNumber(value, 0);
}

export function formatPercent(value) {
  return formatNumber(value, 1);
}

export function formatTemp(value) {
  return formatNumber(value, 1);
}

export function formatSigned(value, decimals = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  const prefix = number > 0 ? "+" : "";
  return `${prefix}${formatNumber(number, decimals)}`;
}

export function formatFaultBits(value) {
  const number = Number(value) || 0;
  return `0x${number.toString(16).toUpperCase().padStart(2, "0")}`;
}

export function formatDurationMs(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value)) return "--";
  if (value < 1000) return `${Math.max(0, Math.round(value))}ms`;
  return `${(value / 1000).toFixed(1)}s`;
}

export function formatMetaAge(frameTUs, meta) {
  if (!meta || !Number.isFinite(Number(frameTUs)) || !Number.isFinite(Number(meta.acquiredAtUs))) {
    return "--";
  }

  const ageMs = (Number(frameTUs) - Number(meta.acquiredAtUs)) / 1000;
  return formatDurationMs(ageMs);
}

export function healthState(meta) {
  if (!meta) return { label: "NO META", className: "unknown" };
  if (meta.faultBits) return { label: "FAULT", className: "fault" };
  if (!meta.valid) return { label: "INVALID", className: "invalid" };

  const health = String(meta.health || "Unknown").toLowerCase();
  const quality = String(meta.quality || "Unknown").toLowerCase();

  if (health === "valid" && quality === "good") {
    return { label: "GOOD", className: "ok" };
  }

  if (health === "unknown" && quality === "unknown") {
    return { label: "UNKNOWN", className: "unknown" };
  }

  return { label: (meta.health || meta.quality || "DEGRADED").toString().toUpperCase(), className: "degraded" };
}

export function summarizeEvent(event) {
  if (!event) return "";

  switch (event.kind) {
    case "QuickShiftRequest":
      return event.active ? "request active" : `released after ${event.duration_us || 0} us`;
    case "MapSwitchChange":
      return `physical request ${event.request || "--"}`;
    case "FaultTransition":
      return `${event.fault || "fault"} -> ${event.health || "unknown"}`;
    default:
      return Object.entries(event)
        .filter(([key]) => !["kind", "at_us", "meta"].includes(key))
        .slice(0, 2)
        .map(([key, value]) => `${key}=${value}`)
        .join(" ");
  }
}
