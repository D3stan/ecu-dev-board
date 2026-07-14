/**
 * TimeSlotGaugeFunctions.js
 * 
 * Pure functions per conversioni matematiche del gauge circolare.
 * 
 * Coordinate System:
 * - SVG ruotato di -90° → 0° = top (00:00)
 * - Senso orario: 90° = 06:00, 180° = 12:00, 270° = 18:00
 * - Centro: (100, 100), Raggio: 80
 */

// ============================================
// CONSTANTS
// ============================================

export const GAUGE_RADIUS = 80;
export const GAUGE_CENTER = 100;
export const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS; // ≈ 502.654

// ============================================
// TIME ↔ ANGLE CONVERSIONS
// ============================================

/**
 * Converti orario "HH:MM" in gradi (0-360)
 * 00:00 → 0°, 06:00 → 90°, 12:00 → 180°, 18:00 → 270°
 * 
 * @param {string} timeStr - Formato "HH:MM" (es: "17:30")
 * @returns {number} Angolo in gradi [0, 360)
 */
export function timeToAngle(timeStr) {
  // Validazione input
  if (!timeStr || typeof timeStr !== 'string') {
    console.error('timeToAngle: invalid input', timeStr);
    return 0;
  }

  const parts = timeStr.split(':');
  if (parts.length !== 2) {
    console.error('timeToAngle: invalid format', timeStr);
    return 0;
  }

  const [hours, minutes] = parts.map(Number);

  // Validazione numeri
  if (isNaN(hours) || isNaN(minutes)) {
    console.error('timeToAngle: NaN values', { hours, minutes, timeStr });
    return 0;
  }

  // Calcola minuti totali da mezzanotte
  const totalMinutes = hours * 60 + minutes;

  // Converti in gradi (24h = 360°)
  // 1440 minuti = 360° → 1 minuto = 0.25°
  const angle = (totalMinutes / 1440) * 360;

  return angle;
}

/**
 * Converti angolo in orario "HH:MM" con snap configurabile
 * 
 * @param {number} angle - Angolo in gradi
 * @param {number} snapMinutes - Arrotondamento in minuti (default: 15)
 * @returns {string} Formato "HH:MM" (es: "17:30")
 */
export function angleToTime(angle, snapMinutes = 15) {
  // Normalizza angolo tra 0-360
  angle = ((angle % 360) + 360) % 360;

  // Converti in minuti totali
  const totalMinutes = (angle / 360) * 1440;

  // Snap ai minuti configurati
  const snappedMinutes = Math.round(totalMinutes / snapMinutes) * snapMinutes;

  // Converti in ore e minuti
  const hours = Math.floor(snappedMinutes / 60) % 24;
  const minutes = snappedMinutes % 60;

  // Zero-padding
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// ============================================
// POLAR COORDINATES
// ============================================

/**
 * Converti angolo in coordinate cartesiane per SVG
 * Compensazione: SVG ruotato -90°, quindi 0° = top
 * 
 * @param {number} angle - Angolo in gradi (0° = top)
 * @returns {Object} { x, y } coordinate SVG
 */
export function angleToCoords(angle) {
  // Validazione input
  if (isNaN(angle) || angle === null || angle === undefined) {
    console.error('angleToCoords: invalid angle', angle);
    // Default: top (0°)
    return { x: GAUGE_CENTER, y: GAUGE_CENTER - GAUGE_RADIUS };
  }

  // Compensazione rotazione SVG: aggiungi 90° per allineare 0° = top
  const adjustedAngle = angle + 90;

  // Converti in radianti
  const rad = adjustedAngle * (Math.PI / 180);

  // Calcola coordinate polari
  // x = center + radius * cos(θ)
  // y = center + radius * sin(θ)
  // NB: sin per x perché l'angolo parte da top (compensato +90°)
  const x = GAUGE_CENTER + GAUGE_RADIUS * Math.sin(rad);
  const y = GAUGE_CENTER - GAUGE_RADIUS * Math.cos(rad);

  return { x, y };
}

/**
 * Converti coordinate cartesiane in angolo
 * Utile per calcolare angolo da posizione mouse/touch
 * 
 * @param {number} x - Coordinata X (relativa al centro gauge)
 * @param {number} y - Coordinata Y (relativa al centro gauge)
 * @returns {number} Angolo in gradi [0, 360) con 0° = top
 */
export function coordsToAngle(x, y) {
  // Math.atan2 restituisce angolo in radianti da -π a +π
  // 0 rad = destra (east), +π/2 = giù (south), -π/2 = su (north)
  const rad = Math.atan2(y, x);

  // Converti in gradi
  let degrees = rad * (180 / Math.PI);

  // Compensazione: atan2 ha 0° a destra, vogliamo 0° in alto
  // Aggiungi 90° per ruotare il sistema di riferimento
  degrees = degrees + 90;

  // Normalizza a [0, 360)
  degrees = ((degrees % 360) + 360) % 360;

  return degrees;
}

// ============================================
// DURATION CALCULATION
// ============================================

/**
 * Calcola la durata tra start e stop
 * Se stop < start, assume che attraversi la mezzanotte
 * 
 * @param {string} start - Orario start "HH:MM"
 * @param {string} stop - Orario stop "HH:MM"
 * @returns {Object} { hours, minutes, totalMinutes }
 */
export function calculateDuration(start, stop) {
  const [startH, startM] = start.split(':').map(Number);
  const [stopH, stopM] = stop.split(':').map(Number);

  let startMinutes = startH * 60 + startM;
  let stopMinutes = stopH * 60 + stopM;

  // Se stop <= start, aggiungi 24h (attraversa mezzanotte)
  if (stopMinutes <= startMinutes) {
    stopMinutes += 24 * 60;
  }

  const diffMinutes = stopMinutes - startMinutes;

  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;

  return {
    hours,
    minutes,
    totalMinutes: diffMinutes
  };
}

// ============================================
// ARC CALCULATIONS
// ============================================

/**
 * Calcola i parametri SVG per disegnare l'arco tra start e stop
 * 
 * @param {string} start - Orario start "HH:MM"
 * @param {string} stop - Orario stop "HH:MM"
 * @returns {Object} { startAngle, stopAngle, arcAngle, arcLength, dashoffset }
 */
export function calculateArcParams(start, stop) {
  const startAngle = timeToAngle(start);
  const stopAngle = timeToAngle(stop);

  // Calcola angolo dell'arco
  let arcAngle = stopAngle - startAngle;
  if (arcAngle < 0) arcAngle += 360;

  // Calcola lunghezza arco
  const arcLength = (arcAngle / 360) * GAUGE_CIRCUMFERENCE;

  // Calcola dashoffset per SVG
  const dashoffset = GAUGE_CIRCUMFERENCE - arcLength;

  return {
    startAngle,
    stopAngle,
    arcAngle,
    arcLength,
    dashoffset
  };
}

// ============================================
// TIME VALIDATION
// ============================================

/**
 * Valida formato orario "HH:MM"
 * 
 * @param {string} timeStr - Stringa da validare
 * @returns {boolean} true se valido
 */
export function isValidTimeFormat(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return false;

  const regex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
  return regex.test(timeStr);
}

/**
 * Aggiusta un orario per garantire start < stop
 * 
 * @param {string} start - Orario start
 * @param {string} stop - Orario stop
 * @param {string} changed - Quale è stato modificato ('start' | 'stop')
 * @returns {Object} { start, stop } aggiustati
 */
export function enforceTimeOrder(start, stop, changed) {
  const [startH, startM] = start.split(':').map(Number);
  const [stopH, stopM] = stop.split(':').map(Number);

  const startTotal = startH * 60 + startM;
  const stopTotal = stopH * 60 + stopM;

  if (changed === 'start') {
    // Se start >= stop, sposta stop a start + 1min
    if (startTotal >= stopTotal) {
      const newStopTotal = (startTotal + 1) % (24 * 60);
      const newStopH = Math.floor(newStopTotal / 60);
      const newStopM = newStopTotal % 60;
      stop = `${String(newStopH).padStart(2, '0')}:${String(newStopM).padStart(2, '0')}`;
    }
  } else {
    // Se stop <= start, sposta start a stop - 1min
    if (stopTotal <= startTotal) {
      const newStartTotal = (stopTotal - 1 + 24 * 60) % (24 * 60);
      const newStartH = Math.floor(newStartTotal / 60);
      const newStartM = newStartTotal % 60;
      start = `${String(newStartH).padStart(2, '0')}:${String(newStartM).padStart(2, '0')}`;
    }
  }

  return { start, stop };
}

// ============================================
// UTILITY
// ============================================

/**
 * Converti minuti totali in formato "HH:MM"
 * 
 * @param {number} totalMinutes - Minuti da mezzanotte
 * @returns {string} Formato "HH:MM"
 */
export function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Converti orario "HH:MM" in minuti totali
 * 
 * @param {string} timeStr - Formato "HH:MM"
 * @returns {number} Minuti da mezzanotte
 */
export function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Snap minuti al valore più vicino
 * 
 * @param {number} minutes - Minuti da arrotondare
 * @param {number} snapTo - Incremento di snap (es: 15)
 * @returns {number} Minuti arrotondati
 */
export function snapMinutes(minutes, snapTo = 15) {
  return Math.round(minutes / snapTo) * snapTo;
}
