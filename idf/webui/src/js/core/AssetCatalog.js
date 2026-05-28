/**
 * AssetCatalog.js
 * Catalogo statico centralizzato per gli asset immagine/icone.
 * Definisce l'identità dell'asset, non il suo ciclo di vita.
 */

// Livelli di priorità predefiniti per indirizzare la queue
export const AssetPriority = {
  HIGH: 10,
  NORMAL: 5,
  LOW: 1
};

// Fallback globale condiviso: un segnaposto leggerissimo base64 (SVG quadrato grigio 1x1)
// Questo evita flash o rotte errate dal browser prima che la logica pub/sub completi il fetch
export const SHARED_FALLBACK = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNlMGUwZTAiLz48L3N2Zz4=";

// Mappatura statica delle identità dell'asset
// VINCOLO BIUNIVOCO: Ogni `key` identifica univocamente e in modo assoluto un singolo file (URL).
// Non ci devono essere due chiavi diverse che puntano allo stesso file.
// massima priorità alla top bar media alle icone tipo termo timer ecc bassa  aquelle che no son subit visibili
const catalog = {
  // Loghi (Priorità Alta - Visibilità immediata necessaria)
  "logo-idrobase": { url: "./assets/img/logo-idrobase.png", priority: AssetPriority.NORMAL, alt: "Idrobase" },
  "logo-product": { url: "./assets/img/logo-product.png", priority: AssetPriority.HIGH, alt: "Nebulizzatore" },

  // Icone Strutturali (Priorità Alta)
  "icon-hamburger-menu": { url: "./assets/icons/icon-hamburger-menu.png", priority: AssetPriority.HIGH, alt: "Menu" },
  "icon-wifi-free": { url: "./assets/icons/icon-wifi-free.png", priority: AssetPriority.LOW, alt: "WiFi Free" },
  "icon-wifi": { url: "./assets/icons/icon-wifi.png", priority: AssetPriority.LOW, alt: "WiFi Status" },
  "icon-wifi-lock": { url: "./assets/icons/icon-wifi-lock.png", priority: AssetPriority.LOW, alt: "WiFi Locked" },

  // Icone Applicative (Priorità Normale)
  "icon-timer": { url: "./assets/icons/icon-timer.png", priority: AssetPriority.NORMAL, alt: "Timer" },
  "icon-calendar": { url: "./assets/icons/icon-calendar.png", priority: AssetPriority.NORMAL, alt: "Calendar" },
  "icon-thermo": { url: "./assets/icons/icon-thermo.png", priority: AssetPriority.NORMAL, alt: "Temperature" },
  "icon-humidity": { url: "./assets/icons/icon-humidity.png", priority: AssetPriority.NORMAL, alt: "Humidity" },
  "icon-setting": { url: "./assets/icons/icon-setting.png", priority: AssetPriority.LOW, alt: "Settings" },
  "icon-antibacterial": { url: "./assets/icons/icon-antibacterial.png", priority: AssetPriority.LOW, alt: "Antibacterial" },
  "icon-modbus": { url: "./assets/icons/icon-modbus.png", priority: AssetPriority.LOW, alt: "Modbus" },
  "icon-sun": { url: "./assets/icons/icon-sun.png", priority: AssetPriority.HIGH, alt: "Day Mode" },
  "icon-moon": { url: "./assets/icons/icon-moon.png", priority: AssetPriority.HIGH, alt: "Night Mode" },
  "icon-dispenser": { url: "./assets/icons/icon-dispenser.png", priority: AssetPriority.LOW, alt: "Dispenser" },
  "icon-fan": { url: "./assets/icons/icon-fan.png", priority: AssetPriority.LOW, alt: "Fan" },
  "icon-pump": { url: "./assets/icons/icon-pump.png", priority: AssetPriority.HIGH, alt: "Pump" },
  "icon-send": { url: "./assets/icons/icon-send.png", priority: AssetPriority.LOW, alt: "Send" },

  // Icone Lingue (Priorità Normale)
  "icon-lang-en": { url: "./assets/img/flags/icon-lang-en.png", priority: AssetPriority.NORMAL, alt: "English" },
  "icon-lang-it": { url: "./assets/img/flags/icon-lang-it.png", priority: AssetPriority.NORMAL, alt: "Italiano" },
  "icon-lang-de": { url: "./assets/img/flags/icon-lang-de.png", priority: AssetPriority.LOW, alt: "Deutsch" },
  "icon-lang-es": { url: "./assets/img/flags/icon-lang-es.png", priority: AssetPriority.LOW, alt: "Español" },
  "icon-lang-fr": { url: "./assets/img/flags/icon-lang-fr.png", priority: AssetPriority.NORMAL, alt: "Français" },
};

/**
 * Recupera e normalizza il descrittore statico dell'asset a partire dalla sua chiave.
 * @param {string} key - Chiave dell'asset (es: "icon-menu")
 * @returns {Object|null} - Descrittore dell'asset normalizzato o null se la chiave non esiste
 */
export function getAssetDescriptor(key) {
  const entry = catalog[key];
  if (!entry) return null;

  // 3. NORMALIZZAZIONE URL CANONICO
  // Calcolo esplicito dell'URL in formato assoluto per garantire che richieste di path "./..." 
  // e "/..." si risolvano e si deduplichino esattamente nella medesima cache entry.
  let urlCanonico = entry.url;
  try {
    // window.location.origin viene usato come Base per normalizzare
    urlCanonico = new URL(entry.url, window.location.origin).href;
  } catch (e) {
    console.warn(`[AssetCatalog] Impossibile normalizzare URL per la chiave '${key}'`, e);
  }

  return {
    key: key,
    urlOriginal: entry.url,
    urlCanonico: urlCanonico,
    priority: entry.priority !== undefined ? entry.priority : AssetPriority.NORMAL,
    fallback: entry.fallback || SHARED_FALLBACK,
    alt: entry.alt || ""
  };
}
