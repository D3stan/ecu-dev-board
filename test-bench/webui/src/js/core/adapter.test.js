import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { dispatchMessage } from "./adapter.js";
import { Store } from "./store.js";
import { Paths } from "../utils/paths.js";

function meta(seq = 1) {
  return {
    acquired_at_us: 100000 + seq,
    seq,
    valid: true,
    health: "Valid",
    quality: "Good",
    fault_bits: 0,
  };
}

function telemetryFrame(overrides = {}) {
  return {
    type: "telemetry",
    schema: "ecu.telemetry.v1",
    t_us: 123456789,
    gen: 42,
    state: {
      tps: {
        permille: 531,
        pct: 53.1,
        fallback_permille: 700,
        fallback_used: true,
        meta: meta(17),
      },
      rpm: {
        rpm: 4200.5,
        period_us: 14285.7,
        accel_rpm_per_s: 120.5,
        synchronized: true,
        crank_reference_trusted: true,
        revolution_id: 1001,
        reference_at_us: 123449000,
        meta: meta(18),
      },
      egt: {
        c: 520.3,
        rate_c_per_s: 1.2,
        max_c: 620,
        state: "High",
        request: "Warning",
        meta: meta(10),
      },
      water: {
        c: 85.1,
        rate_c_per_s: 0.1,
        max_c: 92,
        state: "Normal",
        request: "Normal",
        meta: meta(11),
      },
      quick_shifter: {
        active: true,
        armed: false,
        meta: meta(12),
      },
      map_switch: {
        request: "Secondary",
        meta: meta(13),
      },
      knock: {
        revolution_id: 1001,
        pickup_edge_at_us: 123440000,
        window_opened_at_us: 123440100,
        window_closed_at_us: 123440600,
        read_at_us: 123440700,
        raw_integrator_count: 1234,
        background_estimate: 100,
        normalized_index: 12.34,
        candidate_knock: true,
        valid: true,
        health: "Valid",
        quality: "Good",
        fault_bits: 0,
        rpm: 6250,
        tps_permille: 512,
        ignition_angle_deg: 14.5,
        config_generation: 7,
      },
    },
    events: [
      {
        kind: "QuickShiftRequest",
        at_us: 123400000,
        active: true,
        activated_at_us: 123400000,
        released_at_us: 123400650,
        duration_us: 650,
        meta: meta(4),
      },
    ],
    overflow: {
      quick_shift_events: 1,
      map_switch_events: 2,
      knock_measurements: 3,
      fault_events: 4,
    },
    transport: {
      sent_frames: 9,
      dropped_frames: 1,
      send_errors: 0,
    },
    ...overrides,
  };
}

describe("dispatchMessage", () => {
  beforeEach(() => {
    Store.reset();
  });

  it("stores capabilities handshake fields", () => {
    dispatchMessage(JSON.stringify({
      type: "capabilities",
      schema: "ecu.telemetry.v1",
      schema_version: 1,
      paths: ["state", "event"],
      state_hz: 10,
      events_per_batch: 8,
    }));

    assert.equal(Store.get(Paths.CONNECTION.SCHEMA_VERSION), 1);
    assert.equal(Store.get(Paths.CONNECTION.STATE_HZ), 10);
    assert.equal(Store.get(Paths.CONNECTION.EVENTS_PER_BATCH), 8);
  });

  it("maps V1 telemetry into legacy and ECU Store paths", () => {
    dispatchMessage(JSON.stringify(telemetryFrame()));

    assert.equal(Store.get(Paths.TELEMETRY.TIMESTAMP), 123456789);
    assert.equal(Store.get(Paths.TELEMETRY.GEN), 42);
    assert.equal(Store.get(Paths.TELEMETRY.RPM), 4200.5);
    assert.equal(Store.get(Paths.TELEMETRY.TPS), 53.1);
    assert.equal(Store.get(Paths.TELEMETRY.EGT), 520.3);
    assert.equal(Store.get(Paths.TELEMETRY.ECU_ADVANCE), 14.5);
    assert.equal(Store.get(Paths.TELEMETRY.SPARK_DETECTED), false);
    assert.equal(Store.get(Paths.TELEMETRY.TPS_FALLBACK_USED), true);
    assert.equal(Store.get(Paths.TELEMETRY.RPM_ACCEL), 120.5);
    assert.equal(Store.get(Paths.TELEMETRY.RPM_SYNCHRONIZED), true);
    assert.equal(Store.get(Paths.TELEMETRY.WATER_TEMP), 85.1);
    assert.equal(Store.get(Paths.TELEMETRY.WATER_STATE), "Normal");
    assert.equal(Store.get(Paths.TELEMETRY.WATER_REQUEST), "Normal");
    assert.equal(Store.get(Paths.TELEMETRY.EGT_STATE), "High");
    assert.equal(Store.get(Paths.TELEMETRY.EGT_REQUEST), "Warning");
    assert.equal(Store.get(Paths.TELEMETRY.QS_ACTIVE), true);
    assert.equal(Store.get(Paths.TELEMETRY.QS_ARMED), false);
    assert.equal(Store.get(Paths.TELEMETRY.MAP_REQUEST), "Secondary");
    assert.deepEqual(Store.get(Paths.TELEMETRY.TPS_META), {
      acquiredAtUs: 100017,
      seq: 17,
      valid: true,
      health: "Valid",
      quality: "Good",
      faultBits: 0,
    });
    assert.deepEqual(Store.get(Paths.TELEMETRY.OVERFLOW), {
      quick_shift_events: 1,
      map_switch_events: 2,
      knock_measurements: 3,
      fault_events: 4,
    });
    assert.deepEqual(Store.get(Paths.TELEMETRY.TRANSPORT), {
      sent_frames: 9,
      dropped_frames: 1,
      send_errors: 0,
    });
    assert.equal(Store.get(Paths.TELEMETRY.EVENTS).length, 1);
    assert.equal(Store.get(Paths.TELEMETRY.EVENTS)[0].kind, "QuickShiftRequest");
  });

  it("keeps a bounded event log with the latest 100 events", () => {
    for (let i = 0; i < 105; i += 1) {
      dispatchMessage(JSON.stringify(telemetryFrame({
        gen: i,
        state: {},
        events: [{ kind: "FaultTransition", at_us: i, fault: "Stale" }],
      })));
    }

    const events = Store.get(Paths.TELEMETRY.EVENTS);
    assert.equal(events.length, 100);
    assert.equal(events[0].at_us, 5);
    assert.equal(events[99].at_us, 104);
  });

  it("ignores non-JSON socket system messages, malformed JSON, and unknown frames", () => {
    const originalError = console.error;
    const parseErrors = [];
    console.error = (...args) => parseErrors.push(args);

    try {
      assert.doesNotThrow(() => dispatchMessage("FORCE_DISCONNECT|REPLACED"));
      assert.doesNotThrow(() => dispatchMessage("{not-json"));
      assert.doesNotThrow(() => dispatchMessage(JSON.stringify({ type: "future_frame" })));
    } finally {
      console.error = originalError;
    }

    assert.equal(parseErrors.length, 1);
    assert.equal(Store.get(Paths.TELEMETRY.RPM), 1200);
    assert.equal(Store.get(Paths.TELEMETRY.EVENTS).length, 0);
  });
});
