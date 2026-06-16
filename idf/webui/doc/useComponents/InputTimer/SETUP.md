# 🎯 InputTimer Component - Setup Checklist

## ✅ File Creati

```
webui/src/js/components/InputTimer/
├── InputTimer.js      ✅ Componente principale
├── func.js            ✅ Logica di conversione/validazione
├── func.test.js       ✅ Unit tests
├── example.js         ✅ Esempi d'uso
└── README.md          ✅ Documentazione completa

webui/src/css/components/
└── InputTimer.css     ✅ Stili responsive

webui/src/js/utils/
└── i18n.js            ✅ Traduzioni aggiornate (5 lingue)
```

---

## 📝 Passi per Integrazione

### 1. Includi CSS in index.html

Aggiungi questo link nel `<head>` di `index.html`:

```html
<!-- InputTimer Component Styles -->
<link rel="stylesheet" href="./css/components/InputTimer.css">
```

**Posizione**: Dopo gli altri CSS dei componenti, prima della chiusura `</head>`.

---

### 2. Verifica Traduzioni i18n

Le traduzioni sono già state aggiunte in `i18n.js` per tutte e 5 le lingue:

```js
timer: {
  hours: "HOURS" | "ORE" | "HEURES" | "STUNDEN" | "HORAS",
  minutes: "MINUTES" | "MINUTI" | "MINUTES" | "MINUTEN" | "MINUTOS",
  seconds: "SECONDS" | "SECONDI" | "SECONDES" | "SEKUNDEN" | "SEGUNDOS"
}
```

✅ Nessuna azione richiesta, già implementato.

---

### 3. Usa in TimerEditorPage

Esempio di integrazione nella tua `TimerEditorPage`:

```js
// In TimerEditorPage.js
import { Component } from '../../core/Component.js';
import { InputTimer } from '../../components/InputTimer/InputTimer.js';
import { NavigationManager } from '../../managers/navigationManager.js';

export class TimerEditorPage extends Component {
  onCreate() {
    this.timerInput = null;
    
    // Ottieni paramId dalla route (passato da MenuSettingsPage)
    const routeParams = NavigationManager.getCurrentParams();
    this.paramId = routeParams?.paramId || 1;
  }

  onMount() {
    // Crea InputTimer
    this.timerInput = new InputTimer({
      paramId: this.paramId,
      onConfirm: () => {
        // Torna alla pagina precedente dopo conferma
        NavigationManager.goBack();
      }
    });
    
    // Monta nel container
    const container = this.$('.timer-editor-container');
    if (container) {
      this.timerInput.mount(container);
    }
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
      this.timerInput = null;
    }
  }

  render() {
    return `
      <div class="page timer-editor-page">
        <div class="page-header">
          <button class="back-btn" data-action="back">←</button>
          <h1>Modifica Timer</h1>
        </div>
        <div class="page-content">
          <div class="timer-editor-container"></div>
        </div>
      </div>
    `;
  }

  onBindEvents() {
    const backBtn = this.$('[data-action="back"]');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        NavigationManager.goBack();
      });
    }
  }
}
```

---

### 4. Navigazione da MenuSettingsPage

Quando l'utente clicca su un parametro TIME, naviga a `TimerEditorPage`:

```js
// In MenuSettingsPage.js (o dove gestisci click su ParameterItem)

handleParameterClick(param) {
  if (param.type === ParamType.TIME) {
    // Naviga a TimerEditorPage passando paramId
    NavigationManager.navigateTo('TimerEditorPage', { 
      paramId: param.id 
    });
  }
  // ... altri tipi di parametri
}
```

---

### 5. Test Componente

#### Test Manuale:

1. **Build progetto**:
   ```bash
   cd webui
   npm run build
   ```

2. **Upload filesystem su ESP32**:
   ```bash
   platformio run --target uploadfs
   ```

3. **Connettiti all'ESP32** e naviga a TimerEditorPage

4. **Verifica**:
   - ✅ Visualizzazione corretta colonne (hours/minutes/seconds)
   - ✅ Frecce up/down incrementano/decrementano
   - ✅ Click su valore → input editabile
   - ✅ Pulsante Default reimposta valore
   - ✅ Pulsante Conferma invia comando e naviga indietro
   - ✅ Cambio lingua aggiorna labels

#### Test Automatici:

```bash
cd webui/src/js/components/InputTimer
node func.test.js
```

Dovresti vedere:
```
✅ All tests passed!
```

---

## 🔧 Configurazione Parametri TIME

Per identificare quali parametri sono di tipo TIME, usa:

```js
import { ParamType } from '../../utils/constants.js';

// In constants.js, assicurati di avere:
export const ParamType = {
  NUMBER: 0,
  FLOAT: 1,
  BOOL: 2,
  TIME: 3,      // ← Tipo per timer
  // ... altri
};
```

Nell'ESP32, i parametri TIME dovrebbero avere:
- `type = 3` (TIME)
- `unit = "s"` o `""` (unità opzionale)
- `divisor = 1`
- `min` e `max` in secondi

---

## 🎨 Customizzazione CSS

Se vuoi personalizzare i colori/dimensioni, modifica le variabili CSS in `InputTimer.css`:

```css
/* Esempio: cambia colore brand */
.timer-arrow {
  color: #your-brand-color;
}

.timer-btn-confirm {
  background: #your-brand-color;
}
```

Oppure usa le variabili CSS globali:
- `--brand` (colore principale)
- `--brand-light` (hover)
- `--card` (background)
- `--text` (colore testo)

---

## 📱 Responsive

Il componente è **mobile-first** e si adatta automaticamente:

- **Mobile** (< 375px): Font ridotti, layout compatto
- **Tablet/Desktop** (> 768px): Spaziatura aumentata
- **Desktop Large** (> 1024px): Max-width 600px centrato

Nessuna configurazione necessaria.

---

## 🐛 Troubleshooting

### Problema: Componente non si carica

**Soluzione**: Verifica import in TimerEditorPage:
```js
import { InputTimer } from '../../components/InputTimer/InputTimer.js';
```

### Problema: CSS non applicato

**Soluzione**: Verifica che `InputTimer.css` sia incluso in `index.html`:
```html
<link rel="stylesheet" href="./css/components/InputTimer.css">
```

### Problema: Traduzioni non funzionano

**Soluzione**: Verifica che `i18n.js` contenga le traduzioni aggiornate:
```js
timer: { hours: "...", minutes: "...", seconds: "..." }
```

### Problema: Limiti dinamici non corretti

**Soluzione**: Controlla `config.max` del parametro. Usa console:
```js
console.log(Store.get(Paths.CONFIG.PARAMS).find(p => p.id === 1));
```

---

## 📚 Riferimenti

- **Documentazione completa**: `README.md`
- **Esempi d'uso**: `example.js`
- **Tests**: `func.test.js`
- **Logica**: `func.js`

---

## ✅ Checklist Finale

Prima di considerare l'integrazione completa:

- [ ] CSS incluso in `index.html`
- [ ] Import in `TimerEditorPage.js`
- [ ] Navigazione da `MenuSettingsPage` implementata
- [ ] Test manuale su ESP32
- [ ] Traduzioni verificate in tutte le lingue
- [ ] Comando `MODIFY_PARAM` ricevuto da ESP
- [ ] UI responsive testata su mobile/tablet

---

## 🚀 Deploy

Quando tutto è pronto:

```bash
# 1. Build frontend
cd webui
npm run build

# 2. Upload filesystem
cd ..
platformio run --target uploadfs --environment esp32-s3-devkitc-1

# 3. Upload firmware (se modificato C++)
platformio run --target upload --environment esp32-s3-devkitc-1
```

---

**Creato da**: FogExtra Team  
**Data**: 18 Ottobre 2025  
**Versione**: 1.0.0
