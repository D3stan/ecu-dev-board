import { Socket } from '../core/socket.js';
import { log } from '../utils/logger.js';

/**
 * Sends a command to toggle manual parameter overrides on the ECU.
 * @param {string} param "tps" | "egt" | "rpm"
 * @param {boolean} active Active status
 */
export function toggleOverride(param, active) {
  const payload = {
    cmd: "toggle_override",
    param: param,
    active: !!active
  };
  log.info(`[Command] Toggle override: param=${param}, active=${active}`);
  Socket.send(JSON.stringify(payload));
}

/**
 * Sends a command to set a virtual parameter value.
 * @param {string} param "tps" | "egt" | "rpm"
 * @param {number} value Parameter value
 */
export function setValue(param, value) {
  const payload = {
    cmd: "set_value",
    param: param,
    value: Number(value)
  };
  log.info(`[Command] Set value: param=${param}, value=${value}`);
  Socket.send(JSON.stringify(payload));
}

/**
 * Sends a command to inject or clear a fault condition on the ECU.
 * @param {string} fault "egt_overheat"
 * @param {boolean} active Active status
 */
export function injectFault(fault, active) {
  const payload = {
    cmd: "inject_fault",
    fault: fault,
    active: !!active
  };
  log.info(`[Command] Inject fault: fault=${fault}, active=${active}`);
  Socket.send(JSON.stringify(payload));
}

/**
 * Sends a command to trigger a Quick-Shift cut duration (50ms - 100ms).
 */
export function triggerQs() {
  const payload = {
    cmd: "qs_trigger"
  };
  log.info(`[Command] Trigger Quick Shifter`);
  Socket.send(JSON.stringify(payload));
}

export function init() {
  log.info("[CommandManager] Initialized");
}

export const CommandManager = {
  init,
  toggleOverride,
  setValue,
  injectFault,
  triggerQs
};
