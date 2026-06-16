import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { dispatchMessage } from "../src/js/core/adapter.js";
import { Store } from "../src/js/core/store.js";
import { Paths } from "../src/js/utils/paths.js";
import { TelemetryHistoryManager } from "../src/js/managers/TelemetryHistoryManager.js";
import { getSignalDefinition } from "../src/js/utils/telemetryConfig.js";

const rpmSignal = getSignalDefinition("rpm");
const tpsSignal = getSignalDefinition("tps");

function meta(seq, acquiredAtUs = 1000000) {
  return {
    acquired_at_us: acquiredAtUs,
    seq,
    valid: true,
    health: "Valid",
    quality: "Good",
    fault_bits: 0,
  };
}

function telemetryFrame(gen, values = {}) {
  const rpm = values.rpm ?? 3000 + gen;
  const tps = values.tps ?? 25;

  return {
    type: "telemetry",
    schema: "ecu.telemetry.v1",
    t_us: 1000000 + gen * 100000,
    gen,
    state: {
      rpm: {
        rpm,
        period_us: 60000000 / rpm,
        accel_rpm_per_s: 0,
        synchronized: true,
        crank_reference_trusted: true,
        revolution_id: gen,
        reference_at_us: 1000000,
        meta: meta(gen),
      },
      tps: {
        permille: Math.round(tps * 10),
        pct: tps,
        fallback_permille: 700,
        fallback_used: false,
        meta: meta(gen + 100),
      },
    },
    events: values.events || [],
    overflow: {
      quick_shift_events: 0,
      map_switch_events: 0,
      knock_measurements: 0,
      fault_events: 0,
    },
    transport: {
      sent_frames: gen,
      dropped_frames: 0,
      send_errors: 0,
    },
  };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("TelemetryHistoryManager", () => {
  beforeEach(() => {
    TelemetryHistoryManager.stop();
    Store.reset();
  });

  it("records one sample per signal for one adapter frame", async () => {
    TelemetryHistoryManager.init({
      Store,
      signals: [rpmSignal, tpsSignal],
      maxSeconds: 60,
      stateHz: 10,
    });

    dispatchMessage(JSON.stringify(telemetryFrame(1, { rpm: 4200, tps: 51.2 })));
    await flushMicrotasks();

    assert.equal(TelemetryHistoryManager.getSeries("rpm", 60).length, 1);
    assert.equal(TelemetryHistoryManager.getSeries("tps", 60).length, 1);
    assert.equal(TelemetryHistoryManager.getSeries("rpm", 60)[0].value, 4200);
    assert.equal(TelemetryHistoryManager.getSeries("tps", 60)[0].value, 51.2);
  });

  it("deduplicates repeated Store notifications for the same frame generation", async () => {
    TelemetryHistoryManager.init({
      Store,
      signals: [rpmSignal],
      maxSeconds: 60,
      stateHz: 10,
    });

    const frame = telemetryFrame(2, { rpm: 5000 });
    dispatchMessage(JSON.stringify(frame));
    dispatchMessage(JSON.stringify(frame));
    await flushMicrotasks();

    assert.equal(TelemetryHistoryManager.getSeries("rpm", 60).length, 1);
  });

  it("keeps buffers bounded from state rate and retention", async () => {
    dispatchMessage(JSON.stringify({
      type: "capabilities",
      schema: "ecu.telemetry.v1",
      schema_version: 1,
      paths: ["state", "event"],
      state_hz: 2,
      events_per_batch: 8,
    }));

    TelemetryHistoryManager.init({
      Store,
      signals: [rpmSignal],
      maxSeconds: 2,
    });

    for (let gen = 1; gen <= 6; gen += 1) {
      dispatchMessage(JSON.stringify(telemetryFrame(gen)));
      await flushMicrotasks();
    }

    assert.equal(TelemetryHistoryManager.getSeries("rpm", 60).length, 4);
  });

  it("deduplicates cumulative Store events while preserving order", async () => {
    TelemetryHistoryManager.init({
      Store,
      signals: [rpmSignal],
      maxSeconds: 60,
      stateHz: 10,
    });

    dispatchMessage(JSON.stringify(telemetryFrame(1, {
      events: [{ kind: "MapSwitchChange", at_us: 1000000, request: "Primary", meta: meta(1) }],
    })));
    await flushMicrotasks();

    dispatchMessage(JSON.stringify(telemetryFrame(2, {
      events: [{ kind: "FaultTransition", at_us: 1100000, fault: "Stale", health: "Degraded" }],
    })));
    await flushMicrotasks();

    const events = TelemetryHistoryManager.getEvents(60);
    assert.deepEqual(events.map((event) => event.kind), ["MapSwitchChange", "FaultTransition"]);
  });
});
