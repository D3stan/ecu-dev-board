import { log } from '../utils/logger.js';
import {
  BootstrapRequestOrder,
  BOOTSTRAP_PIPELINE_DEFAULT_RETRY,
  BOOTSTRAP_PIPELINE_DEFAULT_TIMEOUT_MS
} from '../utils/constants.js';

const SESSION_STORAGE_FAIL_KEY = 'fogextra_bootstrap_pipeline_fail_count';
const MAX_AUTO_RELOAD_FAILS = 3;

function normalizeType(type) {
  return String(type || '').trim().toUpperCase();
}

export class BootstrapRequestPipeline {
  constructor(options = {}) {
    this.steps = Array.isArray(options.steps) && options.steps.length > 0
      ? options.steps.map(normalizeType)
      : BootstrapRequestOrder.map(normalizeType);

    this.maxAttemptPerStep = Number.isInteger(options.retryCount) && options.retryCount > 0
      ? options.retryCount
      : BOOTSTRAP_PIPELINE_DEFAULT_RETRY;

    this.timeoutMs = Number.isInteger(options.timeoutMs) && options.timeoutMs > 0
      ? options.timeoutMs
      : BOOTSTRAP_PIPELINE_DEFAULT_TIMEOUT_MS;

    this.sendRequest = typeof options.sendRequest === 'function'
      ? options.sendRequest
      : null;

    this.onCompleted = typeof options.onCompleted === 'function'
      ? options.onCompleted
      : null;

    this.onFailed = typeof options.onFailed === 'function'
      ? options.onFailed
      : null;

    this.currentIndex = 0;
    this.attempt = 0;
    this.currentTimeoutId = null;
    this.isRunning = false;
    this.isCompleted = false;
  }

  start() {
    this.reset();

    if (this.steps.length === 0) {
      this.isCompleted = true;
      return;
    }

    if (!this.sendRequest) {
      log.error('[BOOTSTRAP_PIPELINE] Missing sendRequest callback');
      return;
    }

    this.isRunning = true;
    this._sendCurrentStep();
  }

  reset() {
    this._clearTimeout();
    this.currentIndex = 0;
    this.attempt = 0;
    this.isRunning = false;
    this.isCompleted = false;
  }

  stop() {
    this._clearTimeout();
    this.isRunning = false;
  }

  onMessageProcessed(type) {
    if (!this.isRunning || this.isCompleted) {
      return;
    }

    const normalizedType = normalizeType(type);
    const expected = this._getExpectedType();

    if (!expected || normalizedType !== expected) {
      return;
    }

    log.info(`[BOOTSTRAP_PIPELINE] Step completed: ${expected}`);
    this._clearTimeout();

    this.currentIndex += 1;
    this.attempt = 0;

    if (this.currentIndex >= this.steps.length) {
      this.isRunning = false;
      this.isCompleted = true;
      this._resetFailCounter();

      if (this.onCompleted) {
        this.onCompleted();
      }
      return;
    }

    this._sendCurrentStep();
  }

  isPipelineRunning() {
    return this.isRunning;
  }

  isPipelineCompleted() {
    return this.isCompleted;
  }

  _getExpectedType() {
    if (this.currentIndex < 0 || this.currentIndex >= this.steps.length) {
      return null;
    }
    return this.steps[this.currentIndex];
  }

  _sendCurrentStep() {
    if (!this.isRunning) {
      return;
    }

    const expected = this._getExpectedType();
    if (!expected) {
      return;
    }

    this.attempt += 1;

    const sent = this.sendRequest(expected);
    if (!sent) {
      log.warn(`[BOOTSTRAP_PIPELINE] sendRequest returned false for ${expected}`);
    }

    log.info(`[BOOTSTRAP_PIPELINE] Requested ${expected} (attempt ${this.attempt}/${this.maxAttemptPerStep})`);

    this._clearTimeout();
    this.currentTimeoutId = window.setTimeout(() => {
      this._handleCurrentStepTimeout();
    }, this.timeoutMs);
  }

  _handleCurrentStepTimeout() {
    if (!this.isRunning || this.isCompleted) {
      return;
    }

    const expected = this._getExpectedType();
    if (!expected) {
      return;
    }

    if (this.attempt < this.maxAttemptPerStep) {
      log.warn(`[BOOTSTRAP_PIPELINE] Timeout on ${expected}, retrying...`);
      this._sendCurrentStep();
      return;
    }

    this._failPipeline(`Timeout exhausted for step ${expected}`);
  }

  _failPipeline(reason) {
    this.isRunning = false;
    this._clearTimeout();

    log.error(`[BOOTSTRAP_PIPELINE] FAILED: ${reason}`);

    if (this.onFailed) {
      this.onFailed(reason);
    }

    const failCount = this._getFailCounter();
    if (failCount >= MAX_AUTO_RELOAD_FAILS) {
      log.error('[BOOTSTRAP_PIPELINE] Max auto-reload attempts reached. Reload blocked.');
      return;
    }

    const next = failCount + 1;
    this._setFailCounter(next);
    window.location.reload();
  }

  _clearTimeout() {
    if (this.currentTimeoutId !== null) {
      clearTimeout(this.currentTimeoutId);
      this.currentTimeoutId = null;
    }
  }

  _getFailCounter() {
    try {
      const raw = sessionStorage.getItem(SESSION_STORAGE_FAIL_KEY);
      const n = parseInt(raw || '0', 10);
      return Number.isNaN(n) ? 0 : n;
    } catch (_) {
      return 0;
    }
  }

  _setFailCounter(value) {
    try {
      sessionStorage.setItem(SESSION_STORAGE_FAIL_KEY, String(value));
    } catch (_) {
      // no-op
    }
  }

  _resetFailCounter() {
    this._setFailCounter(0);
  }
}
