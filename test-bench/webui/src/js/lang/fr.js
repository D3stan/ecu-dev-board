/**
 * fr.js — French localization data
 * Source of truth: src/lang/stringParameter.h (lang_fr), DayOfWeek.h (daysFr), menuName.cpp (menuFr)
 *
 * Structure consumed by buildLangData() → Store.LOCALIZATION.LANGS[2]
 *   menuName   → lang_fr menu labels (11 entries, order matches ESP menuName.cpp)
 *   daysLetter → single-char weekday abbreviations matching DayOfWeek::daysFr[]
 *   param      → 41 entries { name, ds } matching lang_fr[PARAMS_NUM] in stringParameter.h
 */
export default {
  menuName: [
    "Température",    // 0: temperature
    "Humidité",       // 1: humidity
    "Minuterie",      // 2: timer
    "Calendrier",     // 3: calendar
    "Horloge",        // 4: clock
    "Constantes",     // 5: constant
    "ActiverMode",    // 6: modeEnable
    "wifi-delete",    // 7: WIFI placeholder (matches ESP AppendMenu)
    "Ventilateur",    // 8: fan
    "Doseur",         // 9: dispenser
    "Antibactérien",  // 10: antibacterial
    "Modbus"          // 11: modebus
  ],

  // DayOfWeek::daysFr[] — Lun … Dim
  daysLetter: ["L", "M", "X", "J", "V", "S", "D"],

  // lang_fr[PARAMS_NUM] — 41 entries, index matches ParamId enum
  param: [
    /* 0  SetTemp            */ { name: "Seuil Temp.",    ds: "Limite temperature.\nActive sous seuil.\nArrete au-dessus\ndu seuil + delta." },
    /* 1  DifTemp            */ { name: "Diff. Arret",    ds: "Hysteresis arret.\nDelta ajoute au\nseuil temp pour\narret stable." },
    /* 2  AdjTemp            */ { name: "Offset Temp",    ds: "Correction lecture\nde temperature\nambiante." },
    /* 3  AbilitaTemp        */ { name: "Active Temp",    ds: "Active le controle\nde temperature.\nSi OFF, l'unite\nignore la temp." },
    /* 4  SetRh              */ { name: "Seuil Hum.",     ds: "Limite humidite.\nActive sous seuil.\nArrete au-dessus\ndu seuil + delta." },
    /* 5  DifRh              */ { name: "Diff. Hum.",     ds: "Hysteresis arret.\nDelta ajoute au\nseuil humidite\npour stabilite." },
    /* 6  AdjRh              */ { name: "Offset Hum.",    ds: "Correction lecture\nd'humidite amb.\npour calibration." },
    /* 7  AbilitaRh          */ { name: "Active Hum.",    ds: "Active controle\nhumidite. Si OFF,\nl'unite ignore\nl'humidite amb." },
    /* 8  TimerON            */ { name: "Temps On",       ds: "Duree allumage.\nTemps actif entre\ndeux pauses.\nFormat [mm:ss]." },
    /* 9  TimerOFF           */ { name: "Temps Pause",    ds: "Duree de pause\nentre deux cycles.\nFormat [mm:ss]." },
    /* 10 AbilitaTimer       */ { name: "Active Timer",   ds: "Active temporiseur.\nSi OFF, unite tourne\nsans cycle ON/OFF." },
    /* 11 AbleCalendar       */ { name: "Active Calend",  ds: "Active calendrier.\nSi ON, unite tourne\nseulement aux heures\nprogrammees." },
    /* 12 TempoScarico       */ { name: "Temps Vid.",     ds: "Temps vidange.\nVide la ligne apres\nl'arret. Unite sec." },
    /* 13 PressDelay         */ { name: "Delai Press.",   ds: "Delai avant test\nde pression pour\natteindre niveau." },
    /* 14 AbleAux            */ { name: "Active Start",   ds: "Active entree Start.\nSi OFF, unite ignore\nsignal externe." },
    /* 15 TimeDay            */ { name: "Jour",           ds: "Jour actuel du mois.\nValeur entre\n1 et 31." },
    /* 16 TimeMonth          */ { name: "Mois",           ds: "Mois actuel.\nValeur entre\n1 et 12." },
    /* 17 TimeYear           */ { name: "Annee",          ds: "Annee courante du\nsysteme interne." },
    /* 18 TimeHour           */ { name: "Heure",          ds: "Heure courante.\nValeur entre\n0 et 23." },
    /* 19 TimeMinute         */ { name: "Minutes",        ds: "Minutes courantes.\nValeur entre\n0 et 59." },
    /* 20 TypePressureSwitch */ { name: "Type Press.",    ds: "Type de pressostat\ninstallé:\n[NC/NO/Désactivé]\nsi réglé sur\nDésactivé cela\nsignifie que le\npressostat est\ncontourné, donc\nil y a toujours\npression" },
    /* 21 MaxStartAttempts   */ { name: "Essais Start",   ds: "Nb max tentatives\nde demarrage si\npas d'eau detectee." },
    /* 22 RelayMode          */ { name: "Mode Relais",    ds: "Fonction relais:\nBypass, Ventil,\nDoseur ou AntiBact." },
    /* 23 AbleWifi           */ { name: "Active App",     ds: "Si OFF, unite ne\npeut etre allumee\npar l'application." },
    /* 24 ChangeLang         */ { name: "Lang. Menu",     ds: "Choisir la langue\ndu menu appareil." },
    /* 25 TimerOnDispenser   */ { name: "Temps Dose",     ds: "Temps ON doseur.\nDuree allumage\ncycle [mm:ss]." },
    /* 26 TimerOffDispenser  */ { name: "Pause Dose",     ds: "Temps pause entre\ndeux ON du doseur.\nFormat [mm:ss]." },
    /* 27 TimerOnFan         */ { name: "TimerOnVent",    ds: "Ventilateur ON.\nSouffle pendant ON.\nEx: ON 10s, OFF 20s\ncycle repete." },
    /* 28 TimerOffFan        */ { name: "TimerOffVent",   ds: "Ventilateur OFF.\nPause entre cycles.\nEx: ON 10s, OFF 20s\nformat mm:ss." },
    /* 29 SetFanTemp         */ { name: "SeuilVentT",     ds: "Seuil temperature\nventilateur.\nON au-dessus du set.\nOFF sous set-diff." },
    /* 30 DifFanTemp         */ { name: "DiffVentT",      ds: "Hysteresis ventilo.\nDelta OFF sous\nseuil - diff.\nStabilise commut." },
    /* 31 SetFanHum          */ { name: "SeuilVentH",     ds: "Seuil humidite\nventilateur.\nON au-dessus set.\nOFF sous set-diff." },
    /* 32 DiffFanHum         */ { name: "DiffVentH",      ds: "Hysteresis RH.\nDelta OFF sous\nseuil - diff.\nStabilise cycles." },
    /* 33 FanDelayAfterOff   */ { name: "Delai Vent",     ds: "Delai arret ventilo\napres pompe OFF.\nUnite secondes." },
    /* 34 AntiBactDelay      */ { name: "Start A.B.",     ds: "Lance cycle anti-\nbacterien apres\nheures inactives." },
    /* 35 AntiBactTimer      */ { name: "Duree A.B.",     ds: "Duree du cycle\nantibacterien en\nminutes et secondes." },
    /* 36 AutoClockUpdate    */ { name: "Heure Auto",     ds: "MAJ auto horloge.\nSi ON, synchro via\napplication mobile." },
    /* 37 TypeAuxInput       */ { name: "Type Entrée",    ds: "Type du signal\nAUX:\n[NC/NO]" },
    /* 38 TimeLowPressure    */ { name: "Temps B.P.",     ds: "Temps de pause\navant redémarrer\nla pompe quand\nbasse pression est\ndétectée [sec.]" },
    /* 39 ModbusBaudRate     */ { name: "BoundRate",      ds: "Définit le débit en\nbauds pour la\ncommunication Modbus." },
    /* 40 ModbusDeviceID     */ { name: "DeviceID",       ds: "Définit l'ID de\nl'appareil Modbus\n(1-247)." }
  ]
};
