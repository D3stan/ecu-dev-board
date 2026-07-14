/**
 * TimeSlotGauge Module
 * 
 * Export pubblici del componente TimeSlotGauge
 */

// Componente principale
export { TimeSlotGauge, default } from './TimeSlotGauge.js';

// Funzioni utility matematiche (opzionale, se servono esternamente)
export {
  timeToAngle,
  angleToTime,
  angleToCoords,
  coordsToAngle,
  calculateDuration,
  calculateArcParams,
  isValidTimeFormat,
  enforceTimeOrder,
  minutesToTime,
  timeToMinutes,
  snapMinutes,
  GAUGE_RADIUS,
  GAUGE_CENTER,
  GAUGE_CIRCUMFERENCE
} from './TimeSlotGaugeFunctions.js';
