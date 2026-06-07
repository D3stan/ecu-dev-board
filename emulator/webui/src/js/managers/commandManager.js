/**
 * commandManager.js — ECU JSON command sender
 *
 * Simplified command manager for the ECU WebSocket protocol.
 * All commands are JSON objects with a `cmd` field, serialized and sent
 * via Socket.send().
 */

import { Socket } from '../core/socket.js';

const CommandManager = (() => {

  /* ─── init ─── */

  /**
   * Initialize the command manager (no-op for ECU protocol).
   */
  function init() {
    // No initialization required — ECU uses fire-and-forget JSON commands.
  }

  /* ─── helpers ─── */

  /**
   * Serialize and send a command object.
   * @param {Object} cmdObj — plain object to JSON-stringify and send
   */
  function _send(cmdObj) {
    try {
      Socket.send(JSON.stringify(cmdObj));
    } catch (err) {
      console.error('[CommandManager] Send error:', err);
    }
  }

  /* ─── public commands ─── */

  /**
   * Request the full configuration from the ECU.
   */
  function sendGetConfig() {
    _send({ cmd: 'get_config' });
  }

  /**
   * Trigger a quick-shift event.
   */
  function sendQsTrigger() {
    _send({ cmd: 'qs_trigger' });
  }

  /**
   * Set the active ignition/power-jet map.
   * @param {string|number} mapId — ID of the map to activate
   */
  function sendSetActiveMap(mapId) {
    _send({ cmd: 'set_active_map', map_id: mapId });
  }

  /**
   * Upload / edit a map's breakpoints.
   * @param {string} mapType   — MapType constant ('ignition' | 'power_jet')
   * @param {string|number} mapId — ID of the map to edit
   * @param {Array} breakpoints — array of breakpoint objects
   */
  function sendEditMap(mapType, mapId, breakpoints) {
    _send({
      cmd:         'edit_map',
      map_type:    mapType,
      map_id:      mapId,
      breakpoints: breakpoints,
    });
  }

  /**
   * Request an OTA update check.
   */
  function sendOtaCheck() {
    _send({ cmd: 'ota_check' });
  }

  /* ─── public API ─── */

  return {
    init,
    sendGetConfig,
    sendQsTrigger,
    sendSetActiveMap,
    sendEditMap,
    sendOtaCheck,
  };
})();

export { CommandManager };
