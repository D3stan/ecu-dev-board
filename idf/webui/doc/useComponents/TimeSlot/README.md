# TimeSlotGauge Component

Componente circolare draggabile per creare e modificare time slot con selezione oraria 24h e giorni della settimana.

## 📁 File Structure

```
TimeSlotGauge/
├── TimeSlotGauge.js              # Componente principale
├── TimeSlotGaugeFunctions.js     # Utility matematiche pure
├── TimeSlotGauge.css             # Stili (già importato in main.css)
├── TimeSlotGaugeExample.js       # Esempi di utilizzo
└── README.md                     # Questa documentazione
```

## 🚀 Quick Start

```javascript
import { TimeSlotGauge } from './components/TimeSlotGauge/TimeSlotGauge.js';
import { modifyTimeSlot } from './managers/commandManager.js';

// Container DOM
const container = document.getElementById('timeslot-page');

// Crea gauge
const gauge = new TimeSlotGauge({
  container,
  i18n,                          // Servizio i18n con t(), subscribe(), unsubscribe()
  getWeekdayLetter: (dayKey) => 'L', // Funzione per lettera giorno localizzata
  mode: 'create',                // 'create' | 'modify'
  snapMinutes: 15,               // Snap orario (default: 15 min)
  
  initial: {
    start: '08:30',
    stop: '12:30',
    days: { mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false }
  },
  
  onSubmit: (payload) => {
    console.log('Submit:', payload);
    modifyTimeSlot(payload);     // Invia a ESP32
  }
});

// Cleanup quando esci dalla pagina
gauge.destroy();
```

## 📋 API Reference

### Constructor Options

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `container` | `HTMLElement` | ✅ | - | Container DOM dove renderizzare il componente |
| `i18n` | `Object` | ✅ | - | Servizio i18n con `t(key)`, `subscribe(fn)`, `unsubscribe(fn)` |
| `getWeekdayLetter` | `Function` | ✅ | - | Funzione `(dayKey) => string` per ottenere lettera giorno localizzata |
| `onSubmit` | `Function` | ✅ | - | Callback `(payload) => void` chiamata al submit |
| `mode` | `'create' \| 'modify'` | ❌ | `'create'` | Modalità componente (cambia label bottone) |
| `snapMinutes` | `number` | ❌ | `15` | Snap orario in minuti (es: 15 = arrotonda a quarti d'ora) |
| `initial` | `Object` | ❌ | Default values | Valori iniziali (vedi sotto) |

#### Initial Values

```javascript
initial: {
  id: 42,                        // ID slot (null per nuovo, 0-254 per modifica)
  start: "08:30",                // Orario inizio formato "HH:MM"
  stop: "12:30",                 // Orario fine formato "HH:MM"
  days: {                        // Giorni settimana
    mon: false,
    tue: false,
    wed: false,
    thu: false,
    fri: false,
    sat: false,
    sun: false
  }
}
```

### Methods

#### `setState(newState)`

Aggiorna lo stato del componente.

```javascript
gauge.setState({
  start: '09:00',
  stop: '18:00',
  days: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false }
});
```

#### `getState()`

Ottiene lo stato corrente.

```javascript
const state = gauge.getState();
console.log(state);
// {
//   id: 42,
//   start: "09:00",
//   stop: "18:00",
//   days: { mon: true, tue: true, ... }
// }
```

#### `destroy()`

Distrugge il componente e rimuove tutti i listener.

```javascript
gauge.destroy();
```

### Submit Payload

Il callback `onSubmit` riceve un payload nel formato:

```javascript
{
  id: 255,                       // 255 = nuovo slot, 0-254 = modifica
  start: "09:30",                // Formato "HH:MM"
  stop: "17:00",                 // Formato "HH:MM"
  days: {                        // Booleans per ogni giorno
    mon: true,
    tue: true,
    wed: true,
    thu: true,
    fri: true,
    sat: false,
    sun: false
  }
}
```

Questo payload è **pronto per essere passato direttamente** a `commandManager.modifyTimeSlot()`.

## 🎨 Features

### ✅ Drag & Drop

- **Mouse**: click e trascina le maniglie (start/stop)
- **Touch**: touch e trascina (iOS Safari compatible)
- **Auto-adjust**: se trascini start oltre stop, stop viene spostato automaticamente (e viceversa)
- **Minimum gap**: sempre almeno 1 minuto tra start e stop

### ✅ Native Time Input

- Click su orario start/stop → apre input nativo del browser
- Utile per selezione precisa senza drag

### ✅ Days of Week

- 7 toggle buttons per giorni settimana
- Lettere localizzate via `getWeekdayLetter()`
- Label "Giorni della Settimana" localizzata via i18n

### ✅ i18n Support

- Tutte le label sono i18n-driven
- Subscribe automatico a cambiamenti lingua
- Update live senza reload componente

### ✅ iOS Safari Compatible

- **NO pull-to-refresh durante drag** → `touch-action: none` + `preventDefault()`
- **NO scroll during drag** → `body.style.overflow = 'hidden'` durante drag
- **Touch-friendly** → hit area 44x44px minimo

### ✅ Validations

- Almeno 1 giorno deve essere selezionato
- Start deve essere < Stop (garantito da auto-adjust)

## 🔧 Integration Examples

### Example 1: Integrazione con Router/Pages

```javascript
import { TimeSlotGauge } from './components/TimeSlotGauge/TimeSlotGauge.js';

class TimeSlotPage {
  constructor(router, i18n, getWeekdayLetter) {
    this.router = router;
    this.i18n = i18n;
    this.getWeekdayLetter = getWeekdayLetter;
    this.gauge = null;
  }
  
  mount(container, mode, slotData = null) {
    this.gauge = new TimeSlotGauge({
      container,
      i18n: this.i18n,
      getWeekdayLetter: this.getWeekdayLetter,
      mode,
      initial: slotData || {},
      
      onSubmit: (payload) => {
        modifyTimeSlot(payload);
        this.router.navigate('scheduler');
      }
    });
  }
  
  unmount() {
    this.gauge?.destroy();
    this.gauge = null;
  }
}
```

### Example 2: Integrazione con commandManager

```javascript
import { modifyTimeSlot } from './managers/commandManager.js';

const gauge = new TimeSlotGauge({
  container,
  i18n,
  getWeekdayLetter,
  mode: 'create',
  
  onSubmit: (payload) => {
    console.log('📤 Invio time slot a ESP32:', payload);
    
    // Invia direttamente a ESP32
    modifyTimeSlot(payload);
    
    // Il messaggio generato sarà:
    // MODIFY_TIME_SLOT|255☺9☺30☺17☺0☺127
    // dove:
    // - 255 = nuovo slot (o ID 0-254 per modifica)
    // - 9☺30 = start (ore☺minuti)
    // - 17☺0 = stop (ore☺minuti)
    // - 127 = dayFlags bitmask (tutti i giorni)
  }
});
```

### Example 3: Integrazione con Store (opzionale)

```javascript
import { Store } from './core/store.js';
import { Paths } from './utils/constants.js';

const gauge = new TimeSlotGauge({
  container,
  i18n,
  getWeekdayLetter,
  mode: 'modify',
  
  // Carica da Store
  initial: Store.get(Paths.CONFIG.TIME_SLOTS).find(s => s.id === slotId),
  
  onSubmit: (payload) => {
    // Invia a ESP32
    modifyTimeSlot(payload);
    
    // NOTA: NON aggiornare Store qui!
    // Store verrà aggiornato quando ESP32 risponde con CMD_TIME_SLOTS
    // (vedi Adapter.js per parsing risposta)
  }
});
```

## 🎯 i18n Keys Required

Aggiungi queste chiavi al tuo file i18n (es: `lang/it.js`):

```javascript
export const it = {
  timeslot: {
    daysOfWeek: 'Giorni della Settimana',
    start: 'Inizio',
    stop: 'Fine',
    create: 'Crea',
    modify: 'Modifica',
    errorNoDays: 'Seleziona almeno un giorno della settimana',
    startHandleAria: 'Maniglia inizio',
    stopHandleAria: 'Maniglia fine',
  }
};

export const en = {
  timeslot: {
    daysOfWeek: 'Days of Week',
    start: 'Start',
    stop: 'Stop',
    create: 'Create',
    modify: 'Modify',
    errorNoDays: 'Select at least one day of the week',
    startHandleAria: 'Start handle',
    stopHandleAria: 'Stop handle',
  }
};
```

## 🔤 getWeekdayLetter Implementation

Implementa questa funzione per localizzare le lettere dei giorni:

```javascript
export function getWeekdayLetter(dayKey) {
  const letters = {
    it: {
      mon: 'L',  // Lunedì
      tue: 'M',  // Martedì
      wed: 'M',  // Mercoledì
      thu: 'G',  // Giovedì
      fri: 'V',  // Venerdì
      sat: 'S',  // Sabato
      sun: 'D'   // Domenica
    },
    en: {
      mon: 'M',  // Monday
      tue: 'T',  // Tuesday
      wed: 'W',  // Wednesday
      thu: 'T',  // Thursday
      fri: 'F',  // Friday
      sat: 'S',  // Saturday
      sun: 'S'   // Sunday
    }
  };
  
  const currentLang = i18n.currentLanguage(); // o come gestisci la lingua
  return letters[currentLang][dayKey] || dayKey.charAt(0).toUpperCase();
}
```

## 📱 Mobile Optimization

Il componente è **mobile-first**:

- **Touch-friendly**: 44x44px minimum hit area
- **iOS Safari**: NO pull-to-refresh durante drag
- **Responsive**: scala su schermi piccoli (320px - 375px)
- **Performance**: drag throttled via `requestAnimationFrame`

### iOS Safari Critical CSS

```css
.gauge-container {
  touch-action: none;                /* Prevent scroll/zoom during drag */
  -webkit-overflow-scrolling: auto;  /* Avoid rubber-banding */
}
```

### iOS Safari Critical JS

```javascript
// Nel touchmove listener:
element.addEventListener('touchmove', (e) => {
  e.preventDefault(); // Prevent pull-to-refresh
}, { passive: false }); // MUST be non-passive!
```

Questo è **già implementato** nel componente.

## 🧪 Testing Checklist

- [ ] Drag start handle → aggiorna orario e arco
- [ ] Drag stop handle → aggiorna orario e arco
- [ ] Drag start oltre stop → stop si sposta automaticamente
- [ ] Drag stop prima di start → start si sposta automaticamente
- [ ] Click su orario → apre input nativo
- [ ] Input nativo change → aggiorna gauge
- [ ] Toggle giorni → cambia stato active
- [ ] Submit senza giorni → mostra errore
- [ ] Submit con giorni → chiama onSubmit con payload corretto
- [ ] Cambio lingua → aggiorna label e lettere giorni
- [ ] iOS Safari drag → NO pull-to-refresh
- [ ] iOS Safari drag → NO scroll pagina
- [ ] Mobile: hit area 44x44px → facile da toccare
- [ ] Dark mode → colori corretti

## 🐛 Troubleshooting

### iOS Safari: Pull-to-Refresh Durante Drag

**Sintomo**: quando trascini verso il basso, Safari refresh la pagina.

**Fix**: verifica che:
1. CSS `touch-action: none` sia applicato a `.gauge-container`
2. Listener `touchmove` usi `{ passive: false }`
3. `e.preventDefault()` sia chiamato nel listener

Tutto questo è **già implementato** nel componente.

### Drag Non Smooth

**Sintomo**: drag scattoso o lento.

**Fix**: il componente usa `requestAnimationFrame` per throttling automatico. Se continua a scattare, verifica performance browser.

### i18n Non Aggiorna

**Sintomo**: cambio lingua ma label non si aggiornano.

**Fix**: verifica che il tuo servizio i18n implementi `subscribe(fn)` e `unsubscribe(fn)` correttamente, e che chiami i listener quando cambia lingua.

### Day Letters Non Localizzate

**Sintomo**: lettere giorni non cambiano con lingua.

**Fix**: verifica che `getWeekdayLetter()` legga la lingua corrente e ritorni la lettera corretta.

## 📚 Math Reference

Il componente usa coordinate polari per posizionare handles e calcolare archi:

```
Angle System:
- 0° = top (00:00)
- 90° = right (06:00)
- 180° = bottom (12:00)
- 270° = left (18:00)

Conversions:
- Time → Angle: (hours*60 + minutes) / 1440 * 360
- Angle → Time: (angle / 360 * 1440) snapped to snapMinutes
- Angle → Coords: (x, y) = polar to cartesian with SVG rotation compensation
```

Tutte le funzioni matematiche sono **pure** e testate in `TimeSlotGaugeFunctions.js`.

## 🎨 CSS Variables

Il componente usa le seguenti CSS variables (già definite in `style.css`):

```css
--card           /* Background card */
--bg             /* Background bottoni */
--surface        /* Hover state */
--brand          /* Colore primario */
--brand-light    /* Hover brand */
--border         /* Bordi */
--text           /* Testo principale */
--text-muted     /* Testo secondario */
--radius         /* Border radius */
--shadow         /* Box shadow */
--shadow-lg      /* Shadow più grande */
```

Se usi dark mode, definisci `[data-theme="dark"]` overrides (già fatto in TimeSlotGauge.css).

## 📦 Dependencies

- **Socket.js**: per invio comandi (via commandManager)
- **i18n service**: con `t()`, `subscribe()`, `unsubscribe()`
- **Separators constants**: per formattare messaggi ESP32

Nessuna libreria esterna richiesta (vanilla JS).

## 🚧 Future Enhancements

Possibili miglioramenti futuri:

- [ ] Snap configurabile per handle (es: ogni 5 min, 10 min, 30 min)
- [ ] Preset buttons (es: "Mattina 8-12", "Pomeriggio 14-18")
- [ ] Multi-select giorni con swipe gesture
- [ ] Toast/Modal custom invece di `alert()` per errori
- [ ] Undo/Redo per drag accidentali
- [ ] Animazione arco durante drag
- [ ] Accessibility: keyboard navigation (arrow keys per spostare handles)

## 📄 License

Parte del progetto Nebulizzatore FogExtra.

---

**Made with ❤️ for Idrobase**
