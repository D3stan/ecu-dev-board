/**
 * func.js
 * =======
 * Utility functions per TimeSlot component.
 * 
 * Funzioni:
 * - timeToMinutes: Converte "HH:MM" in minuti dal midnight
 * - normalizeDayKey: Converte day index numerico in stringa chiave
 * - findActiveSlot: Trova lo slot attivo al momento corrente
 * - findNextSlot: Trova il prossimo slot in arrivo (ciclico su 7 giorni)
 * 
 * @author FogExtra Team
 * @version 1.0.0
 */

import { WeekDaysOrder, WeekDayIndex, DayIndexToKey } from '../../utils/constants.js';

/**
 * Converte una stringa tempo "HH:MM" in minuti dal midnight.
 * 
 * @param {string} time - Tempo in formato "HH:MM" (es: "14:30")
 * @returns {number} Minuti dal midnight (es: 870)
 * 
 * @example
 * timeToMinutes("14:30") // returns 870
 * timeToMinutes("00:00") // returns 0
 * timeToMinutes("23:59") // returns 1439
 */
export function timeToMinutes(time) {
  if (!time || typeof time !== 'string') return 0;
  
  const [hours, minutes] = time.split(':').map(Number);
  
  if (isNaN(hours) || isNaN(minutes)) return 0;
  
  return hours * 60 + minutes;
}

/**
 * Normalizza il giorno in formato stringa chiave.
 * Accetta sia numeri (0-6, dove 0=Domenica) che stringhe ("mon", "tue", ...).
 * 
 * @param {number|string} day - Giorno come numero (0-6) o stringa ("mon", ...)
 * @returns {string|null} Chiave giorno ("mon", "tue", ...) o null se invalido
 * 
 * @example
 * normalizeDayKey(5) // returns "fri"
 * normalizeDayKey("fri") // returns "fri"
 * normalizeDayKey(0) // returns "sun"
 */
export function normalizeDayKey(day) {
  // Se è già una stringa valida, ritorna direttamente
  // Nota: usa indexOf invece di includes per compatibilità con browser vecchi (ES5)
  if (typeof day === 'string' && WeekDaysOrder.indexOf(day) !== -1) {
    return day;
  }
  
  // Se è un numero, converti in stringa
  if (typeof day === 'number' && day >= 0 && day <= 6) {
    return DayIndexToKey[day];
  }
  
  return null;
}

/**
 * Trova lo slot attivo al momento corrente.
 * Uno slot è attivo se:
 * - Il giorno corrente è incluso nei suoi giorni attivi
 * - L'ora corrente cade tra start e stop
 * 
 * Se ci sono più slot attivi contemporaneamente, ritorna quello con start più vicino.
 * 
 * @param {Array} timeSlots - Array di time slots da Store.runtime.scheduler
 * @param {string} currentTime - Tempo corrente "HH:MM"
 * @param {number|string} currentDay - Giorno corrente: numero (0-6) o stringa ("mon", ...)
 * @returns {Object|null} { slot, dayKey } o null se nessuno slot attivo
 * 
 * @example
 * findActiveSlot(slots, "14:30", 1) // Monday
 * findActiveSlot(slots, "14:30", "mon")
 * // returns { slot: {...}, dayKey: "mon" }
 */
export function findActiveSlot(timeSlots, currentTime, currentDay) {
  try {
    // Check robusto: stringa vuota '' è invalida
    if (!timeSlots || timeSlots.length === 0 || !currentTime || currentDay === null || currentDay === undefined || currentDay === '') {
      return null;
    }

    // Normalizza il giorno in stringa chiave
    const dayKey = normalizeDayKey(currentDay);
    if (!dayKey) {
      console.warn('[findActiveSlot] Invalid day:', currentDay);
      return null;
    }

    const currentMinutes = timeToMinutes(currentTime);

    // Filtra gli slot attivi per il giorno corrente e che contengono l'ora corrente
    const activeSlots = [];
    for (var i = 0; i < timeSlots.length; i++) {
      var slot = timeSlots[i];
      if (!slot.days || !slot.days[dayKey]) continue;
      
      var startMin = timeToMinutes(slot.start);
      var stopMin = timeToMinutes(slot.stop);
      
      // Check se current time è dentro lo slot
      if (currentMinutes >= startMin && currentMinutes < stopMin) {
        activeSlots.push({
          slot: slot,
          dayKey: dayKey,
          startMin: startMin
        });
      }
    }

    if (activeSlots.length === 0) return null;

    // Se ci sono più slot attivi, ritorna quello con start più vicino al tempo corrente
    activeSlots.sort(function(a, b) {
      var diffA = Math.abs(currentMinutes - a.startMin);
      var diffB = Math.abs(currentMinutes - b.startMin);
      return diffA - diffB;
    });

    return {
      slot: activeSlots[0].slot,
      dayKey: activeSlots[0].dayKey
    };
  } catch (error) {
    console.error('[findActiveSlot] Error:', error);
    return null;
  }
}

/**
 * Trova il prossimo slot in arrivo (ciclico su 7 giorni).
 * 
 * Logica:
 * 1. Converte tutti gli slot in istanze espanse per giorno
 * 2. Calcola la distanza temporale ciclica da ora a ogni slot
 * 3. Ritorna lo slot con distanza minima
 * 
 * Se oggi è Martedì 14:30 e il prossimo slot è Venerdì 18:00,
 * la funzione troverà correttamente quel slot.
 * 
 * @param {Array} timeSlots - Array di time slots da Store.runtime.scheduler
 * @param {string} currentTime - Tempo corrente "HH:MM"
 * @param {number|string} currentDay - Giorno corrente: numero (0-6) o stringa ("mon", ...)
 * @returns {Object|null} { slot, dayKey } o null se nessuno slot
 * 
 * @example
 * // Oggi: Martedì 14:30
 * // Slot A: Lun-Ven 07:00-09:00
 * // Slot B: Lun-Mer-Ven 18:00-20:00
 * findNextSlot(slots, "14:30", 2) // Tuesday
 * // returns { slot: slotB, dayKey: "tue" } (oggi alle 18:00)
 */
export function findNextSlot(timeSlots, currentTime, currentDay) {
  try {
    // Check robusto: stringa vuota '' è invalida
    if (!timeSlots || timeSlots.length === 0 || !currentTime || currentDay === null || currentDay === undefined || currentDay === '') {
      return null;
    }

    // Normalizza il giorno in stringa chiave
    var normalizedDayKey = normalizeDayKey(currentDay);
    if (!normalizedDayKey) {
      console.warn('[findNextSlot] Invalid day:', currentDay);
      return null;
    }

    var currentDayIndex = WeekDayIndex[normalizedDayKey]; // 0-6
    var currentMinutes = timeToMinutes(currentTime);

    // Converti tutti gli slot in array espanso per giorno
    // Ogni slot può generare fino a 7 istanze (una per giorno attivo)
    var allSlotInstances = [];

    for (var i = 0; i < timeSlots.length; i++) {
      var slot = timeSlots[i];
      for (var j = 0; j < WeekDaysOrder.length; j++) {
        var dayKey = WeekDaysOrder[j];
        var dayIndex = j;
        if (slot.days && slot.days[dayKey]) {
          allSlotInstances.push({
            slot: slot,
            dayKey: dayKey,
            dayIndex: dayIndex,
            startMin: timeToMinutes(slot.start),
            stopMin: timeToMinutes(slot.stop)
          });
        }
      }
    }

    if (allSlotInstances.length === 0) return null;

    // Converti tutto in "minuti assoluti" da Lunedì 00:00
    var currentAbsoluteMinutes = currentDayIndex * 1440 + currentMinutes;

    // Trova il prossimo slot
    var closestSlot = null;
    var minDiff = Infinity;

    for (var k = 0; k < allSlotInstances.length; k++) {
      var instance = allSlotInstances[k];
      var slotAbsoluteStart = instance.dayIndex * 1440 + instance.startMin;

      // Calcola differenza (ciclica su 7 giorni = 10080 minuti)
      var diff = slotAbsoluteStart - currentAbsoluteMinutes;

      // Se la differenza è negativa, wrap around alla prossima settimana
      if (diff <= 0) {
        diff += 7 * 1440; // +10080 minuti (1 settimana)
      }

      // Aggiorna il prossimo slot se questa differenza è minore
      if (diff < minDiff) {
        minDiff = diff;
        closestSlot = instance;
      }
    }

    return closestSlot
      ? {
          slot: closestSlot.slot,
          dayKey: closestSlot.dayKey
        }
      : null;
  } catch (error) {
    console.error('[findNextSlot] Error:', error);
    return null;
  }
}
