import assert from "node:assert/strict";

import { dispatchMessage, onTelemetryFrame } from "../src/js/core/adapter.js";
import { Store } from "../src/js/core/store.js";
import { Paths } from "../src/js/utils/paths.js";

Store.reset();

const rawTelemetryFrames = [];
const unsubscribeRawTelemetry = onTelemetryFrame((frame) => {
  rawTelemetryFrames.push(frame);
});

dispatchMessage(JSON.stringify({
  type: "capabilities",
  schema: "ecu.telemetry.v1",
  schema_version: 1,
  paths: ["state", "event"],
  state_hz: 10,
  events_per_batch: 8,
  device: {
    hwid: "esp32s3-010203040506",
    hardware_revision: "ESP32-S3FH4R2",
    chip_model: "ESP32-S3",
    flash_size_bytes: 4194304
  },
  recording: {
    auto_enabled: false,
    rpm_threshold: 300,
    start_debounce_ms: 1000,
    stop_debounce_ms: 3000
  }
}));

dispatchMessage(JSON.stringify({
  type: "recording_config",
  auto_enabled: true,
  rpm_threshold: 300,
  start_debounce_ms: 1000,
  stop_debounce_ms: 3000
}));

dispatchMessage(JSON.stringify({
  type: "telemetry",
  schema: "ecu.telemetry.v1",
  t_us: 123456789,
  gen: 7,
  state: {
    tps: {
      permille: 325,
      pct: 32.5,
      fallback_permille: 700,
      fallback_used: false,
      meta: {
        acquired_at_us: 123450000,
        seq: 1,
        valid: true,
        health: "Valid",
        quality: "Good",
        fault_bits: 0
      }
    },
    rpm: {
      rpm: 6400,
      period_us: 9375,
      accel_rpm_per_s: 0,
      synchronized: true,
      crank_reference_trusted: true,
      revolution_id: 10,
      reference_at_us: 123449000,
      meta: {
        acquired_at_us: 123450000,
        seq: 2,
        valid: true,
        health: "Valid",
        quality: "Good",
        fault_bits: 0
      }
    },
    egt: {
      c: 410,
      rate_c_per_s: 0,
      max_c: 410,
      state: "Normal",
      request: "Normal",
      meta: {
        acquired_at_us: 123450000,
        seq: 3,
        valid: true,
        health: "Valid",
        quality: "Good",
        fault_bits: 0
      }
    },
    water: {
      c: 82,
      rate_c_per_s: 0,
      max_c: 82,
      state: "Normal",
      request: "Normal",
      meta: {
        acquired_at_us: 123450000,
        seq: 4,
        valid: true,
        health: "Valid",
        quality: "Good",
        fault_bits: 0
      }
    },
    quick_shifter: {
      active: false,
      armed: true,
      meta: {
        acquired_at_us: 123450000,
        seq: 5,
        valid: true,
        health: "Valid",
        quality: "Good",
        fault_bits: 0
      }
    },
    map_switch: {
      request: "Primary",
      meta: {
        acquired_at_us: 123450000,
        seq: 6,
        valid: true,
        health: "Valid",
        quality: "Good",
        fault_bits: 0
      }
    },
    knock: {
      revolution_id: 10,
      pickup_edge_at_us: 123440000,
      window_opened_at_us: 123440100,
      window_closed_at_us: 123440600,
      read_at_us: 123440700,
      raw_integrator_count: 0,
      background_estimate: 0,
      normalized_index: 0,
      candidate_knock: false,
      valid: true,
      health: "Valid",
      quality: "Good",
      fault_bits: 0,
      rpm: 6400,
      tps_permille: 325,
      ignition_angle_deg: 22.4,
      config_generation: 1
    }
  },
  events: [
    {
      kind: "MapSwitchChange",
      at_us: 123400000,
      request: "Primary",
      meta: {
        acquired_at_us: 123400000,
        seq: 7,
        valid: true,
        health: "Valid",
        quality: "Good",
        fault_bits: 0
      }
    }
  ],
  overflow: {
    quick_shift_events: 0,
    map_switch_events: 0,
    knock_measurements: 0,
    fault_events: 0
  },
  transport: {
    sent_frames: 1,
    dropped_frames: 0,
    send_errors: 0
  }
}));

unsubscribeRawTelemetry();

assert.equal(Store.get(Paths.CONNECTION.SCHEMA_VERSION), 1);
assert.equal(Store.get(Paths.CONNECTION.STATE_HZ), 10);
assert.deepEqual(Store.get(Paths.CONNECTION.DEVICE), {
  hwid: "esp32s3-010203040506",
  hardware_revision: "ESP32-S3FH4R2",
  chip_model: "ESP32-S3",
  flash_size_bytes: 4194304
});
assert.deepEqual(Store.get(Paths.RECORDING.CONFIG), {
  auto_enabled: true,
  rpm_threshold: 300,
  start_debounce_ms: 1000,
  stop_debounce_ms: 3000
});
assert.equal(Store.get(Paths.TELEMETRY.RPM), 6400);
assert.equal(Store.get(Paths.TELEMETRY.TPS), 32.5);
assert.equal(Store.get(Paths.TELEMETRY.EGT), 410);
assert.equal(Store.get(Paths.TELEMETRY.WATER_TEMP), 82);
assert.equal(Store.get(Paths.TELEMETRY.ECU_ADVANCE), 22.4);
assert.equal(Store.get(Paths.TELEMETRY.QS_ARMED), true);
assert.equal(Store.get(Paths.TELEMETRY.MAP_REQUEST), "Primary");
assert.equal(Store.get(Paths.TELEMETRY.EVENTS)[0].kind, "MapSwitchChange");
assert.equal(rawTelemetryFrames.length, 1);
assert.equal(rawTelemetryFrames[0].type, "telemetry");
assert.equal(rawTelemetryFrames[0].state.rpm.rpm, 6400);

console.log("adapter websocket telemetry V1 contract passed");
