/**
 * TelemetryValue.js
 * =================
 * Reusable card component for displaying a labeled telemetry value with unit.
 *
 * Constructor options:
 *   { label, unit, field, formatter? }
 *
 *   - label:     Display label text (e.g. "Coolant Temp")
 *   - unit:      Unit string (e.g. "°C", "kPa", "V")
 *   - field:     Key to extract from telemetry.snapshot (e.g. "coolant_temp")
 *   - formatter: Optional function(value) → string for custom formatting
 *
 * Structure:
 *   div.telemetry-value
 *     div.telemetry-value__label   → "Coolant Temp"
 *     span.telemetry-value__number → "87"
 *     span.telemetry-value__unit   → "°C"
 *
 * @author ECU Dev Board
 * @version 1.0.0
 */

import { Component } from '../../core/Component.js';
import { Store } from '../../core/store.js';

export class TelemetryValue extends Component {
  /**
   * @param {Object} options
   * @param {string} options.label     - Display label
   * @param {string} options.unit      - Unit string
   * @param {string} options.field     - Snapshot field key
   * @param {Function} [options.formatter] - Optional value formatter
   */
  constructor(options = {}) {
    super(options);

    this._label = options.label || 'Value';
    this._unit = options.unit || '';
    this._field = options.field || '';
    this._formatter = typeof options.formatter === 'function' ? options.formatter : null;
  }

  // ── Rendering ──────────────────────────────────────────

  render() {
    const el = document.createElement('div');
    el.className = 'telemetry-value';

    el.innerHTML = `
      <div class="telemetry-value__label">${this._escHtml(this._label)}</div>
      <span class="telemetry-value__number">---</span>
      <span class="telemetry-value__unit">${this._escHtml(this._unit)}</span>
    `;

    this.el = el;
    return el;
  }

  // ── Lifecycle ──────────────────────────────────────────

  onActivate() {
    this.subscribeToStore('telemetry.snapshot', (snapshot) => {
      this.updateFromSnapshot(snapshot);
    });
  }

  // ── Update ─────────────────────────────────────────────

  /**
   * Update display from telemetry snapshot.
   * @param {Object} snapshot
   */
  updateFromSnapshot(snapshot) {
    if (!snapshot || !this.el || !this._field) return;

    const raw = snapshot[this._field];
    let display;

    if (raw === undefined || raw === null) {
      display = '---';
    } else if (this._formatter) {
      display = this._formatter(raw);
    } else if (typeof raw === 'number') {
      display = Number.isInteger(raw) ? String(raw) : raw.toFixed(1);
    } else {
      display = String(raw);
    }

    const numberEl = this.$('.telemetry-value__number');
    if (numberEl) numberEl.textContent = display;

    const unitEl = this.$('.telemetry-value__unit');
    if (unitEl) unitEl.textContent = this._unit;
  }

  // ── Helpers ────────────────────────────────────────────

  /**
   * Simple HTML entity escaping for static text.
   * @param {string} str
   * @returns {string}
   * @private
   */
  _escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

export default TelemetryValue;
