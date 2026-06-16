/**
 * Banner Component Utility Functions
 */

let uniqueIdCounter = 0;

/**
 * Map banner type to CSS class
 * @param {string} type - Banner type (info, warning, error, success)
 * @returns {string} CSS class name
 */
export function mapTypeToClass(type) {
  const typeClassMap = {
    info: 'banner-info',
    warning: 'banner-warning', 
    error: 'banner-error',
    success: 'banner-success'
  };
  
  return typeClassMap[type] || 'banner-info';
}

/**
 * Generate a unique ID for banner elements
 * @param {string} prefix - Prefix for the ID
 * @returns {string} Unique ID
 */
export function generateUniqueId(prefix = 'banner') {
  uniqueIdCounter++;
  return `${prefix}-${Date.now()}-${uniqueIdCounter}`;
}

/**
 * Escape HTML to prevent XSS attacks in banner text
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Validate listBindings array structure
 * @param {Array} bindings - Array of binding objects
 * @returns {boolean} True if valid
 */
export function validateBindings(bindings) {
  if (!Array.isArray(bindings)) {
    console.warn('[Banner] listBindings must be an array');
    return false;
  }
  
  return bindings.every((binding, index) => {
    if (!binding.path || typeof binding.path !== 'string') {
      console.warn(`[Banner] Binding at index ${index} missing valid 'path' property`);
      return false;
    }
    
    if (!binding.cb || typeof binding.cb !== 'function') {
      console.warn(`[Banner] Binding at index ${index} missing valid 'cb' function`);
      return false;
    }
    
    return true;
  });
}

/**
 * Create a banner instance from Store data
 * Useful for creating banners dynamically from app state
 * 
 * @param {Object} config - Banner configuration from Store
 * @param {string} config.text - Banner text
 * @param {boolean} [config.closable=true] - Whether closable
 * @param {string} [config.type] - Banner type (info, warning, error, success)
 * @returns {Object} Banner options object
 */
export function createBannerFromConfig(config) {
  const options = {
    text: config.text || "",
    closable: config.closable !== undefined ? config.closable : true,
    cssClasses: ""
  };
  
  // Map type to CSS class
  if (config.type) {
    const typeClassMap = {
      info: 'alert-banner-info',
      warning: 'alert-banner-warning',
      error: 'alert-banner-error',
      success: 'alert-banner-success'
    };
    
    options.cssClasses = typeClassMap[config.type] || '';
  }
  
  return options;
}

/**
 * Format banner text with dynamic values
 * Replace placeholders like {{value}} with actual values
 * 
 * @param {string} template - Text template with placeholders
 * @param {Object} values - Key-value pairs for replacement
 * @returns {string} Formatted text
 * 
 * @example
 * formatBannerText("Alert: {{sensor}} is {{status}}", {
 *   sensor: "Temperature",
 *   status: "high"
 * });
 * // Returns: "Alert: Temperature is high"
 */
export function formatBannerText(template, values) {
  if (!template || typeof template !== 'string') {
    return '';
  }
  
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return values[key] !== undefined ? values[key] : match;
  });
}
