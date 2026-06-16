/**
 * de.js — German localization data
 * Source of truth: src/lang/stringParameter.h (lang_de), DayOfWeek.h (daysDe), menuName.cpp (menuDe)
 *
 * Structure consumed by buildLangData() → Store.LOCALIZATION.LANGS[3]
 *   menuName   → lang_de menu labels (11 entries, order matches ESP menuName.cpp)
 *   daysLetter → single-char weekday abbreviations matching DayOfWeek::daysDe[]
 *   param      → 41 entries { name, ds } matching lang_de[PARAMS_NUM] in stringParameter.h
 */
export default {
  menuName: [
    "Temperatur",     // 0: temperature
    "Feuchtigkeit",   // 1: humidity
    "Timer",          // 2: timer
    "Kalender",       // 3: calendar
    "Uhr",            // 4: clock
    "Konstanten",     // 5: constant
    "ModusAktivieren",// 6: modeEnable
    "wifi-delete",    // 7: WIFI placeholder (matches ESP AppendMenu)
    "Ventilator",     // 8: fan
    "Dosierer",       // 9: dispenser
    "Antibakteriell", // 10: antibacterial
    "Modbus"          // 11: modebus
  ],

  // DayOfWeek::daysDe[] — Mo … So
  daysLetter: ["M", "D", "M", "D", "F", "S", "S"],

  // lang_de[PARAMS_NUM] — 41 entries, index matches ParamId enum
  param: [
    /* 0  SetTemp            */ { name: "TempSet",       ds: "Soll-Temp.\nEinschalten unter\nSet, ausschalten\nüber Set+DifTemp." },
    /* 1  DifTemp            */ { name: "DifTemp",       ds: "Temp-Hysterese.\nReduziert häufiges\nEin/Aus.\nAus über\nSet+DifTemp." },
    /* 2  AdjTemp            */ { name: "KalibTemp",     ds: "Fühler T Abgleich.\nKorrigiert Wert.\nBsp: +1.0 addiert\n1°C zur Messung." },
    /* 3  AbilitaTemp        */ { name: "AktTemp",       ds: "Temp-Regelung\naktivieren.\nON nutzt T-Fühler,\nOFF ignoriert." },
    /* 4  SetRh              */ { name: "FeuchtSet",     ds: "Soll-Feuchte.\nEin bei RH ≤ Set.\nAus über\nSet+DifRh." },
    /* 5  DifRh              */ { name: "DifFeucht",     ds: "Feuchte-Hysterese.\nStabilisiert Zyklus.\nAus wenn RH >\nSet+DifRh." },
    /* 6  AdjRh              */ { name: "KalibFeucht",   ds: "Fühler RH Abgleich.\nKorrigiert Wert.\nBsp: +1.0 addiert\n1% zur Messung." },
    /* 7  AbilitaRh          */ { name: "AktFeucht",     ds: "Feuchte-Regelung\naktivieren.\nON nutzt RH-Fühler,\nOFF ignoriert." },
    /* 8  TimerON            */ { name: "TimOn",         ds: "EIN-Zeit Zyklus.\nBefeuchtung in\nmm:ss." },
    /* 9  TimerOFF           */ { name: "TimOff",        ds: "AUS-Zeit Zyklus.\nPause zwischen\nZyklen in mm:ss." },
    /* 10 AbilitaTimer       */ { name: "AktTimer",      ds: "Zyklustimer\naktivieren.\nON folgt EIN/AUS,\nOFF ignoriert." },
    /* 11 AbleCalendar       */ { name: "AktKal",        ds: "Kalender aktiv.\nON folgt Tagen\nund Stunden.\nOFF ignoriert." },
    /* 12 TempoScarico       */ { name: "Entleeren",     ds: "Entleerzeit.\nLeert Wasserleitung\nam Zyklusende.\nSekunden." },
    /* 13 PressDelay         */ { name: "PresDelay",     ds: "Druckschalter-\nVerzögerung.\nWarte X Sekunden\nvor Prüfung." },
    /* 14 AbleAux            */ { name: "AktAux",        ds: "AUX-Eingang aktiv.\nUND mit anderen\nBedingungen.\nOFF ignoriert." },
    /* 15 TimeDay            */ { name: "Tag",           ds: "Tag des Monats.\nWerte 1..31.\nDatum setzen." },
    /* 16 TimeMonth          */ { name: "Monat",         ds: "Monat des Jahres.\nWerte 1..12.\nDatum setzen." },
    /* 17 TimeYear           */ { name: "Jahr",          ds: "Aktuelles Jahr.\nJahreszahl im\nKalender setzen." },
    /* 18 TimeHour           */ { name: "Stunde",        ds: "Aktuelle Stunde.\nWerte 0..23." },
    /* 19 TimeMinute         */ { name: "Minute",        ds: "Aktuelle Minuten.\nWerte 0..59." },
    /* 20 TypePressureSwitch */ { name: "Typ Druck.",    ds: "Typ des instal-\nlierten Druck-\nschalters:\n[NC/NO/Deaktiviert]\nwenn auf Deakti-\nviert gesetzt be-\ndeutet dass Druck-\nschalter umgangen,\nalso immer Druck\nvorhanden" },
    /* 21 MaxStartAttempts   */ { name: "MaxStart",      ds: "Max Startversuche\nPumpe.\nDann Sperre zur\nSicherheit." },
    /* 22 RelayMode          */ { name: "RelaisMod",     ds: "Relais-Betrieb\nwählen." },
    /* 23 AbleWifi           */ { name: "AktWifi",       ds: "WiFi-Verbindung\naktivieren." },
    /* 24 ChangeLang         */ { name: "Sprache",       ds: "Sprache ändern\nfür Interface." },
    /* 25 TimerOnDispenser   */ { name: "TimOnDos",      ds: "EIN-Zeit Dosierer.\nAktivdauer.\nWährend EIN\ndosiert.\nmm:ss Format.\nBsp: EIN=10s,\nAUS=20s -> 10s EIN,\n20s Pause." },
    /* 26 TimerOffDispenser  */ { name: "TimOffDos",     ds: "AUS-Zeit Dosierer.\nPause zwischen\nZyklen.\nKeine Dosierung.\nmm:ss Format.\nBsp: EIN=10s,\nAUS=20s -> 10s EIN,\n20s AUS." },
    /* 27 TimerOnFan         */ { name: "TimOnLuft",     ds: "EIN-Zeit Lüfter.\nLaufdauer.\nWährend EIN bläst.\nmm:ss Format.\nBsp: EIN=10s,\nAUS=20s -> 10s EIN,\n20s Pause." },
    /* 28 TimerOffFan        */ { name: "TimOffLuft",    ds: "AUS-Zeit Lüfter.\nPause zwischen\nZyklen.\nLüfter AUS.\nmm:ss Format.\nBsp: EIN=10s,\nAUS=20s -> 10s EIN,\n20s AUS." },
    /* 29 SetFanTemp         */ { name: "LuftTemp",      ds: "Lüfter Temp-\nSchwelle.\nEIN über Set.\nAUS wenn T <\nSet-Dif.\nBsp: Set=30.0,\nDif=1.0 -> EIN 30,\nAUS 29." },
    /* 30 DifFanTemp         */ { name: "DifLuft",       ds: "Temp-Hysterese\nfür Lüfter.\nDelta AUS.\nAUS unter Set-Dif.\nBsp: Set=30.0,\nDif=1.0 -> AUS 29." },
    /* 31 SetFanHum          */ { name: "LuftFeucht",    ds: "RH-Schwelle\nLüfter.\nEIN über Set.\nAUS wenn RH <\nSet-Dif.\nBsp: Set=60%,\nDif=5% -> EIN 60,\nAUS 55." },
    /* 32 DiffFanHum         */ { name: "DifLuftHum",    ds: "RH-Hysterese\nfür Lüfter.\nDelta AUS.\nAUS unter Set-Dif.\nBsp: Set=60%,\nDif=5% -> AUS 55." },
    /* 33 FanDelayAfterOff   */ { name: "VentDelay",     ds: "Nachlaufzeit der\nLüftung nach Pump-\naus. Unterstützt\nTrocknung und\nKühlung." },
    /* 34 AntiBactDelay      */ { name: "ABDelay",       ds: "Stunden Inaktiv.\nvor Start des\nAntibakter.-Zyklus.\nVermeidet Wasser-\nstand." },
    /* 35 AntiBactTimer      */ { name: "ABTimer",       ds: "Dauer des Anti-\nbakterienzyklus.\nVentilaktivierung\nzur Wassererneu." },
    /* 36 AutoClockUpdate    */ { name: "AutoUhr",       ds: "Uhr automatisch\naktualisieren.\nON: mit Handy sync.\nOFF: kein Update." },
    /* 37 TypeAuxInput       */ { name: "Typ Eingang",   ds: "Typ des AUX-\nSignals:\n[NC/NO]" },
    /* 38 TimeLowPressure    */ { name: "Zeit N.D.",     ds: "Pausenzeit vor\nNeustart der Pumpe\nbei erkanntem Nie-\nderdruck [sek.]" },
    /* 39 ModbusBaudRate     */ { name: "BoundRate",     ds: "Setzt Baudrate\nfür Modbus-\nKommunikation." },
    /* 40 ModbusDeviceID     */ { name: "DeviceID",      ds: "Setzt Modbus\nGeräte-ID (1-247)." }
  ]
};
