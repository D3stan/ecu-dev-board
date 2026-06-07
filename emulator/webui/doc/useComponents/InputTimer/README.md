# InputTimer Component

## 📋 Descrizione

Componente per modificare parametri di tipo `TIME` (timer) nell'applicazione FOG EXTRA.

Visualizza dinamicamente ore, minuti e secondi con controlli incrementali ciclici, validazione input e pulsanti Default/Conferma.

---

## ⚙️ Caratteristiche

- ✅ **Visualizzazione dinamica**: Mostra solo le colonne necessarie in base al `max`
  - `max < 60s` → solo SECONDI
  - `60s ≤ max < 3600s` → MINUTI + SECONDI
  - `max ≥ 3600s` → ORE + MINUTI + SECONDI

- ✅ **Limiti dinamici**: I valori max per ciascuna unità si adattano in tempo reale
  - Esempio: `max = 1870s` (31m 10s)
    - Minuti max: 31
    - Secondi max: 10 quando minuti = 31, altrimenti 59

- ✅ **Incremento/decremento ciclico**: I valori wrappano al limite (es: 59s → 0s)

- ✅ **Input manuale con validazione**:
  - Click su valore → diventa input editabile
  - Valori decimali troncati alla parte intera
  - Valori fuori range clamped al limite valido
  - ESC annulla, ENTER conferma

- ✅ **Traduzione automatica**: Labels aggiornate quando cambia lingua

- ✅ **Reactive**: Subscribe automatica al parametro nello Store

- ✅ **Mobile-first responsive**: Layout ottimizzato per ogni dispositivo

---

## 🔧 API

### Constructor

```js
new InputTimer({
  paramId: number,      // ID del parametro TIME (obbligatorio)
  onConfirm: Function   // Callback per navigazione dopo invio comando
})
```

### Esempio d'uso

```js
import { InputTimer } from './components/InputTimer/InputTimer.js';
import { NavigationManager } from './managers/navigationManager.js';

// In TimerEditorPage
const timerInput = new InputTimer({
  paramId: 1, // Timer ON (ParamId::TimerOn)
  onConfirm: () => {
    // Torna alla pagina precedente dopo conferma
    NavigationManager.navigateTo('MenuSettingsPage');
  }
});

// Monta e attiva
timerInput.mount(document.querySelector('.timer-container'));
timerInput.activate();
```

---

## 📂 Struttura File

```
components/InputTimer/
├── InputTimer.js    # Componente principale (extend Component)
├── func.js          # Logica di conversione e validazione
└── README.md        # Documentazione

css/components/
└── InputTimer.css   # Stili responsive
```

---

## 🔄 Lifecycle

1. **onCreate**: Carica parametro dallo Store
2. **onMount**: Cache refs DOM, bind eventi, subscribe a Store
3. **onActivate**: Forza update UI con valore corrente
4. **onDestroy**: Cleanup automatico (subscription gestite da Component base)

---

## 📡 Store Integration

Il componente si registra automaticamente allo Store:

```js
Store.subscribe(Paths.CONFIG.PARAMS, (params) => {
  const updated = params.find(p => p.id === this.paramId);
  if (updated) {
    this.config = updated;
    this._updateFromStore();
  }
});
```

Quando l'ESP invia un `MODIFY` message, il componente si aggiorna automaticamente.

---

## 🌐 Internazionalizzazione

Labels tradotte via `i18n.t()`:

```js
// In i18n.js (APP_TRANSLATIONS)
timer: {
  hours: "HOURS" | "ORE" | "HEURES" | "STUNDEN" | "HORAS",
  minutes: "MINUTES" | "MINUTI" | "MINUTES" | "MINUTEN" | "MINUTOS",
  seconds: "SECONDS" | "SECONDI" | "SECONDES" | "SEKUNDEN" | "SEGUNDOS"
}
```

Pulsanti:
- Default → `i18n.t('ui.reset')`
- Conferma → `i18n.t('ui.confirm')`

---

## 🧮 Logica Timer (func.js)

### Conversione

```js
secondsToHMS(1870)
// → { hours: 0, minutes: 31, seconds: 10 }

hmsToSeconds(0, 31, 10)
// → 1870
```

### Limiti dinamici

```js
getMaxValues(max, currentHours, currentMinutes)
// max = 1870s, hours = 0, minutes = 31
// → { hours: 0, minutes: 31, seconds: 10 }

// max = 1870s, hours = 0, minutes = 30
// → { hours: 0, minutes: 31, seconds: 59 }
```

### Validazione

```js
validateTotal({ hours: 0, minutes: 31, seconds: 25 }, 1870)
// totalSeconds = 1885 > 1870
// → { hours: 0, minutes: 31, seconds: 10 } (clamped)

getValidatedValue("21.4", 20, 0, 50)
// → 21 (troncato)

getValidatedValue("70", 48, 0, 50)
// → 50 (clamped al max)
```

---

## 📤 Invio Comandi

Quando l'utente preme **Conferma**:

1. Calcola secondi totali: `hmsToSeconds(hours, minutes, seconds)`
2. Valida range: `totalSeconds >= min && totalSeconds <= max`
3. Invia comando: `CommandManager.modifyParameter(paramId, totalSeconds)`
4. Esegue callback: `this.onConfirm()` (fire-and-forget, no ACK wait)

Formato comando inviato:
```
MODIFY_PARAM|1☺1800
```
(Parametro 1 = Timer ON, valore = 1800 secondi = 30 minuti)

---

## 🎨 CSS Customization

Variabili CSS utilizzate:

```css
var(--card)          /* Background card */
var(--surface)       /* Hover background */
var(--text)          /* Testo principale */
var(--text-muted)    /* Label secondarie */
var(--brand)         /* Colore brand (frecce, border) */
var(--brand-light)   /* Hover brand */
var(--radius)        /* Border radius */
var(--shadow)        /* Box shadow */
```

Responsive breakpoints:
- Mobile: `< 375px` (riduce dimensioni)
- Tablet/Desktop: `> 768px` (aumenta spaziatura)
- Desktop Large: `> 1024px` (max-width 600px centrato)

---

## ✅ Testing Checklist

- [ ] Caricamento parametro da Store
- [ ] Visualizzazione corretta colonne (hours/minutes/seconds)
- [ ] Increment/decrement ciclico
- [ ] Limiti dinamici (es: 31m 10s)
- [ ] Input manuale con validazione
- [ ] Pulsante Default reimposta valore
- [ ] Pulsante Conferma invia comando
- [ ] Callback onConfirm eseguito dopo invio
- [ ] Cambio lingua aggiorna labels
- [ ] Layout responsive su mobile/tablet/desktop

---

## 📖 Esempio Completo

```js
// In TimerEditorPage.js
import { Component } from '../../core/Component.js';
import { InputTimer } from '../../components/InputTimer/InputTimer.js';
import { NavigationManager } from '../../managers/navigationManager.js';

export class TimerEditorPage extends Component {
  onCreate() {
    this.timerInput = null;
  }

  onMount() {
    // Ottieni paramId dalla navigazione (es: passato da MenuSettingsPage)
    const paramId = NavigationManager.getRouteParam('paramId') || 1;
    
    // Crea InputTimer
    this.timerInput = new InputTimer({
      paramId,
      onConfirm: () => {
        NavigationManager.goBack();
      }
    });
    
    // Monta nel container
    const container = this.$('.timer-editor-container');
    this.timerInput.mount(container);
  }

  onActivate() {
    if (this.timerInput) {
      this.timerInput.activate();
    }
  }

  onDeactivate() {
    if (this.timerInput) {
      this.timerInput.deactivate();
    }
  }

  onDestroy() {
    if (this.timerInput) {
      this.timerInput.destroy();
    }
  }

  render() {
    return `
      <div class="page timer-editor-page">
        <div class="page-header">
          <button class="back-btn">←</button>
          <h1>Modifica Timer</h1>
        </div>
        <div class="page-content">
          <div class="timer-editor-container"></div>
        </div>
      </div>
    `;
  }
}
```

---

## 🐛 Troubleshooting

### Componente non si aggiorna al cambio parametro
- Verifica che il parametro sia presente in `Store.get(Paths.CONFIG.PARAMS)`
- Controlla che `paramId` corrisponda all'ID del parametro
- Usa `Store._debugListeners()` per verificare le subscriptions attive

### Label non tradotte
- Verifica che le traduzioni siano presenti in `i18n.js` per tutte le lingue
- Controlla che `enableI18n()` sia chiamato nel constructor
- Usa `i18n.getCurrentLangIndex()` per verificare la lingua corrente

### Limiti dinamici non funzionano
- Controlla `config.max` sia corretto
- Verifica la logica in `func.js > getMaxValues()`
- Log `this.state` dopo increment/decrement

---

## 📝 Note Implementative

- **State interno**: Usa `this.state = { hours, minutes, seconds }` per tracciare valori temporanei
- **No write Store**: Il componente NON scrive mai direttamente nello Store, solo via comandi ESP
- **Fire-and-forget**: `CommandManager.modifyParameter()` non aspetta ACK (opzione A)
- **Cleanup automatico**: Subscriptions gestite da `Component.subscribeToStore()` (auto-cleanup on destroy)

---

Creato da: **FogExtra Team**  
Versione: **1.0.0**  
Data: **18 Ottobre 2025**
