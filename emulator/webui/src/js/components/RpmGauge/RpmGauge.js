/**
 * RpmGauge.js
 * ===========
 * SVG arc gauge component displaying engine RPM from 0 to 18000.
 *
 * The gauge uses two SVG circles (track + fill) with stroke-dashoffset
 * to render a 270° arc (135° → 405°). Fill color transitions through
 * green → yellow → red based on RPM thresholds.
 *
 * @author ECU Dev Board
 * @version 1.0.0
 */

import { Component } from '../../core/Component.js';
import { Store } from '../../core/store.js';

// ── Constants ──────────────────────────────────────────────
const RPM_MAX = 18000;
const RADIUS = 88;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
// We display a 270° arc (3/4 of full circle)
const ARC_LENGTH = CIRCUMFERENCE * (270 / 360);

// Color thresholds
const THRESHOLD_GREEN  = 10000;
const THRESHOLD_YELLOW = 14000;

const COLOR_GREEN  = '#22c55e';
const COLOR_YELLOW = '#eab308';
const COLOR_RED    = '#ef4444';

// SVG arc rotation: 135° start so the gap sits at the bottom
const ROTATION_OFFSET = 135;

export class RpmGauge extends Component {
  /**
   * @param {Object} [options]
   */
  constructor(options = {}) {
    super(options);
    this._currentRpm = 0;
    this._animFrameId = null;
  }

  // ── Rendering ──────────────────────────────────────────

  render() {
    const el = document.createElement('div');
    el.className = 'rpm-gauge';

    el.innerHTML = `
      <svg class="rpm-gauge__svg" width="200" height="200" viewBox="0 0 200 200">
        <circle
          class="rpm-gauge__track"
          cx="100" cy="100" r="${RADIUS}"
          fill="none"
          stroke="var(--gauge-track, rgba(255,255,255,0.1))"
          stroke-width="12"
          stroke-dasharray="${ARC_LENGTH} ${CIRCUMFERENCE}"
          stroke-linecap="round"
          transform="rotate(${ROTATION_OFFSET} 100 100)"
        />
        <circle
          class="rpm-gauge__fill"
          cx="100" cy="100" r="${RADIUS}"
          fill="none"
          stroke="${COLOR_GREEN}"
          stroke-width="12"
          stroke-dasharray="${ARC_LENGTH} ${CIRCUMFERENCE}"
          stroke-dashoffset="${ARC_LENGTH}"
          stroke-linecap="round"
          transform="rotate(${ROTATION_OFFSET} 100 100)"
        />
      </svg>
      <div class="rpm-gauge__value">0</div>
      <div class="rpm-gauge__label">RPM</div>
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

  onDeactivate() {
    if (this._animFrameId) {
      cancelAnimationFrame(this._animFrameId);
      this._animFrameId = null;
    }
  }

  // ── Update ─────────────────────────────────────────────

  /**
   * Update gauge from telemetry snapshot.
   * @param {Object} snapshot
   */
  updateFromSnapshot(snapshot) {
    if (!snapshot) return;

    const rpm = typeof snapshot.rpm === 'number' ? snapshot.rpm : 0;
    this._currentRpm = rpm;

    // Schedule smooth DOM update
    if (this._animFrameId) cancelAnimationFrame(this._animFrameId);
    this._animFrameId = requestAnimationFrame(() => this._render(rpm));
  }

  /**
   * Internal render pass — called inside rAF.
   * @param {number} rpm
   * @private
   */
  _render(rpm) {
    if (!this.el) return;

    const clamped = Math.max(0, Math.min(rpm, RPM_MAX));
    const pct = clamped / RPM_MAX;

    // ── Stroke offset (0 = fully filled, ARC_LENGTH = empty)
    const offset = ARC_LENGTH * (1 - pct);
    const fillCircle = this.$('.rpm-gauge__fill');
    if (fillCircle) {
      fillCircle.setAttribute('stroke-dashoffset', offset);

      // ── Color
      let color = COLOR_GREEN;
      if (clamped >= THRESHOLD_YELLOW) {
        color = COLOR_RED;
      } else if (clamped >= THRESHOLD_GREEN) {
        color = COLOR_YELLOW;
      }
      fillCircle.setAttribute('stroke', color);
    }

    // ── Value text
    const valueEl = this.$('.rpm-gauge__value');
    if (valueEl) {
      valueEl.textContent = Math.round(clamped);
    }
  }
}

export default RpmGauge;
