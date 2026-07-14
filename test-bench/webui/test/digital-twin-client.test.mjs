import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { DigitalTwinBridgeClient } from "../src/js/managers/DigitalTwinClient.js";
import { Store } from "../src/js/core/store.js";
import { Paths } from "../src/js/utils/paths.js";

class FakeWebSocket {
  static instances = [];
  static OPEN = 1;

  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.sent = [];
    this.closed = false;
    FakeWebSocket.instances.push(this);
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  send(payload) {
    this.sent.push(payload);
  }

  message(payload) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }

  close() {
    this.readyState = 3;
    this.closed = true;
    this.onclose?.();
  }
}

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body)
  };
}

function makeFetch(calls) {
  return async (url, options = {}) => {
    calls.push({ url, options });
    if (String(url).endsWith("/api/runs/start")) {
      return response(201, {
        run_id: "run-1",
        hwid: "esp32s3-010203040506",
        ecu_id: "ecu-1"
      });
    }
    if (String(url).endsWith("/api/runs/run-1/end")) {
      return response(200, { status: "ended", run_id: "run-1" });
    }
    return response(404, { detail: "not_found" });
  };
}

function telemetryFrame(gen, tUs, rpm = 6400) {
  return {
    type: "telemetry",
    schema: "ecu.telemetry.v1",
    gen,
    t_us: tUs,
    state: {
      rpm: {
        rpm,
        synchronized: rpm > 100
      }
    },
    events: []
  };
}

function seedDevice() {
  Store.set(Paths.CONNECTION.DEVICE, {
    hwid: "esp32s3-010203040506",
    hardware_revision: "ESP32-S3FH4R2",
    chip_model: "ESP32-S3",
    flash_size_bytes: 4194304,
    firmware_version: "1.0.0-125-gfb81dde"
  });
}

describe("DigitalTwinBridgeClient", () => {
  beforeEach(() => {
    Store.reset();
    FakeWebSocket.instances = [];
  });

  it("starts by HWID and waits for persisted ack before sending the next frame", async () => {
    seedDevice();
    const calls = [];
    const client = new DigitalTwinBridgeClient({
      Store,
      Paths,
      fetchImpl: makeFetch(calls),
      WebSocketImpl: FakeWebSocket,
      autoSubscribe: false
    });
    client.configure({ serverUrl: "http://server.test" });

    await client.startManual();

    assert.equal(calls[0].url, "http://server.test/api/runs/start");
    assert.deepEqual(JSON.parse(calls[0].options.body), {
      hwid: "esp32s3-010203040506",
      hardware_revision: "ESP32-S3FH4R2",
      firmware_version: "1.0.0-125-gfb81dde",
      map_version: null
    });

    const ws = FakeWebSocket.instances[0];
    assert.equal(ws.url, "ws://server.test/ws/v1/telemetry");
    ws.open();

    client.handleTelemetryFrame(telemetryFrame(1, 1000));
    client.handleTelemetryFrame(telemetryFrame(2, 2000));
    client.handleTelemetryFrame(telemetryFrame(2, 2000));

    assert.equal(ws.sent.length, 1);
    assert.equal(Store.get(Paths.DIGITAL_TWIN.QUEUED_FRAMES), 1);
    assert.deepEqual(JSON.parse(ws.sent[0]), {
      hwid: "esp32s3-010203040506",
      run_id: "run-1",
      batch: telemetryFrame(1, 1000)
    });

    ws.message({ status: "persisted", run_id: "run-1", batch_seq: 1, t_us: 1000 });

    assert.equal(ws.sent.length, 2);
    assert.equal(Store.get(Paths.DIGITAL_TWIN.LAST_ACK_T_US), 1000);
    assert.equal(Store.get(Paths.DIGITAL_TWIN.LAST_ACK_BATCH_SEQ), 1);
    assert.deepEqual(JSON.parse(ws.sent[1]).batch, telemetryFrame(2, 2000));
  });

  it("stops recording and surfaces server errors", async () => {
    seedDevice();
    const client = new DigitalTwinBridgeClient({
      Store,
      Paths,
      fetchImpl: makeFetch([]),
      WebSocketImpl: FakeWebSocket,
      autoSubscribe: false
    });
    client.configure({ serverUrl: "http://server.test" });

    await client.startManual();
    const ws = FakeWebSocket.instances[0];
    ws.open();
    client.handleTelemetryFrame(telemetryFrame(1, 1000));
    ws.message({ status: "error", run_id: "run-1", detail: "hwid_mismatch" });

    assert.equal(Store.get(Paths.DIGITAL_TWIN.STATUS), "error");
    assert.equal(Store.get(Paths.DIGITAL_TWIN.ERROR), "hwid_mismatch");
    assert.equal(Store.get(Paths.DIGITAL_TWIN.ACTIVE_RUN_ID), null);
  });

  it("makes queue overflow visible and stops the local bridge", async () => {
    seedDevice();
    const client = new DigitalTwinBridgeClient({
      Store,
      Paths,
      fetchImpl: makeFetch([]),
      WebSocketImpl: FakeWebSocket,
      queueLimit: 1,
      autoSubscribe: false
    });
    client.configure({ serverUrl: "http://server.test" });

    await client.startManual();
    const ws = FakeWebSocket.instances[0];
    ws.open();

    client.handleTelemetryFrame(telemetryFrame(1, 1000));
    client.handleTelemetryFrame(telemetryFrame(2, 2000));
    client.handleTelemetryFrame(telemetryFrame(3, 3000));

    assert.equal(Store.get(Paths.DIGITAL_TWIN.STATUS), "overflow");
    assert.equal(Store.get(Paths.DIGITAL_TWIN.ERROR), "queue_overflow");
    assert.equal(Store.get(Paths.DIGITAL_TWIN.ACTIVE_RUN_ID), null);
    assert.equal(ws.closed, true);
  });

  it("sends ECU auto-record toggles and debounces auto start and stop", async () => {
    seedDevice();
    const calls = [];
    const timers = [];
    const ecuCommands = [];
    const client = new DigitalTwinBridgeClient({
      Store,
      Paths,
      fetchImpl: makeFetch(calls),
      WebSocketImpl: FakeWebSocket,
      setTimeoutImpl: (fn, ms) => {
        const timer = { fn, ms, cleared: false };
        timers.push(timer);
        return timer;
      },
      clearTimeoutImpl: (timer) => {
        timer.cleared = true;
      },
      autoSubscribe: false
    });
    client.configure({
      serverUrl: "http://server.test",
      ecuSocket: { send: (payload) => ecuCommands.push(payload) }
    });

    client.setAutoRecordEnabled(true);
    assert.deepEqual(JSON.parse(ecuCommands[0]), {
      type: "recording_config_set",
      auto_enabled: true
    });

    Store.set(Paths.RECORDING.CONFIG, {
      auto_enabled: true,
      rpm_threshold: 300,
      start_debounce_ms: 1000,
      stop_debounce_ms: 3000
    });
    Store.set(Paths.TELEMETRY.RPM_SYNCHRONIZED, true);
    Store.set(Paths.TELEMETRY.RPM, 6400);

    client.evaluateAutoRecord();
    assert.equal(timers[0].ms, 1000);
    await timers[0].fn();

    assert.equal(Store.get(Paths.DIGITAL_TWIN.RECORDING_SOURCE), "auto");
    assert.equal(Store.get(Paths.DIGITAL_TWIN.ACTIVE_RUN_ID), "run-1");

    Store.set(Paths.TELEMETRY.RPM_SYNCHRONIZED, false);
    Store.set(Paths.TELEMETRY.RPM, 0);
    client.evaluateAutoRecord();
    assert.equal(timers[1].ms, 3000);
    await timers[1].fn();

    assert.equal(calls.at(-1).url, "http://server.test/api/runs/run-1/end");
    assert.equal(Store.get(Paths.DIGITAL_TWIN.STATUS), "idle");
    assert.equal(Store.get(Paths.DIGITAL_TWIN.ACTIVE_RUN_ID), null);
  });
});
