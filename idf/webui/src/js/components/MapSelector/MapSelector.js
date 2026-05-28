/**
 * MapSelector.js
 * ==============
 * Button group for selecting the active ECU map slot.
 *
 * Structure:
 *   div.map-selector
 *     button.map-selector__btn (--active on current)
 *
 * Subscribes to:
 *   - config.maps.ignition  → list of available maps
 *   - telemetry.snapshot     → current active_map id
 *
 * @author ECU Dev Board
 * @version 1.0.0
 */

import { Component } from '../../core/Component.js';
import { Store } from '../../core/store.js';
import { CommandManager } from '../../managers/commandManager.js';

export class MapSelector extends Component {
  constructor(options = {}) {
    super(options);

    this._maps = [];
    this._activeMapId = null;
  }

  // ── Rendering ──────────────────────────────────────────

  render() {
    const el = document.createElement('div');
    el.className = 'map-selector';

    this.el = el;
    return el;
  }

  // ── Event binding ──────────────────────────────────────

  onBindEvents() {
    if (!this.el) return;

    // Delegate click on map buttons
    this.addEventListener(this.el, 'click', (e) => {
      const btn = e.target.closest('.map-selector__btn');
      if (!btn) return;

      const mapId = btn.dataset.mapId;
      if (mapId !== undefined && mapId !== null) {
        this._handleSelect(mapId);
      }
    });
  }

  // ── Lifecycle ──────────────────────────────────────────

  onActivate() {
    // Subscribe to map list
    this.subscribeToStore('config.maps.ignition', (mapData) => {
      this._handleMapData(mapData);
    });

    // Subscribe to telemetry for active map id
    this.subscribeToStore('telemetry.snapshot', (snapshot) => {
      if (snapshot && snapshot.active_map !== undefined) {
        this._activeMapId = snapshot.active_map;
        this._renderButtons();
      }
    });
  }

  // ── Data handlers ──────────────────────────────────────

  /**
   * Handle map data update from Store.
   * @param {Object|Array} mapData
   * @private
   */
  _handleMapData(mapData) {
    if (Array.isArray(mapData)) {
      this._maps = mapData;
    } else if (mapData && typeof mapData === 'object') {
      // Single map object — wrap in array
      this._maps = [mapData];
    } else {
      this._maps = [];
    }
    this._renderButtons();
  }

  /**
   * Render/re-render buttons for each available map.
   * @private
   */
  _renderButtons() {
    if (!this.el) return;

    this.el.innerHTML = '';

    this._maps.forEach((map, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'map-selector__btn';
      btn.dataset.mapId = map.id !== undefined ? map.id : index;
      btn.textContent = map.name || `Map ${index + 1}`;

      // Mark active
      const mapId = map.id !== undefined ? map.id : index;
      if (String(mapId) === String(this._activeMapId)) {
        btn.classList.add('map-selector__btn--active');
      }

      this.el.appendChild(btn);
    });
  }

  // ── Command ────────────────────────────────────────────

  /**
   * Send set-active-map command.
   * @param {string|number} mapId
   * @private
   */
  _handleSelect(mapId) {
    CommandManager.send('SET_ACTIVE_MAP', [String(mapId)]);
  }
}

export default MapSelector;
