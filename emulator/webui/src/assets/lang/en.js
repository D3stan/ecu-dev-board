const langEn ={
    paramsInfo: [
        /* 0 SetTemp */ 
        {
            lable: "Temp Thres.",
            dsc: "Temperature limit.\nTurns on below set.\nTurns off above set\nby the off delta."
        },
        /* 1 DifTemp */ 
        {
            lable: "Off Diff.",
            dsc: "Off hysteresis.\nDelta added to the\nTemp threshold to\nswitch off safely."
        },
        /* 2 AdjTemp */ 
        {
            lable: "Temp Offset",
            dsc: "Offset applied to\nambient temp read\nfor calibration."
        },
        /* 3 AbilitaTemp */ 
        {
            lable: "Enable Temp",
            dsc: "Enable temperature\ncontrol. When OFF,\nunit works ignoring\ntemperature value."
        },
        /* 4 SetRh */ 
        {
            lable: "Hum Thres.",
            dsc: "Humidity limit.\nTurns on below set.\nTurns off above set\nby the off delta."
        },
        /* 5 DifRh */ 
        {
            lable: "Hum Off Diff",
            dsc: "Humidity off delta.\nAdded to the set to\ncreate hysteresis\nand avoid chattering."
        },
        /* 6 AdjRh */ 
        {
            lable: "Hum Offset",
            dsc: "Offset applied to\nambient humidity\nreading for calib."
        },
        /* 7 AbilitaRh */ 
        {
            lable: "Enable Hum",
            dsc: "Enable humidity\ncontrol. If OFF,\nunit works ignoring\nambient humidity."
        },
        /* 8 TimerON */ 
        {
            lable: "On Time",
            dsc: "Spray ON duration\nwithin duty cycle.\nActive time between\npauses. [mm:ss]"
        },
        /* 9 TimerOFF */ 
        {
            lable: "Pause Time",
            dsc: "Pause duration\nbetween two ON\ncycles of the unit.\nFormat [mm:ss]."
        },
        /*10 AbilitaTimer */ 
        {
            lable: "Enable Timer",
            dsc: "Enable duty cycle.\nIf OFF, the unit\nruns continuously\nwithout ON/OFF."
        },
        /*11 AbleCalendar */ 
        {
            lable: "Enable Cal.",
            dsc: "Enable scheduler.\nWhen ON the unit\nruns only on the\nplanned windows."
        },
        /*12 TempoScarico */ 
        {
            lable: "Drain Time",
            dsc: "Line drain time.\nAfter power off it\nempties the line.\nUnit is seconds."
        },
        /*13 PressDelay */ 
        {
            lable: "Press Delay",
            dsc: "Delay before the\npressure check to\nlet the line reach\nthe right level."
        },
        /*14 AbleAux */ 
        {
            lable: "Enable Start",
            dsc: "Enable AUX start\ninput. If OFF the\nunit ignores the\nexternal start."
        },
        /*15 TimeDay */ 
        {
            lable: "Day",
            dsc: "Current day of\nmonth. Set value\nin the range 1..31."
        },
        /*16 TimeMonth */ 
        {
            lable: "Month",
            dsc: "Current month of\nyear. Set value in\nthe range 1..12."
        },
        /*17 TimeYear */ 
        {
            lable: "Year",
            dsc: "Current year for\nthe internal clock.\nSet four digit year."
        },
        /*18 TimeHour */ 
        {
            lable: "Hour",
            dsc: "Current hour for\nthe internal clock.\nRange is 0..23."
        },
        /*19 TimeMinute */ 
        {
            lable: "Minutes",
            dsc: "Current minutes\nfor the clock. Set\nvalue in 0..59."
        },
        /*20 TypePressureSwitch */ 
        {
            lable: "Press Type",
            dsc: "Installed pressure\nswitch type:\n[NC/NO/Disabled]\nif set to Disabled\nit means that\npressure switch is\nbypassed, so there\nis always pressure"
        },
        /*21 MaxStartAttempts */ 
        {
            lable: "Start Tries",
            dsc: "Maximum number\nof start attempts if\nthe pressure switch\ndetects no water."
        },
        /*22 RelayMode */ 
        {
            lable: "Relay Mode",
            dsc: "Select output relay\nfunction: bypass,\nfan, doser, or the\nanti-bacterial mode."
        },
        /*23 AbleWifi */ 
        {
            lable: "Enable App",
            dsc: "When OFF the unit\ncannot be turned\non remotely by\nthe mobile app."
        },
        /*24 ChangeLang */ 
        {
            lable: "Menu Lang",
            dsc: "Select the menu\nlanguage shown on\nthe device display."
        },
        /*25 TimerOnDispenser */ 
        {
            lable: "Dose On",
            dsc: "Dispenser ON time\nwithin its duty\ncycle. Format is\n[mm:ss] value."
        },
        /*26 TimerOffDispenser */ 
        {
            lable: "Dose Pause",
            dsc: "Dispenser pause\ntime between ON\ncycles. Format\nis [mm:ss]."
        },
        /*27 TimerOnFan */ 
        {
            lable: "TimerOnFan",
            dsc: "Fan ON duration.\nAir blows during\nON. Use mm:ss.\nExample: ON 10s,\nOFF 20s repeats."
        },
        /*28 TimerOffFan */ 
        {
            lable: "TimerOffFan",
            dsc: "Fan OFF duration.\nPause between two\nfan cycles. Use the\nmm:ss format."
        },
        /*29 SetFanTemp */ 
        {
            lable: "SetFanTemp",
            dsc: "Fan temperature\nthreshold. Turns\non above set and\noff below set-diff."
        },
        /*30 DifFanTemp */ 
        {
            lable: "DifFanTemp",
            dsc: "Fan temperature\nhysteresis used to\nswitch off below\nthe set minus diff."
        },
        /*31 SetFanHum */ 
        {
            lable: "SetFanHum",
            dsc: "Fan humidity set.\nTurns on above set\nand turns off below\nset minus diff."
        },
        /*32 DiffFanHum */ 
        {
            lable: "DiffFanHum",
            dsc: "Fan humidity off\nhysteresis. Delta\nbelow set to stop.\nStabilizes cycles."
        },
        /*33 FanDelayAfterOff */ 
        {
            lable: "Fan Off Delay",
            dsc: "Delay to stop fan\nafter the pump is\nturned off. Unit is\nseconds value."
        },
        /*34 AntiBactDelay */ 
        {
            lable: "A.B. Start",
            dsc: "Start anti-bact.\ncycle after given\nhours of inactivity.\nUnit is hours."
        },
        /*35 AntiBactTimer */ 
        {
            lable: "A.B. Duration",
            dsc: "Anti-bacterial cycle\nlength in minutes\nand seconds.\nFormat [mm:ss]."
        },
        /*36 AutoClockUpdate */ 
        { 
            lable: "Auto Time",
            dsc: "Automatic clock\nupdate. When ON\nthe app refreshes\ntime periodically."
        },
        /*37 TypeAuxInput */ 
        {
            lable: "Aux Type",
            dsc: "Type of AUX input\nsignal:\n[NC/NO]"
        },
        /*38 TimeLowPressure */ 
        {
            lable: "Time L.P.",
            dsc: "Pause time before\nrestarting the pump\nwhen low pressure\nis detected [sec.]"
        },
        /*39 ModbusBaudRate */ 
        {
            lable: "BoundRate",
            dsc: "Set the baud rate\nfor Modbus\ncommunication."
        },
        /*40 ModbusDeviceID */ 
        {
            lable: "DeviceID",
            dsc: "Set the Modbus\ndevice ID (1-247)."
        }
    ],
    WeekDays: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday"
    ],
    menu : [
        "EnableMode",
        "Timer",
        "Calendar",
        "Temperature",
        "Humidity",
        "Clock",
        "Constants",
        "Fan",
        "Dispenser",
        "Antibacterial",
        "Modbus"
    ]
};
