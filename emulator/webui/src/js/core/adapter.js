// adapter.js — ECU JSON message dispatcher
import { Store } from './store.js';
import { Paths } from '../utils/paths.js';
import { MsgType } from '../utils/constants.js';

/* ───────────────── DISPATCH ───────────────── */

/**
 * Parse and dispatch a raw WebSocket message.
 * Expects JSON strings with a `type` field matching MsgType.
 * @param {string} raw — raw message string from WebSocket
 */
function dispatchMessage(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return;

  let msg;
  try {
    msg = JSON.parse(raw);
  } catch (e) {
    console.warn('[adapter] Non-JSON message ignored:', raw.substring(0, 80));
    return;
  }

  if (!msg || !msg.type) {
    console.warn('[adapter] Message missing "type" field:', msg);
    return;
  }

  switch (msg.type) {
    case MsgType.TELEMETRY:
      return parseTelemetry(msg.data);

    case MsgType.CONFIG:
      return parseConfig(msg.data);

    case MsgType.ACK:
      return parseAck(msg);

    case MsgType.OTA_STATUS:
      return parseOtaStatus(msg);

    default:
      console.warn('[adapter] Unknown message type:', msg.type);
  }
}

/* ───────────────── PARSERS ───────────────── */

/**
 * Telemetry snapshot — single Store.set for 20 Hz performance.
 * The entire data object is stored as-is; components subscribe to
 * TELEMETRY.SNAPSHOT and pick the fields they need.
 * @param {Object} data — telemetry payload
 */
function parseTelemetry(data) {
  if (!data) return;
  Store.set(Paths.TELEMETRY.SNAPSHOT, data);
}

/**
 * Configuration payload — destructured into individual store paths.
 * @param {Object} data — config payload from ESP
 */
function parseConfig(data) {
  if (!data) return;

  if (data.firmware_version !== undefined) {
    Store.set(Paths.CONFIG.FIRMWARE_VERSION, data.firmware_version);
  }

  if (data.maps) {
    if (Array.isArray(data.maps.ignition)) {
      Store.set(Paths.CONFIG.MAPS.IGNITION, data.maps.ignition);
    }
    if (Array.isArray(data.maps.power_jet)) {
      Store.set(Paths.CONFIG.MAPS.POWER_JET, data.maps.power_jet);
    }
  }

  if (data.active_map_id !== undefined) {
    Store.set(Paths.CONFIG.ACTIVE_MAP_ID, data.active_map_id);
  }

  if (data.sync_pulses !== undefined) {
    Store.set(Paths.CONFIG.SYNC_PULSES, data.sync_pulses);
  }

  if (data.egt_alarm_threshold !== undefined) {
    Store.set(Paths.CONFIG.EGT_ALARM, data.egt_alarm_threshold);
  }
}

/**
 * Command acknowledgement.
 * @param {Object} msg — { type, cmd, status, ... }
 */
function parseAck(msg) {
  Store.set(Paths.COMMAND.LAST_ACK, {
    cmd:    msg.cmd    || '',
    status: msg.status || '',
    ts:     Date.now(),
  });
}

/**
 * OTA status update.
 * @param {Object} msg — { type, available, remote_version, current_version }
 */
function parseOtaStatus(msg) {
  if (msg.available !== undefined) {
    Store.set(Paths.OTA.AVAILABLE, msg.available);
  }
  if (msg.remote_version !== undefined) {
    Store.set(Paths.OTA.REMOTE_VERSION, msg.remote_version);
  }
  if (msg.current_version !== undefined) {
    Store.set(Paths.OTA.CURRENT_VERSION, msg.current_version);
  }
}

/* ───────────────── EXPORT ───────────────── */

export { dispatchMessage };
