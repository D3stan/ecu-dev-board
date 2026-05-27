# **Custom ECU per Motori Monocilindrici**

## **1\. Obiettivi**

L’obiettivo principale è lo sviluppo di una Electronic Control Unit (ECU) custom, progettata specificamente per motocicli monocilindrici a carburatore (2T/4T).

Il cuore del sistema è basato sul SoC **ESP32-S3**, scelto per il suo eccellente bilanciamento tra potenza di calcolo (dual-core), connettività nativa (Wi-Fi/BT) e costi contenuti. L'obiettivo primario del progetto è lo sviluppo di un'architettura **software-defined** robusta e flessibile.

Il firmware non utilizzerà il framework Arduino. Lo sviluppo sarà condotto in ambiente nativo **ESP-IDF** su **FreeRTOS**. La scelta è dettata dalla necessità di determinismo assoluto per la gestione motore (Hard Real-Time) separando nettamente i task non critici.

## **2\. Panoramica del Sistema**

L'architettura hardware è organizzata in blocchi funzionali logici che interagiscono con il core centrale (ESP32).

### **2.1 Core Logic (ECU)**

* **Microcontrollore:** ESP32-S3 (Dual Core).  
* Integrati:  
  * controllo solenoidi e/o motori DC a bassa potenza  
  * condizionamento input di varia natura (pick-up, knock sensor, etc)  
  * controllo elementi di potenza (CDI)  
  * controllo eventuale Display o periferiche 

### **2.2 Input Layer (Sensori)**

Raccoglie i segnali per ricostruire lo stato del sistema.

* **Pick-Up:** Segnale primario di sincronizzazione (RPM e fase). Trigger per gli interrupt critici.  
* **TPS (Throttle Position Sensor):** Fondamentale per mappature 3D (RPM vs apertura farfalla). Determina l'intento del pilota.  
* **Knock Sensor:** Feedback vibrazionale per rilevamento detonazione. Input per algoritmi di correzione attiva dell'anticipo.  
* **EGT (Exhaust Gas Temperature):** Monitoraggio termico per sicurezza motore.  
* **QS (Quick Shifter):** Input digitale per richiesta taglio accensione (cambio elettronico).

### **2.3 Output Layer (Attuatori)**

Il blocco di controllo che traduce la logica software in azioni fisiche.

* **CDI (Ignition Control):** Output primario che permette l’accensione della scintilla.  
* **Power Jet (PWM Control):** Controllo PWM di un solenoide per l'arricchimento miscela agli alti regimi/carichi (ex "Injector"). Gestito via software in base a RPM/TPS.  
* **Exhaust Valve (ex BDC):** Controllo della valvola di scarico tramite.

### **2.4 HMI & Connettività**

* **Web UI (ESP-Hosted):** Interfaccia primaria di tuning. Permette la modifica delle curve, parametri della centralina e diagnosi. Comunicazione tramite websocket per telemetria aggiornata frequentemente.  
* **Server Remoto:** Aggiornamenti OTA, diagnosi a distanza e statistiche sulla telemetria.  
* **Display:** Dashboard locale per visualizzazione dashboard.  
* **Switches:** Input utente per selezione strategie (Map Switch, Pit Limiter, etc).

### **2.5 Testing**

* **Debug:** utilizzo del protocollo JTAG.  
* **HITL:** validazione e test del nuovo codice su microcontrollore collegato ad un server su cui viene eseguito un github runner (upload, test e risultati).  
* **Simulazione:** simulazione dell’ambiente fisico con microcontrollore esterno su banco prova creato ad hoc.

## **3\. Flusso Dati**

1. **Interrupt Pick-Up:** Il Core 0 si sveglia.  
2. **Acquisizione Rapida:** Lettura RPM e ADC (TPS) immediata.  
3. **Calcolo Anticipo:** Lookup nella tabella 3D attiva \+ correzioni (Knock/EGT).  
4. **Scheduling Output:** Impostazione timer hardware per l'evento CDI e calcolo Duty Cycle per Power Jet e Valvola Scarico.  
5. **Esecuzione:** I timer hardware attivano i pin fisici indipendentemente dalla CPU.  
6. **Background (Core 1):** I dati vengono 	copiati in un buffer condiviso per essere serviti alla Web UI e al Display.