import { Store } from "./store.js";
import { Paths } from "../utils/paths.js";

/**
 * Parses and dispatches incoming WebSocket JSON messages from the ECU Simulator.
 * @param {string} raw Raw JSON string message
 */
export function dispatchMessage(raw) {
  if (typeof raw !== "string") return;

  try {
    const payload = JSON.parse(raw);
    if (payload.type === "sim_telemetry" && payload.data) {
      const data = payload.data;
      
      // Update telemetry values in the Store
      Store.set(Paths.TELEMETRY.RPM, data.rpm ?? 0);
      Store.set(Paths.TELEMETRY.TPS, data.tps ?? 0);
      Store.set(Paths.TELEMETRY.EGT, data.egt ?? 0);
      Store.set(Paths.TELEMETRY.ECU_ADVANCE, data.ecu_advance ?? 0);
      Store.set(Paths.TELEMETRY.SPARK_DETECTED, !!data.spark_detected);
      
      // Update override status flags in the Store
      if (data.overrides) {
        Store.set(Paths.OVERRIDES.TPS.ACTIVE, !!data.overrides.tps);
        Store.set(Paths.OVERRIDES.EGT.ACTIVE, !!data.overrides.egt);
        Store.set(Paths.OVERRIDES.EGT_FAULT.ACTIVE, !!data.overrides.egt_fault);
      }
    }
  } catch (err) {
    console.error("[Adapter] Failed to parse WebSocket message:", err, raw);
  }
}

export function setBootstrapProcessedNotifier(fn) {
  // Keeping method signature for compatibility with App bootstrap
}
