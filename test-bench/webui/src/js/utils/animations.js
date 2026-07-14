/**
 * animations.js
 * 
 * Utility per gestire animazioni di sidebar e modal.
 * Aggiunge/rimuove classi .active per animazioni CSS.
 */

// ============================================
// SIDEBAR ANIMATIONS
// ============================================

/**
 * Mostra la sidebar con animazione slide-in da destra
 */
export function showSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  
  if (!sidebar || !overlay) {
    console.warn('⚠️ Sidebar o overlay non trovati nel DOM');
    return;
  }
  
  overlay.classList.add('active');
  sidebar.classList.add('active');
}

/**
 * Nasconde la sidebar con animazione slide-out verso destra
 */
export function hideSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  
  if (!sidebar || !overlay) {
    console.warn('⚠️ Sidebar o overlay non trovati nel DOM');
    return;
  }
  
  overlay.classList.remove('active');
  sidebar.classList.remove('active');
}

/**
 * Toggle sidebar (apre se chiusa, chiude se aperta)
 */
export function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  
  if (!sidebar) {
    console.warn('⚠️ Sidebar non trovata nel DOM');
    return;
  }
  
  if (sidebar.classList.contains('active')) {
    hideSidebar();
  } else {
    showSidebar();
  }
}

// ============================================
// MODAL ANIMATIONS
// ============================================

/**
 * Mostra il modal con animazione fade-in + scale
 */
export function showModal() {
  const modal = document.getElementById('modal-backdrop');
  
  if (!modal) {
    console.warn('⚠️ Modal backdrop non trovato nel DOM');
    return;
  }
  
  modal.classList.add('active');
}

/**
 * Nasconde il modal con animazione fade-out + scale
 */
export function hideModal() {
  const modal = document.getElementById('modal-backdrop');
  
  if (!modal) {
    console.warn('⚠️ Modal backdrop non trovato nel DOM');
    return;
  }
  
  modal.classList.remove('active');
}

/**
 * Toggle modal (apre se chiuso, chiude se aperto)
 */
export function toggleModal() {
  const modal = document.getElementById('modal-backdrop');
  
  if (!modal) {
    console.warn('⚠️ Modal backdrop non trovato nel DOM');
    return;
  }
  
  if (modal.classList.contains('active')) {
    hideModal();
  } else {
    showModal();
  }
}

// ============================================
// SETUP EVENT LISTENERS (temporanei)
// ============================================

/**
 * Inizializza event listeners temporanei per testare le animazioni.
 * NOTA: Sidebar e Modal sono ora gestiti dai rispettivi Manager.
 * Questa funzione rimane solo per compatibilità, ma i listener sono duplicati.
 */
export function setupTemporaryListeners() {
}
