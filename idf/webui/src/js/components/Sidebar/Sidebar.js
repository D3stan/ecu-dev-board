/**
 * Sidebar.js
 * ==========
 * Component for the sidebar navigation.
 * Redesigned for the ECU Simulator.
 * 
 * @extends Component
 */

import { Component } from '../../core/Component.js';
import { log } from '../../utils/logger.js';

export class Sidebar extends Component {
  /**
   * @param {Object} config - Sidebar configuration
   * @param {string} config.activeItemId - Active item ID
   * @param {function} config.onItemClick - Item click callback
   * @param {function} config.onClose - Close callback
   */
  constructor(config = {}) {
    super(config);
    
    this.activeItemId = config.activeItemId || 'dashboardPage';
    this.onItemClick = config.onItemClick || (() => {});
    this.onClose = config.onClose || (() => {});
    this.brand = config.brand || "ECU WEBUI";
    this.footerLabel = config.footerLabel || "ECU Dev Board";
    this.items = Array.isArray(config.items) && config.items.length > 0
      ? config.items
      : defaultItems();
    
    // DOM references
    this.overlayEl = null;
    this.sidebarEl = null;
    this.closeBtn = null;
    
    log.debug('📂 Sidebar component created');
  }

  onBindEvents() {
    log.debug('[Sidebar onBindEvents] Binding events');
    
    this.overlayEl = this.el.querySelector('.sidebar-overlay');
    this.sidebarEl = this.el.querySelector('.sidebar');
    this.closeBtn = this.el.querySelector('.sidebar-close-btn');
    
    // Click on overlay -> close
    if (this.overlayEl) {
      this.overlayEl.addEventListener('click', () => {
        this.close();
      });
    }
    
    // Click on close button -> close
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => {
        this.close();
      });
    }
    
    // ESC key -> close
    this._handleEscKey = (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    };
    document.addEventListener('keydown', this._handleEscKey);
    
    // Bind click events on menu items
    this._bindMenuItems();
  }

  onActivate() {
    log.debug('[Sidebar onActivate] Activated');
  }

  onDestroy() {
    log.debug('[Sidebar onDestroy] Cleanup');
    if (this._handleEscKey) {
      document.removeEventListener('keydown', this._handleEscKey);
    }
  }

  /**
   * Render sidebar HTML
   * @returns {string}
   */
  render() {
    return `
      <div class="sidebar-wrapper">
        <div class="sidebar-overlay"></div>
        
        <div class="sidebar">
          <div class="sidebar-header">
            <div class="sidebar-brand">${escapeHtml(this.brand)}</div>
            
            <button class="sidebar-close-btn" aria-label="Close menu">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          
          <div class="sidebar-content">
            <nav class="sidebar-menu">
              ${this._renderMenuItems()}
            </nav>
          </div>
          
          <div class="sidebar-footer">
            <div class="sidebar-version">${escapeHtml(this.footerLabel)}</div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render static menu items for ECU simulator
   * @private
   */
  _renderMenuItems() {
    return this.items.map(item => {
      if (item.type === "section") {
        return `<div class="sidebar-section-title">${escapeHtml(item.label || "")}</div>`;
      }

      const isActive = item.id === this.activeItemId;
      const activeClass = isActive ? 'active' : '';
      return `
        <button class="sidebar-item ${activeClass}"
             type="button"
             data-menu-id="${escapeHtml(item.id)}"
             data-route="${escapeHtml(item.route || "")}">
          <div class="sidebar-item-icon">
            <img data-asset-key="${escapeHtml(item.icon)}" alt="${escapeHtml(item.label)}" />
          </div>
          <span class="sidebar-item-label">${escapeHtml(item.label)}</span>
        </button>
      `;
    }).join('');
  }

  /**
   * Bind click events on menu items
   * @private
   */
  _bindMenuItems() {
    const itemElements = this.el.querySelectorAll('.sidebar-item[data-menu-id]');
    
    itemElements.forEach(element => {
      element.addEventListener('click', () => {
        const menuId = element.getAttribute('data-menu-id');
        const route = element.getAttribute('data-route');
        
        log.debug(`[Sidebar] Item clicked: ${menuId} → ${route}`);
        
        this.onItemClick({
          menuId,
          route,
          element
        });
      });
    });
  }

  /**
   * Open sidebar
   */
  open() {
    if (this.isOpen()) return;
    if (this.overlayEl) this.overlayEl.classList.add('active');
    if (this.sidebarEl) this.sidebarEl.classList.add('active');
  }

  /**
   * Close sidebar
   */
  close() {
    if (!this.isOpen()) return;
    if (this.overlayEl) this.overlayEl.classList.remove('active');
    if (this.sidebarEl) this.sidebarEl.classList.remove('active');
    this.onClose();
  }

  /**
   * Toggle sidebar
   */
  toggle() {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Check if sidebar is open
   * @returns {boolean}
   */
  isOpen() {
    return this.sidebarEl && this.sidebarEl.classList.contains('active');
  }

  /**
   * Set active item
   * @param {string} menuId
   */
  setActiveItem(menuId) {
    this.activeItemId = String(menuId);
    
    if (!this.el) return;
    
    const items = this.el.querySelectorAll('.sidebar-item');
    items.forEach(item => {
      const id = item.getAttribute('data-menu-id');
      if (id === String(menuId)) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }
}

function defaultItems() {
  return [
    { id: 'dashboardPage', label: 'Dashboard', icon: 'icon-thermo', route: 'dashboardPage' }
  ];
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export default Sidebar;
