/**
 * QsButton.js
 * ============
 * Large quick-shift trigger button for ECU ignition cut.
 *
 * - Sends QS trigger command via CommandManager on click
 * - Disabled when FSM state ≠ RUNNING
 * - Flashes with --firing class for 300ms when FSM enters IGNCUT
 *
 * Structure:
 *   button.qs-button  → "⚡ QUICK SHIFT"
 *
 * CSS modifier classes:
 *   --disabled  → FSM not in RUNNING state
 *   --firing    → brief visual pulse during ignition cut
 *
 * @author ECU Dev Board
 * @version 1.0.0
 */

import { Component } from '../../core/Component.js';
import { Store } from '../../core/store.js';
import { CommandManager } from '../../managers/commandManager.js';

const FIRING_FLASH_MS = 300;

export class QsButton extends Component {
  constructor(options = {}) {
    super(options);
    this._firingTimeout = null;
    this._lastFsm = null;
  }

  // ── Rendering ──────────────────────────────────────────

  render() {
    const el = document.createElement('button');
    el.className = 'qs-button qs-button--disabled';
    el.type = 'button';
    el.textContent = '⚡ QUICK SHIFT';
    el.disabled = true;

    this.el = el;
    return el;
  }

  // ── Event binding ──────────────────────────────────────

  onBindEvents() {
    if (!this.el) return;

    this.addEventListener(this.el, 'click', () => {
      this._handleClick();
    });
  }

  // ── Lifecycle ──────────────────────────────────────────

  onActivate() {
    this.subscribeToStore('telemetry.snapshot', (snapshot) => {
      this.updateFromSnapshot(snapshot);
    });
  }

  onDeactivate() {
    if (this._firingTimeout) {
      clearTimeout(this._firingTimeout);
      this._firingTimeout = null;
    }
  }

  onDestroy() {
    if (this._firingTimeout) {
      clearTimeout(this._firingTimeout);
      this._firingTimeout = null;
    }
  }

  // ── Update ─────────────────────────────────────────────

  /**
   * Update button state from telemetry snapshot.
   * @param {Object} snapshot
   */
  updateFromSnapshot(snapshot) {
    if (!snapshot || !this.el) return;

    const fsm = typeof snapshot.fsm === 'string' ? snapshot.fsm : '';
    const isRunning = fsm === 'RUNNING';

    // Enable / disable
    this.el.disabled = !isRunning;
    this.el.classList.toggle('qs-button--disabled', !isRunning);

    // Firing flash on IGNCUT transition
    if (fsm === 'IGNCUT' && this._lastFsm !== 'IGNCUT') {
      this.el.classList.add('qs-button--firing');

      if (this._firingTimeout) clearTimeout(this._firingTimeout);
      this._firingTimeout = setTimeout(() => {
        if (this.el) {
          this.el.classList.remove('qs-button--firing');
        }
        this._firingTimeout = null;
      }, FIRING_FLASH_MS);
    }

    this._lastFsm = fsm;
  }

  // ── Private ────────────────────────────────────────────

  /**
   * Handle button click — send quick-shift trigger.
   * @private
   */
  _handleClick() {
    if (this.el && this.el.disabled) return;

    // Send QS trigger command (fire-and-forget)
    CommandManager.send('QS_TRIGGER');
  }
}

export default QsButton;
