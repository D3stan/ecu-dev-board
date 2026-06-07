/**
 * TopBar.js
 * ==========
 * Top bar component with logo, time display, theme toggle, and menu button.
 * 
 * Features:
 * - FogExtra and Idrobase logos (Idrobase hidden on mobile)
 * - Real-time clock display (bound to Store runtime.rtc.time)
 * - Dark/Light theme toggle (localStorage persistence)
 * - Menu button (opens Sidebar)
 * - Responsive design with mobile optimizations
 * 
 * Structure matches index.html exactly (refactored to component architecture)
 * 
 * @author FogExtra Team
 * @version 2.0.0
 */

import { Component } from '../../core/Component.js';
import { 
  getThemeFromStorage, 
  saveThemeToStorage, 
  applyTheme, 
  toggleTheme,
  updateThemeIcon,
  formatTime 
} from './func.js';

export class TopBar extends Component {
  /**
   * Create TopBar instance.
   * 
   * @param {Object} options - Component options
   * @param {Function} options.onThemeToggle - Callback when theme button is clicked
   * @param {Function} options.onMenuClick - Callback when menu button is clicked
   */
  constructor(options = {}) {
    // Do NOT set el here - let the component create it from render()
    // The container in the HTML is just a placeholder
    
    // Bind to runtime.rtc.time for clock display
    if (!options.bindings) {
      options.bindings = {
        currentTime: 'runtime.rtc.time',
        isLocked: 'app.auth.locked'
      };
    }

    super(options);

    // Callbacks
    this.onThemeToggle = options.onThemeToggle || null;
    this.onMenuClick = options.onMenuClick || null;

    // Internal state - leggi tema DOPO super()
    this._currentTheme = getThemeFromStorage();
  }

  // ============================================
  // LIFECYCLE HOOKS
  // ============================================

  onCreate() {
    // NON applicare il tema qui!
    // Lo script inline in index-new.html ha già applicato il tema dal localStorage
    // Qui dobbiamo solo leggere il valore per sincronizzarlo
  }

  onMount() {
    // Setup event listeners
    this._setupEventListeners();
    
    // Update theme icon based on current theme
    this._updateThemeIcon();
  }

  onDataChange(key, newValue, oldValue) {
    if (key === 'currentTime') {
      this._updateTimeDisplay(newValue);
    }
    if (key === 'isLocked') {
      this._updateMenuButtonVisibility(!newValue);
    }
  }

  onDestroy() {
    // Cleanup is handled automatically by Component base class
  }

  // ============================================
  // RENDERING
  // ============================================

  render() {
    // Matches index.html structure exactly
    // Returns only the INNER content (not the .top-bar wrapper)
    // because the container already exists in the HTML
    
    // Determine which icon to show based on current theme
    const isLightMode = this._currentTheme === 'light';
    const lightIconDisplay = isLightMode ? '' : 'display: none;';
    const darkIconDisplay = isLightMode ? 'display: none;' : '';
    
    return `
      <div class="top-bar-content">
        <div class="top-bar-left">
          <div class="product-logo">
            <img data-asset-key="logo-product" alt="FogExtra" draggable="false">
          </div>
          <div class="product-info">
            <div class="product-name">FOG EXTRA</div>
            <div class="current-time" data-time-display>${formatTime(this.data.currentTime)}</div>
          </div>
          <div class="brand-name">
            <!-- <div class="logo-idrobase">
               <div class="logo-idrobase-title">IDROBASE<span class="logo-idrobase-registered">&reg;</span></div>
               <div class="logo-idrobase-payoff">PASSION FOR WATER</div>
            </div> -->
            <img data-asset-key="logo-idrobase" alt="Idrobase" draggable="false">
          </div>
        </div>
        
        <div class="top-bar-right">
          <button class="icon-btn" data-theme-toggle id="theme-toggle" title="Cambia tema">
            <img 
              data-asset-key="icon-sun" 
              alt="Light" 
              class="theme-icon theme-icon-light"
              style="${lightIconDisplay}"
              draggable="false"
            >
            <img 
              data-asset-key="icon-moon" 
              alt="Dark" 
              class="theme-icon theme-icon-dark" 
              style="${darkIconDisplay}"
              draggable="false"
            >
          </button>
          <button class="icon-btn" data-menu-toggle id="menu-btn" title="Menu">
            <img 
              data-asset-key="icon-hamburger-menu" 
              alt="Menu"
              draggable="false"
            >
          </button>
        </div>
      </div>
    `.trim();
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  /**
   * Setup event listeners for buttons.
   * @private
   */
  _setupEventListeners() {
    // Theme toggle button
    const themeBtn = this.$('[data-theme-toggle]');
    if (themeBtn) {
      this.addEventListener(themeBtn, 'click', () => this._handleThemeToggle());
    }

    // Menu button
    const menuBtn = this.$('[data-menu-toggle]');
    if (menuBtn) {
      this.addEventListener(menuBtn, 'click', () => this._handleMenuClick());
    }
  }

  /**
   * Handle theme toggle button click.
   * @private
   */
  _handleThemeToggle() {
    // Toggle theme using business logic
    const newTheme = toggleTheme(this._currentTheme);
    this._currentTheme = newTheme;

    // Apply changes
    applyTheme(newTheme);
    saveThemeToStorage(newTheme);
    this._updateThemeIcon();

    // Call callback if provided
    if (typeof this.onThemeToggle === 'function') {
      this.onThemeToggle(newTheme);
    }
  }

  /**
   * Handle menu button click.
   * @private
   */
  _handleMenuClick() {
    // Call callback if provided
    if (typeof this.onMenuClick === 'function') {
      this.onMenuClick();
    }
  }

  /**
   * Update time display in the DOM.
   * @private
   * @param {string} time - Formatted time string (HH:MM)
   */
  _updateTimeDisplay(time) {
    const timeDisplay = this.$('[data-time-display]');
    if (timeDisplay) {
      timeDisplay.textContent = formatTime(time);
    }
  }

  /**
   * Update theme icon visibility based on current theme.
   * @private
   */
  _updateThemeIcon() {
    updateThemeIcon(this.el, this._currentTheme);
  }

  /**
   * Show or hide the menu (hamburger) button.
   * Hidden when the app is PIN-locked.
   * @private
   * @param {boolean} visible
   */
  _updateMenuButtonVisibility(visible) {
    const menuBtn = this.$('[data-menu-toggle]');
    if (menuBtn) {
      menuBtn.style.display = visible ? '' : 'none';
    }
  }

  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Get current theme.
   * @returns {string} Current theme ('light' or 'dark')
   */
  getTheme() {
    return this._currentTheme;
  }

  /**
   * Set theme programmatically.
   * @param {string} theme - 'light' or 'dark'
   */
  setTheme(theme) {
    if (theme !== 'light' && theme !== 'dark') {
      console.warn('[TopBar] Invalid theme:', theme);
      return;
    }

    this._currentTheme = theme;
    applyTheme(theme);
    saveThemeToStorage(theme);
    this._updateThemeIcon();
  }

  /**
   * Update time display manually (useful for testing).
   * @param {string} time - Formatted time string
   */
  setTime(time) {
    this.setData('currentTime', time);
  }
}
