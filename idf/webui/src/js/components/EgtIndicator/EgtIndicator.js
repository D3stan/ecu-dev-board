/**
 * EgtIndicator.js
 * ===============
 * Exhaust Gas Temperature (EGT) display with color-coded thresholds.
 *
 * Structure:
 *   div.egt-indicator
 *     span.egt-indicator__value  → "623"
 *     span.egt-indicator__unit   → "°C"
 *     span.egt-indicator__label  → "EGT"
 *
 * CSS modifier classes:
 *   --safe    → below 600 °C  (green)
 *   --warn    → 600–750 °C    (yellow)
 *   --danger  → above 750 °C  (red)
 *
 * @author ECU Dev Board
 * @version 1.0.0
 */

import { Component } from '../../core/Component.js';
import { Store } from '../../core/store.js';

// ── Thresholds ────────────────────────────────────────────
const EGT_WARN   = 600;
const EGT_DANGER = 750;

export class EgtIndicator extends Component {
  constructor(options = {}) {
    super(options);
  }

  // ── Rendering ──────────────────────────────────────────

  render() {
    const el = document.createElement('div');
    el.className = 'egt-indicator egt-indicator--safe';

    el.innerHTML = `
      <span class="egt-indicator__value">---</span>
      <span class="egt-indicator__unit">°C</span>
      <span class="egt-indicator__label">EGT</span>
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
    if (!snapshot || !this.el) return;

    const egt = typeof snapshot.egt === 'number' ? snapshot.egt : null;

    // Value text
    const valueEl = this.$('.egt-indicator__value');
    if (valueEl) {
      valueEl.textContent = egt !== null ? Math.round(egt) : '---';
    }

    // Threshold classes
    this.el.classList.remove(
      'egt-indicator--safe',
      'egt-indicator--warn',
      'egt-indicator--danger'
    );

    if (egt === null || egt < EGT_WARN) {
      this.el.classList.add('egt-indicator--safe');
    } else if (egt <= EGT_DANGER) {
      this.el.classList.add('egt-indicator--warn');
    } else {
      this.el.classList.add('egt-indicator--danger');
    }
  }
}

export default EgtIndicator;
