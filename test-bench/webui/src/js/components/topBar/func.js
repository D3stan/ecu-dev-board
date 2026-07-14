/**
 * TopBar Business Logic
 * ======================
 * Funzioni di business logic separate dal componente TopBar.
 * Gestiscono tema, localStorage e manipolazione icone.
 * 
 * @module TopBar/func
 */

// ============================================
// THEME MANAGEMENT
// ============================================

/**
 * Get theme from localStorage.
 * @returns {string} 'light' or 'dark' (default: 'light')
 */
export function getThemeFromStorage() {
  const theme = localStorage.getItem('theme');
  const result = theme || 'light';
  return result;
}

/**
 * Save theme to localStorage.
 * @param {string} theme - 'light' or 'dark'
 */
export function saveThemeToStorage(theme) {
  localStorage.setItem('theme', theme);
}

/**
 * Apply theme to document root.
 * @param {string} theme - 'light' or 'dark'
 */
export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

/**
 * Toggle theme (light ↔ dark).
 * @param {string} currentTheme - Current theme
 * @returns {string} New theme after toggle
 */
export function toggleTheme(currentTheme) {
  return currentTheme === 'light' ? 'dark' : 'light';
}

// ============================================
// ICON MANAGEMENT
// ============================================

/**
 * Update theme icon visibility based on current theme.
 * In light mode: show sun icon
 * In dark mode: show moon icon
 * 
 * @param {HTMLElement} container - Container element with theme icons
 * @param {string} theme - Current theme ('light' or 'dark')
 */
export function updateThemeIcon(container, theme) {
  if (!container) {
    console.warn('[func.updateThemeIcon] Container is null!');
    return;
  }

  const lightIcon = container.querySelector('.theme-icon-light');
  const darkIcon = container.querySelector('.theme-icon-dark');

  if (!lightIcon || !darkIcon) {
    console.warn('[TopBar/func] Theme icons not found');
    return;
  }

  if (theme === 'light') {
    // Show sun icon in light mode
    lightIcon.style.display = 'block';
    darkIcon.style.display = 'none';
  } else {
    // Show moon icon in dark mode
    lightIcon.style.display = 'none';
    darkIcon.style.display = 'block';
  }
}

// ============================================
// TIME FORMATTING
// ============================================

/**
 * Format time display.
 * Returns the time as-is or '--:--' if empty.
 * 
 * @param {string} time - Time string (HH:MM format expected)
 * @returns {string} Formatted time
 */
export function formatTime(time) {
  return time || '--:--';
}
