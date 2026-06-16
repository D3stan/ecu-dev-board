/**
 * WifiSignalBars.js
 * ==================
 * Pure rendering helper that returns signal-strength bar HTML.
 * Not a full Component — just a static renderer used inside rows.
 *
 * Renders 4 bars; bars up to `level` are "active", rest are inactive.
 *
 * @author FogExtra Team
 * @version 1.0.0
 */

/**
 * Generate signal-bars HTML.
 * @param {number} level – 0..4 (wifiSignalLevel)
 * @param {string} [modifier] – optional CSS modifier class (e.g. 'blue')
 * @returns {string} HTML string
 */
export function renderSignalBars(level = 0, modifier = '') {
  const total = 4;
  const mod = modifier ? ` wifi-signal-bars--${modifier}` : '';
  let html = `<div class="wifi-signal-bars${mod}" aria-label="Signal ${level}/4">`;
  for (let i = 1; i <= total; i++) {
    const active = i <= level ? 'active' : '';
    html += `<div class="wifi-signal-bar wifi-signal-bar--${i} ${active}"></div>`;
  }
  html += '</div>';
  return html;
}
