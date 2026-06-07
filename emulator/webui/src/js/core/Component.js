/**
 * Component.js
 * ============
 * Base class for all UI components in the FogExtra application.
 * 
 * Provides:
 * - Component lifecycle management (create → mount → activate → deactivate → destroy)
 * - Reactive data binding with Store
 * - DOM element management
 * - Event listener cleanup
 * - Child component orchestration
 * - Internationalization (i18n) support with automatic translation updates
 * 
 * Lifecycle Phases:
 * 1. create()      - Component is instantiated, initial setup
 * 2. mount()       - Component is attached to DOM
 * 3. activate()    - Component becomes active/visible
 * 4. deactivate()  - Component becomes inactive/hidden
 * 5. destroy()     - Component is removed, cleanup
 * 
 * @author FogExtra Team
 * @version 2.0.0
 */

import { Store } from './store.js';
import { i18n } from '../utils/i18n.js';
import { ImageManager } from '../managers/ImageManager.js';
import { log } from '../utils/logger.js';

export class Component {
  /**
   * Create a new Component instance.
   * 
   * @param {Object} options - Component configuration
   * @param {string|HTMLElement} options.el - DOM element or selector for component root
   * @param {string} options.id - Unique component identifier
   * @param {Object} options.props - Initial properties passed to component
   * @param {Component} options.parent - Parent component reference
   * @param {Object} options.bindings - Store path bindings for reactive data
   */
  constructor(options = {}) {
    // Save options reference for subclass hooks to access during construction
    this._options = options;
    
    // Component identity
    this.id = options.id || `component-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.type = this.constructor.name;
    
    // DOM reference
    this.el = typeof options.el === 'string' 
      ? document.querySelector(options.el) 
      : options.el || null;
    
    // Component state
    this.state = {
      mounted: false,
      active: false,
      destroyed: false
    };
    
    // Component phase tracking (for debugging and lifecycle control)
    // Phases: created → rendered → bound → active → destroyed
    this.phase = 'created';
    
    // Component hierarchy
    this.parent = options.parent || null;
    this.children = [];
    
    // Initial props (immutable data from parent)
    this.props = options.props || {};
    
    // Local reactive data (component-specific)
    this.data = {};
    
    // Store bindings for reactive updates
    this.bindings = options.bindings || {};
    this._storeUnsubscribers = [];
    
    // Manual Store subscriptions (via subscribeToStore helper)
    this._manualStoreSubscriptions = [];
    
    // Event listener tracking (for cleanup)
    this._listeners = [];
    
    // Child component tracking
    this._childComponents = new Map();
    
    // Internationalization (i18n) support
    this._i18nUnsubscribe = null;
    this._i18nEnabled = false;
    this._i18nUpdateCallback = null;
    
    // Asset Management (Phase 2 Bridge)
    this._assetNodesMap = new Map();
    this._assetSubscriptions = new Map();
    
    // Call user-defined onCreate hook
    this.onCreate();
  }

  // ============================================
  // LIFECYCLE HOOKS (Override in subclasses)
  // ============================================

  /**
   * Called when component is instantiated.
   * Override to perform initial setup, data initialization.
   */
  onCreate() {
    // Override in subclass
  }

  /**
   * Called when component is attached to DOM.
   * Override to setup DOM, register events, subscribe to Store.
   */
  onMount() {
    // Override in subclass
  }

  /**
   * Called when component becomes active/visible.
   * Override to start animations, fetch data, etc.
   */
  onActivate() {
    // Override in subclass
  }

  /**
   * Called when component becomes inactive/hidden.
   * Override to pause animations, save state, etc.
   */
  onDeactivate() {
    // Override in subclass
  }

  /**
   * Called before component is destroyed.
   * Override to perform cleanup, save data, etc.
   */
  onDestroy() {
    // Override in subclass
  }

  // ============================================
  // PROPERTIES (Getters/Setters)
  // ============================================

  /**
   * Get the root DOM element of the component.
   * This provides a consistent API for accessing the component's element.
   * 
   * @returns {HTMLElement|null} The component's root element
   */
  get element() {
    return this.el;
  }

  // ============================================
  // LIFECYCLE MANAGEMENT (Core framework)
  // ============================================

  /**
   * Mount component to DOM.
   * Creates DOM structure, attaches to parent, sets up bindings.
   * 
   * @param {HTMLElement} container - Parent DOM element
   * @returns {Component} this (chainable)
   */
  mount(container) {
    if (this.state.mounted) {
      console.warn(`[Component] ${this.id} is already mounted`);
      return this;
    }

    if (this.state.destroyed) {
      console.error(`[Component] Cannot mount destroyed component ${this.id}`);
      return this;
    }

    // If no element exists, render it
    if (!this.el) {
      const rendered = this.render();
      if (rendered) {
        if (typeof rendered === 'string') {
          const temp = document.createElement('div');
          temp.innerHTML = rendered.trim();
          this.el = temp.firstElementChild;
        } else if (rendered instanceof HTMLElement) {
          this.el = rendered;
        }
        // Update phase after rendering
        this.phase = 'rendered';
      }
    }

    // Attach to container if provided
    if (container && this.el) {
      container.appendChild(this.el);
    }

    // NOTE: Store bindings are NOT setup here anymore
    // They will be setup in activate() when the component becomes active

    // Mark as mounted
    this.state.mounted = true;

    // Call user hook
    this.onMount();

    // Setup i18n binding if enabled
    this._setupI18nBinding();

    // Mount all child components
    this.children.forEach(child => {
      if (!child.state.mounted) {
        child.mount(this.el);
      }
    });

    return this;
  }

  /**
   * Bind DOM event listeners to component elements.
   * Call this after mount() to attach all event handlers.
   * Override in subclass to register custom event listeners.
   * 
   * @returns {Component} this (chainable)
   */
  bindEvents() {
    if (this.phase === 'bound' || this.phase === 'active') {
      console.warn(`[Component] ${this.id} events already bound (phase: ${this.phase})`);
      return this;
    }

    if (this.phase !== 'rendered') {
      console.warn(`[Component] ${this.id} must be rendered before binding events (current phase: ${this.phase})`);
      return this;
    }

    // Update phase
    this.phase = 'bound';

    // Call user hook for custom event binding
    this.onBindEvents();

    // Bind events for all child components
    this.children.forEach(child => {
      if (child.phase === 'rendered') {
        child.bindEvents();
      }
    });

    return this;
  }

  /**
   * User hook for binding custom event listeners.
   * Override in subclass to register addEventListener calls.
   * Called automatically by bindEvents().
   */
  onBindEvents() {
    // Override in subclass
  }

  /**
   * Activate component (make visible/interactive).
   * Sets up Store bindings and calls update() for initial sync.
   * 
   * @returns {Component} this (chainable)
   */
  activate(...args) {
    if (!this.state.mounted) {
      console.warn(`[Component] Cannot activate unmounted component ${this.id}`);
      return this;
    }

    if (this.state.active) {
      return this; // Already active
    }

    // Setup Store bindings (subscribe to reactive data)
    this._setupBindings();

    // Force initial update to sync with Store
    this.update();

    this.state.active = true;
    this.phase = 'active';

    // Show element
    if (this.el) {
      this.el.classList.add('active');
      this.el.classList.remove('inactive');
    }

    // Call user hook FIRST so that any DOM modifications are complete
    this.onActivate(...args);

    // Phase 2: Asset Bridge binding for deferred images (captures finalized DOM)
    this.bindDeferredImages(this.el);

    // Activate all child components
    this.children.forEach(child => {
      if (child.state.mounted && !child.state.active) {
        child.activate();
      }
    });

    return this;
  }

  /**
   * Deactivate component (hide/make non-interactive).
   * Unsubscribes from Store bindings but keeps event listeners active.
   * 
   * @returns {Component} this (chainable)
   */
  deactivate() {
    if (!this.state.active) {
      return this; // Already inactive
    }

    // Teardown Store bindings (unsubscribe)
    this._teardownBindings();

    // Phase 2: Unsubscribe from image manager without destroying the tree
    this.unbindDeferredImages();

    this.state.active = false;
    this.phase = 'bound'; // Back to bound state

    // Hide element
    if (this.el) {
      this.el.classList.remove('active');
      this.el.classList.add('inactive');
    }

    // Call user hook
    this.onDeactivate();

    // Deactivate all child components
    this.children.forEach(child => {
      if (child.state.active) {
        child.deactivate();
      }
    });

    return this;
  }

  /**
   * Destroy component and cleanup resources.
   * Removes from DOM, unsubscribes from Store, removes event listeners.
   * 
   * @returns {void}
   */
  destroy() {
    if (this.state.destroyed) {
      console.warn(`[Component] ${this.id} is already destroyed`);
      return;
    }

    // Call user hook BEFORE cleanup
    this.onDestroy();

    // Phase 2: Complete cleanup of deferred images and local structural state
    this.unbindDeferredImages();
    if (this._assetNodesMap) {
      this._assetNodesMap.clear();
    }

    // Destroy all child components first
    this.children.forEach(child => child.destroy());
    this.children = [];
    this._childComponents.clear();

    // Cleanup Store subscriptions
    this._teardownBindings();

    // Cleanup manual Store subscriptions
    this._teardownManualStoreSubscriptions();

    // Cleanup i18n subscription
    this._teardownI18nBinding();

    // Cleanup event listeners
    this._listeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this._listeners = [];

    // Remove from DOM
    if (this.el && this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }

    // Mark as destroyed
    this.state.destroyed = true;
    this.state.mounted = false;
    this.state.active = false;
    this.phase = 'destroyed';
    this.el = null;
  }

  // ============================================
  // RENDERING
  // ============================================

  /**
   * Render component HTML.
   * Override in subclass to return HTML string or HTMLElement.
   * 
   * @returns {string|HTMLElement|null} Component HTML
   */
  render() {
    // Override in subclass
    return null;
  }

  /**
   * Update component display based on current state.
   * Override in subclass to implement reactive updates.
   */
  update() {
    // Override in subclass
  }

  // ============================================
  // REACTIVE DATA BINDING
  // ============================================

  /**
   * Setup Store bindings for reactive data.
   * Subscribe to Store paths and update component when data changes.
   * 
   * @private
   */
  _setupBindings() {
    if (!this.bindings || Object.keys(this.bindings).length === 0) {
      return;
    }

    Object.entries(this.bindings).forEach(([localKey, storePath]) => {
      // Initial value
      this.data[localKey] = Store.get(storePath);

      // Subscribe to changes
      const unsubscribe = Store.subscribe(storePath, (newValue) => {
        const oldValue = this.data[localKey];
        this.data[localKey] = newValue;
        
        // Call user-defined data change handler if exists
        if (typeof this.onDataChange === 'function') {
          this.onDataChange(localKey, newValue, oldValue);
        }

        // Trigger update
        if (this.state.mounted) {
          this.update();
        }
      });

      this._storeUnsubscribers.push(unsubscribe);
    });
  }

  /**
   * Teardown Store bindings (unsubscribe from all Store subscriptions).
   * Called when component is deactivated.
   * 
   * @private
   */
  _teardownBindings() {
    // Unsubscribe from all Store subscriptions
    this._storeUnsubscribers.forEach(unsubscribe => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    });
    
    // Clear the array
    this._storeUnsubscribers = [];
  }

  /**
   * Get reactive data value.
   * 
   * @param {string} key - Data key
   * @returns {*} Data value
   */
  getData(key) {
    return this.data[key];
  }

  /**
   * Set local data value (does NOT update Store).
   * Use Store.set() to update shared state.
   * 
   * @param {string} key - Data key
   * @param {*} value - New value
   */
  setData(key, value) {
    const oldValue = this.data[key];
    this.data[key] = value;

    if (typeof this.onDataChange === 'function') {
      this.onDataChange(key, value, oldValue);
    }

    if (this.state.mounted) {
      this.update();
    }
  }

  // ============================================
  // INTERNATIONALIZATION (i18n) SUPPORT
  // ============================================

  /**
   * Enable automatic translation updates when language changes.
   * Call this method in onCreate() or constructor of subclass.
   * 
   * Example:
   * ```javascript
   * constructor() {
   *   super();
   *   this.enableI18n(() => this._updateLabels());
   * }
   * ```
   * 
   * @param {Function} updateCallback - Function to call when language changes
   */
  enableI18n(updateCallback) {
    if (typeof updateCallback !== 'function') {
      console.warn(`[Component] enableI18n: updateCallback must be a function`);
      return;
    }

    this._i18nEnabled = true;
    this._i18nUpdateCallback = updateCallback;

    // If component is already mounted, setup binding immediately
    if (this.state.mounted && !this._i18nUnsubscribe) {
      this._setupI18nBinding();
    }
  }

  /**
   * Setup i18n subscription when component is mounted.
   * Automatically called by mount() if i18n is enabled.
   * 
   * @private
   */
  _setupI18nBinding() {
    if (!this._i18nEnabled || this._i18nUnsubscribe) {
      return; // Not enabled or already subscribed
    }

    this._i18nUnsubscribe = i18n.onLanguageChange((newLangIndex) => {
      if (typeof this._i18nUpdateCallback === 'function') {
        try {
          this._i18nUpdateCallback(newLangIndex);
        } catch (error) {
          console.error(`[Component] Error in i18n update callback for ${this.type}:`, error);
        }
      }
    });
  }

  /**
   * Teardown i18n subscription (unsubscribe from language changes).
   * Automatically called by destroy().
   * 
   * @private
   */
  _teardownI18nBinding() {
    if (this._i18nUnsubscribe) {
      this._i18nUnsubscribe();
      this._i18nUnsubscribe = null;
    }
  }

  // ============================================
  // STORE SUBSCRIPTION HELPER
  // ============================================

  /**
   * Subscribe to Store path with automatic cleanup on destroy.
   * Use this instead of manual Store.subscribe() for automatic unsubscribe.
   * 
   * Example:
   * ```javascript
   * onMount() {
   *   this.subscribeToStore(Paths.CONFIG.MENU, (menu) => {
   *     this._updateMenu(menu);
   *   });
   * }
   * ```
   * 
   * @param {string} storePath - Store path to subscribe to
   * @param {Function} callback - Callback when value changes
   * @returns {Function} Unsubscribe function (optional, cleanup is automatic)
   */
  subscribeToStore(storePath, callback) {
    if (!storePath || typeof callback !== 'function') {
      console.warn(`[Component] subscribeToStore: Invalid arguments`);
      return () => {};
    }

    // Subscribe to Store
    const unsubscribe = Store.subscribe(storePath, callback);

    // Track for automatic cleanup
    this._manualStoreSubscriptions.push(unsubscribe);

    // Return unsubscribe function (optional for manual cleanup)
    return unsubscribe;
  }

  /**
   * Cleanup all manual Store subscriptions.
   * Automatically called by destroy().
   * 
   * @private
   */
  _teardownManualStoreSubscriptions() {
    this._manualStoreSubscriptions.forEach(unsubscribe => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    });
    this._manualStoreSubscriptions = [];
  }

  // ============================================
  // EVENT MANAGEMENT
  // ============================================

  /**
   * Add event listener with automatic cleanup.
   * 
   * @param {HTMLElement} element - Target element
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   * @param {Object} options - Event listener options
   */
  addEventListener(element, event, handler, options = {}) {
    if (!element || !event || !handler) {
      console.warn('[Component] addEventListener: Invalid arguments');
      return;
    }

    element.addEventListener(event, handler, options);
    this._listeners.push({ element, event, handler, options });
  }

  /**
   * Remove event listener.
   * 
   * @param {HTMLElement} element - Target element
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  removeEventListener(element, event, handler) {
    if (!element || !event || !handler) {
      return;
    }

    element.removeEventListener(event, handler);
    
    const index = this._listeners.findIndex(
      l => l.element === element && l.event === event && l.handler === handler
    );
    
    if (index !== -1) {
      this._listeners.splice(index, 1);
    }
  }

  // ============================================
  // CHILD COMPONENT MANAGEMENT
  // ============================================

  /**
   * Add child component.
   * 
   * @param {Component} component - Child component instance
   * @returns {Component} this (chainable)
   */
  addChild(component) {
    if (!(component instanceof Component)) {
      console.error('[Component] addChild: Invalid component instance');
      return this;
    }

    if (this.children.includes(component)) {
      console.warn(`[Component] Child ${component.id} already exists`);
      return this;
    }

    component.parent = this;
    this.children.push(component);
    this._childComponents.set(component.id, component);

    // If parent is already mounted, mount child automatically
    if (this.state.mounted && !component.state.mounted) {
      component.mount(this.el);
    }

    // If parent is active, activate child automatically
    if (this.state.active && !component.state.active) {
      component.activate();
    }

    return this;
  }

  /**
   * Remove child component.
   * 
   * @param {Component|string} componentOrId - Child component or ID
   * @returns {Component} this (chainable)
   */
  removeChild(componentOrId) {
    const component = componentOrId instanceof Component
      ? componentOrId
      : this._childComponents.get(componentOrId);

    if (!component) {
      console.warn('[Component] removeChild: Component not found');
      return this;
    }

    // Destroy child
    component.destroy();

    // Remove from collections
    const index = this.children.indexOf(component);
    if (index !== -1) {
      this.children.splice(index, 1);
    }
    this._childComponents.delete(component.id);

    return this;
  }

  /**
   * Get child component by ID.
   * 
   * @param {string} id - Child component ID
   * @returns {Component|undefined} Child component
   */
  getChild(id) {
    return this._childComponents.get(id);
  }

  /**
   * Find child component(s) by type.
   * 
   * @param {string} type - Component type (class name)
   * @returns {Component[]} Array of matching components
   */
  findChildrenByType(type) {
    return this.children.filter(child => child.type === type);
  }

  // ============================================
  // ASSET MANAGEMENT (Phase 2 Bridge)
  // ============================================

  /**
   * Initializes and binds deferred images in the component's subtree.
   * Rebuilds the asset map from scratch to avoid stale DOM references.
   * 
   * @param {HTMLElement} root - The root element to scan (defaults to this.el)
   */
  bindDeferredImages(root = this.el) {
    if (!root) return;

    // 1. Rebuild map from scratch to avoid stale DOM references
    if (!this._assetNodesMap) this._assetNodesMap = new Map();
    if (!this._assetSubscriptions) this._assetSubscriptions = new Map();
    
    this._assetNodesMap.clear();

    // 2. Discover nodes (root itself and its descendants)
    const nodes = [];
    if (root.matches && root.matches('[data-asset-key]')) {
      nodes.push(root);
    }
    // Create a Set of child component roots to avoid binding their assets
    const childRoots = new Set(this.children.map(c => c.el).filter(Boolean));

    if (root.querySelectorAll) {
      const descendants = root.querySelectorAll('[data-asset-key]');
      descendants.forEach(n => {
        // Skip if the node itself is the root of a child component
        if (childRoots.has(n)) return;
        
        // Skip if the node is inside a child component's subtree
        let belongsToChild = false;
        let curr = n.parentElement;
        while (curr && curr !== root && curr !== document.body) {
          if (childRoots.has(curr)) {
            belongsToChild = true;
            break;
          }
          curr = curr.parentElement;
        }
        
        if (!belongsToChild) {
          nodes.push(n);
        }
      });
    }

    // 3. Group nodes by assetKey
    nodes.forEach(node => {
      const assetKey = node.getAttribute('data-asset-key');
      if (!assetKey) return;
      
      if (!this._assetNodesMap.has(assetKey)) {
        this._assetNodesMap.set(assetKey, new Set());
      }
      this._assetNodesMap.get(assetKey).add(node);
    });

    // 3.5 Cleanup stale subscriptions (assets no longer in DOM after refresh/re-render)
    if (this._assetSubscriptions) {
      for (const [subscribedKey, subscriberId] of this._assetSubscriptions.entries()) {
        if (!this._assetNodesMap.has(subscribedKey)) {
          ImageManager.unsubscribe(subscribedKey, subscriberId);
          this._assetSubscriptions.delete(subscribedKey);
        }
      }
    }

    // 4. Subscribe for each DISTINCT assetKey
    this._assetNodesMap.forEach((nodeSet, assetKey) => {
      // Avoid duplicate subscriptions for the same assetKey in this component
      if (!this._assetSubscriptions.has(assetKey)) {
        const subscriberId = `${this.id}::${assetKey}`;
        
        // Request the asset from Manager
        const result = ImageManager.requestAsset(assetKey, {
          id: subscriberId,
          // Use real lifecycle flags already present in Component
          isValid: () => this.state && this.state.active && !this.state.destroyed,
          onAssetReady: (resource) => {
            this._applyAssetToNodes(assetKey, resource);
          }
        });

        // Track the subscription locally if the manager successfully queues or serves it
        if (result && result.subscribed) {
          this._assetSubscriptions.set(assetKey, subscriberId);
        }

        // Apply immediate result (either LOADED resource or fallback)
        if (result && (result.resource || result.fallback)) {
          this._applyAssetToNodes(assetKey, result.resource || result.fallback);
        }
      } else {
        // Optimization for re-renders with existing active subscriptions.
        // We just re-apply the already loaded asset to the newly built node list.
        const loadedAsset = ImageManager.getLoadedAsset ? ImageManager.getLoadedAsset(assetKey) : null;
        if (loadedAsset) {
          this._applyAssetToNodes(assetKey, loadedAsset);
        }
      }
    });
  }

  /**
   * Unbinds all deferred images and cleans up subscriptions for this component.
   */
  unbindDeferredImages() {
    if (!this._assetSubscriptions) return;
    
    this._assetSubscriptions.forEach((subscriberId, assetKey) => {
      ImageManager.unsubscribe(assetKey, subscriberId);
    });
    this._assetSubscriptions.clear();

    // Clean up node references to prevent stale memory when off-screen
    if (this._assetNodesMap) {
      this._assetNodesMap.clear();
    }
  }

  /**
   * Force full refresh of deferred images (e.g. after newly injected DOM nodes).
   * Always rescans the entire component to ensure local state consistency.
   */
  refreshDeferredImages() {
    // Rescan completely from component root to ensure state consistency
    this.bindDeferredImages(this.el);
  }

  /**
   * Safely applies the given resource URL to all valid nodes for a specific asset.
   * PHASE 2 SCOPE: Support only <img> nodes to keep a clean, predictable boundary.
   * 
   * @param {string} assetKey - The key of the asset to apply
   * @param {string} resource - The resolved URL of the asset or fallback
   * @private
   */
  _applyAssetToNodes(assetKey, resource) {
    if (!resource || !this._assetNodesMap) return;
    
    // 1. Get the current Set of nodes
    const nodeSet = this._assetNodesMap.get(assetKey);
    if (!nodeSet) return;

    // 2. Track invalid nodes before removal to avoid iteration manipulation
    const invalidNodes = [];

    // 3. Iterate and apply
    nodeSet.forEach(node => {
      // Robust connection check instead of document.body.contains
      if (node && node.isConnected) {
        // Strictly support only <img> nodes
        if (node.tagName && node.tagName.toUpperCase() === 'IMG') {
          node.src = resource;
        }
      } else {
        invalidNodes.push(node);
      }
    });

    // 4. Safely remove invalid nodes after loop
    invalidNodes.forEach(node => nodeSet.delete(node));
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Query selector within component element.
   * 
   * @param {string} selector - CSS selector
   * @returns {HTMLElement|null} Found element
   */
  $(selector) {
    return this.el ? this.el.querySelector(selector) : null;
  }

  /**
   * Query selector all within component element.
   * 
   * @param {string} selector - CSS selector
   * @returns {NodeList} Found elements
   */
  $$(selector) {
    return this.el ? this.el.querySelectorAll(selector) : [];
  }

  /**
   * Get component info for debugging.
   * 
   * @returns {Object} Component info
   */
  getInfo() {
    return {
      id: this.id,
      type: this.type,
      state: { ...this.state },
      children: this.children.length,
      props: this.props,
      data: this.data
    };
  }

  /**
   * Log component info to console.
   */
  log() {
    log.warn(`[Component:${this.type}]`, this.getInfo());
  }
}
