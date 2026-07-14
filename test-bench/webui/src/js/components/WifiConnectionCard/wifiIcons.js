/**
 * wifiIcons.js
 * =============
 * Icon mapping module for Wi-Fi Connection Card.
 * 
 * All icon references are centralized here so that swapping
 * icon assets later requires only updating this file.
 * 
 * Icons that don't exist yet use placeholder paths.
 * CSS-generated icons (chevron, spinner, signal bars) are
 * handled purely via CSS classes — no asset files needed.
 * 
 * @author FogExtra Team
 * @version 1.0.0
 */

// ============================================
// ICON ASSET KEYS (resolved by Component deferred image bridge)
// ============================================

/** Wi-Fi icon for open (unprotected) networks */
export const WIFI_OPEN_ICON = 'icon-wifi-free';

/** Wi-Fi icon for locked (password-protected) networks */
export const WIFI_LOCK_ICON = 'icon-wifi-lock';

/** Wi-Fi off icon (no connection) */
export const WIFI_OFF_ICON = 'icon-wifi-free';

/** Eye icon – show password */
export const EYE_ICON = 'icon-timer';

/** Eye-off icon – hide password */
export const EYE_OFF_ICON = 'icon-timer';

// ============================================
// CSS-ONLY ICONS (no asset files needed)
// ============================================
// CHEVRON_DOWN  → CSS class: .wifi-icon-chevron
// SPINNER       → CSS class: .wifi-icon-spinner
// SIGNAL_BARS   → CSS class: .wifi-signal-bars  (rendered as divs)

// ============================================
// HELPERS
// ============================================

/**
 * Renders an <img> tag bound to the deferred image bridge.
 *
 * @param {string} assetKey  – asset key from constants above
 * @param {string} alt  – accessible alt text
 * @param {string} [cls] – optional extra CSS class
 * @returns {string} HTML string
 */
export function renderIcon(assetKey, alt = '', cls = '') {
  const safeAlt = alt.replace(/"/g, '&quot;');
  return `<img data-asset-key="${assetKey}" alt="${safeAlt}" class="wifi-icon ${cls}">`;
}
