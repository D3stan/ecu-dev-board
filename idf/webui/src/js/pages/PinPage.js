/**
 * PinPage.js
 * ===========
 * Full-screen PIN entry page for device authentication.
 *
 * Features:
 * - Dynamic digit count (derived from param 41 maxValue via authGuard)
 * - Numeric keypad (0-9, Cancel, Backspace)
 * - Visual dot indicators for entered digits
 * - Auto-submit when all digits entered
 * - Shake animation + error message on wrong PIN
 * - No back button, no hamburger — user cannot leave without correct PIN
 *
 * @author FogExtra Team
 * @version 1.0.0
 */

import { Page } from '../core/Page.js';
import { Store } from '../core/store.js';
import { Paths } from '../utils/paths.js';
import { verifyPin, getPinDigitCount, getReturnPageAfterUnlock } from '../core/authGuard.js';
import { navigateTo } from '../managers/navigatorManager.js';
import { i18n } from '../utils/i18n.js';
import { log } from '../utils/logger.js';

export class PinPage extends Page {
  constructor(options = {}) {
    super({
      id: 'pinPage',
      title: 'PIN',
      showBackButton: false,
      ...options
    });

    // Internal state
    this._enteredDigits = [];
    this._digitCount = 4; // default, updated on activate
    this._isShaking = false;
  }

  // ============================================
  // LIFECYCLE
  // ============================================

  onCreate() {
    super.onCreate();
    log.debug('PinPage', 'Created');

    // Subscribe to language changes — updates all labels when language switches
    this.enableI18n(() => this._updateTranslations());
  }

  onActivate() {
    super.onActivate();
    log.debug('PinPage', 'onActivate');

    // Force translation update in case language changed while we were not active
    this._updateTranslations();

    // Get current digit count from authGuard
    this._digitCount = getPinDigitCount();

    // Reset state
    this._enteredDigits = [];

    // Rebuild indicators for current digit count
    this._renderIndicators();
    this._updateIndicators();
    this._hideError();
  }

  onDeactivate() {
    super.onDeactivate();
    log.debug('PinPage', 'onDeactivate');

    // Pulisci le cifre inserite
    this._enteredDigits = [];
  }

  onBindEvents() {
    super.onBindEvents();
    log.debug('PinPage', 'onBindEvents');

    if (!this.el) return;

    // Delegate keypad clicks
    const keypad = this.el.querySelector('.pin-keypad');
    if (keypad) {
      this.addEventListener(keypad, 'click', (e) => {
        const key = e.target.closest('[data-pin-key]');
        if (key) {
          this._handleKeyPress(key.dataset.pinKey);
        }
      });
    }
  }

  // ============================================
  // RENDERING
  // ============================================

  renderContent() {
    return `
      <div class="pin-page">
        <!-- Header / Brand -->
        <div class="pin-header">
          <div class="pin-lock-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h2 class="pin-title" data-pin-title>${i18n.t('pin.title')}</h2>
          <p class="pin-subtitle" data-pin-subtitle>${i18n.t('pin.subtitle')}</p>
        </div>

        <!-- PIN Indicators -->
        <div class="pin-indicators" data-pin-indicators>
          <!-- Dynamically rendered based on digit count -->
        </div>

        <!-- Error Message -->
        <div class="pin-error" data-pin-error style="visibility: hidden;">
          <span data-pin-error-text>${i18n.t('pin.error')}</span>
        </div>

        <!-- Numeric Keypad -->
        <div class="pin-keypad">
          <button class="pin-key pin-key-digit" data-pin-key="1">1</button>
          <button class="pin-key pin-key-digit" data-pin-key="2">2</button>
          <button class="pin-key pin-key-digit" data-pin-key="3">3</button>
          <button class="pin-key pin-key-digit" data-pin-key="4">4</button>
          <button class="pin-key pin-key-digit" data-pin-key="5">5</button>
          <button class="pin-key pin-key-digit" data-pin-key="6">6</button>
          <button class="pin-key pin-key-digit" data-pin-key="7">7</button>
          <button class="pin-key pin-key-digit" data-pin-key="8">8</button>
          <button class="pin-key pin-key-digit" data-pin-key="9">9</button>
          <button class="pin-key pin-key-action" data-pin-key="cancel">
            <span data-pin-cancel-text>${i18n.t('pin.cancel')}</span>
          </button>
          <button class="pin-key pin-key-digit" data-pin-key="0">0</button>
          <button class="pin-key pin-key-action" data-pin-key="backspace">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/>
              <line x1="18" y1="9" x2="12" y2="15"/>
              <line x1="12" y1="9" x2="18" y2="15"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  /**
   * Update all translatable labels in the page.
   * Called automatically by enableI18n when the language changes.
   * @private
   */
  _updateTranslations() {
    if (!this.el) return;

    const title = this.el.querySelector('[data-pin-title]');
    if (title) title.textContent = i18n.t('pin.title');

    const subtitle = this.el.querySelector('[data-pin-subtitle]');
    if (subtitle) subtitle.textContent = i18n.t('pin.subtitle');

    const errorText = this.el.querySelector('[data-pin-error-text]');
    if (errorText) errorText.textContent = i18n.t('pin.error');

    const cancelText = this.el.querySelector('[data-pin-cancel-text]');
    if (cancelText) cancelText.textContent = i18n.t('pin.cancel');
  }

  /**
   * Check if this page is currently active
   * @private
   */
  _isActive() {
    return this.el && this.el.classList.contains('active');
  }

  /**
   * Render the correct number of indicator dots
   * @private
   */
  _renderIndicators() {
    const container = this.el?.querySelector('[data-pin-indicators]');
    if (!container) return;

    let html = '';
    for (let i = 0; i < this._digitCount; i++) {
      html += '<div class="pin-indicator" data-pin-dot></div>';
    }
    container.innerHTML = html;
  }

  /**
   * Handle a keypad key press
   * @private
   * @param {string} key — "0"-"9", "cancel", "backspace"
   */
  _handleKeyPress(key) {
    if (this._isShaking) return; // ignore input during shake animation

    if (key === 'cancel') {
      this._enteredDigits = [];
      this._updateIndicators();
      this._hideError();
      return;
    }

    if (key === 'backspace') {
      if (this._enteredDigits.length > 0) {
        this._enteredDigits.pop();
        this._updateIndicators();
        this._hideError();
      }
      return;
    }

    // Digit key (0-9)
    if (this._enteredDigits.length >= this._digitCount) return; // already full

    this._enteredDigits.push(key);
    this._updateIndicators();

    // Auto-submit when all digits entered
    if (this._enteredDigits.length === this._digitCount) {
      // Small delay for visual feedback (show last dot fill)
      setTimeout(() => this._submitPin(), 150);
    }
  }

  /**
   * Update indicator dots to reflect entered digits
   * @private
   */
  _updateIndicators() {
    const dots = this.el?.querySelectorAll('[data-pin-dot]');
    if (!dots) return;

    dots.forEach((dot, index) => {
      if (index < this._enteredDigits.length) {
        dot.classList.add('filled');
      } else {
        dot.classList.remove('filled');
      }
    });
  }

  /**
   * Submit the entered PIN for verification
   * @private
   */
  _submitPin() {
    const pinString = this._enteredDigits.join('');

    log.debug('PinPage', `Submitting PIN: "${pinString}"`);

    const isCorrect = verifyPin(pinString);

    if (isCorrect) {
      // PIN corretto — determina la pagina di ritorno salvata da authGuard quando è scattato il lock.
      // Usa replace=true per non lasciare pinPage nello stack di navigazione.
      const returnPage = getReturnPageAfterUnlock();
      log.info(`🔓 [PinPage] PIN corretto — navigazione a: "${returnPage}" (replace)`);
      navigateTo(returnPage, {}, true);
    } else {
      // PIN incorrect — show error with shake
      this._showError();
    }
  }

  /**
   * Show error state with shake animation
   * @private
   */
  _showError() {
    this._isShaking = true;

    // Show error message
    const errorEl = this.el?.querySelector('[data-pin-error]');
    if (errorEl) {
      errorEl.style.visibility = 'visible';
    }

    // Shake indicators
    const indicators = this.el?.querySelector('[data-pin-indicators]');
    if (indicators) {
      indicators.classList.add('pin-shake');
    }

    // Reset after animation
    setTimeout(() => {
      if (indicators) {
        indicators.classList.remove('pin-shake');
      }
      this._enteredDigits = [];
      this._updateIndicators();
      this._isShaking = false;
    }, 600);
  }

  /**
   * Hide error message
   * @private
   */
  _hideError() {
    const errorEl = this.el?.querySelector('[data-pin-error]');
    if (errorEl) {
      errorEl.style.visibility = 'hidden';
    }
  }
}
