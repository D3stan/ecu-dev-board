/**
 * TopBar.js
 * ==========
 * Top bar component for the ECU WebUI.
 * Shows branding, connection status badge, theme toggle, and menu button.
 */

import { Component } from '../../core/Component.js';
import { 
  getThemeFromStorage, 
  saveThemeToStorage, 
  applyTheme, 
  toggleTheme,
  updateThemeIcon
} from './func.js';

export class TopBar extends Component {
  constructor(options = {}) {
    if (!options.bindings) {
      options.bindings = {
        socketStatus: 'socket.state'
      };
    }

    super(options);

    this.onThemeToggle = options.onThemeToggle || null;
    this.onMenuClick = options.onMenuClick || null;
    this._currentTheme = getThemeFromStorage();
  }

  onMount() {
    this._setupEventListeners();
    this._updateThemeIcon();
    this._updateConnectionStatus(this.data.socketStatus);
  }

  onDataChange(key, newValue) {
    if (key === 'socketStatus') {
      this._updateConnectionStatus(newValue);
    }
  }

  render() {
    const isLightMode = this._currentTheme === 'light';
    const lightIconDisplay = isLightMode ? '' : 'display: none;';
    const darkIconDisplay = isLightMode ? 'display: none;' : '';
    
    return `
      <div class="top-bar-content">
        <div class="top-bar-left">
          <div class="product-info">
            <div class="product-name">ECU WEBUI</div>
          </div>
        </div>
        
        <div class="top-bar-right">
          <!-- Connection Status Badge -->
          <div class="connection-status-badge" data-connection-status>DISCONNECTED</div>

          <button class="icon-btn" data-theme-toggle id="theme-toggle" title="Toggle Theme">
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

  _setupEventListeners() {
    const themeBtn = this.$('[data-theme-toggle]');
    if (themeBtn) {
      this.addEventListener(themeBtn, 'click', () => this._handleThemeToggle());
    }

    const menuBtn = this.$('[data-menu-toggle]');
    if (menuBtn) {
      this.addEventListener(menuBtn, 'click', () => this._handleMenuClick());
    }
  }

  _handleThemeToggle() {
    const newTheme = toggleTheme(this._currentTheme);
    this._currentTheme = newTheme;

    applyTheme(newTheme);
    saveThemeToStorage(newTheme);
    this._updateThemeIcon();

    if (typeof this.onThemeToggle === 'function') {
      this.onThemeToggle(newTheme);
    }
  }

  _handleMenuClick() {
    if (typeof this.onMenuClick === 'function') {
      this.onMenuClick();
    }
  }

  _updateConnectionStatus(status) {
    const badge = this.$('[data-connection-status]');
    if (!badge) return;
    
    const displayStatus = status || 'disconnected';
    badge.textContent = displayStatus.toUpperCase();
    badge.className = `connection-status-badge ${displayStatus.toLowerCase()}`;
  }

  _updateThemeIcon() {
    updateThemeIcon(this.el, this._currentTheme);
  }
}
