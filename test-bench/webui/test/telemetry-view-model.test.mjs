import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { Paths } from "../src/js/utils/paths.js";
import {
  buildHealthModel,
  buildRecentEventsModel,
  buildSensorCardModel,
} from "../src/js/utils/telemetryViewModel.js";
import { getSignalDefinition } from "../src/js/utils/telemetryConfig.js";

function reader(values) {
  return (path) => values[path];
}

describe("telemetryViewModel", () => {
  it("labels map switch as a physical request", () => {
    const signal = getSignalDefinition("mapRequest");
    const model = buildSensorCardModel(signal, reader({
      [Paths.TELEMETRY.MAP_REQUEST]: "Secondary",
      [Paths.TELEMETRY.MAP_META]: {
        acquiredAtUs: 900000,
        valid: true,
        health: "Valid",
        quality: "Good",
        faultBits: 0,
      },
      [Paths.TELEMETRY.TIMESTAMP]: 1000000,
    }));

    assert.equal(model.label, "Physical Map Request");
    assert.equal(model.displayValue, "Secondary");
    assert.equal(model.health.severity, "ok");
    assert.equal(model.ageMs, 100);
  });

  it("marks invalid and faulted metadata as degraded display state", () => {
    const invalid = buildHealthModel({
      valid: false,
      health: "Failed",
      quality: "Bad",
      faultBits: 0,
    });
    const faulted = buildHealthModel({
      valid: true,
      health: "Valid",
      quality: "Good",
      faultBits: 4,
    });

    assert.equal(invalid.severity, "danger");
    assert.equal(invalid.label, "Invalid");
    assert.equal(faulted.severity, "warning");
    assert.equal(faulted.label, "Fault 0x4");
  });

  it("preserves event order and summarizes V1 event semantics", () => {
    const events = buildRecentEventsModel([
      { kind: "MapSwitchChange", at_us: 100, request: "Secondary" },
      { kind: "FaultTransition", at_us: 200, fault: "Stale", health: "Degraded" },
    ], 1200, 5);

    assert.deepEqual(events.map((event) => event.title), ["Map request", "Fault"]);
    assert.equal(events[0].summary, "Physical request: Secondary");
    assert.equal(events[1].summary, "Stale -> Degraded");
  });
});

