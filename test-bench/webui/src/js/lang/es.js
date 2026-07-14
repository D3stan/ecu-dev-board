/**
 * es.js — Spanish localization data
 * Source of truth: src/lang/stringParameter.h (lang_es), DayOfWeek.h (daysEs), menuName.cpp (menuEs)
 *
 * Structure consumed by buildLangData() → Store.LOCALIZATION.LANGS[4]
 *   menuName   → lang_es menu labels (11 entries, order matches ESP menuName.cpp)
 *   daysLetter → single-char weekday abbreviations matching DayOfWeek::daysEs[]
 *   param      → 41 entries { name, ds } matching lang_es[PARAMS_NUM] in stringParameter.h
 */
export default {
  menuName: [
    "Temperatura",    // 0: temperature
    "Humedad",        // 1: humidity
    "Temporizador",   // 2: timer
    "Calendario",     // 3: calendar
    "Reloj",          // 4: clock
    "Constantes",     // 5: constant
    "HabilitarModo",  // 6: modeEnable
    "wifi-delete",    // 7: WIFI placeholder (matches ESP AppendMenu)
    "Ventilador",     // 8: fan
    "Dosificador",    // 9: dispenser
    "Antibacteriano", // 10: antibacterial
    "Modbus"          // 11: modebus
  ],

  // DayOfWeek::daysEs[] — Lun … Dom
  daysLetter: ["L", "M", "X", "J", "V", "S", "D"],

  // lang_es[PARAMS_NUM] — 41 entries, index matches ParamId enum
  param: [
    /* 0  SetTemp            */ { name: "TempSet",       ds: "Temperatura de\nconsigna.\nEnciende bajo set,\napaga sobre\nset+difTemp." },
    /* 1  DifTemp            */ { name: "DifTemp",       ds: "Histéresis temp.\nReduce encendidos/\napagados.\nApaga sobre\nset+difTemp." },
    /* 2  AdjTemp            */ { name: "CalibTemp",     ds: "Calibración\nsonda T.\nCorrige lectura.\nEj: +1.0 suma\n1°C al valor." },
    /* 3  AbilitaTemp        */ { name: "ActTemp",       ds: "Activa control\nde temperatura.\nON usa sonda T,\nOFF la ignora." },
    /* 4  SetRh              */ { name: "HumSet",        ds: "Humedad de set.\nEnciende si RH ≤ set.\nApaga sobre\nset+difRh." },
    /* 5  DifRh              */ { name: "DifHum",        ds: "Histéresis hum.\nEstabiliza ciclo.\nApaga cuando RH\n> set+difRh." },
    /* 6  AdjRh              */ { name: "CalibHum",      ds: "Calibración\nsonda RH.\nCorrige lectura.\nEj: +1.0 suma\n1% al valor." },
    /* 7  AbilitaRh          */ { name: "ActHum",        ds: "Activa control\nde humedad.\nON usa sonda RH,\nOFF la ignora." },
    /* 8  TimerON            */ { name: "TimOn",         ds: "Tiempo ON ciclo.\nNebulización en\nmm:ss." },
    /* 9  TimerOFF           */ { name: "TimOff",        ds: "Tiempo OFF ciclo.\nPausa entre ciclos\nen mm:ss." },
    /* 10 AbilitaTimer       */ { name: "ActTimer",      ds: "Activa tempor.\ncíclico.\nON sigue ON/OFF,\nOFF ignora timer." },
    /* 11 AbleCalendar       */ { name: "ActCal",        ds: "Activa calendario.\nON sigue días y\nhoras.\nOFF lo ignora." },
    /* 12 TempoScarico       */ { name: "Vaciado",       ds: "Tiempo vaciado.\nVacía la línea\nde agua al fin\ndel ciclo.\nSegundos." },
    /* 13 PressDelay         */ { name: "RetPres",       ds: "Retardo lectura\nde presostato.\nEspera X seg antes\nde verificar." },
    /* 14 AbleAux            */ { name: "ActAux",        ds: "Activa entrada\nAUX junto con\notras condiciones.\nOFF la ignora." },
    /* 15 TimeDay            */ { name: "Dia",           ds: "Día del mes.\nValores 1..31.\nConfigura fecha." },
    /* 16 TimeMonth          */ { name: "Mes",           ds: "Mes del año.\nValores 1..12.\nConfigura fecha." },
    /* 17 TimeYear           */ { name: "Ano",           ds: "Año actual.\nConfigura año\ndel calendario." },
    /* 18 TimeHour           */ { name: "Hora",          ds: "Hora actual.\nValores 0..23." },
    /* 19 TimeMinute         */ { name: "Minuto",        ds: "Minutos actuales.\nValores 0..59." },
    /* 20 TypePressureSwitch */ { name: "Tipo Pres.",    ds: "Tipo de presostato\ninstalado:\n[NC/NO/Desactivado]\nsi se pone en\nDesactivado sig-\nnifica que el pre-\nsostato se omite,\npor lo tanto hay\nsiempre presión" },
    /* 21 MaxStartAttempts   */ { name: "MaxArranq",     ds: "Máx intentos\nde arranque\nbomba.\nLuego bloqueo\nseguridad." },
    /* 22 RelayMode          */ { name: "ModoRele",      ds: "Escoger uso\ndel relé." },
    /* 23 AbleWifi           */ { name: "ActWifi",       ds: "Activa conexión\nWiFi." },
    /* 24 ChangeLang         */ { name: "Idioma",        ds: "Cambiar idioma\nde interfaz." },
    /* 25 TimerOnDispenser   */ { name: "TimOnDos",      ds: "Tiempo ON\ndosificador.\nDurante ON\ndispensa.\nUsa mm:ss.\nEj: ON=10s,\nOFF=20s -> 10s ON,\n20s pausa." },
    /* 26 TimerOffDispenser  */ { name: "TimOffDos",     ds: "Tiempo OFF\ndosificador.\nPausa entre\nciclos.\nNo dispensa.\nUsa mm:ss.\nEj: ON=10s,\nOFF=20s -> 10s ON,\n20s OFF." },
    /* 27 TimerOnFan         */ { name: "TimOnVent",     ds: "Tiempo ON\nventilador.\nDurante ON sopla.\nUsa mm:ss.\nEj: ON=10s,\nOFF=20s -> 10s ON,\n20s pausa." },
    /* 28 TimerOffFan        */ { name: "TimOffVent",    ds: "Tiempo OFF\nventilador.\nPausa entre ciclos.\nVentilador apag.\nUsa mm:ss.\nEj: ON=10s,\nOFF=20s -> 10s ON,\n20s OFF." },
    /* 29 SetFanTemp         */ { name: "TempVent",      ds: "Umbral T\nventilador.\nON sobre set.\nOFF cuando T <\nset-dif.\nEj: set=30.0,\ndif=1.0 -> ON 30.0,\nOFF 29.0." },
    /* 30 DifFanTemp         */ { name: "DifVent",       ds: "Histéresis T\nventilador.\nDelta apagado.\nOFF bajo set-dif.\nEj: set=30.0,\ndif=1.0 -> OFF\n29.0." },
    /* 31 SetFanHum          */ { name: "HumVent",       ds: "Umbral RH\nventilador.\nON sobre set.\nOFF cuando RH <\nset-dif.\nEj: set=60%,\ndif=5% -> ON 60%,\nOFF 55%." },
    /* 32 DiffFanHum         */ { name: "DifVentHum",    ds: "Histéresis RH\nventilador.\nDelta apagado.\nOFF bajo set-dif.\nEj: set=60%,\ndif=5% -> OFF\n55%." },
    /* 33 FanDelayAfterOff   */ { name: "VentDelay",     ds: "Tiempo de post-\nventilación tras\napagar la bomba.\nFavorece secado\ny enfriamiento." },
    /* 34 AntiBactDelay      */ { name: "ABDelay",       ds: "Horas inactivas\nantes del ciclo\nantibacteriano.\nEvita estancam.\nde agua." },
    /* 35 AntiBactTimer      */ { name: "ABTimer",       ds: "Duración del ciclo\nantibacteriano.\nTiempo de activac.\nde válvula para\nrenovar agua." },
    /* 36 AutoClockUpdate    */ { name: "AutoReloj",     ds: "Actualiza reloj\nautomáticamente.\nON: se sincroniza\ncon el móvil.\nOFF: sin actualización." },
    /* 37 TypeAuxInput       */ { name: "Tipo Entrada",  ds: "Tipo de señal AUX:\n[NC/NO]" },
    /* 38 TimeLowPressure    */ { name: "Tiempo B.P.",   ds: "Tiempo de pausa\nantes de reiniciar\nla bomba cuando se\ndetecta baja pres-\nsión [seg.]" },
    /* 39 ModbusBaudRate     */ { name: "BoundRate",     ds: "Configura la\nvelocidad baud\npara comunicación\nModbus." },
    /* 40 ModbusDeviceID     */ { name: "DeviceID",      ds: "Configura el ID\ndel dispositivo\nModbus (1-247)." }
  ]
};
