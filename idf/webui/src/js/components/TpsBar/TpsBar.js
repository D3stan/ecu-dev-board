/**
 * TpsBar.js
 * =========
 * Horizontal percentage bar showing Throttle Position Sensor value (0–100%).
 *
 * Structure:
 *   div.tps-bar
 *     span.tps-bar__label   → "TPS"
 *     div.tps-bar__track
 *       div.tps-bar__fill   → width driven by TPS %
 *     span.tps-bar__value   → "45.2%"
 *
 * @author ECU Dev Board
 * @version 1.0.0
 */

import { Component } from '../../core/Component.js';
import { Store } from '../../core/store.js';

export class TpsBar extends Component {
  constructor(options = {}) {
    super(options);
  }

  // ── Rendering ──────────────────────────────────────────

  render() {
    const el = document.createElement('div');
    el.className = 'tps-bar';

    el.innerHTML = `
      <span class="tps-bar__label">TPS</span>
      <div class="tps-bar__track">
        <div class="tps-bar__fill"></div>
      </div>
      <span class="tps-bar__value">0.0%</span>
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
   * Update bar from telemetry snapshot.
   * @param {Object} snapshot
   */
  updateFromSnapshot(snapshot) {
    if (!snapshot || !this.el) return;

    const tps = typeof snapshot.tps === 'number' ? snapshot.tps : 0;
    const clamped = Math.max(0, Math.min(tps, 100));

    // Fill width
    const fillEl = this.$('.tps-bar__fill');
    if (fillEl) {
      fillEl.style.width = `${clamped}%`;
    }

    // Value text
    const valueEl = this.$('.tps-bar__value');
    if (valueEl) {
      valueEl.textContent = `${clamped.toFixed(1)}%`;
    }
  }
}

export default TpsBar;
