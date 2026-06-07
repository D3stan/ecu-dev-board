/**
 * MapEditor.js
 * =============
 * Editable table of RPM → value breakpoints for ECU lookup maps.
 *
 * Constructor options:
 *   { mapType }  — 'ignition' or 'power_jet'
 *
 * Structure:
 *   div.map-editor
 *     div.map-editor__header   → map type label
 *     table.map-editor__table  → RPM | Value | Actions columns
 *     button.map-editor__add   → Add breakpoint
 *     button.map-editor__save  → Save map
 *
 * Subscribes to:
 *   - config.maps.ignition  or  config.maps.powerJet  (based on mapType)
 *   - config.activeMapId
 *
 * @author ECU Dev Board
 * @version 1.0.0
 */

import { Component } from '../../core/Component.js';
import { Store } from '../../core/store.js';
import { CommandManager } from '../../managers/commandManager.js';

// ── Map type → Store path mapping ────────────────────────
const MAP_STORE_PATHS = {
  ignition:  'config.maps.ignition',
  power_jet: 'config.maps.powerJet',
};

const MAP_LABELS = {
  ignition:  'Ignition Map',
  power_jet: 'Power Jet Map',
};

export class MapEditor extends Component {
  /**
   * @param {Object} options
   * @param {string} options.mapType - 'ignition' or 'power_jet'
   */
  constructor(options = {}) {
    super(options);

    this._mapType = options.mapType || 'ignition';
    this._storePath = MAP_STORE_PATHS[this._mapType] || MAP_STORE_PATHS.ignition;
    this._label = MAP_LABELS[this._mapType] || this._mapType;
    this._currentMap = null;
  }

  // ── Rendering ──────────────────────────────────────────

  render() {
    const el = document.createElement('div');
    el.className = 'map-editor';

    el.innerHTML = `
      <div class="map-editor__header">${this._escHtml(this._label)}</div>
      <table class="map-editor__table">
        <thead>
          <tr>
            <th>RPM</th>
            <th>Value</th>
            <th></th>
          </tr>
        </thead>
        <tbody class="map-editor__tbody"></tbody>
      </table>
      <div class="map-editor__actions">
        <button type="button" class="map-editor__add">+ Add Breakpoint</button>
        <button type="button" class="map-editor__save">💾 Save</button>
      </div>
    `;

    this.el = el;
    return el;
  }

  // ── Event binding ──────────────────────────────────────

  onBindEvents() {
    if (!this.el) return;

    // Add breakpoint
    const addBtn = this.$('.map-editor__add');
    if (addBtn) {
      this.addEventListener(addBtn, 'click', () => this._addEmptyRow());
    }

    // Save
    const saveBtn = this.$('.map-editor__save');
    if (saveBtn) {
      this.addEventListener(saveBtn, 'click', () => this._handleSave());
    }

    // Delegate delete button clicks on tbody
    const tbody = this.$('.map-editor__tbody');
    if (tbody) {
      this.addEventListener(tbody, 'click', (e) => {
        const deleteBtn = e.target.closest('.map-editor__delete');
        if (deleteBtn) {
          const row = deleteBtn.closest('tr');
          if (row) row.remove();
        }
      });
    }
  }

  // ── Lifecycle ──────────────────────────────────────────

  onActivate() {
    this.subscribeToStore(this._storePath, (mapData) => {
      this._currentMap = mapData;
      this._renderTable(mapData);
    });
  }

  // ── Table rendering ────────────────────────────────────

  /**
   * Populate table rows from map breakpoints.
   * @param {Object} mapData - Map object with .breakpoints array
   * @private
   */
  _renderTable(mapData) {
    const tbody = this.$('.map-editor__tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!mapData || !Array.isArray(mapData.breakpoints)) return;

    mapData.breakpoints.forEach((bp) => {
      const row = this._createRow(bp.rpm, bp.value);
      tbody.appendChild(row);
    });
  }

  /**
   * Create a single table row with editable inputs.
   * @param {number} rpm
   * @param {number} value
   * @returns {HTMLTableRowElement}
   * @private
   */
  _createRow(rpm = 0, value = 0) {
    const tr = document.createElement('tr');
    tr.className = 'map-editor__row';

    tr.innerHTML = `
      <td><input type="number" class="map-editor__input map-editor__rpm" value="${rpm}" min="0" max="18000" step="500"></td>
      <td><input type="number" class="map-editor__input map-editor__val" value="${value}" step="1"></td>
      <td><button type="button" class="map-editor__delete" title="Delete">✕</button></td>
    `;

    return tr;
  }

  /**
   * Add an empty breakpoint row to the table.
   * @private
   */
  _addEmptyRow() {
    const tbody = this.$('.map-editor__tbody');
    if (!tbody) return;

    const row = this._createRow(0, 0);
    tbody.appendChild(row);
  }

  // ── Data extraction ────────────────────────────────────

  /**
   * Read all input values from DOM and return breakpoints array.
   * @returns {Array<{rpm: number, value: number}>}
   */
  getEditedBreakpoints() {
    const rows = this.$$('.map-editor__row');
    const breakpoints = [];

    rows.forEach((row) => {
      const rpmInput = row.querySelector('.map-editor__rpm');
      const valInput = row.querySelector('.map-editor__val');

      if (rpmInput && valInput) {
        breakpoints.push({
          rpm: parseInt(rpmInput.value, 10) || 0,
          value: parseFloat(valInput.value) || 0,
        });
      }
    });

    // Sort by RPM ascending
    breakpoints.sort((a, b) => a.rpm - b.rpm);
    return breakpoints;
  }

  // ── Save handler ───────────────────────────────────────

  /**
   * Send edited map to ECU via CommandManager.
   * @private
   */
  _handleSave() {
    const breakpoints = this.getEditedBreakpoints();

    // Send via CommandManager (command format defined by ECU protocol)
    CommandManager.send('EDIT_MAP', [this._mapType, JSON.stringify(breakpoints)]);
  }

  // ── Helpers ────────────────────────────────────────────

  /** @private */
  _escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

export default MapEditor;
