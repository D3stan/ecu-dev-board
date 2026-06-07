/**
 * enumMappings.js
 * ===============
 * Mappature hardcoded per parametri di tipo ENUM (PRESSURE_TYPE, RELAY_MODE, LANG_TYPE, MONTH).
 * 
 * Ogni mappatura include traduzioni per tutte le lingue supportate:
 * - 0: English
 * - 1: Italian
 * - 2: French
 * - 3: German
 * - 4: Spanish
 * 
 * @author FogExtra Team
 * @version 1.0.0
 */

/**
 * Mappatura per PRESSURE_TYPE
 * 0 = NC (Normalmente Chiuso)
 * 1 = NO (Normalmente Aperto)
 */
export const PRESSURE_TYPE_MAPPING = {
  0: {
    0: "NO",  // English
    1: "NO",  // Italian
    2: "NO",  // French (Normalement Ouvert)
    3: "NO",  // German (Normalerweise Offen)
    4: "NO"   // Spanish (Normalmente Abierto)
  },
    1: {
    0: "NC",  // English
    1: "NC",  // Italian
    2: "NF",  // French (Normalement Fermé)
    3: "NC",  // German (Normalerweise Geschlossen)
    4: "NC"   // Spanish (Normalmente Cerrado)
  },
  2: {
    0: "Disabled", // English
    1: "Disabilitato", // Italian
    2: "Désactivé", // French
    3: "Deaktiviert", // German
    4: "Desactivado" // Spanish
  }
};

/**
 * Mappatura per RELAY_MODE
 * 0 = Bypass
 * 1 = Dispenser
 * 2 = Fan
 * 3 = Antibacterial
 * 4 = Disabled
 */
export const RELAY_MODE_MAPPING = {
  0: {
    0: "ByPass",      // English
    1: "ByPass",      // Italian
    2: "Contournement", // French
    3: "Umleitung",   // German
    4: "Desvío"       // Spanish
  },
  1: {
    0: "Dispenser",   // English
    1: "Dosatore",    // Italian
    2: "Distributeur", // French
    3: "Spender",     // German
    4: "Dispensador"  // Spanish
  },
  2: {
    0: "Fan",         // English
    1: "Ventola",     // Italian
    2: "Ventilateur", // French
    3: "Ventilator",  // German
    4: "Ventilador"   // Spanish
  },
  3: {
    0: "Antibacterial",     // English
    1: "Antibatterico",     // Italian
    2: "Antibactérien",     // French
    3: "Antibakteriell",    // German
    4: "Antibacteriano"     // Spanish
  },
  4: {
    0: "Disabled",     // English
    1: "Disabilitato", // Italian
    2: "Désactivé",    // French
    3: "Deaktiviert",  // German
    4: "Desactivado"   // Spanish
  }
};

/**
 * Mappatura per AUX_TYPE (esempio - da definire in base alle specifiche)
 * TODO: Verificare i valori corretti con le specifiche ESP32
 */
export const AUX_TYPE_MAPPING = {
  0: {
    0: "None",        // English
    1: "Nessuno",     // Italian
    2: "Aucun",       // French
    3: "Keine",       // German
    4: "Ninguno"      // Spanish
  },
  1: {
    0: "Aux 1",       // English
    1: "Aux 1",       // Italian
    2: "Aux 1",       // French
    3: "Aux 1",       // German
    4: "Aux 1"        // Spanish
  },
  2: {
    0: "Aux 2",       // English
    1: "Aux 2",       // Italian
    2: "Aux 2",       // French
    3: "Aux 2",       // German
    4: "Aux 2"        // Spanish
  }
};

/**
 * Mappatura per BOOL
 * 0 = False/No/Off
 * 1 = True/Yes/On
 */
export const BOOL_MAPPING = {
  0: {
    0: "No",          // English
    1: "No",          // Italian
    2: "Non",         // French
    3: "Nein",        // German
    4: "No"           // Spanish
  },
  1: {
    0: "Yes",         // English
    1: "Sì",          // Italian
    2: "Oui",         // French
    3: "Ja",          // German
    4: "Sí"           // Spanish
  }
};

/**
 * Mappatura per LANG_TYPE
 * 0 = English
 * 1 = Italian
 * 2 = French
 * 3 = German
 * 4 = Spanish
 */
export const LANG_TYPE_MAPPING = {
  0: {
    0: "Eng",  // English
    1: "Ing",  // Italian
    2: "Ang",  // French
    3: "Eng",  // German
    4: "Ing"   // Spanish
  },
  1: {
    0: "It",   // English
    1: "It",   // Italian
    2: "It",   // French
    3: "It",   // German
    4: "It"    // Spanish
  },
  2: {
    0: "Fr",   // English
    1: "Fr",   // Italian
    2: "Fr",   // French
    3: "Fr",   // German
    4: "Fr"    // Spanish
  },
  3: {
    0: "De",   // English
    1: "Te",   // Italian (Tedesco)
    2: "Al",   // French (Allemand)
    3: "De",   // German
    4: "Al"    // Spanish (Alemán)
  },
  4: {
    0: "Es",   // English
    1: "Sp",   // Italian (Spagnolo)
    2: "Es",   // French (Espagnol)
    3: "Sp",   // German (Spanisch)
    4: "Es"    // Spanish
  }
};

export const MODBUS_BAUDRATE_MAPPING = {
    0: {
      0: "1200",  // English
      1: "1200",  // Italian
      2: "1200",  // French
      3: "1200",  // German
      4: "1200"   // Spanish
    },
    1: {
      0: "2400",  // English
      1: "2400",  // Italian
      2: "2400",  // French
      3: "2400",  // German
      4: "2400"   // Spanish
    },
    2: {
      0: "4800",  // English
      1: "4800",  // Italian
      2: "4800",  // French
      3: "4800",  // German
      4: "4800"   // Spanish
    },
    3: {
      0: "9600",  // English
      1: "9600",  // Italian
      2: "9600",  // French
      3: "9600",  // German
      4: "9600"   // Spanish
    },
    4: {
      0: "19200",  // English
      1: "19200",  // Italian
      2: "19200",  // French
      3: "19200",  // German
      4: "19200"   // Spanish
    },
    5: {
      0: "38400",  // English
      1: "38400",  // Italian
      2: "38400",  // French
      3: "38400",  // German
      4: "38400"   // Spanish
    },
    6: {
      0: "57600",  // English
      1: "57600",  // Italian
      2: "57600",  // French
      3: "57600",  // German
      4: "57600"   // Spanish
    },
    7: {
      0: "115200",  // English
      1: "115200",  // Italian
      2: "115200",  // French
      3: "115200",  // German
      4: "115200"   // Spanish
    }
}

/**
 * Mappatura per MONTH
 * 1-12 = Gennaio...Dicembre
 */
export const MONTH_MAPPING = {
  1: {
    0: "January",   // English
    1: "Gennaio",   // Italian
    2: "Janvier",   // French
    3: "Januar",    // German
    4: "Enero"      // Spanish
  },
  2: {
    0: "February",  // English
    1: "Febbraio",  // Italian
    2: "Février",   // French
    3: "Februar",   // German
    4: "Febrero"    // Spanish
  },
  3: {
    0: "March",     // English
    1: "Marzo",     // Italian
    2: "Mars",      // French
    3: "März",      // German
    4: "Marzo"      // Spanish
  },
  4: {
    0: "April",     // English
    1: "Aprile",    // Italian
    2: "Avril",     // French
    3: "April",     // German
    4: "Abril"      // Spanish
  },
  5: {
    0: "May",       // English
    1: "Maggio",    // Italian
    2: "Mai",       // French
    3: "Mai",       // German
    4: "Mayo"       // Spanish
  },
  6: {
    0: "June",      // English
    1: "Giugno",    // Italian
    2: "Juin",      // French
    3: "Juni",      // German
    4: "Junio"      // Spanish
  },
  7: {
    0: "July",      // English
    1: "Luglio",    // Italian
    2: "Juillet",   // French
    3: "Juli",      // German
    4: "Julio"      // Spanish
  },
  8: {
    0: "August",    // English
    1: "Agosto",    // Italian
    2: "Août",      // French
    3: "August",    // German
    4: "Agosto"     // Spanish
  },
  9: {
    0: "September", // English
    1: "Settembre", // Italian
    2: "Septembre", // French
    3: "September", // German
    4: "Septiembre" // Spanish
  },
  10: {
    0: "October",   // English
    1: "Ottobre",   // Italian
    2: "Octobre",   // French
    3: "Oktober",   // German
    4: "Octubre"    // Spanish
  },
  11: {
    0: "November",  // English
    1: "Novembre",  // Italian
    2: "Novembre",  // French
    3: "November",  // German
    4: "Noviembre"  // Spanish
  },
  12: {
    0: "December",  // English
    1: "Dicembre",  // Italian
    2: "Décembre",  // French
    3: "Dezember",  // German
    4: "Diciembre"  // Spanish
  }
};

/**
 * Ottiene il valore tradotto per un parametro ENUM
 * @param {string} enumType - Tipo di enum (PRESSURE_TYPE, RELAY_MODE, LANG_TYPE, MONTH, AUX_TYPE, BOOL)
 * @param {number} value - Valore numerico del parametro
 * @param {number} langIndex - Indice lingua corrente (0-4)
 * @returns {string} Valore tradotto
 */
export function getEnumValue(enumType, value, langIndex) {
  let mapping = null;
  
  switch (enumType) {
    case 'PRESSURE_TYPE':
      mapping = PRESSURE_TYPE_MAPPING;
      break;
    case 'RELAY_MODE':
      mapping = RELAY_MODE_MAPPING;
      break;
    case 'AUX_TYPE':
      mapping = AUX_TYPE_MAPPING;
      break;
    case 'BOOL':
      mapping = BOOL_MAPPING;
      break;
    case 'LANG_TYPE':
      mapping = LANG_TYPE_MAPPING;
      break;
    case 'MONTH':
      mapping = MONTH_MAPPING;
      break;
    case 'MODBUS_BAUDRATE':
      mapping = MODBUS_BAUDRATE_MAPPING;
      break;
    default:
      console.warn(`Unknown enum type: ${enumType}`);
      return String(value);
  }
  
  // Verifica che esista la mappatura per il valore
  if (!mapping[value]) {
    console.warn(`No mapping found for ${enumType} value: ${value}`);
    return String(value);
  }
  
  // Verifica che esista la traduzione per la lingua
  if (mapping[value][langIndex] === undefined) {
    console.warn(`No translation found for ${enumType} value ${value} in language ${langIndex}`);
    return mapping[value][0]; // Fallback a English
  }
  
  return mapping[value][langIndex];
}
