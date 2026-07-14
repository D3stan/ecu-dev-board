import { Component } from '../../core/Component.js';
import { mapTypeToClass, generateUniqueId } from './func.js';
import { i18n } from '../../utils/i18n.js';
import { Store } from '../../core/store.js';
import { log } from '../../utils/logger.js';

/**
 * Banner Component
 * 
 * Flexible notification banner with reactive Store subscriptions.
 * Similar API to Modal component for consistency.
 * 
 * @example
 * const banner = new Banner({
 *   title: "Maintenance",
 *   label: "Next maintenance in 340h",
 *   type: "warning",
 *   assetKey: "icon-setting", // optional
 *   closable: true,
 *   subscriptions: [
 *     {
 *       path: "runtime.timers.maintenance.timeLeft",
 *       cb: (value, self) => {
 *         if (value <= 0) {
 *           self.updateType("error");
 *           self.updateLabel("Maintenance required");
 *           self.open();
 *         }
 *       }
 *     }
 *   ]
 * });
 */
export class Banner extends Component {
  /**
   * @param {Object} options - Configuration options
   * @param {string} [options.title=""] - Banner title (optional)
   * @param {string} [options.label=""] - Main banner text
   * @param {string} [options.type="info"] - Banner type: info, warning, error, success
  * @param {string} [options.assetKey=null] - Custom icon asset key (optional)
   * @param {boolean} [options.closable=true] - Whether banner can be closed
   * @param {Object} [options.labelParams={}] - Parameters for label translation (e.g., {hours: 340})
   * @param {Array<{path: string, cb: Function}>} [options.subscriptions=[]] - Store subscriptions
   * @param {Function} [options.onClose=null] - Callback when banner is closed
   */
  constructor(options = {}) {
    // Set Banner properties BEFORE super() to ensure onCreate() can access them
    const bannerOptions = {
      title: options.title || "",
      label: options.label || "",
      type: options.type || "info", 
      assetKey: options.assetKey || null,
      closable: options.closable !== false,
      subscriptions: options.subscriptions || [],
      onCloseCallback: options.onClose || null
    };
    
    // Apply Banner-specific configuration BEFORE super() so onCreate() can access them
    Object.assign(options, bannerOptions);
    
    super(options);
    
    // Additional Banner-specific properties
    Object.assign(this, bannerOptions);
    
    // Store i18n keys and params for translation updates
    this._titleKey = options.title || "";
    this._labelKey = options.label || "";
    this._labelParams = options.labelParams || {}; // Store initial params for translation
    
    // Internal state
    this.isVisible = false;
    this.isUserDismissed = false; // Memory-only state for user dismissal
    
    // Generate unique IDs
    this._bannerId = generateUniqueId('banner');
    this._closeButtonId = generateUniqueId('banner-close');
    
    // Enable i18n updates
    this.enableI18n(() => this._updateTranslations());
    
    // Debug: Log subscriptions
    log.debug('Banner', `Constructor - subscriptions:`, this.subscriptions);
    log.debug('Banner', `Constructor - subscriptions length:`, this.subscriptions ? this.subscriptions.length : 'undefined');

    log.debug('Banner', `Created banner: "${this.title || this.label}" (type: ${this.type})`);
  }

  /**
   * Lifecycle: Called after component is created
   */
  onCreate() {
    log.debug('Banner', `Component created: ${this.title || this.label}`);
  }

  /**
   * Setup Store subscriptions for reactive behavior
   * @private
   */
  _setupSubscriptions() {
    // Safety check - subscriptions might not be initialized yet
    if (!this.subscriptions || !Array.isArray(this.subscriptions)) {
      log.debug('Banner', 'No subscriptions to setup');
      return;
    }
    
    this.subscriptions.forEach(subscription => {
      if (subscription.path && typeof subscription.cb === 'function') {
        // Use Component base class subscription method (auto-cleanup)
        this.subscribeToStore(subscription.path, (value) => {
          subscription.cb(value, this);
        });
        log.debug('Banner', `Subscribed to path: ${subscription.path}`);
      } else {
        log.warn('Banner', 'Invalid subscription:', subscription);
      }
    });
  }

  /**
   * Update translations based on current language
   * Re-translates title and label using stored keys and params
   * @private
   */
  _updateTranslations() {
    if (!this.element) return;
    
    // Update title
    const titleElement = this.element.querySelector('.banner-title');
    if (titleElement && this._titleKey) {
      // Check if it's an i18n key
      const displayText = this._titleKey.startsWith('t:')
        ? i18n.t(this._titleKey.slice(2))
        : this._titleKey;
      titleElement.textContent = displayText;
    }
    
    // Update label with stored params
    const labelElement = this.element.querySelector('.banner-text');
    if (labelElement && this._labelKey) {
      // Check if it's an i18n key and re-translate with params
      let displayText;
      if (this._labelKey.startsWith('t:')) {
        const key = this._labelKey.slice(2);
        displayText = i18n.t(key, this._labelParams || {});
      } else {
        displayText = this._labelKey;
      }
      labelElement.textContent = displayText;
    }
    
    // Update close button aria-label
    const closeButton = this.element.querySelector('.banner-close');
    if (closeButton) {
      closeButton.setAttribute('aria-label', i18n.t('buttons.close'));
    }
    
    log.debug('Banner', `Translations updated: ${this.title || this.label}`);
  }

  /**
   * Lifecycle: Called after component is mounted to DOM
   * Setup event listeners and Store subscriptions
   */
  onMount() {
    // Setup Store subscriptions AFTER component is fully constructed
    this._setupSubscriptions();
    
    // Setup event handlers
    this._setupEventHandlers();
    
    log.debug('Banner', `Component mounted: ${this.title || this.label}`);
  }

  /**
   * Render banner HTML structure.
   * Following Badge pattern: creates HTMLElement directly.
   * @returns {HTMLElement} Banner element
   */
  render() {
    // Create container element
    this.el = document.createElement('div');
    this.el.className = `banner ${mapTypeToClass(this.type)}`;
    this.el.id = this._bannerId;
    this.el.setAttribute('role', 'alert');
    this.el.setAttribute('aria-live', 'polite');
    this.el.style.display = 'none'; // Hidden by default
    
    // Generate and set inner HTML
    this.el.innerHTML = this._generateInnerHTML();
    
    log.debug('Banner', `Rendered - element type: ${this.el ? 'HTMLElement' : 'null'}`);
    
    return this.el;
  }

  /**
   * Generate the inner HTML for the banner
   * @returns {string} Inner HTML string
   * @private
   */
  _generateInnerHTML() {
    const iconHtml = this._generateIconHTML();
    
    // Translate title with initial params (if it's an i18n key)
    const titleText = this._titleKey.startsWith('t:') 
      ? i18n.t(this._titleKey.slice(2)) 
      : this._titleKey;
    
    const titleHtml = titleText ? `
      <div class="banner-title">${titleText}</div>
    ` : '';
    
    // Translate label with initial params (if it's an i18n key)
    const labelText = this._labelKey.startsWith('t:')
      ? i18n.t(this._labelKey.slice(2), this._labelParams)
      : this._labelKey;
    
    const closeButtonHtml = this.closable ? `
      <button class="banner-close" id="${this._closeButtonId}" aria-label="${i18n.t('buttons.close')}">
        <svg class="banner-close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    ` : '';
    
    return `
      <div class="banner-content">
        ${iconHtml}
        <div class="banner-info">
          ${titleHtml}
          <div class="banner-text">${labelText}</div>
        </div>
        ${closeButtonHtml}
      </div>
    `;
  }

  /**
   * Generate icon HTML based on type or custom icon
   * @returns {string} Icon HTML
   * @private
   */
  _generateIconHTML() {
    if (this.assetKey) {
      // Custom icon asset key
      const alt = this.title || this.label || 'Banner icon';
      return `<img class="banner-icon" data-asset-key="${this.assetKey}" alt="${alt}">`;
    }
    
    // Type-based SVG icons
    const icons = {
      info: `<svg class="banner-icon" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 16v-4M12 8h.01" stroke="white" stroke-width="2" fill="none"/>
      </svg>`,
      
      warning: `<svg class="banner-icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99z"/>
        <path d="M12 14h.01M12 10v2" stroke="white" stroke-width="2" fill="none"/>
      </svg>`,
      
      error: `<svg class="banner-icon" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15" stroke="white" stroke-width="2"/>
        <line x1="9" y1="9" x2="15" y2="15" stroke="white" stroke-width="2"/>
      </svg>`,
      
      success: `<svg class="banner-icon" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="10"/>
        <path d="M9 12l2 2 4-4" stroke="white" stroke-width="2" fill="none"/>
      </svg>`
    };
    
    return icons[this.type] || icons.info;
  }

  /**
   * Setup event handlers for banner interactions
   * @private
   */
  _setupEventHandlers() {
    if (this.closable && this.el) {
      // Use querySelector on this.el instead of document.getElementById
      // because the button is inside this.el's innerHTML
      const closeButton = this.el.querySelector(`#${this._closeButtonId}`);
      if (closeButton) {
        closeButton.addEventListener('click', () => this.close());
        log.debug('Banner', `Close button event listener attached: ${this._closeButtonId}`);
      } else {
        log.warn('Banner', `Close button not found: ${this._closeButtonId}`);
      }
    }
  }

  // === PUBLIC API METHODS ===

  /**
   * Show the banner
   */
  open() {
    if (this.element && !this.isVisible) {
      this.element.style.display = 'block';
      this.isVisible = true;
      log.debug('Banner', `Opened: ${this.title || this.label}`);
    }
  }

  /**
   * Force open the banner (for pump status banners)
   * Resets user dismissal state and shows the banner
   */
  forceOpen() {
    this.isUserDismissed = false;
    this.open();
    log.debug('Banner', `Force opened: ${this.title || this.label}`);
  }

  /**
   * Hide the banner  
   */
  close() {
    if (this.element && this.isVisible) {
      this.element.style.display = 'none';
      this.isVisible = false;
      
      // Mark as user dismissed when manually closed
      if (this.closable) {
        this.isUserDismissed = true;
        log.debug('Banner', `User dismissed: ${this.title || this.label}`);
      }
      
      // Call onClose callback if provided
      if (this.onCloseCallback && typeof this.onCloseCallback === 'function') {
        this.onCloseCallback();
      }
      
      log.debug('Banner', `Closed: ${this.title || this.label}`);
    }
  }

  /**
   * Update banner type and refresh display
   * @param {string} newType - New banner type
   */
  updateType(newType) {
    if (this.type !== newType) {
      this.type = newType;
      
      if (this.element) {
        // Update CSS classes
        const typeClass = mapTypeToClass(newType);
        this.element.className = `banner ${typeClass}`;
        
        // Update icon
        const iconElement = this.element.querySelector('.banner-icon');
        if (iconElement && !this.assetKey) {
          iconElement.outerHTML = this._generateIconHTML();
        }
      }
      
      log.debug('Banner', `Updated type to "${newType}": ${this.title || this.label}`);
    }
  }

  /**
   * Update banner title
   * Supports both plain text and i18n keys (prefixed with 't:')
   * @param {string} newTitle - New title text or i18n key (e.g., "t:banners.maintenance.title")
   */
  updateTitle(newTitle) {
    this.title = newTitle;
    this._titleKey = newTitle; // Store for i18n updates
    
    if (this.element) {
      const titleElement = this.element.querySelector('.banner-title');
      if (titleElement) {
        // Check if it's an i18n key (starts with 't:')
        const displayText = newTitle.startsWith('t:') 
          ? i18n.t(newTitle.slice(2)) 
          : newTitle;
        titleElement.textContent = displayText;
      } else if (newTitle && !this.element.querySelector('.banner-title')) {
        // Add title element if it didn't exist
        const infoElement = this.element.querySelector('.banner-info');
        if (infoElement) {
          const titleDiv = document.createElement('div');
          titleDiv.className = 'banner-title';
          const displayText = newTitle.startsWith('t:') 
            ? i18n.t(newTitle.slice(2)) 
            : newTitle;
          titleDiv.textContent = displayText;
          infoElement.insertBefore(titleDiv, infoElement.firstChild);
        }
      }
    }
  }

  /**
   * Update banner label/text
   * Supports both plain text and i18n keys (prefixed with 't:')
   * @param {string} newLabel - New label text or i18n key (e.g., "t:banners.maintenance.next")
   * @param {Object} params - Optional parameters for i18n interpolation (e.g., {hours: 340})
   */
  updateLabel(newLabel, params = {}) {
    this.label = newLabel;
    this._labelKey = newLabel; // Store key for i18n updates
    this._labelParams = params; // Store params for re-translation
    
    if (this.element) {
      const labelElement = this.element.querySelector('.banner-text');
      if (labelElement) {
        // Check if it's an i18n key (starts with 't:')
        let displayText;
        if (newLabel.startsWith('t:')) {
          // Extract key and translate with params
          const key = newLabel.slice(2);
          displayText = i18n.t(key, params);
        } else {
          // Plain text, just use it
          displayText = newLabel;
        }
        labelElement.textContent = displayText;
      }
    }
  }

  /**
   * Toggle banner visibility
   */
  toggle() {
    if (this.isVisible) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Check if banner can be shown (not user dismissed)
   * @returns {boolean} True if can be shown
   */
  canShow() {
    return !this.isUserDismissed;
  }

  /**
   * Reset user dismissal state
   * Useful for maintenance banners or when conditions change
   */
  resetDismissal() {
    this.isUserDismissed = false;
    log.debug('Banner', `Reset dismissal state: ${this.title || this.label}`);
  }
}

export default Banner;
