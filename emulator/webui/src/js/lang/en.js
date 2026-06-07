/**
 * en.js — English localization data
 * Source of truth: src/lang/stringParameter.h (lang_en), DayOfWeek.h (daysEng), menuName.cpp (menuEng)
 *
 * Structure consumed by buildLangData() → Store.LOCALIZATION.LANGS[0]
 *   menuName   → lang_en menu labels (11 entries, order matches ESP menuName.cpp)
 *   daysLetter → single-char weekday abbreviations matching DayOfWeek::daysEng[]
 *   param      → 41 entries { name, ds } matching lang_en[PARAMS_NUM] in stringParameter.h
 */
export default {
  menuName: [
    "Temperature",    // 0: temperature
    "Humidity",       // 1: humidity
    "Timer",          // 2: timer
    "Calendar",       // 3: calendar
    "Clock",          // 4: clock
    "Constants",      // 5: constant
    "EnableMode",     // 6: modeEnable
    "wifi-delete",    // 7: WIFI placeholder (matches ESP AppendMenu)
    "Fan",            // 8: fan
    "Dispenser",      // 9: dispenser
    "Antibacterial",  // 10: antibacterial
    "Modbus"          // 11: modebus
  ],

  // DayOfWeek::daysEng[] — Mon … Sun
  daysLetter: ["M", "T", "W", "T", "F", "S", "S"],

  // lang_en[PARAMS_NUM] — 41 entries, index matches ParamId enum
  param: [
    /* 0  SetTemp            */ { name: "Temp Thres.",   ds: "Temperature limit.\nTurns on below set.\nTurns off above set\nby the off delta." },
    /* 1  DifTemp            */ { name: "Off Diff.",     ds: "Off hysteresis.\nDelta added to the\nTemp threshold to\nswitch off safely." },
    /* 2  AdjTemp            */ { name: "Temp Offset",   ds: "Offset applied to\nambient temp read\nfor calibration." },
    /* 3  AbilitaTemp        */ { name: "Enable Temp",   ds: "Enable temperature\ncontrol. When OFF,\nunit works ignoring\ntemperature value." },
    /* 4  SetRh              */ { name: "Hum Thres.",    ds: "Humidity limit.\nTurns on below set.\nTurns off above set\nby the off delta." },
    /* 5  DifRh              */ { name: "Hum Off Diff",  ds: "Humidity off delta.\nAdded to the set to\ncreate hysteresis\nand avoid chattering." },
    /* 6  AdjRh              */ { name: "Hum Offset",    ds: "Offset applied to\nambient humidity\nreading for calib." },
    /* 7  AbilitaRh          */ { name: "Enable Hum",    ds: "Enable humidity\ncontrol. If OFF,\nunit works ignoring\nambient humidity." },
    /* 8  TimerON            */ { name: "On Time",       ds: "Spray ON duration\nwithin duty cycle.\nActive time between\npauses. [mm:ss]" },
    /* 9  TimerOFF           */ { name: "Pause Time",    ds: "Pause duration\nbetween two ON\ncycles of the unit.\nFormat [mm:ss]." },
    /* 10 AbilitaTimer       */ { name: "Enable Timer",  ds: "Enable duty cycle.\nIf OFF, the unit\nruns continuously\nwithout ON/OFF." },
    /* 11 AbleCalendar       */ { name: "Enable Cal.",   ds: "Enable scheduler.\nWhen ON the unit\nruns only on the\nplanned windows." },
    /* 12 TempoScarico       */ { name: "Drain Time",    ds: "Line drain time.\nAfter power off it\nempties the line.\nUnit is seconds." },
    /* 13 PressDelay         */ { name: "Press Delay",   ds: "Delay before the\npressure check to\nlet the line reach\nthe right level." },
    /* 14 AbleAux            */ { name: "Enable Start",  ds: "Enable AUX start\ninput. If OFF the\nunit ignores the\nexternal start." },
    /* 15 TimeDay            */ { name: "Day",           ds: "Current day of\nmonth. Set value\nin the range 1..31." },
    /* 16 TimeMonth          */ { name: "Month",         ds: "Current month of\nyear. Set value in\nthe range 1..12." },
    /* 17 TimeYear           */ { name: "Year",          ds: "Current year for\nthe internal clock.\nSet four digit year." },
    /* 18 TimeHour           */ { name: "Hour",          ds: "Current hour for\nthe internal clock.\nRange is 0..23." },
    /* 19 TimeMinute         */ { name: "Minutes",       ds: "Current minutes\nfor the clock. Set\nvalue in 0..59." },
    /* 20 TypePressureSwitch */ { name: "Press Type",    ds: "Installed pressure\nswitch type:\n[NC/NO/Disabled]\nif set to Disabled\nit means that\npressure switch is\nbypassed, so there\nis always pressure" },
    /* 21 MaxStartAttempts   */ { name: "Start Tries",   ds: "Maximum number\nof start attempts if\nthe pressure switch\ndetects no water." },
    /* 22 RelayMode          */ { name: "Relay Mode",    ds: "Select output relay\nfunction: bypass,\nfan, doser, or the\nanti-bacterial mode." },
    /* 23 AbleWifi           */ { name: "Enable App",    ds: "When OFF the unit\ncannot be turned\non remotely by\nthe mobile app." },
    /* 24 ChangeLang         */ { name: "Menu Lang",     ds: "Select the menu\nlanguage shown on\nthe device display." },
    /* 25 TimerOnDispenser   */ { name: "Dose On",       ds: "Dispenser ON time\nwithin its duty\ncycle. Format is\n[mm:ss] value." },
    /* 26 TimerOffDispenser  */ { name: "Dose Pause",    ds: "Dispenser pause\ntime between ON\ncycles. Format\nis [mm:ss]." },
    /* 27 TimerOnFan         */ { name: "TimerOnFan",    ds: "Fan ON duration.\nAir blows during\nON. Use mm:ss.\nExample: ON 10s,\nOFF 20s repeats." },
    /* 28 TimerOffFan        */ { name: "TimerOffFan",   ds: "Fan OFF duration.\nPause between two\nfan cycles. Use the\nmm:ss format." },
    /* 29 SetFanTemp         */ { name: "SetFanTemp",    ds: "Fan temperature\nthreshold. Turns\non above set and\noff below set-diff." },
    /* 30 DifFanTemp         */ { name: "DifFanTemp",    ds: "Fan temperature\nhysteresis used to\nswitch off below\nthe set minus diff." },
    /* 31 SetFanHum          */ { name: "SetFanHum",     ds: "Fan humidity set.\nTurns on above set\nand turns off below\nset minus diff." },
    /* 32 DiffFanHum         */ { name: "DiffFanHum",    ds: "Fan humidity off\nhysteresis. Delta\nbelow set to stop.\nStabilizes cycles." },
    /* 33 FanDelayAfterOff   */ { name: "Fan Off Delay", ds: "Delay to stop fan\nafter the pump is\nturned off. Unit is\nseconds value." },
    /* 34 AntiBactDelay      */ { name: "A.B. Start",    ds: "Start anti-bact.\ncycle after given\nhours of inactivity.\nUnit is hours." },
    /* 35 AntiBactTimer      */ { name: "A.B. Duration", ds: "Anti-bacterial cycle\nlength in minutes\nand seconds.\nFormat [mm:ss]." },
    /* 36 AutoClockUpdate    */ { name: "Auto Time",     ds: "Automatic clock\nupdate. When ON\nthe app refreshes\ntime periodically." },
    /* 37 TypeAuxInput       */ { name: "Aux Type",      ds: "Type of AUX input\nsignal:\n[NC/NO]" },
    /* 38 TimeLowPressure    */ { name: "Time L.P.",     ds: "Pause time before\nrestarting the pump\nwhen low pressure\nis detected [sec.]" },
    /* 39 ModbusBaudRate     */ { name: "BoundRate",     ds: "Set the baud rate\nfor Modbus\ncommunication." },
    /* 40 ModbusDeviceID     */ { name: "DeviceID",      ds: "Set the Modbus\ndevice ID (1-247)." }
  ]
};
