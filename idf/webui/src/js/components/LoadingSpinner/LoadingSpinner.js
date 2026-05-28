// LoadingSpinner.js
import { Component } from "../../core/Component.js";
import { i18n } from "../../utils/i18n.js";
import { log } from "../../utils/logger.js";

/**
 * Componente LoadingSpinner
 * Overlay fullscreen con spinner e messaggio di caricamento
 */
class LoadingSpinner extends Component {
  constructor(message = null) {
    super();
    this.message = message;
    this.unsubLang = null;
  }

  /**
   * Render del componente
   * @returns {string} HTML del loading spinner
   */
  render() {
    const message = this.message || i18n.t('messages.loadingConfig');
    
    return `
      <div class="loading-overlay">
        <div class="loading-spinner">
          <div class="spinner-circle"></div>
          <p class="loading-message">${message}</p>
        </div>
      </div>
    `;
  }

  /**
   * Binding eventi (nessun evento per lo spinner)
   */
  bindEvents() {
    // Nessun evento da bindare
  }

  /**
   * Attivazione componente
   */
  activate() {
    log.debug('LoadingSpinner activated');
    
    // Sottoscrizione cambio lingua per aggiornare messaggio
    this.unsubLang = i18n.onLanguageChange(() => {
      this.updateMessage();
    });
  }

  /**
   * Aggiorna il messaggio tradotto
   */
  updateMessage() {
    if (!this.el) return;
    
    const messageEl = this.el.querySelector('.loading-message');
    if (messageEl) {
      const newMessage = this.message || i18n.t('messages.loadingConfig');
      messageEl.textContent = newMessage;
    }
  }

  /**
   * Imposta un nuovo messaggio
   * @param {string} message - Nuovo messaggio da mostrare
   */
  setMessage(message) {
    this.message = message;
    this.updateMessage();
  }

  /**
   * Mostra lo spinner
   */
  show() {
    if (this.el) {
      this.el.classList.add('active');
    }
  }

  /**
   * Nasconde lo spinner
   */
  hide() {
    if (this.el) {
      this.el.classList.remove('active');
    }
  }

  /**
   * Cleanup quando il componente viene distrutto
   */
  destroy() {
    // Unsubscribe dal cambio lingua
    if (this.unsubLang) {
      this.unsubLang();
      this.unsubLang = null;
    }
    
    super.destroy();
  }
}

export default LoadingSpinner;
