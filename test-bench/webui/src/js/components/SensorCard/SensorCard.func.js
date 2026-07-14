/**
 * SensorCard.func.js
 * ==================
 * Helper functions for SensorCard component.
 * 
 * Functions:
 * - getPercentage - Calculates percentage position within min-max range
 * - formatSensorValue - Formats sensor value with unit
 * - calculateBarPosition - Calculates bar fill and setpoint marker positions
 * 
 * @author FogExtra Team
 * @version 1.0.0
 */

/**
 * Calculate percentage position of a value within a range.
 * 
 * @param {number} value - Current value
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Percentage (0-100)
 * 
 * @example
 * getPercentage(25, 0, 100) → 25
 * getPercentage(-10, -20, 80) → 10
 */
export function getPercentage(value, min, max) {
  if (max === min) return 0;
  
  const range = max - min;
  const position = value - min;
  const percentage = (position / range) * 100;
  
  // Clamp between 0 and 100
  return Math.max(0, Math.min(100, percentage));
}

/**
 * Format sensor value with unit.
 * 
 * @param {number} value - Sensor value
 * @param {string} unit - Unit string (e.g., "°C", "%")
 * @returns {string} Formatted value with unit
 * 
 * @example
 * formatSensorValue(24.4, "°C") → "24.4°C"
 * formatSensorValue(65, "%") → "65%"
 */
export function formatSensorValue(value, unit = '', decimals = null) {
  if (value === null || value === undefined) {
    return '--';
  }
  
  let formattedValue = value;
  
  if (typeof value === 'number' && decimals !== null) {
    if (decimals === 0) {
      formattedValue = Math.round(value);
    } else {
      formattedValue = Number(value).toFixed(decimals);
    }
  }
  
  return `${formattedValue}${unit}`;
}

/**
 * Calculate setpoint marker position.
 * Formula: (setpoint - min) / (max - min) * 100
 * 
 * @param {number} setpoint - Target setpoint value
 * @param {number} min - Minimum range
 * @param {number} max - Maximum range
 * @returns {number} Marker position percentage (0-100)
 * 
 * @example
 * calculateMarkerPosition(40, 30, 90) → 16.67 (umidità: 40% tra 30-90%)
 * calculateMarkerPosition(-1, -10, 50) → 15 (temperatura: -1°C tra -10-50°C)
 */
export function calculateMarkerPosition(setpoint, min, max) {
  const range = max - min;
  if (range === 0) return 50; // Default center if no range
  
  const position = ((setpoint - min) / range) * 100;
  return Math.max(0, Math.min(100, position)); // Clamp to [0, 100]
}

/**
 * Calculate bar fill position for sensor value.
 * Handles both same-sign ranges and mixed ranges (crossing zero).
 * 
 * @param {number} sensorValue - Current sensor reading
 * @param {number} min - Minimum range
 * @param {number} max - Maximum range
 * @returns {Object} { fillStart, fillWidth } - Both as percentages (0-100)
 * 
 * @example
 * // Same-sign range (humidity 30-90%, value 65%)
 * calculateBarFillPosition(65, 30, 90) → { fillStart: 0, fillWidth: 58.33 }
 * 
 * // Mixed range (temperature -10 to 50°C, value 18°C)
 * calculateBarFillPosition(18, -10, 50) → { fillStart: 16.67, fillWidth: 30 }
 */
export function calculateBarFillPosition(sensorValue, min, max) {
  const range = max - min;
  if (range === 0) {
    return { fillStart: 0, fillWidth: 0 };
  }

  // Caso A: Range coerente (stesso segno - solo positivi o solo negativi)
  if ((min >= 0 && max >= 0) || (min <= 0 && max <= 0)) {
    const clampedValue = Math.max(min, Math.min(max, sensorValue));
    let fillRatio = (clampedValue - min) / range;
    fillRatio = Math.max(0, Math.min(1, fillRatio));

    return {
      fillStart: 0,
      fillWidth: fillRatio * 100
    };
  }

  // Caso B: Range misto (attraversa lo zero, es. -10°C a 50°C)
  const negRange = Math.abs(min);  // Lunghezza parte negativa
  const posRange = max;             // Lunghezza parte positiva
  const totalRange = negRange + posRange;

  if (totalRange === 0) {
    return { fillStart: 0, fillWidth: 0 };
  }

  // Zero position percentage
  const zeroOffset = negRange / totalRange;

  let fillStart = 0;
  let fillWidth = 0;

  if (sensorValue >= 0) {
    // Valore positivo: riempie da zero verso destra
    const clampedValue = Math.min(sensorValue, max);
    const fillRatio = clampedValue / posRange;
    fillStart = zeroOffset;
    fillWidth = fillRatio * (1 - zeroOffset);
  } else {
    // Valore negativo: riempie da zero verso sinistra
    const clampedValue = Math.max(sensorValue, min);
    const fillRatio = Math.abs(clampedValue) / negRange;
    fillStart = zeroOffset - (fillRatio * zeroOffset);
    fillWidth = fillRatio * zeroOffset;
  }

  // Clamp to valid range
  fillStart = Math.max(0, Math.min(1, fillStart)) * 100;
  fillWidth = Math.max(0, Math.min(1, fillWidth)) * 100;

  return { fillStart, fillWidth };
}

/**
 * Convert internal value (integer) to display value (float).
 * Applies divisor conversion.
 * 
 * @param {number} internalValue - Internal integer value
 * @param {number} divisor - Divisor for conversion
 * @returns {number} Display value (float)
 * 
 * @example
 * convertToDisplay(350, 10) → 35.0
 * convertToDisplay(454, 10) → 45.4
 */
export function convertToDisplay(internalValue, divisor) {
  if (divisor === 0 || divisor === 1) {
    return internalValue;
  }
  return internalValue / divisor;
}
