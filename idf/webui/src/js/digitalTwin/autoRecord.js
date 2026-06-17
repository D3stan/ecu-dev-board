/**
 * autoRecord.js
 *
 * Observes ECU run_started / run_ended lifecycle frames and opens/closes
 * the corresponding server run when auto_enabled is true.
 *
 * The ECU decides when a run begins and ends — this module only bridges
 * that decision to the Digital-Twin server.
 */

import { Store } from "../core/store.js";
import { Paths } from "../utils/paths.js";
import { startRun, stopRun, ENABLED } from "./DigitalTwinClient.js";
import { setRunStartedHook, setRunEndedHook } from "../core/adapter.js";

let _running = false;

export function start() {
  if (!ENABLED || _running) return;
  _running = true;
  setRunStartedHook(_onRunStarted);
  setRunEndedHook(_onRunEnded);
}

export function stop() {
  _running = false;
  setRunStartedHook(null);
  setRunEndedHook(null);
}

async function _onRunStarted(payload) {
  const cfg = Store.get(Paths.CONNECTION.RECORDING_CONFIG);
  if (!cfg || !cfg.auto_enabled) return;

  const status = Store.get(Paths.DIGITAL_TWIN.STATUS);
  if (status !== "idle") return; // already running or transitioning

  const device = Store.get(Paths.CONNECTION.DEVICE);
  const hwid   = device?.hwid;
  const rev    = device?.hardware_revision;
  const ecuRunId = payload.ecu_run_id ?? "unknown";

  try {
    await startRun(hwid, rev, ecuRunId, false);
  } catch (err) {
    console.error("[autoRecord] startRun failed:", err);
  }
}

async function _onRunEnded(payload) {
  const ecuRunId = Store.get(Paths.DIGITAL_TWIN.ECU_RUN_ID);
  if (!ecuRunId || ecuRunId !== payload.ecu_run_id) return;

  const status = Store.get(Paths.DIGITAL_TWIN.STATUS);
  if (status !== "running") return;

  // Only auto-stop if not manually overridden
  // (Manual runs are stopped only by user pressing Stop)
  try {
    await stopRun();
  } catch (err) {
    console.error("[autoRecord] stopRun failed:", err);
  }
}
