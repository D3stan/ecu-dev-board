/**
 * digitalTwin/index.js
 *
 * Entry point for the Digital-Twin bridge.
 * Must be called ONCE from App.js during bootstrap.
 * Idempotent — safe to call multiple times (only initialises once).
 */

import { ENABLED, enqueueFrame, resumeRun, tryFlush } from "./DigitalTwinClient.js";
import { setRawTelemetryHook } from "../core/adapter.js";
import { start as startAutoRecord } from "./autoRecord.js";
import { Spool } from "./spool.js";
import { Store } from "../core/store.js";
import { Paths } from "../utils/paths.js";

let _initialized = false;

export async function initDigitalTwin() {
  if (!ENABLED || _initialized) return;
  _initialized = true;

  try {
    await Spool.open();
  } catch (err) {
    console.error("[DigitalTwin] IndexedDB unavailable — recording disabled:", err);
    return;
  }

  Store.set(Paths.DIGITAL_TWIN.STATUS, "idle");

  // Check for a run that was in progress when the page was last closed
  try {
    const pending = await Spool.findActiveRun();
    if (pending && pending.run_id) {
      console.info("[DigitalTwin] Resuming run", pending.run_id, "from seq", pending.max_batch_seq);
      await resumeRun(pending.run_id, pending.ecu_run_id, pending.max_batch_seq);
    }
  } catch (err) {
    console.warn("[DigitalTwin] resume check failed:", err);
  }

  // Hook raw telemetry frames into the spool while running
  setRawTelemetryHook(async (frame) => {
    const status = Store.get(Paths.DIGITAL_TWIN.STATUS);
    if (status !== "running") return;
    if (frame.batch_seq == null) return; // firmware pre-feature — skip
    await enqueueFrame(frame);
  });

  // Start ECU-event-driven auto-record
  startAutoRecord();

  console.info("[DigitalTwin] Initialized. Server:", import.meta.env.VITE_DIGITAL_TWIN_SERVER_URL);
}
