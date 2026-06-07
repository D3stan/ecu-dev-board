// constants.js — ECU protocol constants

/**
 * Inbound message types from the ECU (JSON `type` field)
 */
export const MsgType = {
  TELEMETRY:  'telemetry',
  CONFIG:     'config',
  ACK:        'ack',
  OTA_STATUS: 'ota_status',
};

/**
 * Outbound command types sent to the ECU (JSON `cmd` field)
 */
export const CmdType = {
  QS_TRIGGER:     'qs_trigger',
  SET_ACTIVE_MAP: 'set_active_map',
  EDIT_MAP:       'edit_map',
  OTA_CHECK:      'ota_check',
  GET_CONFIG:     'get_config',
};

/**
 * ECU finite-state-machine states
 */
export const FsmState = {
  INIT:    'INIT',
  SYNCING: 'SYNCING',
  RUNNING: 'RUNNING',
  IDLE:    'IDLE',
  IGNCUT:  'IGNCUT',
  ALARM:   'ALARM',
};

/**
 * Visual config for each FSM state: label, color (hex), icon (emoji)
 */
export const FsmStateConfig = {
  [FsmState.INIT]:    { label: 'Initializing', color: '#9e9e9e', icon: '⏳' },
  [FsmState.SYNCING]: { label: 'Syncing',      color: '#fbc02d', icon: '🔄' },
  [FsmState.RUNNING]: { label: 'Running',      color: '#4caf50', icon: '🟢' },
  [FsmState.IDLE]:    { label: 'Idle',          color: '#2196f3', icon: '💤' },
  [FsmState.IGNCUT]:  { label: 'Ignition Cut',  color: '#9c27b0', icon: '⚡' },
  [FsmState.ALARM]:   { label: 'Alarm',         color: '#f44336', icon: '🚨' },
};

/**
 * Map types for ignition/power-jet curves
 */
export const MapType = {
  IGNITION:  'ignition',
  POWER_JET: 'power_jet',
};

/**
 * WebSocket connection states (kept from fogextra)
 */
export const SocketState = {
  CONNECTING:    'connecting',
  CONNECTED:     'connected',
  DISCONNECTED:  'disconnected',
  RECONNECTING:  'reconnecting',
};

/**
 * Exhaust Gas Temperature thresholds (°C)
 */
export const EgtThresholds = {
  SAFE:    600,
  WARNING: 750,
  DANGER:  800,
};

/**
 * RPM range constants
 */
export const RpmRange = {
  MIN:            0,
  MAX:            18000,
  IDLE_THRESHOLD: 1500,
  REDLINE:        14000,
};