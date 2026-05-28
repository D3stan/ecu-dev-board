/**
 * MapsPage.js
 * ===========
 * Map editor page for ignition advance and power jet lookup tables.
 * Provides visual curve, breakpoint table editor, and map selector.
 */

import { Page } from '../core/Page.js';
import { Store } from '../core/store.js';
import { Paths } from '../utils/paths.js';
import { MapType } from '../utils/constants.js';
import { MapCurve } from '../components/MapCurve/MapCurve.js';
import { MapEditor } from '../components/MapEditor/MapEditor.js';
import { MapSelector } from '../components/MapSelector/MapSelector.js';

export class MapsPage extends Page {
  constructor() {
    super({
      pageId: 'mapsPage',
      cssClass: 'maps-page',
      title: 'Mappe'
    });

    this.currentMapType = MapType.IGNITION;
    this.currentMapId = 0;

    // Child components
    this.mapCurve = null;
    this.mapEditor = null;
    this.mapSelector = null;
  }

  /**
   * Create the page skeleton DOM.
   * @returns {HTMLElement}
   */
  createSkeleton() {
    const el = document.createElement('div');
    el.id = this.pageId;
    el.className = `page ${this.options.cssClass}`;
    el.style.display = 'none';

    el.innerHTML = `
      <!-- Page Header with back nav -->
      <div class="maps-page__header">
        <button class="maps-page__back-btn" id="maps-back-btn">← Dashboard</button>
        <h2 class="maps-page__title">Editor Mappe</h2>
      </div>

      <!-- Map Type Selector -->
      <div class="maps-page__type-selector">
        <button class="maps-page__type-btn maps-page__type-btn--active" data-map-type="ignition">
          Accensione
        </button>
        <button class="maps-page__type-btn" data-map-type="power_jet">
          Power Jet
        </button>
      </div>

      <!-- Map Selector (which map within the type) -->
      <div id="maps-selector-container"></div>

      <!-- Curve Visualization -->
      <div class="maps-page__curve-section" id="maps-curve-container"></div>

      <!-- Breakpoint Editor Table -->
      <div class="maps-page__editor-section" id="maps-editor-container"></div>
    `;

    this.root = el;
    return el;
  }

  /**
   * Bind DOM events and create child components.
   */
  bindEvents() {
    // Back button
    const backBtn = this.root.querySelector('#maps-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        // Use NavigatorManager if available, otherwise dispatch event
        if (window.__ecuNavigator) {
          window.__ecuNavigator.navigateTo('dashboardPage');
        }
      });
    }

    // Map type toggle buttons
    const typeBtns = this.root.querySelectorAll('.maps-page__type-btn');
    typeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentMapType = btn.dataset.mapType;
        // Update active class
        typeBtns.forEach(b => b.classList.remove('maps-page__type-btn--active'));
        btn.classList.add('maps-page__type-btn--active');
        // Refresh components
        this._refreshComponents();
      });
    });

    // Map Selector
    this.mapSelector = new MapSelector({
      mapType: this.currentMapType,
      onMapSelect: (mapId) => {
        this.currentMapId = mapId;
        this._refreshComponents();
      }
    });
    this.mapSelector.mount(this.root.querySelector('#maps-selector-container'));

    // Map Curve
    this.mapCurve = new MapCurve({ mapType: this.currentMapType });
    this.mapCurve.mount(this.root.querySelector('#maps-curve-container'));

    // Map Editor
    this.mapEditor = new MapEditor({ mapType: this.currentMapType });
    this.mapEditor.mount(this.root.querySelector('#maps-editor-container'));
  }

  /**
   * Refresh child components when map type or ID changes.
   * @private
   */
  _refreshComponents() {
    // Update components with new map type/id
    if (this.mapCurve) {
      this.mapCurve.setMapType(this.currentMapType);
    }
    if (this.mapEditor) {
      this.mapEditor.setMapType(this.currentMapType);
    }
    if (this.mapSelector) {
      this.mapSelector.setMapType(this.currentMapType);
    }
  }

  onActivate() {
    if (this.mapSelector) this.mapSelector.activate();
    if (this.mapCurve) this.mapCurve.activate();
    if (this.mapEditor) this.mapEditor.activate();
  }

  onDeactivate() {
    if (this.mapSelector) this.mapSelector.deactivate();
    if (this.mapCurve) this.mapCurve.deactivate();
    if (this.mapEditor) this.mapEditor.deactivate();
  }
}
