/**
 * FsmBadge.js
 * ===========
 * Colored badge displaying the current ECU Finite State Machine state.
 *
 * Each FSM state maps to a color + icon via FsmStateConfig.
 *
 * Structure:
 *   span.fsm-badge
 *     span.fsm-badge__icon   → emoji / icon char
 *     span.fsm-badge__label  → "RUNNING"
 *
 * @author ECU Dev Board
 * @version 1.0.0
 */

import { Component } from '../../core/Component.js';
import { Store } from '../../core/store.js';

// ── FSM State Configuration ──────────────────────────────
const FsmStateConfig = {
  IDLE:     { color: '#6b7280', icon: '⏸', label: 'IDLE' },
  CRANKING: { color: '#f59e0b', icon: '🔄', label: 'CRANKING' },
  RUNNING:  { color: '#22c55e', icon: '▶',  label: 'RUNNING' },
  IGNCUT:   { color: '#ef4444', icon: '⚡', label: 'IGN CUT' },
  OVERREV:  { color: '#dc2626', icon: '🔺', label: 'OVERREV' },
  FAULT:    { color: '#b91c1c', icon: '⚠',  label: 'FAULT' },
  STOPPED:  { color: '#374151', icon: '⏹',  label: 'STOPPED' },
};

const DEFAULT_CONFIG = { color: '#6b7280', icon: '?', label: 'UNKNOWN' };

export class FsmBadge extends Component {
  constructor(options = {}) {
    super(options);
  }

  // ── Rendering ──────────────────────────────────────────

  render() {
    const el = document.createElement('span');
    el.className = 'fsm-badge';

    el.innerHTML = `
      <span class="fsm-badge__icon">${DEFAULT_CONFIG.icon}</span>
      <span class="fsm-badge__label">${DEFAULT_CONFIG.label}</span>
    `;

    this._applyColors(el, DEFAULT_CONFIG.color);
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
   * Update badge from telemetry snapshot.
   * @param {Object} snapshot
   */
  updateFromSnapshot(snapshot) {
    if (!snapshot || !this.el) return;

    const fsm = typeof snapshot.fsm === 'string' ? snapshot.fsm : '';
    const config = FsmStateConfig[fsm] || DEFAULT_CONFIG;

    // Icon
    const iconEl = this.$('.fsm-badge__icon');
    if (iconEl) iconEl.textContent = config.icon;

    // Label
    const labelEl = this.$('.fsm-badge__label');
    if (labelEl) labelEl.textContent = config.label;

    // Colors
    this._applyColors(this.el, config.color);
  }

  /**
   * Apply background and text color to badge element.
   * Background uses the color with 20% alpha for a subtle tint.
   * @param {HTMLElement} el
   * @param {string} color - hex color string
   * @private
   */
  _applyColors(el, color) {
    // Convert hex to rgba with alpha for background
    el.style.backgroundColor = `${color}1a`; // ~10% alpha via hex
    el.style.color = color;
    el.style.borderColor = `${color}33`;      // ~20% alpha
  }
}

export { FsmStateConfig };
export default FsmBadge;
