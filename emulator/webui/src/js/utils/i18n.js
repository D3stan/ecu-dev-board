// i18n.js
import { Store } from "../core/store.js";
import { Paths } from "./paths.js";
import { log } from "./logger.js";

/**
 * Enum delle lingue (corrisponde a LangSequence in ESP)
 * Usato come indice per accedere alle traduzioni
 */
export const LangIndex = {
  ENGLISH: 0,
  ITALIAN: 1,
  FRENCH: 2,
  GERMAN: 3,
  SPANISH: 4
};

/**
 * Traduzioni hardcoded per l'app (non ricevute da ESP)
 * Struttura: { [langIndex]: { section: { key: "value" } } }
 */
const APP_TRANSLATIONS = {
  // ENGLISH - Index 0
  [LangIndex.ENGLISH]: {
    ui: {
      // Base UI texts
      loading: "Loading...",
      error: "Error",
      save: "Save",
      cancel: "Cancel",
      confirm: "Confirm",
      delete: "Delete",
      edit: "Edit",
      add: "Add",
      remove: "Remove",
      close: "Close",
      ok: "OK",
      yes: "Yes",
      no: "No",
      back: "Back",
      next: "Next",
      previous: "Previous",
      apply: "Apply",
      reset: "Reset",
      // Pages and sections
      titleScheduler: "Scheduler",
      titleSchedulerSetting: "Scheduler Setting",
      titleWifi: "Wi-Fi",
      timerEditorPage: "Edit Timer",
      parameterEditorPage: "Edit Parameter",
      addTimeSlot: "Add new Time Slot",
      activeTimeSlots: "Active Time Slots",
      daysOfWeek: "Days of Week",
      start: "Start",
      stop: "Stop",
      create: "Create",
      modify: "Modify",
      errorNoDays: "Select at least one day of the week",
      startHandle: "Start handle",
      stopHandle: "Stop handle",
      sensors: "Sensors",
      modeSelector: "Mode Selector",
      modeSelectorInstruction: "To start the pump, select a mode.",
      // Mode labels
      modeTemperature: "Temperature",
      modeHumidity: "Humidity",
      modeTimer: "Timer",
      modeCalendar: "Calendar",
      // label per qaundo non ci sono time slot
      noData: "Create a time slot",
      // Connection states
      connected: "Connected",
      connecting: "Connecting",
      disconnected: "Disconnected",
      reconnecting: "Reconnecting",
      // Pump states
      pumpOn: "On",
      pumpOff: "Off",
      powerOn: "On",
      powerOff: "Off",
      pumpLowPressure: "Low Pressure",
      pumpBlocked: "Blocked",
      pumpTesting: "Testing",
      // Timer labels
      timer: {
        hours: "HOURS",
        minutes: "MINUTES",
        seconds: "SECONDS"
      }
    },
    buttons: {
      save: "Save",
      cancel: "Cancel", 
      close: "Close",
      ok: "OK",
      yes: "Yes",
      no: "No"
    },
    banners: {
      maintenance: {
        title: "Maintenance",
        next: "{worksHours} / {totalHours} h — {remainingHours} h remaining",
        required: "Maintenance overdue — immediate service required",
        warning: "{worksHours} / {totalHours} h — {remainingHours} h remaining"
      },
      pump: {
        lowPressure: {
          title: "Low Pressure",
          message: "Pump pressure is too low"
        },
        blocked: {
          title: "Pump Blocked", 
          message: "Pump is blocked - check system immediately"
        }
      },
      antibacterial: {
        title: "Antibacterial Treatment Failed",
        message: "The antibacterial treatment has failed - check system immediately"
      }
      
    },
    messages: {
      connectionLost: "Connection lost",
      reconnecting: "Reconnecting...",
      configTimeout: "Configuration timeout",
      loadingConfig: "Loading configuration...",
      noData: "No data available",
      savingChanges: "Saving changes...",
      changesSaved: "Changes saved successfully",
      errorSaving: "Error saving changes",
      confirmDelete: "Are you sure you want to delete?",
      confirmReset: "Are you sure you want to reset?"
    },
    validation: {
      required: "This field is required",
      invalidValue: "Invalid value",
      outOfRange: "Value out of range",
      minValue: "Minimum value",
      maxValue: "Maximum value"
    },
    paramsStr: {
      apName: "Access Point Name"
    },
    machineId: {
      title: "Machine ID (Modbus / AP / DNS)",
      description: "The Machine ID uniquely identifies the device. Changing it will:\n\n• Update the Modbus Slave ID\n• Change the Wi-Fi AP network name (fogExtra-ID)\n• Change the local DNS name (fogextra-ID.local)\n\nMake sure each machine has a different ID.",
      modbusId: "Modbus ID",
      wifiAp: "Wi-Fi AP",
      dnsLocal: "Local DNS"
    },
    wifi: {
      card: {
        title: "Wi-Fi Connection",
        scan: "Scan"
      },
      section: {
        current: "Current Network",
        available: "Available Networks",
        foundCount: "{count} networks found"
      },
      badge: {
        connected: "Connected",
        disconnected: "Not connected",
        saved: "Saved"
      },
      label: {
        open: "Open",
        noNetwork: "No network",
        unknownNetwork: "Unknown network",
        ipAddress: "IPv4 Address",
        copyIp: "Copy IP",
        copiedIp: "IP copied",
        copyIpFailed: "Failed to copy IP",
        copyingIp: "Copying IP...",
        copiedIpTitle: "IP Copied",
        copyIpFailedTitle: "Copy Failed",
        copyingIpTitle: "Copying IP",
        copyIpTitle: "Copy IP Address"
      },
      state: {
        connecting: "Connecting…",
        scanning: "Scanning networks…"
      },
      form: {
        passwordRequired: "Password required",
        connect: "Connect",
        showPassword: "Show password",
        hidePassword: "Hide password"
      },
      error: {
        timeout: "Connection failed: timeout",
        noApFound: "Connection failed: network not found",
        authFail: "Connection failed: wrong password",
        dhcpFail: "Connection failed: DHCP error",
        unknown: "Connection failed: unknown error"
      },
      note: {
        staMobile: "To change Wi-Fi network or scan for networks, connect to the device access point (AP)"
      }
    },
    pin: {
      title: "Device Locked",
      subtitle: "Enter your PIN to access the dashboard",
      error: "Wrong PIN",
      cancel: "Cancel"
    }
  },

  // ITALIAN - Index 1
  [LangIndex.ITALIAN]: {
    ui: {
      // Testi base UI
      loading: "Caricamento...",
      error: "Errore",
      save: "Salva",
      cancel: "Annulla",
      confirm: "Conferma",
      delete: "Elimina",
      edit: "Modifica",
      add: "Aggiungi",
      remove: "Rimuovi",
      close: "Chiudi",
      ok: "OK",
      yes: "Sì",
      no: "No",
      back: "Indietro",
      next: "Avanti",
      previous: "Precedente",
      apply: "Applica",
      reset: "Ripristina",
      // Pagine e sezioni
      titleScheduler: "Programmazione",
      titleSchedulerSetting: "Impostazioni Programmazione",
      titleWifi: "Wi-Fi",
      timerEditorPage: "Modifica Timer",
      parameterEditorPage: "Modifica Parametro",
      addTimeSlot: "Aggiungi nuova Fascia Oraria",
      activeTimeSlots: "Fasce Orarie Attive",
      daysOfWeek: "Giorni della Settimana",
      start: "Inizio",
      stop: "Fine",
      create: "Crea",
      modify: "Modifica",
      errorNoDays: "Seleziona almeno un giorno della settimana",
      startHandle: "Maniglia inizio",
      stopHandle: "Maniglia fine",
      sensors: "Sensori",
      modeSelector: "Selettore Modalità",
      modeSelectorInstruction: "Per attivare la pompa, seleziona una modalità.",
      // Mode labels
      modeTemperature: "Temperatura",
      modeHumidity: "Umidità",
      modeTimer: "Timer",
      modeCalendar: "Calendario",
      // Connection states
      connected: "Connesso",
      connecting: "Connessione...",
      disconnected: "Disconnesso",
      reconnecting: "Riconnessione...",
      // 
      noData: "Crea un time slot",
      // Pump states
      pumpOn: "Accesa",
      pumpOff: "Spenta",
      powerOn: "Acceso",
      powerOff: "Spento",
      pumpLowPressure: "Bassa Pressione",
      pumpBlocked: "Bloccata",
      pumpTesting: "Test",
      // Timer labels
      timer: {
        hours: "ORE",
        minutes: "MINUTI",
        seconds: "SECONDI"
      }
    },
    buttons: {
      save: "Salva",
      cancel: "Annulla",
      close: "Chiudi", 
      ok: "OK",
      yes: "Sì",
      no: "No"
    },
    banners: {
      maintenance: {
        title: "Manutenzione",
        next: "{worksHours} / {totalHours} h — {remainingHours} h restanti",
        required: "Manutenzione scaduta — intervento immediato richiesto",
        warning: "{worksHours} / {totalHours} h — {remainingHours} h rimanenti"
      },
      pump: {
        lowPressure: {
          title: "Bassa Pressione", 
          message: "La pressione della pompa è troppo bassa"
        },
        blocked: {
          title: "Pompa Bloccata",
          message: "La pompa è bloccata - controllare immediatamente il sistema"
        }
      },
    antibacterial: {
      title: "Trattamento Antibatterico Fallito",
      message: "Il trattamento antibatterico è fallito - controllare subito il sistema"
    }
    },
    messages: {
      connectionLost: "Connessione persa",
      reconnecting: "Riconnessione in corso...",
      configTimeout: "Timeout configurazione",
      loadingConfig: "Caricamento configurazione...",
      noData: "Nessun dato disponibile",
      savingChanges: "Salvataggio modifiche...",
      changesSaved: "Modifiche salvate con successo",
      errorSaving: "Errore nel salvataggio",
      confirmDelete: "Sei sicuro di voler eliminare?",
      confirmReset: "Sei sicuro di voler ripristinare?"
    },
    validation: {
      required: "Questo campo è obbligatorio",
      invalidValue: "Valore non valido",
      outOfRange: "Valore fuori intervallo",
      minValue: "Valore minimo",
      maxValue: "Valore massimo"
    },
    paramsStr: {
      apName: "Nome Punto di Accesso"
    },
    machineId: {
      title: "ID Macchina (Modbus / AP / DNS)",
      description: "L'ID Macchina identifica univocamente il dispositivo. Modificarlo comporta:\n\n• Aggiornamento del Modbus Slave ID\n• Cambio del nome della rete Wi-Fi AP (fogExtra-ID)\n• Cambio del nome DNS locale (fogextra-ID.local)\n\nAssicurati che ogni macchina abbia un ID diverso.",
      modbusId: "Modbus ID",
      wifiAp: "Wi-Fi AP",
      dnsLocal: "DNS locale"
    },
    wifi: {
      card: {
        title: "Connessione Wi-Fi",
        scan: "Scansiona"
      },
      section: {
        current: "Rete Attuale",
        available: "Reti Disponibili",
        foundCount: "{count} reti trovate"
      },
      badge: {
        connected: "Connesso",
        disconnected: "Non connesso",
        saved: "Salvata"
      },
      label: {
        open: "Aperta",
        noNetwork: "Nessuna rete",
        unknownNetwork: "Rete sconosciuta",
        ipAddress: "IPv4 della rete",
        copyIp: "Copia IP",
        copiedIp: "IP copiato",
        copyIpFailed: "Copia fallita",
        copyingIp: "Copia in corso...",
        copiedIpTitle: "IP copiato",
        copyIpFailedTitle: "Copia fallita",
        copyingIpTitle: "Copia in corso",
        copyIpTitle: "Copia IP"
      },
      state: {
        connecting: "Connessione…",
        scanning: "Scansione reti in corso…"
      },
      form: {
        passwordRequired: "Password richiesta",
        connect: "Connetti",
        showPassword: "Mostra password",
        hidePassword: "Nascondi password"
      },
      error: {
        timeout: "Connessione fallita: timeout",
        noApFound: "Connessione fallita: rete non trovata",
        authFail: "Connessione fallita: password errata",
        dhcpFail: "Connessione fallita: errore DHCP",
        unknown: "Connessione fallita: errore sconosciuto"
      },
      note: {
        staMobile: "Per cambiare rete Wi-Fi o scansionare le reti, connettiti al punto di accesso del dispositivo (AP)"
      }
    },
    pin: {
      title: "Dispositivo Bloccato",
      subtitle: "Inserisci il PIN per accedere",
      error: "PIN errato",
      cancel: "Annulla"
    }
  },

  // FRENCH - Index 2
  [LangIndex.FRENCH]: {
    ui: {
      loading: "Chargement...",
      error: "Erreur",
      save: "Enregistrer",
      cancel: "Annuler",
      confirm: "Confirmer",
      delete: "Supprimer",
      edit: "Modifier",
      add: "Ajouter",
      remove: "Retirer",
      close: "Fermer",
      ok: "OK",
      yes: "Oui",
      no: "Non",
      back: "Retour",
      next: "Suivant",
      previous: "Précédent",
      apply: "Appliquer",
      reset: "Réinitialiser",
      titleScheduler: "Planificateur",
      titleSchedulerSetting: "Réglages du Planificateur",
      titleWifi: "Wi-Fi",
      timerEditorPage: "Modifier le Minuteur",
      parameterEditorPage: "Modifier le Paramètre",
      addTimeSlot: "Ajouter une nouvelle tranche horaire",
      activeTimeSlots: "Tranches horaires actives",
      daysOfWeek: "Jours de la Semaine",
      start: "Début",
      stop: "Fin",
      create: "Créer",
      modify: "Modifier",
      errorNoDays: "Sélectionnez au moins un jour de la semaine",
      startHandle: "Poignée de début",
      stopHandle: "Poignée de fin",
      sensors: "Capteurs",
      modeSelector: "Sélecteur de Mode",
      modeSelectorInstruction: "Pour démarrer la pompe, sélectionnez un mode.",
      // Mode labels
      modeTemperature: "Température",
      modeHumidity: "Humidité",
      modeTimer: "Minuteur",
      modeCalendar: "Calendrier",
      // Connection states
      connected: "Connected",
      connecting: "Connecting",
      disconnected: "Disconnected",
      reconnecting: "Reconnecting",

      // scrivilo in francese
      noData: "Créer un créneau horaire",
      // Pump states
      pumpOn: "On",
      pumpOff: "Off",
      powerOn: "On",
      powerOff: "Off",
      pumpLowPressure: "Low Pressure",
      pumpBlocked: "Blocked",
      pumpTesting: "Testing",
      timer: {
        hours: "HEURES",
        minutes: "MINUTES",
        seconds: "SECONDES"
      }
    },
    buttons: {
      save: "Enregistrer",
      cancel: "Annuler",
      close: "Fermer",
      ok: "OK",
      yes: "Oui",
      no: "Non"
    },
    banners: {
      maintenance: {
        title: "Maintenance",
        next: "{worksHours} / {totalHours} h — {remainingHours} h restantes",
        required: "Maintenance échue — intervention immédiate requise",
        warning: "{worksHours} / {totalHours} h — {remainingHours} h restantes"
      },
      pump: {
        lowPressure: {
          title: "Basse Pression",
          message: "La pression de la pompe est trop basse"
        },
        blocked: {
          title: "Pompe Bloquée",
          message: "La pompe est bloquée - vérifier le système immédiatement"
        }
      },
      antibacterial: {
        title: "Échec du Traitement Antibactérien",
        message: "Le traitement antibactérien a échoué - vérifiez immédiatement le système"
      }
    },
    messages: {
      connectionLost: "Connexion perdue",
      reconnecting: "Reconnexion...",
      configTimeout: "Délai de configuration",
      loadingConfig: "Chargement de la configuration...",
      noData: "Aucune donnée disponible",
      savingChanges: "Enregistrement des modifications...",
      changesSaved: "Modifications enregistrées avec succès",
      errorSaving: "Erreur lors de l'enregistrement",
      confirmDelete: "Êtes-vous sûr de vouloir supprimer?",
      confirmReset: "Êtes-vous sûr de vouloir réinitialiser?"
    },
    validation: {
      required: "Ce champ est obligatoire",
      invalidValue: "Valeur invalide",
      outOfRange: "Valeur hors limites",
      minValue: "Valeur minimale",
      maxValue: "Valeur maximale"
    },
    paramsStr: {
      apName: "Nom du Point d'Accès"
    },
    machineId: {
      title: "ID Machine (Modbus / AP / DNS)",
      description: "L'ID Machine identifie de manière unique l'appareil. Le modifier entraînera :\n\n• Mise à jour du Modbus Slave ID\n• Changement du nom du réseau Wi-Fi AP (fogExtra-ID)\n• Changement du nom DNS local (fogextra-ID.local)\n\nAssurez-vous que chaque machine a un ID différent.",
      modbusId: "Modbus ID",
      wifiAp: "Wi-Fi AP",
      dnsLocal: "DNS local"
    },
    wifi: {
      card: {
        title: "Connexion Wi-Fi",
        scan: "Scanner"
      },
      section: {
        current: "Réseau Actuel",
        available: "Réseaux Disponibles",
        foundCount: "{count} réseaux trouvés"
      },
      badge: {
        connected: "Connecté",
        disconnected: "Non connecté",
        saved: "Enregistré"
      },
      label: {
        open: "Ouvert",
        noNetwork: "Aucun réseau",
        unknownNetwork: "Réseau inconnu",
        ipAddress: "Adresse IPv4",
        copyIp: "Copier l'IP",
        copiedIp: "IP copié",
        copyIpFailed: "La copie a échoué",
        copyingIp: "Copie en cours...",
        copiedIpTitle: "IP copié",
        copyIpFailedTitle: "Échec de la copie",
        copyingIpTitle: "Copie en cours",
        copyIpTitle: "Copier l'IP"
      },
      state: {
        connecting: "Connexion…",
        scanning: "Recherche de réseaux…"
      },
      form: {
        passwordRequired: "Mot de passe requis",
        connect: "Connecter",
        showPassword: "Afficher le mot de passe",
        hidePassword: "Masquer le mot de passe"
      },
      error: {
        timeout: "Connexion échouée : délai dépassé",
        noApFound: "Connexion échouée : réseau introuvable",
        authFail: "Connexion échouée : mot de passe incorrect",
        dhcpFail: "Connexion échouée : erreur DHCP",
        unknown: "Connexion échouée : erreur inconnue"
      },
      note: {
        staMobile: "Pour changer de réseau Wi-Fi ou scanner les réseaux, connectez-vous au point d'accès de l'appareil (AP)"
      }
    },
    pin: {
      title: "Appareil Verrouillé",
      subtitle: "Entrez votre PIN pour accéder au tableau de bord",
      error: "PIN incorrect",
      cancel: "Annuler"
    }
  },
  [LangIndex.GERMAN]: {
    ui: {
      loading: "Laden...",
      error: "Fehler",
      save: "Speichern",
      cancel: "Abbrechen",
      confirm: "Bestätigen",
      delete: "Löschen",
      edit: "Bearbeiten",
      add: "Hinzufügen",
      remove: "Entfernen",
      close: "Schließen",
      ok: "OK",
      yes: "Ja",
      no: "Nein",
      back: "Zurück",
      next: "Weiter",
      previous: "Vorherige",
      apply: "Anwenden",
      reset: "Zurücksetzen",
      titleScheduler: "Zeitplaner",
      titleSchedulerSetting: "Zeitplaner-Einstellungen",
      titleWifi: "WLAN",
      timerEditorPage: "Timer Bearbeiten",
      parameterEditorPage: "Parameter Bearbeiten",
      addTimeSlot: "Neue Zeitspanne hinzufügen",
      activeTimeSlots: "Aktive Zeitspannen",
      daysOfWeek: "Wochentage",
      start: "Start",
      stop: "Ende",
      create: "Erstellen",
      modify: "Ändern",
      errorNoDays: "Wählen Sie mindestens einen Wochentag aus",
      startHandle: "Startgriff",
      stopHandle: "Endgriff",
      sensors: "Sensoren",
      modeSelector: "Modus-Selektor",
      modeSelectorInstruction: "Um die Pumpe zu starten, wählen Sie einen Modus.",
      // Mode labels
      modeTemperature: "Temperatur",
      modeHumidity: "Feuchtigkeit",
      modeTimer: "Timer",
      modeCalendar: "Kalender",
      // Connection states
      connected: "Connected",
      connecting: "Connecting",
      disconnected: "Disconnected",
      reconnecting: "Reconnecting",

      // scrivilo in tedesco
      noData: "Erstellen Sie einen Zeitrahmen",
      // Pump states
      pumpOn: "On",
      pumpOff: "Off",
      powerOn: "On",
      powerOff: "Off",
      pumpLowPressure: "Low Pressure",
      pumpBlocked: "Blocked",
      pumpTesting: "Testing",
      timer: {
        hours: "STUNDEN",
        minutes: "MINUTEN",
        seconds: "SEKUNDEN"
      }
    },
    buttons: {
      save: "Speichern",
      cancel: "Abbrechen",
      close: "Schließen",
      ok: "OK",
      yes: "Ja",
      no: "Nein"
    },
    banners: {
      maintenance: {
        title: "Wartung",
        next: "{worksHours} / {totalHours} h — {remainingHours} h verbleibend",
        required: "Wartung überfällig — sofortiger Service erforderlich",
        warning: "{worksHours} / {totalHours} h — {remainingHours} h verbleibend"
      },
      pump: {
        lowPressure: {
          title: "Niedriger Druck",
          message: "Pumpendruck ist zu niedrig"
        },
        blocked: {
          title: "Pumpe Blockiert",
          message: "Pumpe ist blockiert - System sofort überprüfen"
        }
      },
      antibacterial: {
        title: "Antibakterielle Behandlung Fehlgeschlagen",
        message: "Die antibakterielle Behandlung ist fehlgeschlagen – prüfen Sie das System sofort"
      }
    },
    messages: {
      connectionLost: "Verbindung verloren",
      reconnecting: "Wiederverbindung...",
      configTimeout: "Konfigurationszeitüberschreitung",
      loadingConfig: "Konfiguration wird geladen...",
      noData: "Keine Daten verfügbar",
      savingChanges: "Änderungen werden gespeichert...",
      changesSaved: "Änderungen erfolgreich gespeichert",
      errorSaving: "Fehler beim Speichern",
      confirmDelete: "Sind Sie sicher, dass Sie löschen möchten?",
      confirmReset: "Sind Sie sicher, dass Sie zurücksetzen möchten?"
    },
    validation: {
      required: "Dieses Feld ist erforderlich",
      invalidValue: "Ungültiger Wert",
      outOfRange: "Wert außerhalb des Bereichs",
      minValue: "Mindestwert",
      maxValue: "Höchstwert"
    },
    paramsStr: {
      apName: "Access Point Name"
    },
    machineId: {
      title: "Maschinen-ID (Modbus / AP / DNS)",
      description: "Die Maschinen-ID identifiziert das Gerät eindeutig. Eine Änderung bewirkt:\n\n• Aktualisierung der Modbus Slave ID\n• Änderung des Wi-Fi AP Netzwerknamens (fogExtra-ID)\n• Änderung des lokalen DNS-Namens (fogextra-ID.local)\n\nStellen Sie sicher, dass jede Maschine eine andere ID hat.",
      modbusId: "Modbus ID",
      wifiAp: "Wi-Fi AP",
      dnsLocal: "Lokales DNS"
    },
    wifi: {
      card: {
        title: "WLAN-Verbindung",
        scan: "Suchen"
      },
      section: {
        current: "Aktuelles Netzwerk",
        available: "Verfügbare Netzwerke",
        foundCount: "{count} Netzwerke gefunden"
      },
      badge: {
        connected: "Verbunden",
        disconnected: "Nicht verbunden",
        saved: "Gespeichert"
      },
      label: {
        open: "Offen",
        noNetwork: "Kein Netzwerk",
        unknownNetwork: "Unbekanntes Netzwerk",
        ipAddress: "IPv4-Adresse",
        copyIp: "IP kopieren",
        copiedIp: "IP kopiert",
        copyIpFailed: "Kopieren fehlgeschlagen",
        copyingIp: "Kopiere...",
        copiedIpTitle: "IP kopiert",
        copyIpFailedTitle: "Kopie fehlgeschlagen",
        copyingIpTitle: "Kopiere...",
        copyIpTitle: "IP kopieren"
      },
      state: {
        connecting: "Verbindung…",
        scanning: "Netzwerke werden gesucht…"
      },
      form: {
        passwordRequired: "Passwort erforderlich",
        connect: "Verbinden",
        showPassword: "Passwort anzeigen",
        hidePassword: "Passwort verbergen"
      },
      error: {
        timeout: "Verbindung fehlgeschlagen: Zeitüberschreitung",
        noApFound: "Verbindung fehlgeschlagen: Netzwerk nicht gefunden",
        authFail: "Verbindung fehlgeschlagen: falsches Passwort",
        dhcpFail: "Verbindung fehlgeschlagen: DHCP-Fehler",
        unknown: "Verbindung fehlgeschlagen: unbekannter Fehler"
      },
      note: {
        staMobile: "Um ein Wi-Fi-Netzwerk zu ändern oder nach Netzwerken zu suchen, verbinden Sie sich mit dem Access Point des Geräts (AP)"
      }
    },
    pin: {
      title: "Gerät Gesperrt",
      subtitle: "Geben Sie Ihre PIN ein, um auf das Dashboard zuzugreifen",
      error: "Falsche PIN",
      cancel: "Abbrechen"
    }
  },

  // SPANISH - Index 4
  [LangIndex.SPANISH]: {
    ui: {
      loading: "Cargando...",
      error: "Error",
      save: "Guardar",
      cancel: "Cancelar",
      confirm: "Confirmar",
      delete: "Eliminar",
      edit: "Editar",
      add: "Agregar",
      remove: "Quitar",
      close: "Cerrar",
      ok: "OK",
      yes: "Sí",
      no: "No",
      back: "Atrás",
      next: "Siguiente",
      previous: "Anterior",
      apply: "Aplicar",
      reset: "Restablecer",
      titleScheduler: "Programador",
      titleSchedulerSetting: "Configuración del Programador",
      titleWifi: "Wi-Fi",
      timerEditorPage: "Editar Temporizador",
      parameterEditorPage: "Editar Parámetro",
      addTimeSlot: "Agregar nueva franja horaria",
      activeTimeSlots: "Franjas horarias activas",
      daysOfWeek: "Días de la Semana",
      start: "Inicio",
      stop: "Fin",
      create: "Crear",
      modify: "Modificar",
      errorNoDays: "Selecciona al menos un día de la semana",
      startHandle: "Manija de inicio",
      stopHandle: "Manija de fin",
      sensors: "Sensores",
      modeSelector: "Selector de Modo",
      modeSelectorInstruction: "Para iniciar la bomba, seleccione un modo.",
      // Mode labels
      modeTemperature: "Temperatura",
      modeHumidity: "Humedad",
      modeTimer: "Temporizador",
      modeCalendar: "Calendario",
      // Connection states
      connected: "Connected",
      connecting: "Connecting",
      disconnected: "Disconnected",
      reconnecting: "Reconnecting",

      // scrivilo in spagnolo
      noData: "Crea un time slot",
      // Pump states
      pumpOn: "On",
      pumpOff: "Off",
      powerOn: "On",
      powerOff: "Off",
      pumpLowPressure: "Low Pressure",
      pumpBlocked: "Blocked",
      pumpTesting: "Testing",
      timer: {
        hours: "HORAS",
        minutes: "MINUTOS",
        seconds: "SEGUNDOS"
      }
    },
    buttons: {
      save: "Guardar",
      cancel: "Cancelar",
      close: "Cerrar",
      ok: "OK",
      yes: "Sí",
      no: "No"
    },
    banners: {
      maintenance: {
        title: "Mantenimiento",
        next: "{worksHours} / {totalHours} h — {remainingHours} h restantes",
        required: "Mantenimiento vencido — se requiere intervención inmediata",
        warning: "{worksHours} / {totalHours} h — {remainingHours} h restantes"
      },
      pump: {
        lowPressure: {
          title: "Baja Presión",
          message: "La presión de la bomba es demasiado baja"
        },
        blocked: {
          title: "Bomba Bloqueada",
          message: "La bomba está bloqueada - verificar el sistema inmediatamente"
        }
      },
      antibacterial: {
        title: "Tratamiento Antibacteriano Fallido",
        message: "El tratamiento antibacteriano ha fallado - revise el sistema inmediatamente"
      }
    },
    messages: {
      connectionLost: "Conexión perdida",
      reconnecting: "Reconectando...",
      configTimeout: "Tiempo de espera de configuración",
      loadingConfig: "Cargando configuración...",
      noData: "No hay datos disponibles",
      savingChanges: "Guardando cambios...",
      changesSaved: "Cambios guardados con éxito",
      errorSaving: "Error al guardar",
      confirmDelete: "¿Está seguro de que desea eliminar?",
      confirmReset: "¿Está seguro de que desea restablecer?"
    },
    validation: {
      required: "Este campo es obligatorio",
      invalidValue: "Valor inválido",
      outOfRange: "Valor fuera de rango",
      minValue: "Valor mínimo",
      maxValue: "Valor máximo"
    },
    paramsStr: {
      apName: "Nombre del Punto de Acceso"
    },
    machineId: {
      title: "ID de Máquina (Modbus / AP / DNS)",
      description: "El ID de Máquina identifica de forma única el dispositivo. Modificarlo implica:\n\n• Actualización del Modbus Slave ID\n• Cambio del nombre de la red Wi-Fi AP (fogExtra-ID)\n• Cambio del nombre DNS local (fogextra-ID.local)\n\nAsegúrate de que cada máquina tenga un ID diferente.",
      modbusId: "Modbus ID",
      wifiAp: "Wi-Fi AP",
      dnsLocal: "DNS local"
    },
    wifi: {
      card: {
        title: "Conexión Wi-Fi",
        scan: "Buscar"
      },
      section: {
        current: "Red Actual",
        available: "Redes Disponibles",
        foundCount: "{count} redes encontradas"
      },
      badge: {
        connected: "Conectado",
        disconnected: "No conectado",
        saved: "Guardada"
      },
      label: {
        open: "Abierta",
        noNetwork: "Sin red",
        unknownNetwork: "Red desconocida",
        ipAddress: "Dirección IPv4",
        copyIp: "Copiar IP",
        copiedIp: "IP copiada",
        copyIpFailed: "Error al copiar IP",
        copyingIp: "Copiando IP...",
        copiedIpTitle: "IP copiada",
        copyIpFailedTitle: "Error al copiar",
        copyingIpTitle: "Copiando IP",
        copyIpTitle: "Copiar IP"
      },
      state: {
        connecting: "Conectando…",
        scanning: "Buscando redes…"
      },
      form: {
        passwordRequired: "Contraseña requerida",
        connect: "Conectar",
        showPassword: "Mostrar contraseña",
        hidePassword: "Ocultar contraseña"
      },
      error: {
        timeout: "Conexión fallida: tiempo de espera agotado",
        noApFound: "Conexión fallida: red no encontrada",
        authFail: "Conexión fallida: contraseña incorrecta",
        dhcpFail: "Conexión fallida: error DHCP",
        unknown: "Conexión fallida: error desconocido"
      },
      note: {
        staMobile: "Para cambiar de red Wi-Fi o buscar redes, conéctese al punto de acceso del dispositivo (AP)"
      }
    },
    pin: {
      title: "Dispositivo Bloqueado",
      subtitle: "Introduce tu PIN para acceder al panel",
      error: "PIN incorrecto",
      cancel: "Cancelar"
    }
  }
};

/**
 * Classe I18n - Sistema di internazionalizzazione
 * Gestisce traduzioni hardcoded app + testi ricevuti da ESP
 */
class I18n {
  constructor() {
    this.changeListeners = [];
    this._setupLanguageListener();
  }

  /**
   * Setup listener per cambio lingua nello Store
   * Quando cambia il parametro ChangeLang (id=24), notifica tutti i listener
   */
  _setupLanguageListener() {
    Store.subscribe(Paths.LOCALIZATION.CURRENT_LANG_INDEX, (newLangIndex) => {
      log.info(`Language changed to index: ${newLangIndex}`);
      this._notifyLanguageChange(newLangIndex);
    });
  }

  /**
   * Notifica tutti i listener del cambio lingua
   * @param {number} newLangIndex - Nuovo indice lingua
   */
  _notifyLanguageChange(newLangIndex) {
    this.changeListeners.forEach(callback => {
      try {
        callback(newLangIndex);
      } catch (error) {
        log.error('Error in language change listener:', error);
      }
    });
  }

  /**
   * Registra un listener per il cambio lingua
   * @param {Function} callback - Funzione da chiamare al cambio lingua
   * @returns {Function} Funzione per rimuovere il listener
   */
  onLanguageChange(callback) {
    this.changeListeners.push(callback);
    
    // Ritorna funzione per unsubscribe
    return () => {
      const index = this.changeListeners.indexOf(callback);
      if (index > -1) {
        this.changeListeners.splice(index, 1);
      }
    };
  }

  /**
   * Ottiene l'indice della lingua corrente
   * @returns {number} Indice lingua (0-4)
   */
  getCurrentLangIndex() {
    const langIndex = Store.get(Paths.LOCALIZATION.CURRENT_LANG_INDEX);
    // Default a ITALIAN se non ancora impostato
    return langIndex !== undefined && langIndex !== null ? langIndex : LangIndex.ITALIAN;
  }

  /**
   * Traduce una chiave usando le traduzioni hardcoded dell'app
   * @param {string} key - Chiave traduzione (es: "ui.save" o "messages.connectionLost")
   * @param {object} params - Parametri opzionali per interpolazione {param: value}
   * @returns {string} Testo tradotto
   */
  t(key, params = {}) {
    const langIndex = this.getCurrentLangIndex();
    const translations = APP_TRANSLATIONS[langIndex];

    if (!translations) {
      log.warn(`No translations found for language index: ${langIndex}`);
      return key;
    }
    
    // Naviga l'oggetto nested (es: "ui.save" → translations.ui.save)
    const text = this._getNestedValue(translations, key);
    
    if (!text) {
      log.warn(`Missing translation for key: ${key} (lang: ${langIndex})`);
      return key;
    }
    
    // Interpola parametri se presenti
    return this._interpolate(text, params);
  }

  tMenu(menuId) {
    const langIndex = this.getCurrentLangIndex();
    
    // Static translations for ECU dashboard menus across LangIndex
    const menus = {
      0: ['Dashboard', 'Dashboard', 'Tableau de bord', 'Dashboard', 'Panel de control'], // DASHBOARD
      1: ['Maps', 'Mappe', 'Cartes', 'Karten', 'Mapas'],                              // MAPS
      2: ['Settings', 'Impostazioni', 'Paramètres', 'Einstellungen', 'Ajustes']        // SETTINGS
    };

    return menus[menuId]?.[langIndex] || `Menu ${menuId}`;
  }


  /**
   * Traduce un nome parametro usando i dati ricevuti da ESP
   * @param {number} paramId - ID del parametro
   * @returns {object} Oggetto con { name, ds } tradotti
   */
  tParam(paramId) {
    const langs = Store.get(Paths.LOCALIZATION.LANGS);
    const langIndex = this.getCurrentLangIndex();
    
    if (!langs || !langs[langIndex]) {
      log.warn(`No language data available for index: ${langIndex}`);
      return { name: `Param ${paramId}`, ds: '' };
    }
    
    // Accesso diretto per indice (paramId corrisponde all'indice nell'array param)
    const translation = langs[langIndex].param?.[paramId];
    
    if (!translation) {
      log.warn(`No translation found for param id ${paramId} in language ${langIndex}`);
      return { name: `Param ${paramId}`, ds: '' };
    }
    
    return {
      name: translation.name || `Param ${paramId}`,
      ds: translation.ds || ''
    };
  }

  /**
   * Traduce una lettera del giorno della settimana
   * @param {number} dayIndex - Indice giorno (0=lun, 1=mar, ..., 6=dom)
   * @returns {string} Lettera del giorno
   */
  tDay(dayIndex) {
    const langs = Store.get(Paths.LOCALIZATION.LANGS);
    const langIndex = this.getCurrentLangIndex();
    
    if (!langs || !langs[langIndex]) {
      log.warn(`No language data available for index: ${langIndex}`);
      return '';
    }
    
    const dayLetter = langs[langIndex].daysLetter?.[dayIndex];
    return dayLetter || '';
  }

  /**
   * Traduce un valore ENUM usando enumMappings
   * @param {number} enumType - Tipo di parametro (da ParamType)
   * @param {number} value - Valore numerico del parametro
   * @returns {string} Valore tradotto
   */
  tEnum(enumType, value) {
    return String(value);
  }

  /**
   * Ottiene valore nested da oggetto usando path stringa
   * @param {object} obj - Oggetto da cui estrarre valore
   * @param {string} path - Path separato da '.' (es: "ui.save")
   * @returns {*} Valore trovato o undefined
   */
  _getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Interpola parametri nel testo
   * Sostituisce {key} con params[key]
   * @param {string} text - Testo con placeholder {key}
   * @param {object} params - Parametri da sostituire
   * @returns {string} Testo interpolato
   */
  _interpolate(text, params) {
    return text.replace(/\{(\w+)\}/g, (match, key) => {
      return params.hasOwnProperty(key) ? params[key] : match;
    });
  }
}

// Esporta istanza singleton
export const i18n = new I18n();

// Export anche la classe per test
export default I18n;
