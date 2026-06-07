// paths.js — Store path constants for ECU

export const Paths = {
  TELEMETRY: {
    SNAPSHOT: 'telemetry.snapshot',
  },
  CONFIG: {
    FIRMWARE_VERSION: 'config.firmwareVersion',
    MAPS: {
      IGNITION:  'config.maps.ignition',
      POWER_JET: 'config.maps.powerJet',
    },
    ACTIVE_MAP_ID: 'config.activeMapId',
    SYNC_PULSES:   'config.syncPulses',
    EGT_ALARM:     'config.egtAlarm',
    MENU:          'config.menu',
    SOFTWARE: {
      VERSION:     'config.software.version',
      MAC_ADDRESS: 'config.software.macAddress',
    },
  },
  LOCALIZATION: {
    CURRENT_LANG_INDEX: 'localization.currentLangIndex',
    LANGS:              'localization.langs',
  },
  OTA: {
    AVAILABLE:      'ota.available',
    REMOTE_VERSION: 'ota.remoteVersion',
    CURRENT_VERSION: 'ota.currentVersion',
  },
  COMMAND: {
    LAST_ACK: 'command.lastAck',
  },
  SOCKET: {
    STATE: 'socket.state',
  },
  APP: {
    LOADING:       'app.loading',
    INITIALIZED:   'app.initialized',
    ERROR:         'app.error',
    SELECTED_MENU: 'app.selectedMenu',
  },
};

