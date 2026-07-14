import { Store as DefaultStore } from "../core/store.js";
import { Paths as DefaultPaths } from "../utils/paths.js";
import { onTelemetryFrame } from "../core/adapter.js";

const DEFAULT_QUEUE_LIMIT = 512;

export class DigitalTwinBridgeClient {
  constructor(options = {}) {
    this.Store = options.Store || DefaultStore;
    this.Paths = options.Paths || DefaultPaths;
    this.fetchImpl = options.fetchImpl || globalThis.fetch?.bind(globalThis);
    this.WebSocketImpl = options.WebSocketImpl || globalThis.WebSocket;
    this.setTimeoutImpl = options.setTimeoutImpl || globalThis.setTimeout?.bind(globalThis);
    this.clearTimeoutImpl = options.clearTimeoutImpl || globalThis.clearTimeout?.bind(globalThis);
    this.queueLimit = options.queueLimit || DEFAULT_QUEUE_LIMIT;
    this.autoSubscribe = options.autoSubscribe !== undefined ? options.autoSubscribe : true;

    this.serverUrl = "";
    this.enabled = false;
    this.ecuSocket = null;
    this.ws = null;
    this.socketOpen = false;
    this.runId = null;
    this.hwid = null;
    this.ecuId = null;
    this.recordingSource = null;
    this.awaitingAck = false;
    this.queue = [];
    this.seenKeys = new Set();
    this.startTimer = null;
    this.stopTimer = null;
    this.unsubscribers = [];
  }

  configure(options = {}) {
    this.ecuSocket = options.ecuSocket || this.ecuSocket;
    this.serverUrl = normalizeServerUrl(options.serverUrl || "");
    this.enabled = this.serverUrl.length > 0;

    this.Store.set(this.Paths.DIGITAL_TWIN.ENABLED, this.enabled);
    this.Store.set(this.Paths.DIGITAL_TWIN.SERVER_URL, this.serverUrl);
    this.Store.set(this.Paths.DIGITAL_TWIN.STATUS, this.enabled ? "idle" : "disabled");
    this.Store.set(this.Paths.DIGITAL_TWIN.ERROR, null);

    if (this.autoSubscribe && options.autoSubscribe !== false) {
      this.installSubscriptions();
    }
  }

  installSubscriptions() {
    if (this.unsubscribers.length > 0) return;

    this.unsubscribers.push(onTelemetryFrame((frame) => this.handleTelemetryFrame(frame)));
    this.unsubscribers.push(this.Store.subscribe(
      this.Paths.TELEMETRY.RPM,
      () => this.evaluateAutoRecord(),
      false
    ));
    this.unsubscribers.push(this.Store.subscribe(
      this.Paths.TELEMETRY.RPM_SYNCHRONIZED,
      () => this.evaluateAutoRecord(),
      false
    ));
    this.unsubscribers.push(this.Store.subscribe(
      this.Paths.RECORDING.CONFIG,
      () => this.evaluateAutoRecord(),
      false
    ));
  }

  dispose() {
    this.unsubscribers.splice(0).forEach((unsubscribe) => {
      try {
        unsubscribe();
      } catch (_) {}
    });
    this._clearStartTimer();
    this._clearStopTimer();
    this._closeSocket();
  }

  startManual() {
    return this.startRecording("manual");
  }

  async startRecording(source = "manual") {
    if (!this.enabled) {
      this._setError("digital_twin_disabled", "disabled");
      return null;
    }
    if (this.runId) {
      return this.runId;
    }
    if (!this.fetchImpl || !this.WebSocketImpl) {
      this._setError("digital_twin_transport_unavailable");
      return null;
    }

    const device = this.Store.get(this.Paths.CONNECTION.DEVICE);
    if (!device?.hwid) {
      this._setError("missing_hwid");
      return null;
    }

    this._setStatus("starting");
    this._setError(null);

    try {
      const response = await this.fetchImpl(this._apiUrl("/api/runs/start"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hwid: device.hwid,
          hardware_revision: device.hardware_revision || null,
          firmware_version: device.firmware_version || null,
          map_version: null
        })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const body = await response.json();
      this.runId = String(body.run_id);
      this.hwid = String(body.hwid || device.hwid);
      this.ecuId = body.ecu_id ? String(body.ecu_id) : null;
      this.recordingSource = source;
      this.queue = [];
      this.seenKeys.clear();
      this.awaitingAck = false;

      this.Store.set(this.Paths.DIGITAL_TWIN.ACTIVE_RUN_ID, this.runId);
      this.Store.set(this.Paths.DIGITAL_TWIN.ECU_ID, this.ecuId);
      this.Store.set(this.Paths.DIGITAL_TWIN.RECORDING_SOURCE, this.recordingSource);
      this.Store.set(this.Paths.DIGITAL_TWIN.QUEUED_FRAMES, 0);

      this._openSocket();
      this._setStatus("recording");
      return this.runId;
    } catch (err) {
      this._fail(err?.message || "start_failed");
      return null;
    }
  }

  async stopRecording() {
    const runId = this.runId;
    if (!runId) {
      this._setStatus(this.enabled ? "idle" : "disabled");
      return;
    }

    this._setStatus("stopping");
    this._closeSocket();
    this._clearRunState();

    try {
      if (this.fetchImpl) {
        const response = await this.fetchImpl(this._apiUrl(`/api/runs/${encodeURIComponent(runId)}/end`), {
          method: "POST"
        });
        if (!response.ok) {
          throw new Error(await response.text());
        }
      }
      this._setStatus(this.enabled ? "idle" : "disabled");
      this._setError(null);
    } catch (err) {
      this._setError(err?.message || "stop_failed");
    }
  }

  setAutoRecordEnabled(enabled) {
    const command = JSON.stringify({
      type: "recording_config_set",
      auto_enabled: !!enabled
    });

    if (!this.ecuSocket || typeof this.ecuSocket.send !== "function") {
      this._setError("ecu_socket_unavailable");
      return false;
    }

    this.ecuSocket.send(command);
    return true;
  }

  handleTelemetryFrame(frame) {
    if (!this.enabled || !this.runId || frame?.type !== "telemetry") {
      return;
    }

    const key = `${frame.gen ?? ""}:${frame.t_us ?? ""}`;
    if (this.seenKeys.has(key)) {
      return;
    }
    this.seenKeys.add(key);

    if (this.queue.length >= this.queueLimit) {
      this._fail("queue_overflow", "overflow");
      return;
    }

    this.queue.push(frame);
    this._updateQueueSize();
    this._flush();
  }

  evaluateAutoRecord() {
    if (!this.enabled) {
      this._clearStartTimer();
      this._clearStopTimer();
      return;
    }

    const config = this.Store.get(this.Paths.RECORDING.CONFIG);
    if (!config.auto_enabled) {
      this._clearStartTimer();
      this._clearStopTimer();
      return;
    }

    const rpm = Number(this.Store.get(this.Paths.TELEMETRY.RPM)) || 0;
    const synchronized = !!this.Store.get(this.Paths.TELEMETRY.RPM_SYNCHRONIZED);
    const threshold = Number(config.rpm_threshold) || 0;

    if (!this.runId && synchronized && rpm > threshold) {
      if (!this.startTimer) {
        this.startTimer = this.setTimeoutImpl(async () => {
          this.startTimer = null;
          await this.startRecording("auto");
        }, Number(config.start_debounce_ms) || 0);
      }
    } else {
      this._clearStartTimer();
    }

    const shouldStopAuto = this.runId
      && this.recordingSource === "auto"
      && !synchronized
      && rpm < threshold;

    if (shouldStopAuto) {
      if (!this.stopTimer) {
        this.stopTimer = this.setTimeoutImpl(async () => {
          this.stopTimer = null;
          await this.stopRecording();
        }, Number(config.stop_debounce_ms) || 0);
      }
    } else {
      this._clearStopTimer();
    }
  }

  _openSocket() {
    this._closeSocket();
    const socket = new this.WebSocketImpl(this._wsUrl());
    this.ws = socket;
    this.socketOpen = false;

    socket.onopen = () => {
      if (this.ws !== socket) return;
      this.socketOpen = true;
      this._flush();
    };

    socket.onmessage = (event) => {
      if (this.ws !== socket) return;
      this._handleServerMessage(event.data);
    };

    socket.onerror = () => {
      if (this.ws !== socket) return;
      this._fail("server_websocket_error");
    };

    socket.onclose = () => {
      if (this.ws !== socket) return;
      this.socketOpen = false;
      if (this.runId) {
        this._fail("server_websocket_closed");
      }
    };
  }

  _flush() {
    if (!this.runId || this.awaitingAck || !this.socketOpen || !this._socketReady()) {
      return;
    }
    if (this.queue.length === 0) {
      this._updateQueueSize();
      return;
    }

    const frame = this.queue.shift();
    this._updateQueueSize();

    try {
      this.ws.send(JSON.stringify({
        hwid: this.hwid,
        run_id: this.runId,
        batch: frame
      }));
      this.awaitingAck = true;
    } catch (err) {
      this._fail(err?.message || "send_failed");
    }
  }

  _handleServerMessage(raw) {
    let ack;
    try {
      ack = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch (err) {
      this._fail(`ack_parse_error: ${err?.message || err}`);
      return;
    }

    if (ack.status !== "persisted") {
      this._fail(ack.detail || "server_error");
      return;
    }
    if (ack.run_id && String(ack.run_id) !== this.runId) {
      this._fail("run_id_mismatch");
      return;
    }

    this.Store.set(this.Paths.DIGITAL_TWIN.LAST_ACK_T_US, ack.t_us ?? null);
    this.Store.set(
      this.Paths.DIGITAL_TWIN.LAST_ACK_BATCH_SEQ,
      ack.batch_seq ?? ack.committed_through_sequence ?? null
    );
    this.awaitingAck = false;
    this._flush();
  }

  _socketReady() {
    const openValue = this.WebSocketImpl?.OPEN ?? 1;
    return this.ws && this.ws.readyState === openValue;
  }

  _closeSocket() {
    const socket = this.ws;
    this.ws = null;
    this.socketOpen = false;
    if (socket && typeof socket.close === "function") {
      try {
        socket.close();
      } catch (_) {}
    }
  }

  _clearRunState() {
    this.runId = null;
    this.hwid = null;
    this.ecuId = null;
    this.recordingSource = null;
    this.awaitingAck = false;
    this.queue = [];
    this.seenKeys.clear();
    this.Store.set(this.Paths.DIGITAL_TWIN.ACTIVE_RUN_ID, null);
    this.Store.set(this.Paths.DIGITAL_TWIN.ECU_ID, null);
    this.Store.set(this.Paths.DIGITAL_TWIN.RECORDING_SOURCE, null);
    this.Store.set(this.Paths.DIGITAL_TWIN.QUEUED_FRAMES, 0);
  }

  _fail(detail, status = "error") {
    this._closeSocket();
    this._clearRunState();
    this._setError(detail || status);
    this._setStatus(status);
  }

  _setStatus(status) {
    this.Store.set(this.Paths.DIGITAL_TWIN.STATUS, status);
  }

  _setError(error, status = null) {
    this.Store.set(this.Paths.DIGITAL_TWIN.ERROR, error);
    if (status) {
      this._setStatus(status);
    }
  }

  _updateQueueSize() {
    this.Store.set(this.Paths.DIGITAL_TWIN.QUEUED_FRAMES, this.queue.length);
  }

  _clearStartTimer() {
    if (!this.startTimer) return;
    this.clearTimeoutImpl(this.startTimer);
    this.startTimer = null;
  }

  _clearStopTimer() {
    if (!this.stopTimer) return;
    this.clearTimeoutImpl(this.stopTimer);
    this.stopTimer = null;
  }

  _apiUrl(path) {
    return `${this.serverUrl}${path}`;
  }

  _wsUrl() {
    const url = new URL(this.serverUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = "/ws/v1/telemetry";
    url.search = "";
    url.hash = "";
    return url.toString();
  }
}

function normalizeServerUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `http://${text}`;
  return withProtocol.replace(/\/+$/, "");
}

export const DigitalTwinClient = new DigitalTwinBridgeClient();
