/**
 * ModeSelector.func.js
 * ====================
 * Helper functions and configuration for ModeSelector component.
 * 
 * @author FogExtra Team
 * @version 1.0.0
 */

import { MODE_PARAM_IDS } from '../../utils/constants.js';
import { Paths } from '../../utils/paths.js';

/**
 * Configurazione di tutti i mode buttons.
 * 
 * Ogni entry contiene:
 * - id: identificatore unico
 * - assetKey: chiave asset catalogo
 * - storePath: path dello store per isActive
 * - paramId: ID del parametro nel config.params
 * 
 * @type {Array<Object>}
 */
export const MODE_CONFIGURATIONS = [
  {
    id: 'temperature',
    assetKey: 'icon-thermo',
    storePath: 'runtime.modes.temperature.isActive',
    paramId: MODE_PARAM_IDS.TEMPERATURE,
    labelKey: 'ui.modeTemperature'
  },
  {
    id: 'humidity',
    assetKey: 'icon-humidity',
    storePath: 'runtime.modes.humidity.isActive',
    paramId: MODE_PARAM_IDS.HUMIDITY,
    labelKey: 'ui.modeHumidity'
  },
  {
    id: 'timer',
    assetKey: 'icon-timer',
    storePath: 'runtime.modes.timer.isActive',
    paramId: MODE_PARAM_IDS.TIMER,
    labelKey: 'ui.modeTimer'
  },
  {
    id: 'calendar',
    assetKey: 'icon-calendar',
    storePath: 'runtime.modes.calendar.isActive',
    paramId: MODE_PARAM_IDS.CALENDAR,
    labelKey: 'ui.modeCalendar'
  },
  // {
  //   id: 'wireless',
  //   assetKey: 'icon-wifi',
  //   storePath: 'runtime.modes.wireless.isActive',
  //   paramId: MODE_PARAM_IDS.WIRELESS
  // },
  // {
  //   id: 'aux',
  //   assetKey: 'icon-setting',
  //   storePath: 'runtime.modes.aux.isActive',
  //   paramId: MODE_PARAM_IDS.AUX
  // }
];
