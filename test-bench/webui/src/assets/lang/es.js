const langEs ={
    paramsInfo: [
        /* 0 SetTemp */ 
        {
            lable: "TempSet",
            dsc: "Temperatura de\nconsigna.\nEnciende bajo set,\napaga sobre\nset+difTemp."
        },
        /* 1 DifTemp */ 
        {
            lable: "DifTemp",
            dsc: "Histéresis temp.\nReduce encendidos/\napagados.\nApaga sobre\nset+difTemp."
        },
        /* 2 AdjTemp */ 
        {
            lable: "CalibTemp",
            dsc: "Calibración\nsonda T.\nCorrige lectura.\nEj: +1.0 suma\n1°C al valor."
        },
        /* 3 AbilitaTemp */ 
        {
            lable: "ActTemp",
            dsc: "Activa control\nde temperatura.\nON usa sonda T,\nOFF la ignora."
        },
        /* 4 SetRh */ 
        {
            lable: "HumSet",
            dsc: "Humedad de set.\nEnciende si RH ≤ set.\nApaga sobre\nset+difRh."
        },
        /* 5 DifRh */ 
        {
            lable: "DifHum",
            dsc: "Histéresis hum.\nEstabiliza ciclo.\nApaga cuando RH\n> set+difRh."
        },
        /* 6 AdjRh */ 
        {
            lable: "CalibHum",
            dsc: "Calibración\nsonda RH.\nCorrige lectura.\nEj: +1.0 suma\n1% al valor."
        },
        /* 7 AbilitaRh */ 
        {
            lable: "ActHum",
            dsc: "Activa control\nde humedad.\nON usa sonda RH,\nOFF la ignora."
        },
        /* 8 TimerON */ 
        {
            lable: "TimOn",
            dsc: "Tiempo ON ciclo.\nNebulización en\nmm:ss."
        },
        /* 9 TimerOFF */ 
        {
            lable: "TimOff",
            dsc: "Tiempo OFF ciclo.\nPausa entre ciclos\nen mm:ss."
        },
        /*10 AbilitaTimer */ 
        {
            lable: "ActTimer",
            dsc: "Activa tempor.\ncíclico.\nON sigue ON/OFF,\nOFF ignora timer."
        },
        /*11 AbleCalendar */ 
        {
            lable: "ActCal",
            dsc: "Activa calendario.\nON sigue días y\nhoras.\nOFF lo ignora."
        },
        /*12 TempoScarico */ 
        {
            lable: "Vaciado",
            dsc: "Tiempo vaciado.\nVacía la línea\nde agua al fin\ndel ciclo.\nSegundos."
        },
        /*13 PressDelay */ 
        {
            lable: "RetPres",
            dsc: "Retardo lectura\nde presostato.\nEspera X seg antes\nde verificar."
        },
        /*14 AbleAux */ 
        {
            lable: "ActAux",
            dsc: "Activa entrada\nAUX junto con\notras condiciones.\nOFF la ignora."
        },
        /*15 TimeDay */ 
        {
            lable: "Dia",
            dsc: "Día del mes.\nValores 1..31.\nConfigura fecha."
        },
        /*16 TimeMonth */ 
        {
            lable: "Mes",
            dsc: "Mes del año.\nValores 1..12.\nConfigura fecha."
        },
        /*17 TimeYear */ 
        {
            lable: "Ano",
            dsc: "Año actual.\nConfigura año\ndel calendario."
        },
        /*18 TimeHour */ 
        {
            lable: "Hora",
            dsc: "Hora actual.\nValores 0..23."
        },
        /*19 TimeMinute */ 
        {
            lable: "Minuto",
            dsc: "Minutos actuales.\nValores 0..59."
        },
        /*20 TypePressureSwitch */ 
        {
            lable: "Tipo Pres.",
            dsc: "Tipo de presostato\ninstalado:\n[NC/NO/Desactivado]\nsi se pone en\nDesactivado sig-\nnifica que el pre-\nsostato se omite,\npor lo tanto hay\nsiempre presión"
        },
        /*21 MaxStartAttempts */ 
        {
            lable: "MaxArranq",
            dsc: "Máx intentos\nde arranque\nbomba.\nLuego bloqueo\nseguridad."
        },
        /*22 RelayMode */ 
        {
            lable: "ModoRele",
            dsc: "Escoger uso\ndel relé."
        },
        /*23 AbleWifi */ 
        {
            lable: "ActWifi",
            dsc: "Activa conexión\nWiFi."
        },
        /*24 ChangeLang */ 
        {
            lable: "Idioma",
            dsc: "Cambiar idioma\nde interfaz."
        },
        /*25 TimerOnDispenser */ 
        {
            lable: "TimOnDos",
            dsc: "Tiempo ON\ndosificador.\nDurante ON\ndispensa.\nUsa mm:ss.\nEj: ON=10s,\nOFF=20s -> 10s ON,\n20s pausa."
        },
        /*26 TimerOffDispenser */ 
        {
            lable: "TimOffDos",
            dsc: "Tiempo OFF\ndosificador.\nPausa entre\nciclos.\nNo dispensa.\nUsa mm:ss.\nEj: ON=10s,\nOFF=20s -> 10s ON,\n20s OFF."
        },
        /*27 TimerOnFan */ 
        {
            lable: "TimOnVent",
            dsc: "Tiempo ON\nventilador.\nDurante ON sopla.\nUsa mm:ss.\nEj: ON=10s,\nOFF=20s -> 10s ON,\n20s pausa."
        },
        /*28 TimerOffFan */ 
        {
            lable: "TimOffVent",
            dsc: "Tiempo OFF\nventilador.\nPausa entre ciclos.\nVentilador apag.\nUsa mm:ss.\nEj: ON=10s,\nOFF=20s -> 10s ON,\n20s OFF."
        },
        /*29 SetFanTemp */ 
        {
            lable: "TempVent",
            dsc: "Umbral T\nventilador.\nON sobre set.\nOFF cuando T <\nset-dif.\nEj: set=30.0,\ndif=1.0 -> ON 30.0,\nOFF 29.0."
        },
        /*30 DifFanTemp */ 
        {
            lable: "DifVent",
            dsc: "Histéresis T\nventilador.\nDelta apagado.\nOFF bajo set-dif.\nEj: set=30.0,\ndif=1.0 -> OFF\n29.0."
        },
        /*31 SetFanHum */ 
        {
            lable: "HumVent",
            dsc: "Umbral RH\nventilador.\nON sobre set.\nOFF cuando RH <\nset-dif.\nEj: set=60%,\ndif=5% -> ON 60%,\nOFF 55%."
        },
        /*32 DiffFanHum */ 
        {
            lable: "DifVentHum",
            dsc: "Histéresis RH\nventilador.\nDelta apagado.\nOFF bajo set-dif.\nEj: set=60%,\ndif=5% -> OFF\n55%."
        },
        /*33 FanDelayAfterOff */ 
        {
            lable: "VentDelay",
            dsc: "Tiempo de post-\nventilación tras\napagar la bomba.\nFavorece secado\ny enfriamiento."
        },
        /*34 AntiBactDelay */ 
        {
            lable: "ABDelay",
            dsc: "Horas inactivas\nantes del ciclo\nantibacteriano.\nEvita estancam.\nde agua."
        },
        /*35 AntiBactTimer */ 
        {
            lable: "ABTimer",
            dsc: "Duración del ciclo\nantibacteriano.\nTiempo de activac.\nde válvula para\nrenovar agua."
        },
        /*36 AutoClockUpdate */ 
        {
            lable: "AutoReloj",
            dsc: "Actualiza reloj\nautomáticamente.\nON: se sincroniza\ncon el móvil.\nOFF: sin actualización."
        },
        /*37 TypeAuxInput */ 
        {
            lable: "Tipo Entrada",
            dsc: "Tipo de señal AUX:\n[NC/NO]"
        },
        /*38 TimeLowPressure */ 
        {
            lable: "Tiempo B.P.",
            dsc: "Tiempo de pausa\nantes de reiniciar\nla bomba cuando se\ndetecta baja pres-\nsión [seg.]"
        },
        /*39 ModbusBaudRate */ 
        {
            lable: "BoundRate",
            dsc: "Configura la\nvelocidad baud\npara comunicación\nModbus."
        },
        /*40 ModbusDeviceID */ 
        {
            lable: "DeviceID",
            dsc: "Configura el ID\ndel dispositivo\nModbus (1-247)."
        }
    ],
    WeekDays: [
        "Lunes",
        "Martes",
        "Miércoles",
        "Jueves",
        "Viernes",
        "Sábado",
        "Domingo"
    ],
    menu : [
        "HabilitarModo",
        "Temporizador",
        "Calendario",
        "Temperatura",
        "Humedad",
        "Reloj",
        "Constantes",
        "Ventilador",
        "Dosificador",
        "Antibacteriano",
        "Modbus"
    ]
};
