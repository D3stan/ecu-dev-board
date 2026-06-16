const langFr ={
    paramsInfo: [
        /* 0 SetTemp */ 
        {
            lable: "Seuil Temp.",
            dsc: "Limite temperature.\nActive sous seuil.\nArrete au-dessus\ndu seuil + delta."
        },
        /* 1 DifTemp */ 
        {
            lable: "Diff. Arret",
            dsc: "Hysteresis arret.\nDelta ajoute au\nseuil temp pour\narret stable."
        },
        /* 2 AdjTemp */ 
        {
            lable: "Offset Temp",
            dsc: "Correction lecture\nde temperature\nambiante."
        },
        /* 3 AbilitaTemp */ 
        {
            lable: "Active Temp",
            dsc: "Active le controle\nde temperature.\nSi OFF, l'unite\nignore la temp."
        },
        /* 4 SetRh */ 
        {
            lable: "Seuil Hum.",
            dsc: "Limite humidite.\nActive sous seuil.\nArrete au-dessus\ndu seuil + delta."
        },
        /* 5 DifRh */ 
        {
            lable: "Diff. Hum.",
            dsc: "Hysteresis arret.\nDelta ajoute au\nseuil humidite\npour stabilite."
        },
        /* 6 AdjRh */ 
        {
            lable: "Offset Hum.",
            dsc: "Correction lecture\nd'humidite amb.\npour calibration."
        },
        /* 7 AbilitaRh */ 
        {
            lable: "Active Hum.",
            dsc: "Active controle\nhumidite. Si OFF,\nl'unite ignore\nl'humidite amb."
        },
        /* 8 TimerON */ 
        {
            lable: "Temps On",
            dsc: "Duree allumage.\nTemps actif entre\ndeux pauses.\nFormat [mm:ss]."
        },
        /* 9 TimerOFF */ 
        {
            lable: "Temps Pause",
            dsc: "Duree de pause\nentre deux cycles.\nFormat [mm:ss]."
        },
        /*10 AbilitaTimer */ 
        {
            lable: "Active Timer",
            dsc: "Active temporiseur.\nSi OFF, unite tourne\nsans cycle ON/OFF."
        },
        /*11 AbleCalendar */ 
        {
            lable: "Active Calend",
            dsc: "Active calendrier.\nSi ON, unite tourne\nseulement aux heures\nprogrammees."
        },
        /*12 TempoScarico */ 
        {
            lable: "Temps Vid.",
            dsc: "Temps vidange.\nVide la ligne apres\nl'arret. Unite sec."
        },
        /*13 PressDelay */ 
        {
            lable: "Delai Press.",
            dsc: "Delai avant test\nde pression pour\natteindre niveau."
        },
        /*14 AbleAux */ 
        {
            lable: "Active Start",
            dsc: "Active entree Start.\nSi OFF, unite ignore\nsignal externe."
        },
        /*15 TimeDay */ 
        {
            lable: "Jour",
            dsc: "Jour actuel du mois.\nValeur entre\n1 et 31."
        },
        /*16 TimeMonth */ 
        {
            lable: "Mois",
            dsc: "Mois actuel.\nValeur entre\n1 et 12."
        },
        /*17 TimeYear */ 
        {
            lable: "Annee",
            dsc: "Annee courante du\nsysteme interne."
        },
        /*18 TimeHour */ 
        {
            lable: "Heure",
            dsc: "Heure courante.\nValeur entre\n0 et 23."
        },
        /*19 TimeMinute */ 
        {
            lable: "Minutes",
            dsc: "Minutes courantes.\nValeur entre\n0 et 59."
        },
        /*20 TypePressureSwitch */ 
        {
            lable: "Type Press.",
            dsc: "Type de pressostat\ninstallé:\n[NC/NO/Désactivé]\nsi réglé sur\nDésactivé cela\nsignifie que le\npressostat est\ncontourné, donc\nil y a toujours\npression"
        },
        /*21 MaxStartAttempts */ 
        {
            lable: "Essais Start",
            dsc: "Nb max tentatives\nde demarrage si\npas d'eau detectee."
        },
        /*22 RelayMode */ 
        {
            lable: "Mode Relais",
            dsc: "Fonction relais:\nBypass, Ventil,\nDoseur ou AntiBact."
        },
        /*23 AbleWifi */ 
        {
            lable: "Active App",
            dsc: "Si OFF, unite ne\npeut etre allumee\npar l'application."
        },
        /*24 ChangeLang */ 
        {
            lable: "Lang. Menu",
            dsc: "Choisir la langue\ndu menu appareil."
        },
        /*25 TimerOnDispenser */ 
        {
            lable: "Temps Dose",
            dsc: "Temps ON doseur.\nDuree allumage\ncycle [mm:ss]."
        },
        /*26 TimerOffDispenser */ 
        {
            lable: "Pause Dose",
            dsc: "Temps pause entre\ndeux ON du doseur.\nFormat [mm:ss]."
        },
        /*27 TimerOnFan */ 
        {
            lable: "TimerOnVent",
            dsc: "Ventilateur ON.\nSouffle pendant ON.\nEx: ON 10s, OFF 20s\ncycle repete."
        },
        /*28 TimerOffFan */ 
        {
            lable: "TimerOffVent",
            dsc: "Ventilateur OFF.\nPause entre cycles.\nEx: ON 10s, OFF 20s\nformat mm:ss."
        },
        /*29 SetFanTemp */ 
        {
            lable: "SeuilVentT",
            dsc: "Seuil temperature\nventilateur.\nON au-dessus du set.\nOFF sous set-diff."
        },
        /*30 DifFanTemp */ 
        {
            lable: "DiffVentT",
            dsc: "Hysteresis ventilo.\nDelta OFF sous\nseuil - diff.\nStabilise commut."
        },
        /*31 SetFanHum */ 
        {
            lable: "SeuilVentH",
            dsc: "Seuil humidite\nventilateur.\nON au-dessus set.\nOFF sous set-diff."
        },
        /*32 DiffFanHum */ 
        {
            lable: "DiffVentH",
            dsc: "Hysteresis RH.\nDelta OFF sous\nseuil - diff.\nStabilise cycles."
        },
        /*33 FanDelayAfterOff */ 
        {
            lable: "Delai Vent",
            dsc: "Delai arret ventilo\na pres pompe OFF.\nUnite secondes."
        },
        /*34 AntiBactDelay */ 
        {
            lable: "Start A.B.",
            dsc: "Lance cycle anti-\nbacterien apres\nheures inactives."
        },
        /*35 AntiBactTimer */ 
        {
            lable: "Duree A.B.",
            dsc: "Duree du cycle\nantibacterien en\nminutes et secondes."
        },
        /*36 AutoClockUpdate */ 
        {
            lable: "Heure Auto",
            dsc: "MAJ auto horloge.\nSi ON, synchro via\napplication mobile."
        },
        /*37 TypeAuxInput */ 
        {
            lable: "Type Entrée",
            dsc: "Type du signal\nAUX:\n[NC/NO]"
        },
        /*38 TimeLowPressure */ 
        {
            lable: "Temps B.P.",
            dsc: "Temps de pause\navant redémarrer\nla pompe quand\nbasse pression est\ndétectée [sec.]"
        },
        /*39 ModbusBaudRate */ 
        {
            lable: "BoundRate",
            dsc: "Définit le débit en\nbauds pour la\ncommunication Modbus."
        },
        /*40 ModbusDeviceID */ 
        {
            lable: "DeviceID",
            dsc: "Définit l'ID de\nl'appareil Modbus\n(1-247)."
        }
    ],
    WeekDays: [
        "Lundi",
        "Mardi",
        "Mercredi",
        "Jeudi",
        "Vendredi",
        "Samedi",
        "Dimanche"
    ],
    menu : [
        "ActiverMode",
        "Minuterie",
        "Calendrier",
        "Température",
        "Humidité",
        "Horloge",
        "Constantes",
        "Ventilateur",
        "Doseur",
        "Antibactérien",
        "Modbus"
    ]
};
