// mockData.js
/**
 * Dati mock per sviluppo/test offline
 * Simula i dati ricevuti dall'ESP32
 *
 * Usage (already auto-activated on localhost / ?mock):
 *   - Bootstrap data (langs, params, menu, scheduler)
 *   - Rich initial RUNTIME state (sensors, modes, pump, RTC...)
 *   - Live emulator that makes values drift over time
 *   - Commands have local effect (UI updates immediately)
 */

/**
 * Mock delle traduzioni (formato parseLang)
 * Struttura: { menuName[], daysLetter[], param[] }
 */
export const MOCK_LANGS = [
  // ENGLISH - Index 0
  {
    menuName: ["Mode Enable", "Timer", "Calendar", "Temperature", "Humidity", "Clock", "Settings", "Fan", "Dispenser"],
    daysLetter: ["M", "T", "W", "T", "F", "S", "S"],
    param: [
      { name: "SetTemp", ds: "Set Temperature" },           // 0
      { name: "DiffTemp", ds: "Diff Temperature" },         // 1
      { name: "AdjTemp", ds: "Adjust Temperature" },        // 2
      { name: "EnTemp", ds: "Enable Temperature" },         // 3
      { name: "SetRh", ds: "Set Humidity" },                // 4
      { name: "DiffRh", ds: "Diff Humidity" },              // 5
      { name: "AdjRh", ds: "Adjust Humidity" },             // 6
      { name: "EnRh", ds: "Enable Humidity" },              // 7
      { name: "TimerOn", ds: "Timer On Time" },             // 8
      { name: "TimerOff", ds: "Timer Off Time" },           // 9
      { name: "EnTimer", ds: "Enable Timer" },              // 10
      { name: "EnCal", ds: "Enable Calendar" },             // 11
      { name: "PumpDelay", ds: "Pump Delay" },              // 12
      { name: "DrainDelay", ds: "Drain Delay" },            // 13
      { name: "EnAux", ds: "Enable Auxiliary" },            // 14
      { name: "Day", ds: "Day" },                           // 15
      { name: "Month", ds: "Month" },                       // 16
      { name: "Year", ds: "Year" },                         // 17
      { name: "Hour", ds: "Hour" },                         // 18
      { name: "Minute", ds: "Minute" },                     // 19
      { name: "ChangeLang", ds: "Change Language" },        // 20
      { name: "PressMode", ds: "Pressure Mode" },           // 21
      { name: "RelayMode", ds: "Relay Mode" },              // 22
      { name: "AuxModeEn", ds: "Auxiliary Mode" },            // 23
      { name: "MaxPumpHours", ds: "Max Pump Hours" }        // 24
    ]
  },
  // ITALIAN - Index 1
  {
    menuName: ["Modalità", "Timer", "Calendario", "Temperatura", "Umidità", "Orologio", "Impostazioni", "Ventola", "Dosatore"],
    daysLetter: ["L", "M", "M", "G", "V", "S", "D"],
    param: [
      { name: "SetTemp", ds: "Temperatura Impostata" },
      { name: "DiffTemp", ds: "Differenziale Temperatura" },
      { name: "AdjTemp", ds: "Regolazione Temperatura" },
      { name: "EnTemp", ds: "Abilita Temperatura" },
      { name: "SetRh", ds: "Umidità Impostata" },
      { name: "DiffRh", ds: "Differenziale Umidità" },
      { name: "AdjRh", ds: "Regolazione Umidità" },
      { name: "EnRh", ds: "Abilita Umidità" },
      { name: "TimerOn", ds: "Tempo di Accensione" },
      { name: "TimerOff", ds: "Tempo di Spegnimento" },

      { name: "EnTimer", ds: "Abilita Timer" },
      { name: "EnCal", ds: "Abilita Calendario" },
      { name: "PumpDelay", ds: "Ritardo Pompa" },
      { name: "DrainDelay", ds: "Ritardo Scarico" },
      { name: "EnAux", ds: "Abilita Ausiliaria" },
      { name: "Day", ds: "Giorno" },
      { name: "Month", ds: "Mese" },
      { name: "Year", ds: "Anno" },
      { name: "Hour", ds: "Ora" },
      { name: "Minute", ds: "Minuto" },
      { name: "ChangeLang", ds: "Cambia Lingua" },

      { name: "PressMode", ds: "Modalità Pressostato" },
      { name: "RelayMode", ds: "Modalità Relè" },
      { name: "AuxModeIt", ds: "Modalità Ausiliaria" },
      { name: "MaxPumpHours", ds: "Ore Massime Pompa" }
    ]
  },
  // FRENCH - Index 2
  {
    menuName: ["Mode", "Minuteur", "Calendrier", "Température", "Humidité", "Horloge", "Réglages", "Ventilateur", "Distributeur"],
    daysLetter: ["L", "M", "M", "J", "V", "S", "D"],
    param: [
      { name: "SetTemp", ds: "Température Réglée" },        // 0
      { name: "DiffTemp", ds: "Différentiel Température" }, // 1
      { name: "AdjTemp", ds: "Ajustement Température" },    // 2
      { name: "EnTemp", ds: "Activer Température" },        // 3
      { name: "SetRh", ds: "Humidité Réglée" },             // 4
      { name: "DiffRh", ds: "Différentiel Humidité" },      // 5
      { name: "AdjRh", ds: "Ajustement Humidité" },         // 6
      { name: "EnRh", ds: "Activer Humidité" },             // 7
      { name: "TimerOn", ds: "Temps Allumage" },            // 8
      { name: "TimerOff", ds: "Temps Extinction" },         // 9
      { name: "EnTimer", ds: "Activer Minuteur" },          // 10
      { name: "EnCal", ds: "Activer Calendrier" },          // 11
      { name: "PumpDelay", ds: "Retard Pompe" },            // 12
      { name: "DrainDelay", ds: "Retard Vidange" },         // 13
      { name: "EnAux", ds: "Activer Auxiliaire" },          // 14
      { name: "Day", ds: "Jour" },                          // 15
      { name: "Month", ds: "Mois" },                        // 16
      { name: "Year", ds: "Année" },                        // 17
      { name: "Hour", ds: "Heure" },                        // 18
      { name: "Minute", ds: "Minute" },                     // 19
      { name: "ChangeLang", ds: "Changer Langue" },         // 20
      { name: "PressMode", ds: "Mode Pressostat" },         // 21
      { name: "RelayMode", ds: "Mode Relais" },             // 22
      { name: "AuxModeFr", ds: "Mode Auxiliaire" },           // 23
      { name: "MaxPumpHours", ds: "Heures Max Pompe" }      // 24
    ]
  },
  // GERMAN - Index 3
  {
    menuName: ["Modus", "Timer", "Kalender", "Temperatur", "Feuchtigkeit", "Uhr", "Einstellungen", "Ventilator", "Spender"],
    daysLetter: ["M", "D", "M", "D", "F", "S", "S"],
    param: [
      { name: "SetTemp", ds: "Solltemperatur" },            // 0
      { name: "DiffTemp", ds: "Temperaturdifferenz" },      // 1
      { name: "AdjTemp", ds: "Temperaturanpassung" },       // 2
      { name: "EnTemp", ds: "Temperatur Aktivieren" },      // 3
      { name: "SetRh", ds: "Sollluftfeuchtigkeit" },        // 4
      { name: "DiffRh", ds: "Feuchtigkeitsdifferenz" },     // 5
      { name: "AdjRh", ds: "Feuchtigkeitsanpassung" },      // 6
      { name: "EnRh", ds: "Feuchtigkeit Aktivieren" },      // 7
      { name: "TimerOn", ds: "Einschaltzeit" },             // 8
      { name: "TimerOff", ds: "Ausschaltzeit" },            // 9
      { name: "EnTimer", ds: "Timer Aktivieren" },          // 10
      { name: "EnCal", ds: "Kalender Aktivieren" },         // 11
      { name: "PumpDelay", ds: "Pumpenverzögerung" },       // 12
      { name: "DrainDelay", ds: "Ablaufverzögerung" },      // 13
      { name: "EnAux", ds: "Hilfsgerät Aktivieren" },       // 14
      { name: "Day", ds: "Tag" },                           // 15
      { name: "Month", ds: "Monat" },                       // 16
      { name: "Year", ds: "Jahr" },                         // 17
      { name: "Hour", ds: "Stunde" },                       // 18
      { name: "Minute", ds: "Minute" },                     // 19
      { name: "ChangeLang", ds: "Sprache Ändern" },         // 20
      { name: "PressMode", ds: "Druckmodus" },              // 21
      { name: "RelayMode", ds: "Relaismodus" },             // 22
      { name: "AuxModeDe", ds: "Hilfsmodus" },                // 23
      { name: "MaxPumpHours", ds: "Max Pumpenstunden" }     // 24
    ]
  },
  // SPANISH - Index 4
  {
    menuName: ["Modo", "Temporizador", "Calendario", "Temperatura", "Humedad", "Reloj", "Configuración", "Ventilador", "Dispensador"],
    daysLetter: ["L", "M", "X", "J", "V", "S", "D"],
    param: [
      { name: "SetTemp", ds: "Temperatura Establecida" },   // 0
      { name: "DiffTemp", ds: "Diferencial Temperatura" },  // 1
      { name: "AdjTemp", ds: "Ajuste Temperatura" },        // 2
      { name: "EnTemp", ds: "Activar Temperatura" },        // 3
      { name: "SetRh", ds: "Humedad Establecida" },         // 4
      { name: "DiffRh", ds: "Diferencial Humedad" },        // 5
      { name: "AdjRh", ds: "Ajuste Humedad" },              // 6
      { name: "EnRh", ds: "Activar Humedad" },              // 7
      { name: "TimerOn", ds: "Tiempo Encendido" },          // 8
      { name: "TimerOff", ds: "Tiempo Apagado" },           // 9
      { name: "EnTimer", ds: "Activar Temporizador" },      // 10
      { name: "EnCal", ds: "Activar Calendario" },          // 11
      { name: "PumpDelay", ds: "Retardo Bomba" },           // 12
      { name: "DrainDelay", ds: "Retardo Drenaje" },        // 13
      { name: "EnAux", ds: "Activar Auxiliar" },            // 14
      { name: "Day", ds: "Día" },                           // 15
      { name: "Month", ds: "Mes" },                         // 16
      { name: "Year", ds: "Año" },                          // 17
      { name: "Hour", ds: "Hora" },                         // 18
      { name: "Minute", ds: "Minuto" },                     // 19
      { name: "ChangeLang", ds: "Cambiar Idioma" },         // 20
      { name: "PressMode", ds: "Modo Presostato" },         // 21
      { name: "RelayMode", ds: "Modo Relé" },               // 22
      { name: "AuxModeSe", ds: "Modo Auxiliar" },             // 23
      { name: "MaxPumpHours", ds: "Horas Máx Bomba" }       // 24
    ]
  }
];

/**
 * Mock dei parametri (formato parseParam)
 */
export const MOCK_PARAMS = [
  // Parametri temperatura
  { id: 0, unit: "°C", type: 0, menuType: 0, min: 0, max: 50, step: 1, divisor: 1, shift: 0, default: 22 },
  { id: 1, unit: "°C", type: 0, menuType: 0, min: 1, max: 10, step: 1, divisor: 1, shift: 0, default: 2 },
  { id: 2, unit: "°C", type: 0, menuType: 0, min: -5, max: 5, step: 1, divisor: 10, shift: 0, default: 0 },
  { id: 3, unit: "", type: 1, menuType: 0, min: 0, max: 1, step: 1, divisor: 1, shift: 0, default: 1 },
  
  // Parametri umidità
  { id: 4, unit: "%", type: 0, menuType: 0, min: 0, max: 100, step: 1, divisor: 1, shift: 0, default: 60 },
  { id: 5, unit: "%", type: 0, menuType: 0, min: 1, max: 20, step: 1, divisor: 1, shift: 0, default: 5 },
  { id: 6, unit: "%", type: 0, menuType: 0, min: -10, max: 10, step: 1, divisor: 10, shift: 0, default: 0 },
  { id: 7, unit: "", type: 1, menuType: 0, min: 0, max: 1, step: 1, divisor: 1, shift: 0, default: 1 },
  
  // Parametri timer
  { id: 8, unit: "s", type: 0, menuType: 0, min: 1, max: 3600, step: 1, divisor: 1, shift: 0, default: 60 },
  { id: 9, unit: "s", type: 0, menuType: 0, min: 1, max: 3600, step: 1, divisor: 1, shift: 0, default: 30 },
  { id: 10, unit: "", type: 1, menuType: 0, min: 0, max: 1, step: 1, divisor: 1, shift: 0, default: 0 },
  
  // Parametri costanti
  { id: 11, unit: "", type: 1, menuType: 0, min: 0, max: 1, step: 1, divisor: 1, shift: 0, default: 0 },
  { id: 12, unit: "s", type: 0, menuType: 0, min: 1, max: 600, step: 1, divisor: 1, shift: 0, default: 10 },
  { id: 13, unit: "s", type: 0, menuType: 0, min: 1, max: 60, step: 1, divisor: 1, shift: 0, default: 5 },
  { id: 14, unit: "", type: 1, menuType: 0, min: 0, max: 1, step: 1, divisor: 1, shift: 0, default: 0 },
  
  // Data/Ora
  { id: 15, unit: "", type: 0, menuType: 0, min: 1, max: 31, step: 1, divisor: 1, shift: 0, default: 1 },
  { id: 16, unit: "", type: 0, menuType: 0, min: 1, max: 12, step: 1, divisor: 1, shift: 0, default: 1 },
  { id: 17, unit: "", type: 0, menuType: 0, min: 2020, max: 2100, step: 1, divisor: 1, shift: 0, default: 2025 },
  { id: 18, unit: "", type: 0, menuType: 0, min: 0, max: 23, step: 1, divisor: 1, shift: 0, default: 12 },
  { id: 19, unit: "", type: 0, menuType: 0, min: 0, max: 59, step: 1, divisor: 1, shift: 0, default: 0 },
  
  // Altri
  { id: 20, unit: "", type: 0, menuType: 0, min: 0, max: 2, step: 1, divisor: 1, shift: 0, default: 0 },
  { id: 21, unit: "", type: 0, menuType: 0, min: 1, max: 10, step: 1, divisor: 1, shift: 0, default: 3 },
  { id: 22, unit: "", type: 0, menuType: 0, min: 0, max: 2, step: 1, divisor: 1, shift: 0, default: 0 },
  { id: 23, unit: "", type: 2, menuType: 2, min: 0, max: 1, step: 1, divisor: 1, shift: 0, default: 1 },
  
  // ChangeLang (id: 24) - IMPORTANTE!
  { id: 24, unit: "", type: 8, menuType: 1, min: 0, max: 4, step: 1, divisor: 1, shift: 0, default: 1 }, // Default: ITALIAN
  
  // Dosatore
  { id: 25, unit: "s", type: 0, menuType: 0, min: 1, max: 3600, step: 1, divisor: 1, shift: 0, default: 10 },
  { id: 26, unit: "s", type: 0, menuType: 0, min: 1, max: 3600, step: 1, divisor: 1, shift: 0, default: 60 },
  
  // Ventola
  { id: 27, unit: "s", type: 0, menuType: 0, min: 1, max: 3600, step: 1, divisor: 1, shift: 0, default: 10 },
  { id: 28, unit: "s", type: 0, menuType: 0, min: 1, max: 3600, step: 1, divisor: 1, shift: 0, default: 60 },
  { id: 29, unit: "°C", type: 0, menuType: 0, min: 0, max: 50, step: 1, divisor: 1, shift: 0, default: 25 },
  { id: 30, unit: "°C", type: 0, menuType: 0, min: 1, max: 10, step: 1, divisor: 1, shift: 0, default: 2 },
  { id: 31, unit: "%", type: 0, menuType: 0, min: 0, max: 100, step: 1, divisor: 1, shift: 0, default: 70 },
  { id: 32, unit: "%", type: 0, menuType: 0, min: 1, max: 20, step: 1, divisor: 1, shift: 0, default: 5 },
];

/**
 * Mock della configurazione menu (formato parseMenu)
 * Lista dei menu attivi con parametri associati
 */
export const MOCK_MENU = [
  { menuId: 0, params: [3, 7, 10, 11, 14, 23] },    // Mode Enable
  { menuId: 1, params: [23, 9, 24] },                     // Timer
  { menuId: 2, params: [] },                         // Calendar (scheduler)
  { menuId: 3, params: [0, 1, 2] },                  // Temperature
  { menuId: 4, params: [4, 5, 6] },                  // Humidity
  { menuId: 5, params: [15, 16, 17, 18, 19] },      // Clock
  { menuId: 6, params: [12, 13, 20, 21, 22, 24] },  // Settings (include ChangeLang)
];

/**
 * Mock degli scheduler (formato parseTimeSlot)
 */
export const MOCK_SCHEDULER = [
  {
    id: 0,
    start: "08:00",
    stop: "12:00",
    days: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false }
  },
  {
    id: 1,
    start: "14:00",
    stop: "18:00",
    days: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false }
  }
];

/**
 * Carica i dati mock nello Store
 * @param {object} Store - Istanza Store
 * @param {object} Paths - Costanti paths
 */
export function loadMockData(Store, Paths) {
  // Carica traduzioni
  Store.set(Paths.LOCALIZATION.LANGS, MOCK_LANGS);
  
  // Imposta lingua default (ITALIAN = index 1)
  const defaultLangIndex = 1;
  Store.set(Paths.LOCALIZATION.CURRENT_LANG_INDEX, defaultLangIndex);
  
  // Arricchisci parametri con name e ds dalla lingua corrente
  const currentLang = MOCK_LANGS[defaultLangIndex];
  const enrichedParams = MOCK_PARAMS.map((param, index) => {
    // Usa l'indice per trovare la traduzione corrispondente
    const translation = currentLang.param[index];
    
    return {
      ...param,
      name: translation ? translation.name : `Param ${param.id}`,
      ds: translation ? translation.ds : `Description for parameter ${param.id}`,
      value: param.default // Aggiungi anche il valore iniziale
    };
  });
  
  // Carica parametri arricchiti
  Store.set(Paths.CONFIG.PARAMS, enrichedParams);
  
  // Carica menu
  Store.set(Paths.CONFIG.MENU, MOCK_MENU);
  
  // Carica scheduler
  Store.set(Paths.RUNTIME.SCHEDULER, MOCK_SCHEDULER);

  // 🧪 Seed rich initial runtime state so the UI (Home, sensors, modes, power, etc.) looks alive
  seedMockRuntimeState(Store, Paths);
}

/**
 * Initial realistic runtime snapshot (what an UPDATE message would populate).
 * This makes sensors, mode LEDs, pump icon, timers, maintenance etc. visible immediately.
 */
export function seedMockRuntimeState(Store, Paths) {
  const R = Paths.RUNTIME;

  // Sensors — plausible room values
  Store.set(R.SENSORS.TEMP_CONNECTED, true);
  Store.set(R.SENSORS.TEMP_VALUE, 21.8);
  Store.set(R.SENSORS.HUM_CONNECTED, true);
  Store.set(R.SENSORS.HUM_VALUE, 57.5);
  Store.set(R.SENSORS.PRESSURE, 0); // 0 = normal

  // Modes (some enabled + a couple active for nice visual)
  Store.set(R.MODES.TEMP_ENABLED, true);
  Store.set(R.MODES.TEMP_ACTIVE, true);
  Store.set(R.MODES.HUM_ENABLED, true);
  Store.set(R.MODES.HUM_ACTIVE, false);
  Store.set(R.MODES.TIMER_ENABLED, true);
  Store.set(R.MODES.TIMER_ACTIVE, false);
  Store.set(R.MODES.CAL_ENABLED, false);
  Store.set(R.MODES.CAL_ACTIVE, false);
  Store.set(R.MODES.AUX_ENABLED, false);
  Store.set(R.MODES.AUX_ACTIVE, false);
  Store.set(R.MODES.WIFI_ENABLED, true);
  Store.set(R.MODES.WIFI_ACTIVE, true);

  // Outputs
  Store.set(R.OUTPUTS.PUMP, 1);      // PumpState.ON
  Store.set(R.OUTPUTS.RELAY, false);
  Store.set(R.OUTPUTS.DRAIN, false);

  // Alerts
  Store.set(R.ALERTS.IS_MODIFING, false);
  Store.set(R.ALERTS.IS_ANTIBACTERIAL_ERROR, false);

  // Timers (example running timer values)
  Store.set(R.TIMERS.MODE_ON, 45);
  Store.set(R.TIMERS.MODE_OFF, 15);

  // Maintenance counters (hours)
  Store.set(R.TIMERS.MAINTENANCE.ABSOLUTE_TIME, 1240);
  Store.set(R.TIMERS.MAINTENANCE.TIME_LEFT, 320);
  Store.set(R.TIMERS.MAINTENANCE.IS_MAINTENANCE, false);

  // RTC (will be advanced by the emulator)
  Store.set(R.RTC.TIME, "14:37");
  Store.set(R.RTC.DAY, 3); // e.g. Wednesday

  // WiFi connection mode (AP/STA) — helps some cards
  // (ConnectionMode is imported in App, we just set a friendly value here)
  try {
    Store.set("wifi.connectionMode", "AP");
  } catch (_) {}
}

/**
 * Starts a lightweight live emulator.
 * Makes temperature/humidity drift, advances the RTC clock, occasionally
 * toggles pump or active states so the dashboard feels "running".
 *
 * @returns {Function} stop() — call to cancel the interval
 */
export function startMockEmulator(Store, Paths) {
  const R = Paths.RUNTIME;
  let tick = 0;

  const id = setInterval(() => {
    tick++;

    // --- Drift sensors a little ---
    const t = Store.get(R.SENSORS.TEMP_VALUE) ?? 21.5;
    const h = Store.get(R.SENSORS.HUM_VALUE) ?? 58;

    // small realistic noise
    const newT = Math.max(18, Math.min(27, +(t + (Math.random() - 0.5) * 0.6).toFixed(1)));
    const newH = Math.max(35, Math.min(80, +(h + (Math.random() - 0.5) * 1.2).toFixed(1)));

    Store.set(R.SENSORS.TEMP_VALUE, newT);
    Store.set(R.SENSORS.HUM_VALUE, newH);

    // --- Advance RTC clock (every ~3s of real time ≈ 1 minute) ---
    if (tick % 3 === 0) {
      const timeStr = Store.get(R.RTC.TIME) || "14:37";
      const [hh, mm] = timeStr.split(":").map(n => parseInt(n, 10) || 0);
      let newMin = mm + 1;
      let newHour = hh;
      if (newMin >= 60) {
        newMin = 0;
        newHour = (newHour + 1) % 24;
      }
      const newTime = `${String(newHour).padStart(2, "0")}:${String(newMin).padStart(2, "0")}`;
      Store.set(R.RTC.TIME, newTime);
    }

    // --- Occasionally flip pump state or active flags for demo liveliness ---
    if (tick % 12 === 0) {
      const pump = Store.get(R.OUTPUTS.PUMP) ?? 0;
      const tempActive = Store.get(R.MODES.TEMP_ACTIVE) ?? false;

      // If temperature mode is active, let the pump "cycle"
      if (tempActive) {
        Store.set(R.OUTPUTS.PUMP, pump ? 0 : 1);
      }
    }

    // Small chance to flip humidity active for visual variety
    if (tick % 25 === 0) {
      const humActive = Store.get(R.MODES.HUM_ACTIVE) ?? false;
      Store.set(R.MODES.HUM_ACTIVE, !humActive);
    }

    // Maintenance countdown demo (very slow)
    if (tick % 40 === 0) {
      const left = Store.get(R.TIMERS.MAINTENANCE.TIME_LEFT) ?? 300;
      if (left > 10) {
        Store.set(R.TIMERS.MAINTENANCE.TIME_LEFT, left - 1);
      }
    }
  }, 1600); // ~every 1.6s feels alive without being frantic

  // Return stopper so App can clean up on hot-reload / navigation if desired
  return () => clearInterval(id);
}

/* ============================================================
   MOCK COMMAND EFFECTS (so clicks actually do something)
   ============================================================ */

/**
 * Parse a command the UI tried to send and apply a realistic local effect.
 * This is what makes buttons (Power, mode toggles, param edits, time slots)
 * feel responsive while in full emulation mode.
 */
export function applyMockCommandEffect(raw) {
  if (!raw || typeof raw !== "string") return;

  const [header, body = ""] = raw.split("|", 2);

  // MODIFY_PARAM|id☺value   → simulate ESP echo as MODIFY
  if (header === "MODIFY_PARAM" || header === "CMD_MODIFY_PARAM") {
    const [idStr, valStr] = body.split("☺");
    const id = parseInt(idStr, 10);
    const value = parseInt(valStr, 10);
    if (!Number.isNaN(id)) {
      // Feed a MODIFY message exactly like the real adapter expects
      const modifyMsg = `MODIFY|${id},${value}`;
      // We import dispatch dynamically to avoid circular issues at top level
      import("../core/adapter.js").then(({ dispatchMessage }) => {
        dispatchMessage(modifyMsg);
      }).catch(() => {});
    }
    return;
  }

  // PUMP_STATE|0 or |1
  if (header === "PUMP_STATE" || header === "CMD_PUMP_STATE") {
    const val = parseInt(body, 10) || 0;
    import("../core/adapter.js").then(({ dispatchMessage }) => {
      // Build a minimal UPDATE that only touches pump + keep other fields stable
      // We reuse the test helper builder if available
      const msg = `UPDATE|1,1,1,1,1,0,1,0,0,0,0,0,1,1,0,0,0,${val},0,0,0,21.5,55.0,14:38,3,1.2.3,1200,300`;
      dispatchMessage(msg);
    }).catch(() => {
      // Fallback direct Store write if dispatch not reachable
      try {
        const { Store } = require("../core/store.js"); // won't work in ESM, ignore
      } catch (_) {}
    });
    return;
  }

  // MODIFY_TIME_SLOT and DELETE_TIME_SLOT — the pages already update the scheduler list
  // via their own logic or we can just let the existing scheduler Store path work.
  // For full round-trip we can re-emit a TIME_SLOT snapshot if needed.
  if (header === "MODIFY_TIME_SLOT" || header === "DELETE_TIME_SLOT") {
    // The TimeSlot editor components usually write directly or rely on server echo.
    // For now we do nothing extra — scheduler list is already local.
    // If you want stronger echo, we could re-broadcast the current scheduler.
    return;
  }

  // REQ_MSG|TYPE (bootstrap pull requests) — in mock we already have everything loaded.
  if (header === "REQ_MSG") {
    // Optionally you could re-dispatch cached snapshots here.
    return;
  }
}

/**
 * Installs a global short-circuit so that when the app is in mock mode,
 * CommandManager (and any direct Socket.send) produce visible UI effects.
 *
 * It wraps Socket.send at runtime.
 */
export function installMockCommandEffects() {
  // We do a very small runtime patch on the Socket module.
  // This is only active while the dev server is running in mock mode.
  import("../core/socket.js").then(({ Socket }) => {
    const originalSend = Socket.send;

    // Avoid double-wrapping on HMR
    if (originalSend && originalSend._isMockWrapped) return;

    const wrappedSend = (msg) => {
      // Always try to apply local effect first (great for dev)
      try { applyMockCommandEffect(msg); } catch (e) { /* ignore */ }

      // Also call original (it will just warn because no WS, that's fine)
      try {
        originalSend.call(Socket, msg);
      } catch (_) {}
    };
    wrappedSend._isMockWrapped = true;

    // Replace the function on the object (Socket is the IIFE return value)
    try {
      Socket.send = wrappedSend;
    } catch (_) {
      // If the module doesn't allow mutation, the applyMockCommandEffect
      // path above (called from other places) is still useful.
    }
  }).catch(() => {
    // Socket not available yet — effects will still work for the
    // high-level CommandManager.modifyParameter etc because many of them
    // go through paths that we can also intercept at a higher level if needed.
  });

  console.log("%c[MockEmulator] Command effects installed — UI interactions will be simulated locally.", "color:#4ade80");
}
