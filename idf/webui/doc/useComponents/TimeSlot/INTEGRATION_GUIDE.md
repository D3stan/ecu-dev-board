# TimeSlotGauge - Integration Guide

Guida completa all'integrazione del componente TimeSlotGauge nell'app FogExtra.

## 📁 File Structure

```
webui/
├── src/
│   ├── index.html                              # ✅ CSS importato
│   ├── js/
│   │   ├── components/
│   │   │   ├── TimeSlotGauge/
│   │   │   │   ├── TimeSlotGauge.js           # ✅ Componente principale
│   │   │   │   ├── TimeSlotGaugeFunctions.js  # ✅ Funzioni matematiche
│   │   │   │   └── index.js                   # ✅ Export module
│   │   │   ├── TimeSlotRender/
│   │   │   │   └── TimeSlotRender.js          # ✅ MODIFICATO - Navigation
│   │   │   ├── TimeSlot/
│   │   │   │   └── TimeSlot.js                # Già esistente
│   │   │   └── AddTimeSlotButton/
│   │   │       └── AddTimeSlotButton.js       # Già esistente
│   │   ├── pages/
│   │   │   └── TimeSlotEditorPage.js          # ✅ IMPLEMENTATO
│   │   ├── managers/
│   │   │   ├── commandManager.js              # Già esistente
│   │   │   └── navigatorManager.js            # Già esistente
│   │   └── utils/
│   │       ├── i18n.js                        # ✅ MODIFICATO - chiavi aggiunte
│   │       ├── constants.js                   # Già esistente
│   │       └── paths.js                       # Già esistente
│   └── css/
│       └── components/
│           └── TimeSlotGauge.css              # ✅ CSS componente
└── doc/
    └── useComponents/
        └── TimeSlot/
            ├── README.md                       # Documentazione componente
            ├── TimeSlotGaugeExample.js         # Esempi di utilizzo
            ├── TimeSlotGauge.css               # Copia CSS per reference
            └── INTEGRATION_GUIDE.md            # Questo file

```

## ✅ Modifiche Implementate

### 1. **index.html** - CSS Import
```html
<!-- Aggiunto in <head> -->
<link rel="stylesheet" href="./css/components/TimeSlotGauge.css">
```

### 2. **i18n.js** - Chiavi Traduzione
Aggiunte per **tutte le 5 lingue** (EN, IT, FR, DE, ES):

```javascript
ui: {
  daysOfWeek: "Giorni della Settimana",    // IT
  start: "Inizio",
  stop: "Fine",
  create: "Crea",
  modify: "Modifica",
  errorNoDays: "Seleziona almeno un giorno della settimana",
  startHandle: "Maniglia inizio",
  stopHandle: "Maniglia fine"
}
```

### 3. **TimeSlotRender.js** - Navigation Logic

#### AddTimeSlotButton onClick:
```javascript
this.addButton = new AddTimeSlotButton({
  onClick: () => {
    // Naviga a timeSlotEditorPage in modalità CREATE
    NavigatorManager.navigateTo('timeSlotEditorPage', {
      mode: 'create'
    });
  }
});
```

#### TimeSlot onClick:
```javascript
_handleTimeSlotClick(slot) {
  // Naviga a timeSlotEditorPage in modalità MODIFY
  NavigatorManager.navigateTo('timeSlotEditorPage', {
    mode: 'modify',
    slotId: slot.id
  });
}
```

### 4. **TimeSlotEditorPage.js** - Implementazione Completa

#### Constructor:
```javascript
constructor(options = {}) {
  super({
    id: 'timeSlotEditorPage',
    title: 'Scheduler Setting',
    showBackButton: true,
    ...options
  });

  this.mode = options.mode || 'create';
  this.slotId = options.slotId || null;
  this.pageTopBar = null;
  this.timeSlotGauge = null;
}
```

#### onActivate (riceve dati da NavigatorManager):
```javascript
onActivate(data = {}) {
  super.onActivate();
  
  // Aggiorna mode e slotId se passati
  if (data.mode) this.mode = data.mode;
  if (data.slotId !== undefined) this.slotId = data.slotId;

  // Aggiorna gauge se già montato
  if (this.timeSlotGauge) {
    this.timeSlotGauge.setState(this._getInitialValues());
  }
}
```

#### _getInitialValues:
```javascript
_getInitialValues() {
  if (this.mode === 'modify' && this.slotId !== null) {
    // Carica da Store
    const slots = Store.get(Paths.RUNTIME.SCHEDULER) || [];
    const slot = slots.find(s => s.id === this.slotId);
    if (slot) return { id: slot.id, start: slot.start, stop: slot.stop, days: {...slot.days} };
  }
  
  // Default per CREATE
  return {
    start: '12:30',
    stop: '18:30',
    days: { mon: false, tue: false, wed: false, thu: false, fri: true, sat: true, sun: true }
  };
}
```

#### TimeSlotGauge Mount:
```javascript
this.timeSlotGauge = new TimeSlotGauge({
  container,
  i18n: this._createI18nAdapter(),
  getWeekdayLetter: this._getWeekdayLetter.bind(this),
  mode: this.mode,
  snapMinutes: 15,
  initial: this._getInitialValues(),
  
  onSubmit: (payload) => {
    // Invia a ESP32
    modifyTimeSlot(payload);
    
    // Torna indietro
    NavigatorManager.goBack();
  }
});
```

#### i18n Adapter:
```javascript
_createI18nAdapter() {
  return {
    t: (key) => {
      const keyMap = {
        'timeslot.daysOfWeek': 'ui.daysOfWeek',
        'timeslot.start': 'ui.start',
        'timeslot.stop': 'ui.stop',
        'timeslot.create': 'ui.create',
        'timeslot.modify': 'ui.modify',
        'timeslot.errorNoDays': 'ui.errorNoDays',
        'timeslot.startHandleAria': 'ui.startHandle',
        'timeslot.stopHandleAria': 'ui.stopHandle',
      };
      return i18n.t(keyMap[key] || key);
    },
    
    subscribe: (callback) => i18n.onLanguageChange(callback),
    unsubscribe: (unsubscribeFn) => { if (typeof unsubscribeFn === 'function') unsubscribeFn(); }
  };
}
```

#### getWeekdayLetter:
```javascript
_getWeekdayLetter(dayKey) {
  const dayIndex = WeekDayIndex[dayKey]; // { mon: 0, tue: 1, ... }
  if (dayIndex === undefined) return dayKey.charAt(0).toUpperCase();
  
  const fullDayName = i18n.tDay(dayIndex);
  return fullDayName.charAt(0).toUpperCase();
}
```

## 🔄 Flusso di Navigazione

### CREATE MODE
```
1. User clicca AddTimeSlotButton
   ↓
2. TimeSlotRender chiama NavigatorManager.navigateTo('timeSlotEditorPage', { mode: 'create' })
   ↓
3. NavigatorManager chiama TimeSlotEditorPage.onActivate({ mode: 'create' })
   ↓
4. TimeSlotEditorPage monta TimeSlotGauge con valori default:
   - start: '12:30'
   - stop: '18:30'
   - days: Ven/Sab/Dom
   ↓
5. User modifica e clicca "Crea"
   ↓
6. TimeSlotGauge chiama onSubmit(payload)
   ↓
7. TimeSlotEditorPage chiama modifyTimeSlot(payload) → ESP32
   ↓
8. TimeSlotEditorPage chiama NavigatorManager.goBack()
```

### MODIFY MODE
```
1. User clicca TimeSlot card (ID = 42)
   ↓
2. TimeSlotRender chiama NavigatorManager.navigateTo('timeSlotEditorPage', { mode: 'modify', slotId: 42 })
   ↓
3. NavigatorManager chiama TimeSlotEditorPage.onActivate({ mode: 'modify', slotId: 42 })
   ↓
4. TimeSlotEditorPage carica slot 42 da Store e monta TimeSlotGauge con quei dati
   ↓
5. User modifica e clicca "Modifica"
   ↓
6. TimeSlotGauge chiama onSubmit(payload) con id=42
   ↓
7. TimeSlotEditorPage chiama modifyTimeSlot(payload) → ESP32
   ↓
8. TimeSlotEditorPage chiama NavigatorManager.goBack()
```

## 📋 Payload Format

Il payload inviato a `commandManager.modifyTimeSlot()` è:

```javascript
{
  id: 255,              // 255 = nuovo slot (CREATE), 0-254 = modifica (MODIFY)
  start: "12:30",       // Formato "HH:MM"
  stop: "18:30",        // Formato "HH:MM"
  days: {               // Booleans per ogni giorno
    mon: false,
    tue: false,
    wed: false,
    thu: false,
    fri: true,
    sat: true,
    sun: true
  }
}
```

### Messaggio ESP32 Generato

`commandManager.modifyTimeSlot()` converte il payload in:

```
MODIFY_TIME_SLOT|255☺12☺30☺18☺30☺112
```

Dove:
- `255` = ID slot (255 per nuovo)
- `12☺30` = start (ore☺minuti)
- `18☺30` = stop (ore☺minuti)
- `112` = dayFlags bitmask (Ven=16 + Sab=32 + Dom=64 = 112)

## 🧪 Testing

### Test CREATE
1. Vai alla pagina Scheduler
2. Clicca "Aggiungi nuova Fascia Oraria"
3. Verifica gauge con:
   - Start: 12:30
   - Stop: 18:30
   - Giorni: Ven, Sab, Dom attivi
4. Trascina maniglie
5. Seleziona/deseleziona giorni
6. Clicca "Crea"
7. Verifica:
   - Messaggio inviato a ESP32
   - Ritorno a Scheduler
   - Store aggiornato (quando ESP risponde)

### Test MODIFY
1. Vai alla pagina Scheduler
2. Clicca su una time slot card esistente
3. Verifica gauge caricato con dati slot
4. Modifica orari/giorni
5. Clicca "Modifica"
6. Verifica:
   - Messaggio inviato con ID corretto
   - Ritorno a Scheduler
   - Store aggiornato

### Test iOS Safari
1. Apri su iPhone/iPad
2. Trascina maniglie
3. Verifica:
   - ❌ NO pull-to-refresh durante drag
   - ❌ NO scroll pagina durante drag
   - ✅ Drag smooth e responsive
   - ✅ Hit area comoda (44x44px)

### Test i18n
1. Cambia lingua (EN → IT → FR → DE → ES)
2. Verifica aggiornamento live:
   - Titolo pagina
   - Label "Giorni della Settimana"
   - Label "Inizio" / "Fine"
   - Bottone "Crea" / "Modifica"
   - Lettere giorni (L, M, M, G, V, S, D)

### Test Dark Mode
1. Toggle dark mode
2. Verifica colori gauge:
   - Track
   - Arc
   - Handles
   - Testi

## 🐛 Troubleshooting

### Gauge non appare
- ✅ Verifica CSS importato in `index.html`
- ✅ Verifica TimeSlotEditorPage registrata in App
- ✅ Controlla console per errori

### Navigazione non funziona
- ✅ Verifica NavigatorManager inizializzato
- ✅ Verifica TimeSlotEditorPage registrata con `registerPage()`
- ✅ Controlla che `data` sia passato correttamente in `onActivate()`

### Slot non si carica in MODIFY
- ✅ Verifica `slotId` passato correttamente
- ✅ Verifica Store contiene gli slot in `Paths.RUNTIME.SCHEDULER`
- ✅ Controlla console per errori in `_getInitialValues()`

### Lettere giorni sbagliate
- ✅ Verifica `i18n.tDay()` funzioni correttamente
- ✅ Verifica `WeekDayIndex` mapping corretto
- ✅ Controlla lingua corrente

### iOS pull-to-refresh ancora attivo
- ✅ Verifica CSS: `.gauge-container { touch-action: none; }`
- ✅ Verifica build/bundler non rimuova questa proprietà
- ✅ Controlla console per warning

## 📚 References

- **Componente**: `webui/src/js/components/TimeSlotGauge/TimeSlotGauge.js`
- **Funzioni**: `webui/src/js/components/TimeSlotGauge/TimeSlotGaugeFunctions.js`
- **Pagina**: `webui/src/js/pages/TimeSlotEditorPage.js`
- **Docs**: `webui/doc/useComponents/TimeSlot/README.md`
- **Examples**: `webui/doc/useComponents/TimeSlot/TimeSlotGaugeExample.js`

## 🎯 Next Steps

1. ✅ Build progetto: `npm run build`
2. ✅ Upload filesystem: PlatformIO → Upload Filesystem Image
3. ✅ Test su ESP32 reale
4. ✅ Test su iOS Safari
5. ⏸️ Eventuali aggiustamenti UI/UX
6. ⏸️ Implementare toast/modal custom per errori (invece di `alert()`)

---

**Made with ❤️ for Idrobase FogExtra**
