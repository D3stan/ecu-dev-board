/**
 * TimeSlotGaugeExample.js
 * 
 * Esempio di utilizzo del componente TimeSlotGauge
 * Mostra come integrarlo con commandManager e Store
 */

import { TimeSlotGauge } from './TimeSlotGauge.js';
import { modifyTimeSlot } from '../../managers/commandManager.js';

// ============================================
// EXAMPLE 1: CREATE MODE
// ============================================

/**
 * Crea un nuovo time slot
 * @param {HTMLElement} container - Container DOM
 * @param {Object} i18n - Servizio i18n
 * @param {Function} getWeekdayLetter - Funzione per ottenere lettera giorno
 */
export function createNewTimeSlot(container, i18n, getWeekdayLetter) {
  const gauge = new TimeSlotGauge({
    container,
    i18n,
    getWeekdayLetter,
    mode: 'create',
    
    // Valori iniziali di default
    initial: {
      start: '08:30',
      stop: '12:30',
      days: {
        mon: false,
        tue: false,
        wed: false,
        thu: false,
        fri: false,
        sat: false,
        sun: false
      }
    },
    
    // Snap a 15 minuti
    snapMinutes: 15,
    
    // Callback submit
    onSubmit: (payload) => {
      console.log('✅ Nuovo time slot creato:', payload);
      
      // Invia comando a ESP32
      modifyTimeSlot(payload);
      
      // Naviga indietro o mostra feedback
      // navigateToPage('schedulerPage');
    }
  });
  
  return gauge;
}

// ============================================
// EXAMPLE 2: MODIFY MODE
// ============================================

/**
 * Modifica un time slot esistente
 * @param {HTMLElement} container - Container DOM
 * @param {Object} i18n - Servizio i18n
 * @param {Function} getWeekdayLetter - Funzione per ottenere lettera giorno
 * @param {Object} existingSlot - Time slot esistente da Store
 */
export function modifyExistingTimeSlot(container, i18n, getWeekdayLetter, existingSlot) {
  const gauge = new TimeSlotGauge({
    container,
    i18n,
    getWeekdayLetter,
    mode: 'modify',
    
    // Carica valori esistenti
    initial: {
      id: existingSlot.id,
      start: existingSlot.start,
      stop: existingSlot.stop,
      days: { ...existingSlot.days }
    },
    
    snapMinutes: 15,
    
    // Callback submit
    onSubmit: (payload) => {
      console.log('✅ Time slot modificato:', payload);
      
      // Invia comando a ESP32
      modifyTimeSlot(payload);
      
      // Naviga indietro o mostra feedback
      // navigateToPage('schedulerPage');
    }
  });
  
  return gauge;
}

// ============================================
// EXAMPLE 3: INTEGRATION CON ROUTING
// ============================================

/**
 * Esempio di integrazione con sistema di routing
 */
export class TimeSlotPage {
  constructor(options) {
    this.container = options.container;
    this.i18n = options.i18n;
    this.getWeekdayLetter = options.getWeekdayLetter;
    this.router = options.router;
    this.gauge = null;
  }
  
  /**
   * Monta la pagina in modalità create
   */
  mountCreate() {
    this.gauge = new TimeSlotGauge({
      container: this.container,
      i18n: this.i18n,
      getWeekdayLetter: this.getWeekdayLetter,
      mode: 'create',
      
      initial: {
        start: '08:30',
        stop: '12:30',
        days: {
          mon: false,
          tue: false,
          wed: false,
          thu: false,
          fri: false,
          sat: false,
          sun: false
        }
      },
      
      snapMinutes: 15,
      
      onSubmit: (payload) => {
        console.log('📤 Creazione time slot:', payload);
        
        // Invia a ESP32
        modifyTimeSlot(payload);
        
        // Naviga indietro
        this.router.navigate('scheduler');
      }
    });
  }
  
  /**
   * Monta la pagina in modalità modify
   * @param {number} slotId - ID dello slot da modificare
   */
  mountModify(slotId) {
    // Recupera slot da Store
    const slot = this._getSlotFromStore(slotId);
    
    if (!slot) {
      console.error('❌ Slot non trovato:', slotId);
      this.router.navigate('scheduler');
      return;
    }
    
    this.gauge = new TimeSlotGauge({
      container: this.container,
      i18n: this.i18n,
      getWeekdayLetter: this.getWeekdayLetter,
      mode: 'modify',
      
      initial: {
        id: slot.id,
        start: slot.start,
        stop: slot.stop,
        days: { ...slot.days }
      },
      
      snapMinutes: 15,
      
      onSubmit: (payload) => {
        console.log('📤 Modifica time slot:', payload);
        
        // Invia a ESP32
        modifyTimeSlot(payload);
        
        // Naviga indietro
        this.router.navigate('scheduler');
      }
    });
  }
  
  /**
   * Smonta la pagina e cleanup
   */
  unmount() {
    if (this.gauge) {
      this.gauge.destroy();
      this.gauge = null;
    }
  }
  
  /**
   * Helper per recuperare slot da Store
   * @param {number} slotId
   * @returns {Object|null}
   */
  _getSlotFromStore(slotId) {
    // TODO: implementa recupero da Store
    // const timeSlots = Store.get(Paths.CONFIG.TIME_SLOTS);
    // return timeSlots.find(s => s.id === slotId);
    return null;
  }
}

// ============================================
// EXAMPLE 4: i18n SERVICE MOCK
// ============================================

/**
 * Esempio di servizio i18n compatibile
 */
export class MockI18nService {
  constructor() {
    this.currentLang = 'it';
    this.translations = {
      it: {
        'timeslot.daysOfWeek': 'Giorni della Settimana',
        'timeslot.start': 'Inizio',
        'timeslot.stop': 'Fine',
        'timeslot.create': 'Crea',
        'timeslot.modify': 'Modifica',
        'timeslot.errorNoDays': 'Seleziona almeno un giorno della settimana',
        'timeslot.startHandleAria': 'Maniglia inizio',
        'timeslot.stopHandleAria': 'Maniglia fine',
      },
      en: {
        'timeslot.daysOfWeek': 'Days of Week',
        'timeslot.start': 'Start',
        'timeslot.stop': 'Stop',
        'timeslot.create': 'Create',
        'timeslot.modify': 'Modify',
        'timeslot.errorNoDays': 'Select at least one day of the week',
        'timeslot.startHandleAria': 'Start handle',
        'timeslot.stopHandleAria': 'Stop handle',
      }
    };
    this.listeners = [];
  }
  
  t(key) {
    return this.translations[this.currentLang][key] || key;
  }
  
  setLanguage(lang) {
    this.currentLang = lang;
    this.listeners.forEach(fn => fn());
  }
  
  subscribe(fn) {
    this.listeners.push(fn);
  }
  
  unsubscribe(fn) {
    const index = this.listeners.indexOf(fn);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }
}

/**
 * Esempio di funzione getWeekdayLetter
 */
export function getWeekdayLetter(dayKey) {
  const letters = {
    it: {
      mon: 'L',
      tue: 'M',
      wed: 'M',
      thu: 'G',
      fri: 'V',
      sat: 'S',
      sun: 'D'
    },
    en: {
      mon: 'M',
      tue: 'T',
      wed: 'W',
      thu: 'T',
      fri: 'F',
      sat: 'S',
      sun: 'S'
    }
  };
  
  // TODO: usa lingua corrente da i18n
  const lang = 'it';
  return letters[lang][dayKey] || dayKey.charAt(0).toUpperCase();
}

// ============================================
// EXAMPLE 5: VANILLA JS STANDALONE
// ============================================

/**
 * Esempio standalone senza dipendenze complesse
 */
export function initTimeSlotGaugeStandalone() {
  const container = document.getElementById('timeslot-gauge-container');
  
  // Mock i18n semplice
  const i18n = {
    t: (key) => {
      const translations = {
        'timeslot.daysOfWeek': 'Giorni della Settimana',
        'timeslot.start': 'Inizio',
        'timeslot.stop': 'Fine',
        'timeslot.create': 'Crea',
        'timeslot.modify': 'Modifica',
        'timeslot.errorNoDays': 'Seleziona almeno un giorno',
      };
      return translations[key] || key;
    },
    subscribe: () => {},
    unsubscribe: () => {}
  };
  
  // Mock getWeekdayLetter
  const getWeekdayLetter = (dayKey) => {
    const letters = { mon: 'L', tue: 'M', wed: 'M', thu: 'G', fri: 'V', sat: 'S', sun: 'D' };
    return letters[dayKey];
  };
  
  // Crea gauge
  const gauge = new TimeSlotGauge({
    container,
    i18n,
    getWeekdayLetter,
    mode: 'create',
    snapMinutes: 15,
    
    onSubmit: (payload) => {
      console.log('✅ Submit:', payload);
      alert('Time slot creato! Vedi console per dettagli.');
      
      // Qui invieresti il payload a ESP32
      // modifyTimeSlot(payload);
    }
  });
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    gauge.destroy();
  });
  
  return gauge;
}
