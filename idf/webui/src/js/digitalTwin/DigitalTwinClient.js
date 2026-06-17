/**
 * DigitalTwinClient.js
 *
 * Manages the connection to the Digital-Twin server:
 * - 10-state run lifecycle machine
 * - Persistent IndexedDB spool
 * - Chunked upload with configurable in-flight window
 * - Cumulative server ack with committed_through_sequence
 * - Automatic reconnect (reconnecting → running, NOT → ended)
 *
 * States: disabled | idle | starting | running | reconnecting | draining | stopping | ended | interrupted | error
 */

import { Store } from "../core/store.js";
import { Paths } from "../utils/paths.js";
import { Spool } from "./spool.js";

export const ENABLED = !!import.meta.env.VITE_DIGITAL_TWIN_SERVER_URL;
const SERVER_URL = (import.meta.env.VITE_DIGITAL_TWIN_SERVER_URL || "").replace(/\/$/, "");

const CHUNK_SIZE  = Number(import.meta.env.VITE_DT_CHUNK_SIZE  ?? 10);
const WS_WINDOW   = Number(import.meta.env.VITE_DT_WINDOW      ?? 2);
const RECONNECT_BASE_MS = 2000;
const RECONNECT_MAX_MS  = 30000;
const DRAIN_TIMEOUT_MS  = 15000;
const MAX_RECONNECT_TRIES = 5;

let _runId     = null;
let _ecuRunId  = null;
let _hwid      = null;
let _ws        = null;
let _reconnectAttempts = 0;
let _reconnectTimer    = null;
let _drainTimer        = null;
let _inFlight  = 0;     // chunks awaiting ack
let _streamGen = 0;     // incremented on each new server WS connection
let _manualOverride = false; // true when user explicitly started the run

function _setState(s) {
  Store.set(Paths.DIGITAL_TWIN.STATUS, s);
}

function _getState() {
  return Store.get(Paths.DIGITAL_TWIN.STATUS);
}

// ─── REST helpers ────────────────────────────────────────────────────────────

async function _post(path, body) {
  const res = await fetch(`${SERVER_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
  return res.json();
}

async function _getJson(path) {
  const res = await fetch(`${SERVER_URL}${path}`);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json();
}

// ─── Server WebSocket ────────────────────────────────────────────────────────

function _openServerWs(onReady) {
  if (_ws) {
    try { _ws.close(); } catch (_) {}
    _ws = null;
  }

  const wsUrl = SERVER_URL.replace(/^http/, "ws") + "/ws/v1/telemetry";
  const ws = new WebSocket(wsUrl);
  _ws = ws;
  _streamGen++;
  _inFlight = 0;
  Store.set(Paths.DIGITAL_TWIN.IN_FLIGHT, 0);

  ws.onopen = () => {
    _reconnectAttempts = 0;
    if (onReady) onReady();
  };

  ws.onmessage = (e) => {
    let ack;
    try { ack = JSON.parse(e.data); } catch (_) { return; }

    if (ack.status === "persisted" && ack.committed_through_sequence != null) {
      _inFlight = Math.max(0, _inFlight - 1);
      Store.set(Paths.DIGITAL_TWIN.IN_FLIGHT, _inFlight);
      Store.set(Paths.DIGITAL_TWIN.LAST_COMMITTED_SEQ, ack.committed_through_sequence);
      Spool.deleteThrough(_runId, ack.committed_through_sequence).then(() => {
        Spool.countPending(_runId).then(n => Store.set(Paths.DIGITAL_TWIN.SPOOL_SIZE, n));
      });
      // Continue flushing
      _tryFlush();
      // If draining and spool is empty → complete stop
      if (_getState() === "draining") {
        Spool.countPending(_runId).then(n => {
          if (n === 0) _completeStop();
        });
      }
    } else if (ack.status === "error") {
      console.error("[DigitalTwinClient] server error:", ack.detail);
      Store.set(Paths.DIGITAL_TWIN.ERROR, ack.detail || "server_error");
      _setState("error");
    }
  };

  ws.onclose = () => {
    _ws = null;
    const state = _getState();
    if (state === "running" || state === "reconnecting") {
      _scheduleReconnect();
    }
  };

  ws.onerror = () => {
    // onclose will follow
  };
}

function _scheduleReconnect() {
  if (_reconnectAttempts >= MAX_RECONNECT_TRIES) {
    _setState("interrupted");
    return;
  }
  _setState("reconnecting");
  const delay = Math.min(RECONNECT_BASE_MS * 2 ** _reconnectAttempts, RECONNECT_MAX_MS);
  _reconnectAttempts++;
  clearTimeout(_reconnectTimer);
  _reconnectTimer = setTimeout(async () => {
    try {
      // Query server for last committed sequence (resume)
      const info = await _getJson(`/api/runs/active?hwid=${encodeURIComponent(_hwid)}`);
      const serverSeq = info.last_committed_sequence ?? 0;
      Store.set(Paths.DIGITAL_TWIN.LAST_COMMITTED_SEQ, serverSeq);
      // Delete already-committed frames from spool
      await Spool.deleteThrough(_runId, serverSeq);
      _openServerWs(() => {
        _setState("running");
        _tryFlush();
      });
    } catch (err) {
      console.warn("[DigitalTwinClient] reconnect failed:", err);
      _scheduleReconnect();
    }
  }, delay);
}

// ─── Chunk upload ────────────────────────────────────────────────────────────

async function _tryFlush() {
  const state = _getState();
  if (state !== "running" && state !== "draining") return;
  if (!_ws || _ws.readyState !== WebSocket.OPEN) return;
  if (_inFlight >= WS_WINDOW) return;

  const lastSeq = Store.get(Paths.DIGITAL_TWIN.LAST_COMMITTED_SEQ) ?? 0;
  const chunk = await Spool.fetchChunk(_runId, lastSeq, CHUNK_SIZE);
  if (chunk.length === 0) return;

  const envelope = {
    hwid:             _hwid,
    run_id:           _runId,
    ecu_run_id:       _ecuRunId,
    stream_generation: _streamGen,
    chunk: chunk.map(r => ({
      batch_seq:  r.batch_seq,
      frame:      JSON.parse(r.frame_json),
    })),
  };

  try {
    _ws.send(JSON.stringify(envelope));
    _inFlight++;
    Store.set(Paths.DIGITAL_TWIN.IN_FLIGHT, _inFlight);
    // Immediately try to fill the window
    if (_inFlight < WS_WINDOW) _tryFlush();
  } catch (err) {
    console.error("[DigitalTwinClient] send error:", err);
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Start a new server run.
 * @param {string} hwid
 * @param {string|null} hardwareRevision
 * @param {string} ecuRunId  Hex string from ECU run_started frame
 * @param {boolean} manual   True if user pressed Start
 */
export async function startRun(hwid, hardwareRevision, ecuRunId, manual = false) {
  const state = _getState();
  if (state === "starting" || state === "running") return; // guard double-call
  _setState("starting");
  _manualOverride = manual;
  _hwid = hwid;
  _ecuRunId = ecuRunId;

  try {
    const resp = await _post("/api/runs/start", {
      hwid,
      hardware_revision: hardwareRevision ?? null,
      firmware_version:  null,
      map_version:       null,
    });
    _runId = resp.run_id;
    Store.set(Paths.DIGITAL_TWIN.RUN_ID,    _runId);
    Store.set(Paths.DIGITAL_TWIN.ECU_RUN_ID, ecuRunId);
    Store.set(Paths.DIGITAL_TWIN.HWID,       hwid);
    Store.set(Paths.DIGITAL_TWIN.LAST_COMMITTED_SEQ, 0);
    _openServerWs(() => {
      _setState("running");
    });
  } catch (err) {
    console.error("[DigitalTwinClient] startRun failed:", err);
    Store.set(Paths.DIGITAL_TWIN.ERROR, err.message);
    _setState("error");
  }
}

/**
 * Resume an existing run after page reload.
 * @param {string} runId
 * @param {string} ecuRunId
 * @param {number} maxLocalSeq  Highest batch_seq found in IndexedDB spool
 */
export async function resumeRun(runId, ecuRunId, maxLocalSeq) {
  _runId    = runId;
  _ecuRunId = ecuRunId;
  _hwid     = Store.get(Paths.DIGITAL_TWIN.HWID);
  _setState("reconnecting");
  try {
    const info = await _getJson(`/api/runs/active?hwid=${encodeURIComponent(_hwid ?? "")}`);
    if (!info || info.run_id !== runId) {
      // Run no longer active on server — clear spool
      await Spool.clearRun(runId);
      _setState("idle");
      return;
    }
    const serverSeq = info.last_committed_sequence ?? 0;
    Store.set(Paths.DIGITAL_TWIN.LAST_COMMITTED_SEQ, serverSeq);
    Store.set(Paths.DIGITAL_TWIN.RUN_ID,    _runId);
    Store.set(Paths.DIGITAL_TWIN.ECU_RUN_ID, _ecuRunId);
    await Spool.deleteThrough(runId, serverSeq);
    _openServerWs(() => {
      _setState("running");
      _tryFlush();
    });
  } catch (err) {
    console.warn("[DigitalTwinClient] resumeRun failed:", err);
    _setState("interrupted");
  }
}

/**
 * Enqueue a raw ECU telemetry frame for upload.
 * Called by the raw telemetry hook when status === "running".
 */
export async function enqueueFrame(frame) {
  if (!_runId || !_ecuRunId) return;
  const batchSeq = frame.batch_seq ?? 0;
  await Spool.push(_runId, _ecuRunId, batchSeq, JSON.stringify(frame));
  const n = await Spool.countPending(_runId);
  Store.set(Paths.DIGITAL_TWIN.SPOOL_SIZE, n);
  _tryFlush();
}

/**
 * Stop the current run. Transitions through draining → stopping → ended.
 * If spool is empty, stops immediately; otherwise waits up to DRAIN_TIMEOUT_MS.
 */
export async function stopRun() {
  const state = _getState();
  if (state === "draining" || state === "stopping" || state === "ended") return;
  _setState("draining");
  _manualOverride = false;

  const pending = await Spool.countPending(_runId);
  if (pending === 0) {
    _completeStop();
    return;
  }

  // Give the spool time to drain
  _drainTimer = setTimeout(() => {
    console.warn("[DigitalTwinClient] drain timeout — forcing stop");
    _completeStop();
  }, DRAIN_TIMEOUT_MS);
}

async function _completeStop() {
  clearTimeout(_drainTimer);
  _setState("stopping");
  try {
    if (_runId) await _post(`/api/runs/${_runId}/end`, {});
  } catch (err) {
    console.warn("[DigitalTwinClient] end run failed:", err);
  }
  if (_ws) { try { _ws.close(); } catch (_) {} _ws = null; }
  await Spool.clearRun(_runId);
  _runId = null; _ecuRunId = null;
  Store.set(Paths.DIGITAL_TWIN.RUN_ID, null);
  Store.set(Paths.DIGITAL_TWIN.ECU_RUN_ID, null);
  Store.set(Paths.DIGITAL_TWIN.SPOOL_SIZE, 0);
  Store.set(Paths.DIGITAL_TWIN.IN_FLIGHT, 0);
  _setState("ended");
  // Reset to idle after a short delay
  setTimeout(() => { if (_getState() === "ended") _setState("idle"); }, 2000);
}

/** Called by index.js to trigger a flush cycle after a frame is enqueued. */
export function tryFlush() { _tryFlush(); }

// ENABLED is exported as `export const` at the top of this module.
