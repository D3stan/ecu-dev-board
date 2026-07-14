export const Paths = {
  TELEMETRY: {
    RPM: "telemetry.rpm",
    TPS: "telemetry.tps",
    EGT: "telemetry.egt",
    ECU_ADVANCE: "telemetry.ecu_advance",
    SPARK_DETECTED: "telemetry.spark_detected",

    TIMESTAMP: "telemetry.t_us",
    GEN: "telemetry.gen",

    TPS_FALLBACK_USED: "telemetry.tps_fallback_used",
    RPM_ACCEL: "telemetry.rpm_accel",
    RPM_SYNCHRONIZED: "telemetry.rpm_synchronized",

    WATER_TEMP: "telemetry.water_temp",
    WATER_STATE: "telemetry.water_state",
    WATER_REQUEST: "telemetry.water_request",

    EGT_STATE: "telemetry.egt_state",
    EGT_REQUEST: "telemetry.egt_request",

    QS_ACTIVE: "telemetry.qs_active",
    QS_ARMED: "telemetry.qs_armed",

    MAP_REQUEST: "telemetry.map_request",
    KNOCK: "telemetry.knock",

    TPS_META: "telemetry.meta.tps",
    RPM_META: "telemetry.meta.rpm",
    EGT_META: "telemetry.meta.egt",
    WATER_META: "telemetry.meta.water",
    QS_META: "telemetry.meta.qs",
    MAP_META: "telemetry.meta.map",

    OVERFLOW: "telemetry.overflow",
    TRANSPORT: "telemetry.transport",
    EVENTS: "telemetry.events"
  },
  CONNECTION: {
    SCHEMA_VERSION: "connection.schema_version",
    STATE_HZ: "connection.state_hz",
    EVENTS_PER_BATCH: "connection.events_per_batch",
    DEVICE: "connection.device"
  },
  RECORDING: {
    CONFIG: "recording.config",
    AUTO_ENABLED: "recording.config.auto_enabled",
    RPM_THRESHOLD: "recording.config.rpm_threshold",
    START_DEBOUNCE_MS: "recording.config.start_debounce_ms",
    STOP_DEBOUNCE_MS: "recording.config.stop_debounce_ms"
  },
  DIGITAL_TWIN: {
    ENABLED: "digitalTwin.enabled",
    SERVER_URL: "digitalTwin.server_url",
    STATUS: "digitalTwin.status",
    ERROR: "digitalTwin.error",
    ACTIVE_RUN_ID: "digitalTwin.active_run_id",
    ECU_ID: "digitalTwin.ecu_id",
    RECORDING_SOURCE: "digitalTwin.recording_source",
    QUEUED_FRAMES: "digitalTwin.queued_frames",
    LAST_ACK_T_US: "digitalTwin.last_ack_t_us",
    LAST_ACK_BATCH_SEQ: "digitalTwin.last_ack_batch_seq"
  },
  OVERRIDES: {
    TPS: {
      ACTIVE: "overrides.tps.active",
      VALUE: "overrides.tps.value"
    },
    EGT: {
      ACTIVE: "overrides.egt.active",
      VALUE: "overrides.egt.value"
    },
    RPM: {
      ACTIVE: "overrides.rpm.active",
      VALUE: "overrides.rpm.value"
    },
    EGT_FAULT: {
      ACTIVE: "overrides.egt_fault.active"
    }
  },
  SOCKET: {
    STATE: "socket.state"
  }
};
