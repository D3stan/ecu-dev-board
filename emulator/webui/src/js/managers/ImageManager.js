/**
 * ImageManager.js
 * Motore centrale di risoluzione e code management degli Asset Immagine/Icone.
 * Gestisce registry runtime, concorrenza asincrona con priorità e subscriber pattern.
 */
import { getAssetDescriptor, SHARED_FALLBACK } from '../core/AssetCatalog.js';

// Configurazione base manager (Prudente per Fase 1)
const CONFIG = {
  MAX_CONCURRENT: 1, // Molto stretto: Non asfissia il serverino dell'ESP32
  MAX_RETRIES: 2,    // Limita infinite loop
  RETRY_DELAY_MS: 800
};

// Enum Stati della Runtime Entry
const STATUS = {
  IDLE: 'idle',
  QUEUED: 'queued',
  LOADING: 'loading',
  LOADED: 'loaded',
  FAILED: 'failed'
};

const ImageManager = (() => {
  // Registry Centrale Runtime: Map<String(AssetKey), AssetRuntimeEntry>
  // Garantisce la deduplica esatta: ogni Key esisterà una sola volta.
  const runtimeRegistry = new Map();

  // Reverse Index dei Subscriber: Map<String(SubscriberId), Set<String(AssetKey)>>
  // Permette di localizzare velocemente tutte le queue a cui un subscriber (es. un Component) è associato.
  const subscriberRegistry = new Map();

  let activeRequests = 0;
  let queueSequence = 0; // Contatore globale per garantire ordinamento FIFO sulla stessa priorità

  /**
   * Genera la struttura iniziale di una Runtime Entry per l'Asset
   */
  function createRuntimeEntry(descriptor) {
    return {
      key: descriptor.key,
      urlCanonico: descriptor.urlCanonico,
      status: STATUS.IDLE,
      priority: descriptor.priority, // Priorità fissa
      sequenceNumber: 0, // Inizializzato al momento del QUEUED
      attempts: 0,
      resource: null, // Viene assegnato qui il costoso URL.createObjectURL(blob)
      fallback: descriptor.fallback,
      subscribers: new Map(), // mappa interna subscriberId -> object(Subscriber)
      error: null,
      lastUsedAt: Date.now()
    };
  }

  /**
   * Avanzamento Coda tramite logica asincrona protetta
   */
  function processQueue() {
    // Trova le entry in stato QUEUED
    const queuedEntries = Array.from(runtimeRegistry.values()).filter(e => e.status === STATUS.QUEUED);
    if (queuedEntries.length === 0) {
      return;
    }

    // Sort Queue: 
    // 1. Priorità più alta per prima (DESC)
    // 2. A parità di priorità, ordine di arrivo in coda (FIFO/sequenceNumber ASC)
    queuedEntries.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return a.sequenceNumber - b.sequenceNumber;
    });

    // Processa tutte le entry possibili fino al limite di concorrenza configurato
    while (activeRequests < CONFIG.MAX_CONCURRENT && queuedEntries.length > 0) {
      const entryToProcess = queuedEntries.shift(); // Estrae il primo elemento dalla coda ordinata
      fetchAsset(entryToProcess); // async non bloccante
    }
  }

  /**
   * Lavoro HTTP - Richiede il modulo
   */
  async function fetchAsset(entry) {
    entry.status = STATUS.LOADING;
    entry.attempts++;
    activeRequests++;

    try {
      // Usiamo l'url normalizzato per la cache di rete corretta
      const response = await fetch(entry.urlCanonico);
      if (!response.ok) {
         throw new Error(`HTTP Fetch Failed: ${response.status}`);
      }
      
      const blob = await response.blob();
      
      // POLICY DI FASE 1:
      // Gli ObjectURL restano vivi per tutta la sessione SPA come cache sicura.
      // Nessun revokeObjectURL() aggressivo viene fatto, rinviato a future logiche selettive.
      entry.resource = URL.createObjectURL(blob);
      entry.status = STATUS.LOADED;
      entry.error = null;
      
      notifySubscribers(entry);

    } catch (err) {
      console.warn(`[ImageManager] Fallimento fetching per asset '${entry.key}' (Tentativo ${entry.attempts}):`, err);
      
      if (entry.attempts < CONFIG.MAX_RETRIES) {
         // Meccanismo delay tra i retry per non floddare la rete
         entry.status = STATUS.IDLE;
         setTimeout(() => {
            if (entry.status === STATUS.IDLE) { // Controlla ev. cambiamenti in between
               entry.status = STATUS.QUEUED;
               entry.sequenceNumber = queueSequence++; // <- RIASSEGNATO: Nuovo ingresso in coda per retry
               processQueue();
            }
         }, CONFIG.RETRY_DELAY_MS);
      } else {
         entry.status = STATUS.FAILED;
         entry.error = err.message || "Retry Exhausted";
         // Non notifichiamo fallback qui. Il manager l'ha già ritornato in fase di requestAsset.
         // Chi ha un fallback lo continuerà a vedere.
      }
    } finally {
      activeRequests--;
      processQueue(); // Riprende la cima della coda
    }
  }

  /**
   * Pub/Sub - Spinge le notifiche di completamento
   */
  function notifySubscribers(entry) {
    if (entry.status !== STATUS.LOADED) return;

    for (const [subId, subData] of entry.subscribers.entries()) {
      // 2. SHAPE DEL SUBSCRIBER E VALIDITÀ:
      // Controlla prima se il componente ha dichiarato isValid() ed è decaduto
      if (typeof subData.isValid === 'function' && !subData.isValid()) {
        unsubscribe(entry.key, subId);
        continue;
      }

      try {
        subData.onAssetReady(entry.resource);
      } catch (e) {
        console.error(`[ImageManager] Errore nell'handler onAssetReady del subscriber '${subId}':`, e);
      }
    }
  }


  // ===================================
  // API PUBBLICHE
  // ===================================

  /**
   * 1. REQUEST ASSET STRUTTURATO
   * Richiede una dipendenza. Non restituisce mai booleani o array magici.
   * Restituisce un Payload ben delineato { status, resource, fallback, subscribed }.
   * 
   * IL SUBSCRIBER EXPECT:
   * subscriber = { id: String, onAssetReady: Function, isValid: Function }
   */
  function requestAsset(key, subscriber) {
    // Validazione contratto base
    if (!key || !subscriber || !subscriber.id || typeof subscriber.onAssetReady !== 'function') {
      console.error("[ImageManager] requestAsset invocato con parametri non validi", { key, subscriberId: subscriber?.id });
      return { status: STATUS.FAILED, resource: null, fallback: SHARED_FALLBACK, subscribed: false };
    }

    // Deduplica 1: Recupera catalog details
    const descriptor = getAssetDescriptor(key);
    if (!descriptor) {
      console.warn(`[ImageManager] Asset non mappato nel catalogo: '${key}'`);
      return { status: STATUS.FAILED, resource: null, fallback: SHARED_FALLBACK, subscribed: false };
    }

    // Deduplica 2: Assicura singola istanza nel RuntimeRegistry
    if (!runtimeRegistry.has(key)) {
      runtimeRegistry.set(key, createRuntimeEntry(descriptor));
    }

    const entry = runtimeRegistry.get(key);
    entry.lastUsedAt = Date.now();

    // Valutazione di routing in base allo stato Sessione Locale/Memoria
    if (entry.status === STATUS.LOADED && entry.resource) {
       // RISORSA GIÀ PRONTA IN RAM: Ritorno immediato. 
       // NON AGGIUNGE IL SUBSCRIBER alla lista, non è necessario aspettare eventi.
       return {
         status: entry.status,
         resource: entry.resource, // Blob Object URL Definitivo
         fallback: entry.fallback,
         subscribed: false // false perché non aggiunto ai subscriber attivi
       };
    }

    if (entry.status === STATUS.FAILED) {
       // Ha fallito iterazioni max. Rende il default fisso senza attesa di notifiche.
       // NON AGGIUNGE IL SUBSCRIBER alla lista, non c'è politica di recovery.
       return {
         status: entry.status,
         resource: null,
         fallback: entry.fallback,
         subscribed: false // false perché inutile legarsi a una promessa fallita
       };
    }

    // Mapping per tracciamento Multiplo interno se serve aspettare (QUEUED, LOADING, IDLE)
    if (!subscriberRegistry.has(subscriber.id)) {
      subscriberRegistry.set(subscriber.id, new Set());
    }
    subscriberRegistry.get(subscriber.id).add(key);

    // Registra effettivamente il componente richiedente
    entry.subscribers.set(subscriber.id, subscriber);

    if (entry.status === STATUS.IDLE) {
       // Non è mai stata chiesta. Indirizziamola verso il Fetch
       entry.status = STATUS.QUEUED;
       entry.sequenceNumber = queueSequence++;
       // Rilascio di thread prima di intaccare le priorità accodate
       setTimeout(processQueue, 0);
    }

    // Se stiamo LOADING o è appena diventata QUEUED:
    // Restituiamo il fallback provvisorio.
    return {
       status: entry.status,
       resource: null,
       fallback: entry.fallback,
       subscribed: true
    };
  }

  /**
   * Restituisce immediatamente la risorsa se già caricata, senza effetti collaterali.
   * Utilizzato dai Componenti per controlli sincroni e veloci (es. in render()).
   */
  function getLoadedAsset(key) {
    const entry = runtimeRegistry.get(key);
    if (entry && entry.status === STATUS.LOADED) {
      return entry.resource;
    }
    return null;
  }

  /**
   * 5. ARCHITETTURA DI UNSUBSCRIBE (Punto e Componente)
   * Rimuove un iscritto da una particolare chiave risorsa.
   */
  function unsubscribe(key, subscriberId) {
    const entry = runtimeRegistry.get(key);
    if (entry) {
       entry.subscribers.delete(subscriberId);
    }

    // Libera anche il reverse lookup
    const subSet = subscriberRegistry.get(subscriberId);
    if (subSet) {
       subSet.delete(key);
       if (subSet.size === 0) {
         subscriberRegistry.delete(subscriberId);
       }
    }
  }

  /**
   * Rimuove massivamente un iscritto (es un Component distrutto)
   * da tutte le istanze contemporaneamente, garantendo memory sweep affidabile.
   */
  function unsubscribeAll(subscriberId) {
    const linkedKeys = subscriberRegistry.get(subscriberId);
    if (!linkedKeys) return;

    // Converte in array per iterare senza side-effects da mutazioni di Set
    Array.from(linkedKeys).forEach(key => {
      unsubscribe(key, subscriberId);
    });
  }

  /**
   * Metriche di validazione diagnostica (Requirement 7)
   */
  function getStats() {
    return {
       totalEntries: runtimeRegistry.size,
       activeRequests: activeRequests,
       activeSubscribers: subscriberRegistry.size,
       loadedStatusCount: Array.from(runtimeRegistry.values()).filter(e => e.status === STATUS.LOADED).length
    };
  }

  return {
    requestAsset,
    getLoadedAsset,
    unsubscribe,
    unsubscribeAll,
    getStats
  };

})();

// Alias visibile all'esterno
export { STATUS as AssetStatus, ImageManager };
