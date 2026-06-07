// commands.js
import { Separators, CmdToEsp } from "./constants.js";

/**
 * Converte "HH:MM" in {h,m}
 */
function parseTime(str) {
  const [h, m] = str.split(":").map(n => parseInt(n, 10) || 0);
  return { h, m };
}

/**
 * Codifica i giorni in un byte con 7 bit (lun=bit0, dom=bit6)
 * days = { mon:true, tue:false, wed:true, thu:false, fri:true, sat:false, sun:false }
 */
function encodeDays(days) {
  return (
    (days.mon ? 1 << 0 : 0) |
    (days.tue ? 1 << 1 : 0) |
    (days.wed ? 1 << 2 : 0) |
    (days.thu ? 1 << 3 : 0) |
    (days.fri ? 1 << 4 : 0) |
    (days.sat ? 1 << 5 : 0) |
    (days.sun ? 1 << 6 : 0)
  );
}

/**
 * Genera un messaggio MODIFY_PARAM
 */
function makeModifyParam(id, value) {
  return `${CmdToEsp.MODIFY_PARAM}|${id}${Separators.FIELD}${value}`;
}

/**
 * Genera un messaggio MODIFY_TIME_SLOT da slot "umano"
 * slot = {id, start:"HH:MM", stop:"HH:MM", days:{mon,...}}
 */
function makeModifyTimeSlot(slot) {
  const { h: startH, m: startM } = parseTime(slot.start);
  const { h: stopH, m: stopM }   = parseTime(slot.stop);
  const dayFlags = encodeDays(slot.days);

  const fields = [slot.id, startH, startM, stopH, stopM, dayFlags];
  return `${CmdToEsp.MODIFY_TIME_SLOT}|${fields.join(Separators.FIELD)}`;
}

/**
 * Genera un messaggio DELETE_TIME_SLOT
 */
function makeDeleteTimeSlot(id) {
  return `${CmdToEsp.DELETE_TIME_SLOT}|${id}`;
}

export { makeModifyParam, makeModifyTimeSlot, makeDeleteTimeSlot, encodeDays, parseTime };
