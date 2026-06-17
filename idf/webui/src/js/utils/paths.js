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
    DEVICE: "connection.device",
    RECORDING_CONFIG: "connection.recording_config",
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
  },
  DIGITAL_TWIN: {
    STATUS:             "digitalTwin.status",
    RUN_ID:             "digitalTwin.runId",
    ECU_RUN_ID:         "digitalTwin.ecuRunId",
    HWID:               "digitalTwin.hwid",
    SPOOL_SIZE:         "digitalTwin.spoolSize",
    IN_FLIGHT:          "digitalTwin.inFlight",
    LAST_COMMITTED_SEQ: "digitalTwin.lastCommittedSeq",
    ERROR:              "digitalTwin.error",
  },
};
