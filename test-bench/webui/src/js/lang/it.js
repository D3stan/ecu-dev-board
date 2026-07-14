/**
 * it.js — Italian localization data
 * Source of truth: src/lang/stringParameter.h (lang_it), DayOfWeek.h (daysIt), menuName.cpp (menuIt)
 *
 * Structure consumed by buildLangData() → Store.LOCALIZATION.LANGS[1]
 *   menuName   → lang_it menu labels (11 entries, order matches ESP menuName.cpp)
 *   daysLetter → single-char weekday abbreviations matching DayOfWeek::daysIt[]
 *   param      → 41 entries { name, ds } matching lang_it[PARAMS_NUM] in stringParameter.h
 */
export default {
  menuName: [
    "Temperatura",    // 0: temperature
    "Umidita'",       // 1: humidity
    "Timer",          // 2: timer
    "Calendario",     // 3: calendar
    "Orologio",       // 4: clock
    "Costanti",       // 5: constant
    "AbilitaMode",    // 6: modeEnable
    "wifi-delete",    // 7: WIFI placeholder (matches ESP AppendMenu)
    "Ventilatore",    // 8: fan
    "Dosatore",       // 9: dispenser
    "Antibatterico",  // 10: antibacterial
    "Modbus"          // 11: modebus
  ],

  // DayOfWeek::daysIt[] — Lun … Dom
  daysLetter: ["L", "M", "M", "G", "V", "S", "D"],

  // lang_it[PARAMS_NUM] — 41 entries, index matches ParamId enum
  param: [
    /* 0  SetTemp            */ { name: "Soglia Temp.",  ds: "Soglia di temperatura.\nAccende sotto soglia\nSpegne sopra soglia+\ndiff. spegnimento" },
    /* 1  DifTemp            */ { name: "Diff. Soglia",  ds: "Differenziale soglia.\nValore da sommare\nalla Soglia per lo\nspegnimento" },
    /* 2  AdjTemp            */ { name: "Correz.Temp",   ds: "Correzione lettura\ntemperatura ambiente." },
    /* 3  AbilitaTemp        */ { name: "Abil. Temp",    ds: "Abilita Soglia Temp.\nSe disattiva(OFF),\nla macchina funziona\nindipendentemente\ndalla temperatura." },
    /* 4  SetRh              */ { name: "Soglia Umid.",  ds: "Soglia di umidità.\nAccende sotto soglia.\nSpegne sopra sogli+\ndiff. spegnimento." },
    /* 5  DifRh              */ { name: "Diff. Umid",    ds: "Differenziale umidità.\nValore da sommare\nalla soglia di umidità\nsper lo spegnimento." },
    /* 6  AdjRh              */ { name: "Correz. Umid",  ds: "Correzzione lettura\numidità ambiente.\n" },
    /* 7  AbilitaRh          */ { name: "Abil. Umid.",   ds: "Abilita soglia umidità\nSe disattiva(OFF)\nla macchina funziona\nindipendentemente\ndall'umidità ambiente." },
    /* 8  TimerON            */ { name: "Tempo acc.",    ds: "Tempo accensione.\nDurata accensione\nfra una pausa\ne l'altra [mm.ss]." },
    /* 9  TimerOFF           */ { name: "Tempo pausa",   ds: "Durata della pausa\nfra un ciclo e il \nsuccessivo [mm.ss]." },
    /* 10 AbilitaTimer       */ { name: "Abil. Tempo",   ds: "Abilita temporizzatore.\nSe disattiva (OFF),\nla macchina funziona\nsenza cicli di accensione\ne pausa." },
    /* 11 AbleCalendar       */ { name: "Abil. Calend",  ds: "Abilita calendario.\nSe attivo (ON), la\nmacchina funziona\nsolo nei giorni e\n orari programmati\n nel calendario.\n" },
    /* 12 TempoScarico       */ { name: "TempoScarico",  ds: "Tempo di scarico.\nDurata svuotamento\nlinea dopo lo\nspegnimento della\nmacchina [sec.]" },
    /* 13 PressDelay         */ { name: "Rit. Press.",   ds: "Ritardo [sec.]\ncontrollo pressione\nper dare tempo alla\nlinea di andare\nin pressione." },
    /* 14 AbleAux            */ { name: "Abil. Start",   ds: "Abilita ingresso\ndi start (AUX).\nSe disattivo (OFF)\nla macchina ignora\nlo stato di start" },
    /* 15 TimeDay            */ { name: "Giorno",        ds: "Giorno del mese.\nImposta il giorno\ncorrente della\nmacchina [1..31]" },
    /* 16 TimeMonth          */ { name: "Mese",          ds: "Mese dell'anno.\nImposta il mese\ncorrente della\nmacchina [1..12]" },
    /* 17 TimeYear           */ { name: "Anno",          ds: "Anno corrente.\nImposta l'anno\ncorrente della\nmacchina" },
    /* 18 TimeHour           */ { name: "Ora",           ds: "Ora corrente.\nImposta l'ora\ncorrente della\nmacchina [0..23]" },
    /* 19 TimeMinute         */ { name: "Minuti",        ds: "Minuti correnti.\nImposta i minuti\ncorrenti della\nmacchina [0..59]" },
    /* 20 TypePressureSwitch */ { name: "Tipo Press.",   ds: "Tipo pressostato\nmontato\n[NC/NO/Disabilita]\nse impostato\nDisabilitato\nsignifica che il\npressostato viene\nbypassato, quindi\nc'è sempre\npressione" },
    /* 21 MaxStartAttempts   */ { name: "Tentativi",     ds: "Numero massimo di\ntentativi di\naccensione macchina\nse il pressostato\nnon rileva acqua." },
    /* 22 RelayMode          */ { name: "Modo relè",     ds: "Seleziona funzione\ndel relè d'uscita:\nbypass, ventilatore,\ndosatore o antibatt." },
    /* 23 AbleWifi           */ { name: "Abilita App",   ds: "Se disattiva (OFF),\nla macchina non può\nessere accesa\ntramite app." },
    /* 24 ChangeLang         */ { name: "Lingua Menù",   ds: "Seleziona la lingua \ndel menù\ndella macchina." },
    /* 25 TimerOnDispenser   */ { name: "Tempo Dos.",    ds: "Durata accensione\ndosatore fra una pausa\ne l'altra [mm:ss]" },
    /* 26 TimerOffDispenser  */ { name: "Pausa Dos.",    ds: "Durata pausa fra\nun'accensione e \nl'altra del dosatore\n[mm:ss]." },
    /* 27 TimerOnFan         */ { name: "TimerOnFan",    ds: "Tempo ON ventola.\nDurata accensione.\nDurante ON soffia.\nUsa mm:ss.\nEsempio: ON=10s,\nOFF=20s -> 10s ON,\n20s pausa, ciclico." },
    /* 28 TimerOffFan        */ { name: "TimerOffFan",   ds: "Tempo OFF ventola.\nPausa tra cicli.\nVentola spenta.\nUsa mm:ss.\nEsempio: ON=10s,\nOFF=20s -> 10s ON,\n20s OFF, ripete." },
    /* 29 SetFanTemp         */ { name: "SetFanTemp",    ds: "Soglia T ventola.\nAccende sopra set.\nSpegne quando T\nscende sotto\nset-dif.\nEsempio: set=30.0,\ndif=1.0 -> ON 30.0,\nOFF 29.0." },
    /* 30 DifFanTemp         */ { name: "DifFanTemp",    ds: "Isteresi T ventola.\nDelta per spegnere.\nOFF sotto set-dif.\nStabilizza comm.\nEsempio: set=30.0,\ndif=1.0 -> OFF\n29.0." },
    /* 31 SetFanHum          */ { name: "SetFanHum",     ds: "Soglia RH ventola.\nAccende sopra set.\nSpegne quando RH\nscende sotto\nset-dif.\nEsempio: set=60%,\ndif=5% -> ON 60%,\nOFF 55%." },
    /* 32 DiffFanHum         */ { name: "DiffFanHum",    ds: "Isteresi RH ventola.\nDelta per spegnere.\nOFF sotto set-dif.\nStabilizza ciclo.\nEsempio: set=60%,\ndif=5% -> OFF\n55%." },
    /* 33 FanDelayAfterOff   */ { name: "Rit. Vent.",    ds: "Ritardo spegnimento\nventilatore dopo\nlo spegnimento pompa\n[sec.]" },
    /* 34 AntiBactDelay      */ { name: "Avvio A.B.",    ds: "Avvio ciclo antibat.\ndopo ore di inattività\ndella macchina [ore]." },
    /* 35 AntiBactTimer      */ { name: "Durata A.B",    ds: "Durata ciclo\nantibatterico [mm:ss].\n" },
    /* 36 AutoClockUpdate    */ { name: "Auto ora",      ds: "Aggiorn. automatico\norologio.\nSe attivo (ON)\nl'orologio si aggiorna\nautomat. con app" },
    /* 37 TypeAuxInput       */ { name: "Tipo Aux",      ds: "Tipo di segnale\ningresso AUX:\n[NC,NO]" },
    /* 38 TimeLowPressure    */ { name: "Pausa B.P.",    ds: "Tempo di pausa\nprima di riaccendere\nla pompa se viene\nrilevata bassa\npressione [sec.]" },
    /* 39 ModbusBaudRate     */ { name: "BoundRate",     ds: "Imposta la velocità\nbaud della\ncomunicazione\nModbus." },
    /* 40 ModbusDeviceID     */ { name: "DeviceID",      ds: "Imposta l'ID\ndel dispositivo\nModbus (1-247)." }
  ]
};
