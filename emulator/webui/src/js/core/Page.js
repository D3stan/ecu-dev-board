/**
 * Page.js
 * ========
 * Extended Component class for full-screen pages in the FogExtra app.
 * 
 * Pages are special components that:
 * - Occupy the entire viewport (full-screen container)
 * - Integrate with NavigatorManager for routing
 * - Have automatic lifecycle tied to navigation
 * - Can contain multiple child components
 * - Support back button navigation
 * 
 * Lifecycle with Navigation:
 * 1. NavigatorManager.navigateTo('pageId')
 * 2. Page.activate() → onActivate() hook
 * 3. User interacts with page
 * 4. NavigatorManager.goBack()
 * 5. Page.deactivate() → onDeactivate() hook
 * 
 * @author FogExtra Team
 * @version 2.0.0
 */

import { Component } from './Component.js';

export class Page extends Component {
  /**
   * Create a new Page instance.
   * 
   * @param {Object} options - Page configuration
   * @param {string} options.id - Page ID (required, used for navigation)
   * @param {string} options.title - Page title (displayed in header)
   * @param {string} options.icon - Page icon path (optional)
   * @param {boolean} options.showBackButton - Show back button in header (default: true for non-home pages)
   * @param {Function} options.onBackButton - Custom back button handler
   * @param {Object} options.bindings - Store bindings
   */
  constructor(options = {}) {
    // Set default element selector for pages
    if (!options.el) {
      options.el = `#${options.id}`;
    }

    super(options);

    // Page-specific properties
    this.pageId = this.id; // Explicit page identifier for routing
    this.title = options.title || 'Untitled Page';
    this.icon = options.icon || null;
    this.showBackButton = options.showBackButton !== undefined ? options.showBackButton : true;
    this.onBackButton = options.onBackButton || null;

    // Page state
    this.isHomePage = false; // Set by NavigatorManager
    this.navigationDepth = 0; // Track depth in navigation stack

    // Components organized by area
    this.components = {
      header: [],
      content: [],
      footer: []
    };
  }

  // ============================================
  // PAGE LIFECYCLE (Override Component methods)
  // ============================================

  /**
   * Called when page is navigated to (becomes visible).
   * Override to implement page-specific activation logic.
   */
  onActivate() {
    super.onActivate();
    
    // Update page title if header exists
    this._updateHeader();

    // Scroll to top when page activates
    if (this.el) {
      const contentArea = this.el.querySelector('.content-area');
      if (contentArea) {
        contentArea.scrollTop = 0;
      }
    }
  }

  /**
   * Called when page is navigated away from (becomes hidden).
   * Override to implement page-specific deactivation logic.
   */
  onDeactivate() {
    super.onDeactivate();
    
    // Optional: Save scroll position for restoration
    if (this.el) {
      const contentArea = this.el.querySelector('.content-area');
      if (contentArea) {
        this._scrollPosition = contentArea.scrollTop;
      }
    }
  }

  // ============================================
  // PAGE RENDERING
  // ============================================

  /**
   * Create page skeleton (minimal DOM structure).
   * Returns a bare-bones page element to be injected into pages-container.
   * Content will be added during skeleton creation.
   * 
   * @returns {HTMLElement} Page skeleton element
   */
  createSkeleton() {
    // Create page wrapper
    const pageEl = document.createElement('div');
    pageEl.className = 'page left'; // Initially hidden to the left
    pageEl.id = this.pageId;
    
    // Create content area container
    const contentArea = document.createElement('div');
    contentArea.className = 'content-area';
    
    // Render content into content area
    contentArea.innerHTML = this.renderContent();
    
    // Append content area to page
    pageEl.appendChild(contentArea);
    
    // Save reference
    this.el = pageEl;
    this.phase = 'rendered';

    // Complete semantic mount for pages created via createSkeleton().
    // This keeps Page lifecycle aligned with Component.mount() semantics,
    // without routing through mount() itself.
    this.state.mounted = true;
    this.onMount();

    // Attiva la subscription i18n se la sottoclasse ha chiamato enableI18n().
    // Necessario perché le pagine usano createSkeleton() invece di mount(),
    // bypassando il meccanismo automatico di Component.mount() che normalmente
    // chiama _setupI18nBinding(). Senza questa chiamata, le pagine che usano
    // enableI18n() sulla propria istanza non ricevono mai le notifiche di
    // cambio lingua.
    this._setupI18nBinding();
    
    return pageEl;
  }

  /**
   * Render page structure.
   * Override to provide custom page layout.
   * 
   * @returns {string} Page HTML
   */
  render() {
    return `
      <div id="${this.pageId}" class="page">
        ${this.showBackButton ? this._renderHeader() : ''}
        <div class="content-area">
          ${this.renderContent()}
        </div>
      </div>
    `;
  }

  /**
   * Render page header with back button.
   * 
   * @private
   * @returns {string} Header HTML
   */
  _renderHeader() {
    return `
      <div class="sub-header">
        <button class="back-btn" data-page-back="${this.pageId}" aria-label="Indietro">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <h2 class="sub-header-title">${this.title}</h2>
      </div>
    `;
  }

  /**
   * Render page content.
   * Override in subclass to implement page-specific content.
   * 
   * @returns {string} Content HTML
   */
  renderContent() {
    return `<p>Page content goes here</p>`;
  }

  /**
   * Update page header (title, back button).
   * 
   * @private
   */
  _updateHeader() {
    if (!this.showBackButton || !this.el) return;

    const titleEl = this.el.querySelector('.sub-header-title');
    if (titleEl) {
      titleEl.textContent = this.title;
    }
  }

  // ============================================
  // PAGE-SPECIFIC METHODS
  // ============================================

  /**
   * Set page title dynamically.
   * 
   * @param {string} title - New page title
   */
  setTitle(title) {
    this.title = title;
    if (this.state.active) {
      this._updateHeader();
    }
  }

  /**
   * Set parameter for editor pages (parameterEditorPage, timerEditorPage).
   * This is used to pass parameter data when navigating to editor pages.
   * 
   * @param {Object} param - Parameter object from Store
   */
  setParameter(param) {
    this.param = param;
  }

  /**
   * Add component to specific page area.
   * 
   * @param {Component} component - Component instance
   * @param {string} area - Target area ('header', 'content', 'footer')
   * @returns {Page} this (chainable)
   */
  addComponent(component, area = 'content') {
    if (!this.components[area]) {
      console.warn(`[Page] Invalid area: ${area}`);
      return this;
    }

    this.components[area].push(component);
    this.addChild(component);

    // Mount to appropriate container
    if (this.state.mounted) {
      const container = this._getAreaContainer(area);
      if (container) {
        component.mount(container);
      }
    }

    return this;
  }

  /**
   * Get container element for area.
   * 
   * @private
   * @param {string} area - Area name
   * @returns {HTMLElement|null} Container element
   */
  _getAreaContainer(area) {
    if (!this.el) return null;

    switch (area) {
      case 'header':
        return this.el.querySelector('.sub-header');
      case 'content':
        return this.el.querySelector('.content-area');
      case 'footer':
        return this.el.querySelector('.page-footer');
      default:
        return this.el.querySelector('.content-area');
    }
  }

  /**
   * Remove all components from page.
   */
  clearComponents() {
    Object.values(this.components).forEach(areaComponents => {
      areaComponents.forEach(component => {
        this.removeChild(component);
      });
    });

    this.components = {
      header: [],
      content: [],
      footer: []
    };
  }

  /**
   * Show loading indicator.
   * 
   * @param {string} message - Optional loading message
   */
  showLoading(message = 'Caricamento...') {
    const contentArea = this._getAreaContainer('content');
    if (!contentArea) return;

    const loadingEl = document.createElement('div');
    loadingEl.className = 'page-loading';
    loadingEl.innerHTML = `
      <div class="spinner"></div>
      <p>${message}</p>
    `;
    loadingEl.dataset.pageLoading = 'true';

    contentArea.appendChild(loadingEl);
  }

  /**
   * Hide loading indicator.
   */
  hideLoading() {
    const contentArea = this._getAreaContainer('content');
    if (!contentArea) return;

    const loadingEl = contentArea.querySelector('[data-page-loading="true"]');
    if (loadingEl) {
      loadingEl.remove();
    }
  }

  /**
   * Show error message on page.
   * 
   * @param {string} message - Error message
   * @param {Function} onRetry - Optional retry callback
   */
  showError(message, onRetry = null) {
    const contentArea = this._getAreaContainer('content');
    if (!contentArea) return;

    const errorEl = document.createElement('div');
    errorEl.className = 'page-error';
    errorEl.innerHTML = `
      <div class="error-icon">⚠️</div>
      <p class="error-message">${message}</p>
      ${onRetry ? '<button class="error-retry-btn">Riprova</button>' : ''}
    `;
    errorEl.dataset.pageError = 'true';

    if (onRetry) {
      const retryBtn = errorEl.querySelector('.error-retry-btn');
      retryBtn.addEventListener('click', () => {
        this.hideError();
        onRetry();
      });
    }

    contentArea.appendChild(errorEl);
  }

  /**
   * Hide error message.
   */
  hideError() {
    const contentArea = this._getAreaContainer('content');
    if (!contentArea) return;

    const errorEl = contentArea.querySelector('[data-page-error="true"]');
    if (errorEl) {
      errorEl.remove();
    }
  }

  /**
   * Restore scroll position (if saved).
   */
  restoreScrollPosition() {
    if (this._scrollPosition !== undefined && this.el) {
      const contentArea = this.el.querySelector('.content-area');
      if (contentArea) {
        contentArea.scrollTop = this._scrollPosition;
      }
    }
  }

  // ============================================
  // NAVIGATION INTEGRATION
  // ============================================

  /**
   * Handle back button click.
   * Called by NavigatorManager or manual back button.
   * 
   * @returns {boolean} true if navigation should proceed, false to cancel
   */
  handleBack() {
    // Call custom handler if provided
    if (typeof this.onBackButton === 'function') {
      return this.onBackButton();
    }

    // Default: allow navigation
    return true;
  }

  /**
   * Check if page can be navigated away from.
   * Override to implement validation (e.g., unsaved changes).
   * 
   * @returns {boolean} true if can leave, false to prevent
   */
  canLeave() {
    // Override in subclass for custom logic
    return true;
  }

  /**
   * Called when page is about to be navigated to.
   * Override to implement pre-navigation logic (e.g., auth check).
   * 
   * @returns {boolean} true to allow navigation, false to prevent
   */
  canEnter() {
    // Override in subclass for custom logic
    return true;
  }

  // ============================================
  // DEBUG
  // ============================================

  /**
   * Get page info for debugging.
   * 
   * @returns {Object} Page info
   */
  getInfo() {
    return {
      ...super.getInfo(),
      pageId: this.pageId,
      title: this.title,
      isHomePage: this.isHomePage,
      navigationDepth: this.navigationDepth,
      componentCounts: {
        header: this.components.header.length,
        content: this.components.content.length,
        footer: this.components.footer.length
      }
    };
  }
}
