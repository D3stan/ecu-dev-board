/**
 * ConnectionBadge.js
 * ==================
 * Small badge displaying the current WebSocket connection status.
 *
 * Structure:
 *   span.connection-badge
 *     span.connection-badge__dot    → colored status dot
 *     span.connection-badge__label  → "Connected"
 *
 * CSS modifier classes on the dot:
 *   --connected     → green
 *   --connecting    → yellow (covers both connecting & reconnecting)
 *   --disconnected  → red
 *
 * @author ECU Dev Board
 * @version 1.0.0
 */

import { Component } from '../../core/Component.js';
import { Store } from '../../core/store.js';
import { SocketState } from '../../utils/constants.js';
import { Paths } from '../../utils/paths.js';

// ── State → display mapping ─────────────────────────────
const STATE_MAP = {
  [SocketState.CONNECTED]:     { css: 'connection-badge__dot--connected',     label: 'Connected' },
  [SocketState.CONNECTING]:    { css: 'connection-badge__dot--connecting',    label: 'Connecting…' },
  [SocketState.RECONNECTING]:  { css: 'connection-badge__dot--connecting',    label: 'Reconnecting…' },
  [SocketState.DISCONNECTED]:  { css: 'connection-badge__dot--disconnected',  label: 'Disconnected' },
};

const DEFAULT_DISPLAY = { css: 'connection-badge__dot--disconnected', label: 'Unknown' };

export class ConnectionBadge extends Component {
  constructor(options = {}) {
    super(options);
  }

  // ── Rendering ──────────────────────────────────────────

  render() {
    const el = document.createElement('span');
    el.className = 'connection-badge';

    el.innerHTML = `
      <span class="connection-badge__dot connection-badge__dot--disconnected"></span>
      <span class="connection-badge__label">Disconnected</span>
    `;

    this.el = el;
    return el;
  }

  // ── Lifecycle ──────────────────────────────────────────

  onActivate() {
    this.subscribeToStore(Paths.SOCKET.STATE, (state) => {
      this.updateFromState(state);
    });
  }

  // ── Update ─────────────────────────────────────────────

  /**
   * Update badge from socket state value.
   * @param {string} socketState - One of SocketState values
   */
  updateFromState(socketState) {
    if (!this.el) return;

    const display = STATE_MAP[socketState] || DEFAULT_DISPLAY;

    // Dot class
    const dotEl = this.$('.connection-badge__dot');
    if (dotEl) {
      dotEl.className = `connection-badge__dot ${display.css}`;
    }

    // Label
    const labelEl = this.$('.connection-badge__label');
    if (labelEl) {
      labelEl.textContent = display.label;
    }
  }
}

export default ConnectionBadge;
