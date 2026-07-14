const langDe ={
    paramsInfo: [
        /* 0 SetTemp */ 
        {
            lable: "TempSet",
            dsc: "Soll-Temp.\nEinschalten unter\nSet, ausschalten\nüber Set+DifTemp."
        },
        /* 1 DifTemp */ 
        {
            lable: "DifTemp",
            dsc: "Temp-Hysterese.\nReduziert häufiges\nEin/Aus.\nAus über\nSet+DifTemp."
        },
        /* 2 AdjTemp */ 
        {
            lable: "KalibTemp",
            dsc: "Fühler T Abgleich.\nKorrigiert Wert.\nBsp: +1.0 addiert\n1°C zur Messung."
        },
        /* 3 AbilitaTemp */ 
        {
            lable: "AktTemp",
            dsc: "Temp-Regelung\naktivieren.\nON nutzt T-Fühler,\nOFF ignoriert."
        },
        /* 4 SetRh */ 
        {
            lable: "FeuchtSet",
            dsc: "Soll-Feuchte.\nEin bei RH ≤ Set.\nAus über\nSet+DifRh."
        },
        /* 5 DifRh */ 
        {
            lable: "DifFeucht",
            dsc: "Feuchte-Hysterese.\nStabilisiert Zyklus.\nAus wenn RH >\nSet+DifRh."
        },
        /* 6 AdjRh */ 
        {
            lable: "KalibFeucht",
            dsc: "Fühler RH Abgleich.\nKorrigiert Wert.\nBsp: +1.0 addiert\n1% zur Messung."
        },
        /* 7 AbilitaRh */ 
        {
            lable: "AktFeucht",
            dsc: "Feuchte-Regelung\naktivieren.\nON nutzt RH-Fühler,\nOFF ignoriert."
        },
        /* 8 TimerON */ 
        {
            lable: "TimOn",
            dsc: "EIN-Zeit Zyklus.\nBefeuchtung in\nmm:ss."
        },
        /* 9 TimerOFF */ 
        {
            lable: "TimOff",
            dsc: "AUS-Zeit Zyklus.\nPause zwischen\nZyklen in mm:ss."
        },
        /*10 AbilitaTimer */ 
        {
            lable: "AktTimer",
            dsc: "Zyklustimer\naktivieren.\nON folgt EIN/AUS,\nOFF ignoriert."
        },
        /*11 AbleCalendar */ 
        {
            lable: "AktKal",
            dsc: "Kalender aktiv.\nON folgt Tagen\nund Stunden.\nOFF ignoriert."
        },
        /*12 TempoScarico */ 
        {
            lable: "Entleeren",
            dsc: "Entleerzeit.\nLeert Wasserleitung\nam Zyklusende.\nSekunden."
        },
        /*13 PressDelay */ 
        {
            lable: "PresDelay",
            dsc: "Druckschalter-\nVerzögerung.\nWarte X Sekunden\nvor Prüfung."
        },
        /*14 AbleAux */ 
        {
            lable: "AktAux",
            dsc: "AUX-Eingang aktiv.\nUND mit anderen\nBedingungen.\nOFF ignoriert."
        },
        /*15 TimeDay */ 
        {
            lable: "Tag",
            dsc: "Tag des Monats.\nWerte 1..31.\nDatum setzen."
        },
        /*16 TimeMonth */ 
        {
            lable: "Monat",
            dsc: "Monat des Jahres.\nWerte 1..12.\nDatum setzen."
        },
        /*17 TimeYear */ 
        {
            lable: "Jahr",
            dsc: "Aktuelles Jahr.\nJahreszahl im\nKalender setzen."
        },
        /*18 TimeHour */ 
        {
            lable: "Stunde",
            dsc: "Aktuelle Stunde.\nWerte 0..23."
        },
        /*19 TimeMinute */ 
        {
            lable: "Minute",
            dsc: "Aktuelle Minuten.\nWerte 0..59."
        },
        /*20 TypePressureSwitch */ 
        {
            lable: "Typ Druck.",
            dsc: "Typ des instal-\nlierten Druck-\nschalters:\n[NC/NO/Deaktiviert]\nwenn auf Deakti-\nviert gesetzt be-\ndeutet dass Druck-\nschalter umgangen,\nalso immer Druck\nvorhanden"
        },
        /*21 MaxStartAttempts */ 
        {
            lable: "MaxStart",
            dsc: "Max Startversuche\nPumpe.\nDann Sperre zur\nSicherheit."
        },
        /*22 RelayMode */ 
        {
            lable: "RelaisMod",
            dsc: "Relais-Betrieb\nwählen."
        },
        /*23 AbleWifi */ 
        {
            lable: "AktWifi",
            dsc: "WiFi-Verbindung\naktivieren."
        },
        /*24 ChangeLang */ 
        {
            lable: "Sprache",
            dsc: "Sprache ändern\nfür Interface."
        },
        /*25 TimerOnDispenser */ 
        {
            lable: "TimOnDos",
            dsc: "EIN-Zeit Dosierer.\nAktivdauer.\nWährend EIN\ndosiert.\nmm:ss Format.\nBsp: EIN=10s,\nAUS=20s -> 10s EIN,\n20s Pause."
        },
        /*26 TimerOffDispenser */ 
        {
            lable: "TimOffDos",
            dsc: "AUS-Zeit Dosierer.\nPause zwischen\nZyklen.\nKeine Dosierung.\nmm:ss Format.\nBsp: EIN=10s,\nAUS=20s -> 10s EIN,\n20s AUS."
        },
        /*27 TimerOnFan */ 
        {
            lable: "TimOnLuft",
            dsc: "EIN-Zeit Lüfter.\nLaufdauer.\nWährend EIN bläst.\nmm:ss Format.\nBsp: EIN=10s,\nAUS=20s -> 10s EIN,\n20s Pause."
        },
        /*28 TimerOffFan */ 
        {
            lable: "TimOffLuft",
            dsc: "AUS-Zeit Lüfter.\nPause zwischen\nZyklen.\nLüfter AUS.\nmm:ss Format.\nBsp: EIN=10s,\nAUS=20s -> 10s EIN,\n20s AUS."
        },
        /*29 SetFanTemp */ 
        {
            lable: "LuftTemp",
            dsc: "Lüfter Temp-\nSchwelle.\nEIN über Set.\nAUS wenn T <\nSet-Dif.\nBsp: Set=30.0,\nDif=1.0 -> EIN 30,\nAUS 29."
        },
        /*30 DifFanTemp */ 
        {
            lable: "DifLuft",
            dsc: "Temp-Hysterese\nfür Lüfter.\nDelta AUS.\nAUS unter Set-Dif.\nBsp: Set=30.0,\nDif=1.0 -> AUS 29."
        },
        /*31 SetFanHum */ 
        {
            lable: "LuftFeucht",
            dsc: "RH-Schwelle\nLüfter.\nEIN über Set.\nAUS wenn RH <\nSet-Dif.\nBsp: Set=60%,\nDif=5% -> EIN 60,\nAUS 55."
        },
        /*32 DiffFanHum */ 
        {
            lable: "DifLuftHum",
            dsc: "RH-Hysterese\nfür Lüfter.\nDelta AUS.\nAUS unter Set-Dif.\nBsp: Set=60%,\nDif=5% -> AUS 55."
        },
        /*33 FanDelayAfterOff */ 
        {
            lable: "VentDelay",
            dsc: "Nachlaufzeit der\nLüftung nach Pump-\naus. Unterstützt\nTrocknung und\nKühlung."
        },
        /*34 AntiBactDelay */ 
        {
            lable: "ABDelay",
            dsc: "Stunden Inaktiv.\nvor Start des\nAntibakter.-Zyklus.\nVermeidet Wasser-\nstand."
        },
        /*35 AntiBactTimer */ 
        {
            lable: "ABTimer",
            dsc: "Dauer des Anti-\nbakterienzyklus.\nVentilaktivierung\nzur Wassererneu."
        },
        /*36 AutoClockUpdate */ 
        {
            lable: "AutoUhr",
            dsc: "Uhr automatisch\naktualisieren.\nON: mit Handy sync.\nOFF: kein Update."
        },
        /*37 TypeAuxInput */ 
        {
            lable: "Typ Eingang",
            dsc: "Typ des AUX-\nSignals:\n[NC/NO]"
        },
        /*38 TimeLowPressure */ 
        {
            lable: "Zeit N.D.",
            dsc: "Pausenzeit vor\nNeustart der Pumpe\nbei erkanntem Nie-\nderdruck [sek.]"
        },
        /*39 ModbusBaudRate */ 
        {
            lable: "BoundRate",
            dsc: "Setzt Baudrate\nfür Modbus-\nKommunikation."
        },
        /*40 ModbusDeviceID */ 
        {
            lable: "DeviceID",
            dsc: "Setzt Modbus\nGeräte-ID (1-247)."
        }
    ],
    WeekDays: [
        "Montag",
        "Dienstag",
        "Mittwoch",
        "Donnerstag",
        "Freitag",
        "Samstag",
        "Sonntag"
    ],
    menu : [
        "ModusAktivieren",
        "Timer",
        "Kalender",
        "Temperatur",
        "Feuchtigkeit",
        "Uhr",
        "Konstanten",
        "Ventilator",
        "Dosierer",
        "Antibakteriell",
        "Modbus"
    ]
};
