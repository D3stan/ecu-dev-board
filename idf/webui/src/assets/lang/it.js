

const langIt ={
    paramsInfo: [
        /* 0 SetTemp */ 
        {
            lable: "Soglia Temp.",
            dsc: "Soglia di temperatura.\nAccende sotto soglia\nSpegne sopra soglia+\ndiff. spegnimento"
        },
        /* 1 DifTemp */ 
        {
            lable: "Diff. Soglia",
            dsc: "Differenziale soglia.\nValore da sommare\nalla Soglia per lo\nspegnimento"
        },
        /* 2 AdjTemp */ 
        {
            lable: "Correz.Temp",
            dsc: "Correzione lettura\ntemperatura ambiente."
        },
        /* 3 AbilitaTemp */ 
        {
            lable: "Abil. Temp",
            dsc: "Abilita Soglia Temp.\nSe disattiva(OFF),\nla macchina funziona\nindipendentemente\ndalla temperatura."
        },
        /* 4 SetRh */ 
        {
            lable: "Soglia Umid.",
            dsc: "Soglia di umidità.\nAccende sotto soglia.\nSpegne sopra sogli+\ndiff. spegnimento."
        },
        /* 5 DifRh */ 
        {
            lable: "Diff. Umid",
            dsc: "Differenziale umidità.\nValore da sommare\nalla soglia di umidità\nsper lo spegnimento."
        },
        /* 6 AdjRh */ 
        {
            lable: "Correz. Umid",
            dsc: "Correzzione lettura\numidità ambiente.\n"
        },
        /* 7 AbilitaRh */ 
        {
            lable: "Abil. Umid.",
            dsc: "Abilita soglia umidità\nSe disattiva(OFF)\nla macchina funziona\nindipendentemente\ndall'umidità ambiente."
        },
        /* 8 TimerON */ 
        {
            lable: "Tempo acc.",
            dsc: "Tempo accensione.\nDurata accensione\nfra una pausa\ne l'altra [mm.ss]."
        },
        /* 9 TimerOFF */ 
        {
            lable: "Tempo pausa",
            dsc: "Durata della pausa\nfra un ciclo e il \nsuccessivo [mm.ss]."
        },
        /*10 AbilitaTimer */ 
        {
            lable: "Abil. Tempo",
            dsc: "Abilita temporizzatore.\nSe disattiva (OFF),\nla macchina funziona\nsenza cicli di accensione\ne pausa."
        },
        /*11 AbleCalendar */ 
        {
            lable: "Abil. Calend",
            dsc: "Abilita calendario.\nSe attivo (ON), la\nmacchina funziona\nsolo nei giorni e\n orari programmati\n nel calendario.\n"
        },
        /*12 TempoScarico */ 
        {
            lable: "TempoScarico",
            dsc: "Tempo di scarico.\nDurata svuotamento\nlinea dopo lo\nspegnimento della\nmacchina [sec.]"
        },
        /*13 PressDelay */ 
        {
            lable: "Rit. Press.",
            dsc: "Ritardo [sec.]\ncontrollo pressione\nper dare tempo alla\nlinea di andare\nin pressione."
        },
        /*14 AbleAux */ 
        {
            lable: "Abil. Start",
            dsc: "Abilita ingresso\ndi start (AUX).\nSe disattivo (OFF)\nla macchina ignora\nlo stato di start"
        },
        /*15 TimeDay */ 
        {
            lable: "Giorno",
            dsc: "Giorno del mese.\nImposta il giorno\ncorrente della\nmacchina [1..31]"
        },
        /*16 TimeMonth */ 
        {
            lable: "Mese",
            dsc: "Mese dell'anno.\nImposta il mese\ncorrente della\nmacchina [1..12]"
        },
        /*17 TimeYear */ 
        {
            lable: "Anno",
            dsc: "Anno corrente.\nImposta l'anno\ncorrente della\nmacchina"
        },
        /*18 TimeHour */ 
        {
            lable: "Ora",
            dsc: "Ora corrente.\nImposta l'ora\ncorrente della\nmacchina [0..23]"
        },
        /*19 TimeMinute */ 
        {
            lable: "Minuti",
            dsc: "Minuti correnti.\nImposta i minuti\ncorrenti della\nmacchina [0..59]"
        },
        /*20 TypePressureSwitch */ 
        {
            lable: "Tipo Press.",
            dsc: "Tipo pressostato\nmontato\n[NC/NO/Disabilita]\nse impostato\nDisabilitato\nsignifica che il\npressostato viene\nbypassato, quindi\nc'è sempre\npressione"
        },
        /*21 MaxStartAttempts */ 
        {
            lable: "Tentativi",
            dsc: "Numero massimo di\ntentativi di\naccensione macchina\nse il pressostato\nnon rileva acqua."
        },
        /*22 RelayMode */ 
        {
            lable: "Modo relè",
            dsc: "Seleziona funzione\ndel relè d'uscita:\nbypass, ventilatore,\ndosatore o antibatt."
        },
        /*23 AbleWifi */ 
        {
            lable: "Abilita App",
            dsc: "Se disattiva (OFF),\nla macchina non può\nessere accesa\ntramite app."
        },
        /*24 ChangeLang */ 
        {
            lable: "Lingua Menù",
            dsc: "Seleziona la lingua \ndel menù\ndella macchina."
        },
        /*25 TimerOnDispenser */ 
        {
            lable: "Tempo Dos.",
            dsc: "Durata accensione\ndosatore fra una pausa\ne l'altra [mm:ss]"
        },
        /*26 TimerOffDispenser */ 
        {
            lable: "Pausa Dos.",
            dsc: "Durata pausa fra\nun'accensione e \nl'altra del dosatore\n[mm:ss]."
        },
        /*27 TimerOnFan */ 
        {
            lable: "TimerOnFan",
            dsc: "Tempo ON ventola.\nDurata accensione.\nDurante ON soffia.\nUsa mm:ss.\nEsempio: ON=10s,\nOFF=20s -> 10s ON,\n20s pausa, ciclico."
        },
        /*28 TimerOffFan */ 
        {
            lable: "TimerOffFan",
            dsc: "Tempo OFF ventola.\nPausa tra cicli.\nVentola spenta.\nUsa mm:ss.\nEsempio: ON=10s,\nOFF=20s -> 10s ON,\n20s OFF, ripete."
        },
        /*29 SetFanTemp */ 
        {
            lable: "SetFanTemp",
            dsc: "Soglia T ventola.\nAccende sopra set.\nSpegne quando T\nscende sotto\nset-dif.\nEsempio: set=30.0,\ndif=1.0 -> ON 30.0,\nOFF 29.0."
        },
        /*30 DifFanTemp */ 
        {
            lable: "DifFanTemp",
            dsc: "Isteresi T ventola.\nDelta per spegnere.\nOFF sotto set-dif.\nStabilizza comm.\nEsempio: set=30.0,\ndif=1.0 -> OFF\n29.0."
        },
        /*31 SetFanHum */ 
        {
            lable: "SetFanHum",
            dsc: "Soglia RH ventola.\nAccende sopra set.\nSpegne quando RH\nscende sotto\nset-dif.\nEsempio: set=60%,\ndif=5% -> ON 60%,\nOFF 55%."
        },
        /*32 DiffFanHum */ 
        {
            lable: "DiffFanHum",
            dsc: "Isteresi RH ventola.\nDelta per spegnere.\nOFF sotto set-dif.\nStabilizza ciclo.\nEsempio: set=60%,\ndif=5% -> OFF\n55%."
        },
        /*33 FanDelayAfterOff */ 
        {
            lable: "Rit. Vent.",
            dsc: "Ritardo spegnimento\nventilatore dopo\nlo spegnimento pompa\n[sec.]"
        },
        /*34 AntiBactDelay */ 
        {
            lable: "Avvio A.B.",
            dsc: "Avvio ciclo antibat.\ndopo ore di inattività\ndella macchina [ore]."
        },
        /*35 AntiBactTimer */ 
        {
            lable: "Durata A.B",
            dsc: "Durata ciclo\nantibatterico [mm:ss].\n"
        },
        /*36 AutoClockUpdate */ 
        { 
            lable: "Auto ora",
            dsc: "Aggiorn. automatico\norologio.\nSe attivo (ON)\nl'orologio si aggiorna\nautomat. con app"
        },
        /*37 TypeAuxInput */ 
        {
            lable: "Tipo Aux",
            dsc: "Tipo di segnale\ningresso AUX:\n[NC,NO]"
        },
        /*38 TimeLowPressure */ 
        {
            lable: "Pausa B.P.",
            dsc: "Tempo di pausa\nprima di riaccendere\nla pompa se viene\nrilevata bassa\npressione [sec.]"
        },
        /*39 ModbusBaudRate */ 
        {
            lable: "BoundRate",
            dsc: "Imposta la velocità\nbaud della\ncomunicazione\nModbus."
        },
        /*40 ModbusDeviceID */ 
        {
            lable: "DeviceID",
            dsc: "Imposta l'ID\ndel dispositivo\nModbus (1-247)."
        }
    ],
    WeekDays: [
        "Lunedì",
        "Martedì",
        "Mercoledì",
        "Giovedì",
        "Venerdì",
        "Sabato",
        "Domenica"
    ],
    menu : [
        "AbilitaMode",
        "Timer",
        "Calendario",
        "Temperatura",
        "Umidita'",
        "Orologio",
        "Costanti",
        "Ventilatore",
        "Dosatore",
        "Antibatterico",
        "Modbus"
    ]
};