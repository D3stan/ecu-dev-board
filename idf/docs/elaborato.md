# ECU Telemetria e Accensione — Specifica Finale

## 1. Panoramica del Sistema

Un sistema embedded/web a 4 nodi che dimostra una ECU personalizzata per motocicli monocilindrici. Il progetto copre controllo motore in tempo reale, telemetria live, tuning mappe, aggiornamenti OTA e logging delle sessioni.

### Nodi

| # | Nodo | Hardware | Ruolo |
|---|---|---|---|
| 1 | **Simulatore** | ESP32 | Genera segnali sensore simulati (pick-up, TPS, EGT). Controllato tramite una mini web UI dedicata. |
| 2 | **ECU** | ESP32-S3 | Controllo motore (Core 0) + comunicazioni (Core 1). Ospita la dashboard a bordo da LittleFS. |
| 3 | **Dashboard a Bordo** | Browser telefono/tablet | App SvelteKit servita dalla ECU. **Controllo completo**: telemetria in tempo reale, editing mappe, OTA, trigger QS. |
| 4 | **Server** | VM Proxmox | Broker MQTT (Mosquitto) + backend Express.js + React SPA. **Solo lettura**: visualizzatore storico sessioni. |

### Protocolli

| Percorso | Protocollo | Direzione | Payload |
|---|---|---|---|
| Simulatore → ECU | GPIO / cavi ADC | Input | Onda quadra (pick-up), analogico (TPS, EGT) |
| ECU → Telefono | WebSocket | Push | Telemetria in tempo reale JSON (~10–20 Hz) |
| Telefono → ECU | WebSocket | Comandi | Trigger QS, editing mappa, switch mappa, richiesta config |
| ECU → Broker MQTT | Pubblicazione MQTT | Push | Log sessione (bufferizzati, inviati a fine sessione) |
| Broker MQTT → Express | Sottoscrizione MQTT | Push | Log sessione → PostgreSQL |
| React SPA → Express | HTTP REST | Pull | Lista sessioni, dettaglio sessione |
| ECU → VM Proxmox | HTTP GET | Pull | Verifica versione OTA + download firmware |

---

## 2. Diagramma di Architettura

```
  ┌──────────────────┐
  │   Simulatore     │
  │   (ESP32)        │
  │                  │          GPIO wires
  │  Onda quadra ────┼────────────────────────────┐
  │  TPS analog. ────┼────────────────────────────┤
  │  EGT analog. ────┼────────────────────────────┤
  │                  │                             │
  │  Mini Web UI ◄───┼── (WiFi AP, solo config)   │
  └──────────────────┘                             │
                                                   │
                                         ┌─────────▼────────┐
                                         │    ESP32-S3       │
                                         │    Nodo ECU       │
                                         │                   │
                                         │  Core 0 (Motore)  │
                                         │  ├─ pick_up ISR   │
                                         │  ├─ rpm_task      │
                                         │  └─ adc_task      │
                                         │                   │
                                         │  Core 1 (Comms)   │
                                         │  ├─ ws_task       │
                                         │  ├─ mqtt_task     │
                                         │  └─ ota_task      │
                                         │                   │
                                         │  LittleFS:        │
                                         │  build SvelteKit  │
                                         └──┬──────────┬─────┘
                                            │          │
                              WebSocket     │          │  MQTT pub (log sessione)
                              + HTTP static │          │  HTTP GET (poll OTA)
                                            │          │
                                   ┌────────▼──┐    ┌──▼──────────────────────┐
                                   │ Telefono/ │    │   VM Proxmox            │
                                   │ Tablet    │    │                         │
                                   │           │    │  ┌───────────────────┐  │
                                   │ SvelteKit │    │  │ Mosquitto         │  │
                                   │ Dashboard │    │  └─────────┬─────────┘  │
                                   │ a Bordo   │    │            │ subscribe  │
                                   │           │    │  ┌─────────▼─────────┐  │
                                   │ CONTROLLO │    │  │ Express.js        │  │
                                   │ COMPLETO  │    │  │ (ingestione log)  │  │
                                   └───────────┘    │  └─────────┬─────────┘  │
                                                    │            │            │
                                                    │  ┌─────────▼─────────┐  │
                                                    │  │ React SPA         │  │
                                                    │  │ (viewer sessioni) │  │
                                                    │  │ SOLO LETTURA      │  │
                                                    │  └───────────────────┘  │
                                                    │                         │
                                                    │  PostgreSQL             │
                                                    └─────────────────────────┘
```

---

## 3. Nodo 1 — Simulatore (ESP32)

### Scopo
Sostituisce i sensori reali per test da banco. Genera segnali elettrici che la ECU legge tramite il normale percorso I/O (ISR, ADC).

### Uscite verso ECU
| Segnale | Tipo | Range | Controllo |
|---|---|---|---|
| Pick-up | Onda quadra su GPIO | 0–300 Hz (≈ 0–18.000 RPM per mono) | Frequenza regolabile via web UI |
| TPS | Tensione analogica (DAC o PWM filtrato) | 0–3,3 V (0–100% gas) | Regolabile via slider web UI |
| EGT | Tensione analogica (DAC o PWM filtrato) | 0–3,3 V (mappata su 0–900°C) | Regolabile via slider web UI |

### Web UI
- Ospitata sull'ESP32 Simulatore (modalita WiFi AP)
- Pagina HTML/JS semplice
- Controlli: slider/input RPM, slider TPS, slider EGT
- Preset: "Idle" (1200 RPM, 0% TPS), "Cruise" (6000 RPM, 30% TPS), "WOT" (12000 RPM, 100% TPS)
- Kill switch: ferma tutti i segnali (simula motore spento)

---

## 4. Nodo 2 — ECU (ESP32-S3)

### 4.1 Allocazione Task FreeRTOS

| Task | Core | Priorita | Stack | Ruolo |
|---|---|---|---|---|
| `pick_up_isr` | 0 | — (ISR) | — | ISR sul fronte del GPIO pick-up. Cattura il timestamp, notifica `rpm_task`. |
| `rpm_task` | 0 | Massima | 4 KB | Calcola i RPM dai timestamp ISR. Esegue la FSM motore. Pianifica il timer CDI. |
| `adc_task` | 0 | Alta | 4 KB | Campionamento periodico TPS + EGT. Calcola duty cycle Power Jet da lookup table. |
| `ws_task` | 1 | Alta | 8 KB | Server WebSocket. Trasmette telemetria JSON. Riceve comandi dalla dashboard a bordo. |
| `mqtt_task` | 1 | Media | 8 KB | Bufferizza la telemetria durante la sessione. Pubblica il log su broker MQTT a fine sessione. |
| `ota_task` | 1 | Bassa | 8 KB | Esegue polling periodico del server per nuove versioni firmware. Scarica e applica OTA. |

### 4.2 FSM Motore

```
Stati: INIT, SYNCING, RUNNING, IDLE, IGNCUT, ALARM

         ┌──────┐  pick-up rilevato  ┌──────────┐
         │ INIT │──────────────────►│ SYNCING  │
         └──────┘                   └──────────┘
                  ◄── timeout ──────────┘ │ N impulsi validi consecutivi
                                          ▼
                 RPM < soglia   ┌─────────┐   EGT > MAX
            ┌───────────────────── │ RUNNING │──────────────────┐
            ▼                      └─────────┘                  ▼
         ┌──────┐  RPM = 0              │                   ┌───────┐
         │ IDLE │──────────►INIT        │ richiesta QS      │ ALARM │
         └──────┘                       ▼                   └───────┘
                                  ┌──────────┐                  │ EGT OK
                                  │ IGNCUT   │                  └──────►RUNNING
                                  └──────────┘
                                  (taglio CDI per N cicli,
                                   poi → RUNNING)
```

**Transizioni:**
| Da | A | Trigger |
|---|---|---|
| INIT | SYNCING | Rilevato il primo impulso pick-up |
| SYNCING | RUNNING | N impulsi validi consecutivi (sync acquisito) |
| SYNCING | INIT | Timeout — nessun impulso per T ms |
| RUNNING | IDLE | RPM scende sotto la soglia idle |
| RUNNING | ALARM | EGT supera il limite di sicurezza |
| RUNNING | IGNCUT | Ricevuto trigger QS (pulsante o comando WebSocket) |
| IDLE | INIT | RPM = 0 (motore fermo) |
| ALARM | RUNNING | EGT torna sotto la soglia di sicurezza |
| IGNCUT | RUNNING | Dopo N cicli di taglio accensione |

### 4.3 Tabelle di Lookup (1D, salvate in NVS)

**Mappa Anticipo Accensione**: `f(RPM) → advance_degrees`
- Numero di breakpoints RPM configurabile
- Interpolazione lineare tra i breakpoints
- Supporto mappe multiple (Mappa A, Mappa B, ...)
- Una mappa attiva alla volta

**Mappa Duty Cycle Power Jet**: `f(RPM) → duty_cycle_%`
- Stessa struttura della mappa accensione
- Controlla l'uscita PWM verso il solenoide Power Jet

### 4.4 Buffer Dati Condiviso

Core 0 scrive → Core 1 legge (lock-free o con mutex):

```c
typedef struct {
    uint16_t rpm;
    float    tps_percent;      // 0.0–100.0
    float    egt_celsius;
    float    advance_deg;
    float    pj_duty_percent;
    uint8_t  fsm_state;        // enum
    uint8_t  active_map_id;
    int64_t  timestamp_us;
} ecu_telemetry_t;
```

### 4.5 Pianificazione Uscita CDI

1. `rpm_task` calcola l'anticipo dalla lookup table
2. Converte i gradi di anticipo → ritardo temporale dal impulso pick-up (in base agli RPM correnti)
3. Avvia un timer hardware (ESP32 MCPWM o GP timer)
4. L'ISR del timer scatta → porta alto il GPIO CDI per la durata scintilla → reset

### 4.6 Server HTTP + WebSocket

- **EspAsyncWebServer** (port ESP-IDF, ex me-no-dev) gestisce HTTP e WebSocket su un unico server asincrono
- File build SvelteKit salvati **compressi gzip** (`.gz`) in LittleFS → serviti con header `Content-Encoding: gzip` → il browser decomprime automaticamente
- Questo dimezza l'uso flash per asset statici (~50–70% di compressione su JS/CSS/HTML)
- Endpoint:
  - `GET /` → `index.html.gz` (entry point SvelteKit)
  - `GET /assets/*` → file `.gz` statici (JS/CSS/font)
  - `WS /ws` → WebSocket per telemetria + comandi

---

## 5. Nodo 3 — Dashboard a Bordo (SvelteKit)

### Hosting
- Sviluppata con SvelteKit (adapter statico → pre-rendered)
- Output di build **compresso gzip** e flashato nella partizione LittleFS su ESP32
- Servita da EspAsyncWebServer con `Content-Encoding: gzip` — il browser decomprime in modo trasparente
- Accesso via browser telefono/tablet su WiFi (modalita STA, stessa rete)

### Funzionalita

| Funzione | Descrizione |
|---|---|
| **Indicatore RPM** | Visualizzazione RPM grande e ben visibile in tempo reale |
| **Barra TPS** | Barra percentuale posizione gas |
| **Indicatore EGT** | Temperatura con soglia a colori (verde → giallo → rosso) |
| **Stato FSM** | Badge con stato motore corrente (INIT / SYNCING / RUNNING / IDLE / ALARM / IGNCUT) |
| **Mappa Attiva** | Mappa accensione/PJ attualmente attiva |
| **Angolo Anticipo** | Anticipo accensione calcolato corrente |
| **Duty Cycle PJ** | Percentuale duty Power Jet corrente |
| **Editor Mappa** | Aggiungi/rimuovi/modifica breakpoints RPM e valori. Curva visuale. |
| **Selettore Mappa** | Selezione mappa attiva tra quelle memorizzate |
| **Trigger QS** | Pulsante per simulare l'ingresso quick-shifter |
| **Stato OTA** | Versione firmware corrente, pulsante verifica aggiornamenti (ESP32 fa polling al server) |

### Protocollo WebSocket

**Telemetria (ECU → Dashboard):**
```json
{
  "type": "telemetry",
  "data": {
    "rpm": 8500,
    "tps": 72.3,
    "egt": 620,
    "fsm": "RUNNING",
    "advance_deg": 28.5,
    "pj_duty": 45.0,
    "active_map": 1,
    "ts": 1716825600000
  }
}
```

**Comandi (Dashboard → ECU):**
```json
{"cmd": "qs_trigger"}

{"cmd": "set_active_map", "map_id": 1}

{"cmd": "edit_map", "map_type": "ignition", "map_id": 1,
 "breakpoints": [
   {"rpm": 1000, "value": 5},
   {"rpm": 3000, "value": 15},
   {"rpm": 6000, "value": 25},
   {"rpm": 9000, "value": 30},
   {"rpm": 12000, "value": 28}
 ]}

{"cmd": "ota_check"}

{"cmd": "get_config"}
```

**Risposte (ECU → Dashboard):**
```json
{"type": "ack", "cmd": "set_active_map", "status": "ok"}

{"type": "config", "data": {
  "firmware_version": "1.2.0",
  "maps": {
    "ignition": [{"id": 0, "name": "Stock", "breakpoints": [...]}, ...],
    "power_jet": [{"id": 0, "name": "Stock", "breakpoints": [...]}]
  },
  "active_map_id": 0,
  "sync_pulses_required": 5,
  "egt_alarm_threshold": 800
}}

{"type": "ota_status", "available": true, "remote_version": "1.3.0", "current_version": "1.2.0"}
```

---

## 6. Nodo 4 — Server (VM Proxmox)

### Componenti

```
Proxmox VM
├── Mosquitto (MQTT broker, port 1883/8883)
├── PostgreSQL (session storage)
├── Express.js (backend API + MQTT subscriber)
└── React SPA (served by Express, static build)
```

### MQTT — Log Sessioni

> [!IMPORTANT]
> Questa sezione richiede progettazione accurata. Il formato dati deve essere guidato da cio che la dashboard React deve visualizzare, ed e limitato dalla RAM disponibile su ESP32.

#### Cosa mostra la Dashboard React

**Vista Lista Sessioni**: riepilogo per sessione:
| Campo | Fonte | Scopo |
|---|---|---|
| ID sessione | Generato da ESP32 | Identificatore univoco |
| Ora inizio / fine | Timestamp primo e ultimo campione | Calcolo durata |
| Durata | Derivata | Panoramica rapida |
| RPM max | Aggregato dai campioni | Indicatore intensita sessione |
| RPM medi | Aggregato dai campioni | Carattere sessione |
| EGT max | Aggregato dai campioni | Revisione sicurezza |
| Conteggio allarmi | Numero eventi ALARM | Indicatore affidabilita |
| Conteggio QS | Numero eventi IGNCUT | Frequenza cambi |
| Versione firmware | Da metadata sessione | Tracciabilita |

**Vista Dettaglio Sessione**: dati time-series per i grafici:
| Grafico | Asse X | Asse Y | Note |
|---|---|---|---|
| RPM nel tempo | timestamp | RPM (0–18k) | Grafico principale, grande |
| TPS nel tempo | timestamp | TPS % (0–100) | Sovrapposto o separato |
| EGT nel tempo | timestamp | °C (0–900) | Con linea soglia allarme |
| Anticipo accensione | timestamp | gradi | Mostra il comportamento mappa |
| Duty Power Jet | timestamp | % (0–100) | Correlazione con RPM |
| Stato FSM | timestamp | enum stato | Bande/regioni colorate sulla timeline |
| Eventi | timestamp | marker | Marcatori verticali per QS, switch mappa, allarmi |

#### Budget RAM ESP32

ESP32-S3 ha ~512 KB di SRAM totale. Dopo FreeRTOS, stack WiFi, TLS, WebSocket e LittleFS, in pratica **~100–150 KB** sono disponibili per il buffer di sessione.

Dati per campione (binario compatto in RAM, JSON solo in fase di publish):

```c
typedef struct {
    uint32_t timestamp_ms;    // 4 bytes (relative to session start)
    uint16_t rpm;             // 2 bytes
    uint8_t  tps;             // 1 byte  (0–100, integer %)
    uint16_t egt;             // 2 bytes (°C, integer)
    uint8_t  advance_deg;     // 1 byte  (0–60°, integer)
    uint8_t  pj_duty;         // 1 byte  (0–100%)
    uint8_t  fsm_state;       // 1 byte  (enum)
} __attribute__((packed)) session_sample_t;  // = 12 bytes
```

| Sample Rate | Dimensione buffer (100 KB) | Durata massima sessione |
|---|---|---|
| 10 Hz | ~8.500 campioni | ~14 minuti |
| 5 Hz | ~8.500 campioni | ~28 minuti |
| 2 Hz | ~8.500 campioni | ~70 minuti |
| 1 Hz | ~8.500 campioni | ~2,3 ore |

> [!WARNING]
> A 10 Hz, un buffer da 14 minuti riempie 100 KB. Una sessione reale in pista dura 15–20 minuti. Occorre scegliere:
> - **1 Hz** e sicuro per il buffer ma i grafici sono "a scalini"
> - **5 Hz** e un buon compromesso (28 min, grafici fluidi)
> - **10 Hz** rischia overflow su sessioni lunghe
>
> **Raccomandazione**: campionamento a 5 Hz per i log sessione, con **buffer circolare** che sovrascrive i dati piu vecchi se la sessione supera il limite. La dashboard a bordo continua a ricevere telemetria a 10–20 Hz via WebSocket (non loggata).

#### Strategia di Pubblicazione MQTT

Basata su sessione (opzione C da Q23):

1. **Inizio sessione**: la FSM passa a `SYNCING` → ESP32 avvia il buffering
2. **Durante la sessione**: i campioni sono scritti nel buffer circolare alla frequenza scelta
3. **Fine sessione**: la FSM torna a `INIT` (RPM = 0 per T secondi) → sessione finalizzata
4. **Publish**: ESP32 pubblica il log sessione via MQTT. Se il payload e troppo grande per un singolo messaggio MQTT (limite broker, tipicamente 256 KB), si divide in **chunk**.

#### Struttura Topic MQTT

```
ecu/{device_id}/session/meta      → metadata sessione + riepilogo
ecu/{device_id}/session/samples   → dati time-series dei campioni (possibilmente in chunk)
ecu/{device_id}/session/events    → eventi discreti durante la sessione
```

**Payload meta:**
```json
{
  "session_id": "uuid",
  "device_id": "ecu-001",
  "start_ts": 1716825600000,
  "end_ts": 1716829200000,
  "duration_s": 3600,
  "sample_rate_hz": 5,
  "sample_count": 1800,
  "max_rpm": 12400,
  "avg_rpm": 6200,
  "max_egt": 720,
  "alarm_count": 0,
  "qs_count": 12,
  "fw_version": "1.2.0"
}
```

**Payload campioni** (in chunk se necessario):
```json
{
  "session_id": "uuid",
  "chunk": 1,
  "total_chunks": 3,
  "samples": [
    {"t": 0, "rpm": 1200, "tps": 0, "egt": 180, "adv": 8, "pj": 0, "fsm": 3},
    {"t": 200, "rpm": 3500, "tps": 25, "egt": 350, "adv": 18, "pj": 10, "fsm": 2},
    ...
  ]
}
```

**Payload eventi:**
```json
{
  "session_id": "uuid",
  "events": [
    {"t": 1000, "type": "FSM", "from": 0, "to": 1},
    {"t": 5000, "type": "FSM", "from": 1, "to": 2},
    {"t": 45000, "type": "QS"},
    {"t": 120000, "type": "MAP_SWITCH", "map_id": 1},
    {"t": 300000, "type": "ALARM", "egt": 810}
  ]
}
```

> [!NOTE]
> I timestamp in campioni/eventi usano `t` = millisecondi relativi a `start_ts` (riduce i byte rispetto ai timestamp assoluti). Il backend ricostruisce i tempi assoluti usando `start_ts + t`.

---

### Backend Express.js

**Subscriber MQTT:** si connette al broker Mosquitto. Si sottoscrive a `ecu/+/session/#`. Riassembla i payload campioni in chunk. Inserisce le sessioni complete in PostgreSQL.

**API REST (solo lettura):**

| Method | Endpoint | Response |
|---|---|---|
| `GET` | `/api/sessions` | List: `[{id, device_id, start_ts, end_ts, duration_s, max_rpm, avg_rpm, max_egt, alarm_count, qs_count, fw_version}]` |
| `GET` | `/api/sessions/:id` | Full session: `{meta, samples[], events[]}` |

**Endpoint OTA:**

| Method | Endpoint | Response |
|---|---|---|
| `GET` | `/api/ota/version` | `{"version": "1.3.0", "url": "/api/ota/firmware"}` |
| `GET` | `/api/ota/firmware` | Binary `.bin` file download |

### React SPA (Solo Lettura)

**Vista Lista Sessioni:**
- Tabella ordinabile/filtrabile con colonne: data, durata, RPM max, RPM medi, EGT max, conteggio allarmi, conteggio QS
- Click su una riga → vai al dettaglio

**Vista Dettaglio Sessione:**
- **Header**: data sessione, durata, versione firmware, statistiche riepilogo
- **Area grafici principale**: grafici time-series sovrapposti/impilati (RPM, TPS, EGT, anticipo, duty PJ)
- **Timeline FSM**: barra orizzontale colorata con regioni di stato (verde = RUNNING, giallo = IDLE, rosso = ALARM, blu = IGNCUT)
- **Marker eventi**: linee verticali sui grafici per trigger QS, switch mappa, allarmi
- **Zoom/pan**: possibilita di zoomare su un intervallo temporale per analisi dettagliata

### Schema PostgreSQL

```sql
CREATE TABLE sessions (
    id           UUID PRIMARY KEY,
    device_id    VARCHAR(32) NOT NULL,
    start_ts     TIMESTAMPTZ NOT NULL,
    end_ts       TIMESTAMPTZ NOT NULL,
    duration_s   INTEGER NOT NULL,
    max_rpm      INTEGER,
    avg_rpm      INTEGER,
    max_egt      INTEGER,
    alarm_count  INTEGER DEFAULT 0,
    qs_count     INTEGER DEFAULT 0,
    fw_version   VARCHAR(16),
    samples      JSONB NOT NULL,           -- array of sample objects
    events       JSONB NOT NULL,           -- array of event objects
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_device_time ON sessions(device_id, start_ts DESC);
```

> [!NOTE]
> Le statistiche di sintesi (`max_rpm`, `avg_rpm`, ecc.) sono salvate come colonne per query lista efficienti. I dati completi campioni/eventi stanno in colonne JSONB per la vista dettaglio. Cosi si evita di dover parsare JSONB solo per renderizzare la lista sessioni.

---

## 7. Confine di Scope

### In Scope (Deliverable Elaborato)

| Componente | Stato |
|---|---|
| Firmware ECU (ESP-IDF, FreeRTOS, dual-core) | ✅ |
| FSM motore (6 stati) | ✅ |
| ISR pick-up → RPM → scheduling CDI | ✅ |
| Campionamento ADC (TPS, EGT) → PWM Power Jet | ✅ |
| Lookup table 1D con interpolazione (NVS) | ✅ |
| Server WebSocket (telemetria + comandi) | ✅ |
| Client MQTT (pubblicazione log sessione) | ✅ |
| Client OTA (poll + download + apply) | ✅ |
| Dashboard a bordo (SvelteKit, LittleFS) | ✅ |
| Simulatore ESP32 (segnali + web UI) | ✅ |
| Backend Express.js (MQTT sub + REST API) | ✅ |
| React SPA (lista sessioni + dettaglio sessione) | ✅ |
| Schema PostgreSQL + integrazione | ✅ |

### Fuori Scope (Sviluppi Futuri)

| Componente | Note |
|---|---|
| Sensore knock + correzione attiva | Hardware non disponibile |
| Controllo valvola di scarico | Meccanica non presente |
| Mappe 3D (RPM × TPS) | Mappe 1D per elaborato, 3D piu avanti |
| Pipeline HITL / CI | Troppo pesante per lo scope d'esame |
| Progetto PCB (KiCad) | Da citare in relazione come sviluppo futuro |
| OBD-II / CAN bus | Integrazione futura |
| Modalita WiFi AP + STA | Solo STA per ora |
| Sensore EGT reale (MAX6675) | Simulato per ora |
