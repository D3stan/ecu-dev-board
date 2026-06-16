/**
 * theme.js
 * 
 * Gestione tema dark/light mode con persistenza localStorage.
 */

const THEME_KEY = 'fogextra-theme';
const THEME_LIGHT = 'light';
const THEME_DARK = 'dark';

/**
 * Ottiene il tema corrente dall'attributo data-theme dell'HTML
 * @returns {string} 'light' o 'dark'
 */
export function getCurrentTheme() {
  const html = document.documentElement;
  return html.getAttribute('data-theme') || THEME_LIGHT;
}

/**
 * Applica un tema specifico
 * @param {string} theme - 'light' o 'dark'
 */
export function applyTheme(theme) {
  const html = document.documentElement;
  const themeIcon = document.getElementById('theme-icon');
  
  if (theme !== THEME_LIGHT && theme !== THEME_DARK) {
    console.warn(`⚠️ Tema non valido: ${theme}. Uso default 'light'.`);
    theme = THEME_LIGHT;
  }
  
  html.setAttribute('data-theme', theme);
  
  // Aggiorna icona se presente
  if (themeIcon) {
    themeIcon.src = theme === THEME_LIGHT 
      ? './assets/icons/icon-sun.png' 
      : './assets/icons/icon-moon.png';
  }
  
}

/**
 * Salva il tema in localStorage
 * @param {string} theme - 'light' o 'dark'
 */
export function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (e) {
    console.warn('⚠️ Impossibile salvare tema in localStorage:', e);
  }
}

/**
 * Carica il tema salvato da localStorage (o usa system preference)
 * @returns {string} Il tema caricato
 */
export function loadTheme() {
  try {
    // 1. Prova a caricare da localStorage
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === THEME_LIGHT || savedTheme === THEME_DARK) {
      return savedTheme;
    }
    
    // 2. Fallback: rileva preferenza di sistema
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return THEME_DARK;
    }
    
    // 3. Default: light theme
    return THEME_LIGHT;
    
  } catch (e) {
    console.warn('⚠️ Errore nel caricamento tema:', e);
    return THEME_LIGHT;
  }
}

/**
 * Toggle tra light e dark theme
 */
export function toggleTheme() {
  const currentTheme = getCurrentTheme();
  const newTheme = currentTheme === THEME_LIGHT ? THEME_DARK : THEME_LIGHT;
  
  applyTheme(newTheme);
  saveTheme(newTheme);
  
  return newTheme;
}

/**
 * Inizializza il tema: carica da storage e applica
 */
export function initTheme() {
  const theme = loadTheme();
  applyTheme(theme);
  
  return theme;
}

/**
 * Setup event listener per il bottone theme toggle (temporaneo)
 */
export function setupThemeToggleListener() {
  const themeToggle = document.getElementById('theme-toggle');
  
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  } else {
    console.warn('⚠️ Bottone theme-toggle non trovato nel DOM');
  }
}

/**
 * Ascolta le modifiche alla preferenza di sistema (opzionale)
 */
export function watchSystemThemeChanges() {
  if (!window.matchMedia) return;
  
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  
  mediaQuery.addEventListener('change', (e) => {
    // Solo se l'utente non ha una preferenza salvata
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (!savedTheme) {
      const newTheme = e.matches ? THEME_DARK : THEME_LIGHT;
      applyTheme(newTheme);
    }
  });
}
