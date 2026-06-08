export const Paths = {
  RUNTIME: {
    RTC: {
      TIME: "runtime.rtc.time",
      DAY: "runtime.rtc.day"
    },
    ALERTS: {
      IS_MODIFING: "runtime.alerts.isModifing",
      IS_PUMP_BLOCKED: "runtime.alerts.isPumpBlocked",
      IS_ANTIBACTERIAL_ERROR: "runtime.alerts.isAntibacterialError",
      PUMP_HOURS: "runtime.alerts.pumpHours"
    },
    SENSORS: {
      TEMP_VALUE: "runtime.sensors.temperature.value",
      TEMP_CONNECTED: "runtime.sensors.temperature.connected",
      HUM_VALUE: "runtime.sensors.humidity.value",
      HUM_CONNECTED: "runtime.sensors.humidity.connected",
      PRESSURE: "runtime.sensors.pressureSwitch"
    },
    OUTPUTS: {
      PUMP: "runtime.outputs.pumpState",
      RELAY: "runtime.outputs.extraRelay",
      DRAIN: "runtime.outputs.drainValve"
    },
    MODES: {
      TEMP_ENABLED: "runtime.modes.temperature.isEnabled",
      TEMP_ACTIVE: "runtime.modes.temperature.isActive",
      HUM_ENABLED: "runtime.modes.humidity.isEnabled",
      HUM_ACTIVE: "runtime.modes.humidity.isActive",
      TIMER_ENABLED: "runtime.modes.timer.isEnabled",
      TIMER_ACTIVE: "runtime.modes.timer.isActive",
      CAL_ENABLED: "runtime.modes.calendar.isEnabled",
      CAL_ACTIVE: "runtime.modes.calendar.isActive",
      AUX_ENABLED: "runtime.modes.aux.isEnabled",
      AUX_ACTIVE: "runtime.modes.aux.isActive",
      WIFI_ENABLED: "runtime.modes.wireless.isEnabled",
      WIFI_ACTIVE: "runtime.modes.wireless.isActive"
    },
    TIMERS: {
      MODE_ON: "runtime.timers.mode.on",
      MODE_OFF: "runtime.timers.mode.off",
      DISPENSER_ON: "runtime.timers.dispenser.on",
      DISPENSER_OFF: "runtime.timers.dispenser.off",
      FAN_ON: "runtime.timers.fan.on",
      FAN_OFF: "runtime.timers.fan.off",
      MAINTENANCE: {
        ABSOLUTE_TIME: "runtime.timers.maintenance.absoluteTime",
        TIME_LEFT: "runtime.timers.maintenance.timeLeft",
        IS_MAINTENANCE: "runtime.timers.maintenance.isMaintenance",
      }
    },
    SCHEDULER: "runtime.scheduler"
  },
  WIFI: {
    CONNECTION_MODE: "wifi.connectionMode",
    STA_IP: "wifi.staIp",
    NETWORKS: "wifi.networks",
    NETWORKS_UPDATED_AT: "wifi.networksUpdatedAt",

    CONNECTION: {
      STATUS: "wifi.connection.status",

      CONNECTED_SSID: "wifi.connection.connectedNetwork.ssid",
      CONNECTED_SIGNAL: "wifi.connection.connectedNetwork.signalLevel",

      OPERATION: "wifi.connection.operation",
      SILENCE_MS: "wifi.connection.silenceMs",

      ERROR_TYPE: "wifi.connection.error.type",
      ERROR_SEEN_BY_USER: "wifi.connection.error.seenByUser"
    }
  },
  CONFIG: {
    PARAMS: "config.params",
    PARAMS_STR: "config.paramsStr",
    MENU: "config.menu",
    SOFTWARE: {
      VERSION: "config.software.version",
      MAC_ADDRESS: "config.software.macAddress",
    }
  },
  LOCALIZATION: {
    LANGS: "localization.langs",
    CURRENT: "localization.currentLang",
    CURRENT_LANG_INDEX: "localization.currentLangIndex"
  },
  SOCKET: {
    STATE: "socket.state",
  },
  APP: {
    LOADING: "app.loading",
    INITIALIZED: "app.initialized",
    ERROR: "app.error",
    SELECTED_MENU: "app.selectedMenu",
    AUTH: {
      LOCKED: "app.auth.locked",
      PIN_REQUIRED: "app.auth.pinRequired"
    }
  }
};
