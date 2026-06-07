/**
 * MapCurve.js
 * ============
 * SVG visualization of an ECU lookup-table curve (breakpoints → polyline).
 *
 * Constructor options:
 *   { mapType }  — 'ignition' or 'power_jet'
 *
 * Structure:
 *   div.map-curve
 *     svg (viewBox="0 0 400 200")
 *       — grid lines (horizontal at 25% intervals, vertical at 3000 RPM)
 *       — polyline through breakpoints
 *       — circles at each breakpoint
 *       — vertical dashed line at current RPM
 *
 * @author ECU Dev Board
 * @version 1.0.0
 */

import { Component } from '../../core/Component.js';
import { Store } from '../../core/store.js';

// ── SVG constants ────────────────────────────────────────
const SVG_W = 400;
const SVG_H = 200;
const PADDING_X = 10;
const PADDING_Y = 15;
const PLOT_W = SVG_W - 2 * PADDING_X;    // 380
const PLOT_H = SVG_H - 2 * PADDING_Y;    // 170

const RPM_MAX = 18000;
const SVG_NS = 'http://www.w3.org/2000/svg';

// Map type → store path
const MAP_STORE_PATHS = {
  ignition:  'config.maps.ignition',
  power_jet: 'config.maps.powerJet',
};

export class MapCurve extends Component {
  /**
   * @param {Object} options
   * @param {string} options.mapType - 'ignition' or 'power_jet'
   */
  constructor(options = {}) {
    super(options);

    this._mapType = options.mapType || 'ignition';
    this._storePath = MAP_STORE_PATHS[this._mapType] || MAP_STORE_PATHS.ignition;
    this._breakpoints = [];
    this._currentRpm = 0;
  }

  // ── Rendering ──────────────────────────────────────────

  render() {
    const el = document.createElement('div');
    el.className = 'map-curve';

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${SVG_W} ${SVG_H}`);
    svg.setAttribute('class', 'map-curve__svg');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    el.appendChild(svg);
    this.el = el;
    return el;
  }

  // ── Lifecycle ──────────────────────────────────────────

  onActivate() {
    // Subscribe to map data
    this.subscribeToStore(this._storePath, (mapData) => {
      if (mapData && Array.isArray(mapData.breakpoints)) {
        this._breakpoints = mapData.breakpoints;
      } else {
        this._breakpoints = [];
      }
      this._redraw();
    });

    // Subscribe to telemetry for current RPM cursor
    this.subscribeToStore('telemetry.snapshot', (snapshot) => {
      if (snapshot && typeof snapshot.rpm === 'number') {
        this._currentRpm = snapshot.rpm;
        this._redraw();
      }
    });
  }

  // ── Drawing ────────────────────────────────────────────

  /**
   * Full redraw of the SVG contents.
   * @private
   */
  _redraw() {
    const svg = this.el ? this.el.querySelector('.map-curve__svg') : null;
    if (!svg) return;

    // Clear
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const maxVal = this._getMaxValue();

    this._drawGrid(svg, maxVal);
    this._drawCurve(svg, maxVal);
    this._drawRpmCursor(svg);
  }

  /**
   * Get the maximum value across breakpoints (for Y-axis scaling).
   * @returns {number}
   * @private
   */
  _getMaxValue() {
    if (this._breakpoints.length === 0) return 100;
    const max = Math.max(...this._breakpoints.map(bp => Math.abs(bp.value)));
    return max > 0 ? max : 100;
  }

  /**
   * Draw background grid lines.
   * @param {SVGElement} svg
   * @param {number} maxVal
   * @private
   */
  _drawGrid(svg, maxVal) {
    const gridColor = 'rgba(255,255,255,0.08)';

    // Horizontal grid lines at 25% intervals
    for (let i = 0; i <= 4; i++) {
      const y = this._scaleY((maxVal * i) / 4, maxVal);
      const line = this._svgLine(PADDING_X, y, SVG_W - PADDING_X, y, gridColor, 0.5);
      svg.appendChild(line);
    }

    // Vertical grid lines every 3000 RPM
    for (let rpm = 0; rpm <= RPM_MAX; rpm += 3000) {
      const x = this._scaleX(rpm);
      const line = this._svgLine(x, PADDING_Y, x, SVG_H - PADDING_Y, gridColor, 0.5);
      svg.appendChild(line);
    }
  }

  /**
   * Draw the polyline curve and breakpoint circles.
   * @param {SVGElement} svg
   * @param {number} maxVal
   * @private
   */
  _drawCurve(svg, maxVal) {
    if (this._breakpoints.length === 0) return;

    // Sort by RPM
    const sorted = [...this._breakpoints].sort((a, b) => a.rpm - b.rpm);

    // Polyline
    const points = sorted
      .map(bp => `${this._scaleX(bp.rpm)},${this._scaleY(bp.value, maxVal)}`)
      .join(' ');

    const polyline = document.createElementNS(SVG_NS, 'polyline');
    polyline.setAttribute('points', points);
    polyline.setAttribute('fill', 'none');
    polyline.setAttribute('stroke', 'var(--accent, #3b82f6)');
    polyline.setAttribute('stroke-width', '2');
    polyline.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(polyline);

    // Breakpoint circles
    sorted.forEach(bp => {
      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('cx', this._scaleX(bp.rpm));
      circle.setAttribute('cy', this._scaleY(bp.value, maxVal));
      circle.setAttribute('r', '4');
      circle.setAttribute('fill', 'var(--accent, #3b82f6)');
      circle.setAttribute('stroke', 'var(--bg, #111)');
      circle.setAttribute('stroke-width', '1.5');
      svg.appendChild(circle);
    });
  }

  /**
   * Draw vertical dashed line at the current RPM position.
   * @param {SVGElement} svg
   * @private
   */
  _drawRpmCursor(svg) {
    if (this._currentRpm <= 0) return;

    const x = this._scaleX(this._currentRpm);
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', x);
    line.setAttribute('y1', PADDING_Y);
    line.setAttribute('x2', x);
    line.setAttribute('y2', SVG_H - PADDING_Y);
    line.setAttribute('stroke', 'var(--warning, #eab308)');
    line.setAttribute('stroke-width', '1');
    line.setAttribute('stroke-dasharray', '4 3');
    svg.appendChild(line);
  }

  // ── Coordinate scaling ─────────────────────────────────

  /**
   * Scale RPM to SVG X coordinate.
   * @param {number} rpm
   * @returns {number}
   */
  _scaleX(rpm) {
    return (rpm / RPM_MAX) * PLOT_W + PADDING_X;
  }

  /**
   * Scale value to SVG Y coordinate (inverted — higher values at top).
   * @param {number} value
   * @param {number} maxVal
   * @returns {number}
   */
  _scaleY(value, maxVal) {
    return (SVG_H - PADDING_Y) - (value / maxVal) * PLOT_H;
  }

  // ── SVG helpers ────────────────────────────────────────

  /**
   * Create an SVG line element.
   * @private
   */
  _svgLine(x1, y1, x2, y2, stroke, strokeWidth) {
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    line.setAttribute('stroke', stroke);
    line.setAttribute('stroke-width', strokeWidth);
    return line;
  }
}

export default MapCurve;
