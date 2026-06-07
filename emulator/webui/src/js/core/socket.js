// socket.js
import { SocketState } from "../utils/constants.js";

const Socket = (() => {
  // --- CONFIGURAZIONE ---
  const CONFIG = {
    disconnectTimeout: 2000,   // ms senza messaggi prima di considerare ESP offline
    backoffBase: 2000,         // tempo iniziale di retry (2s) - aumentato da 1s per ridurre storm
    backoffFactor: 2,          // moltiplicatore progressivo
    backoffMax: 30000,         // massimo intervallo retry (30s)
    initialBackoff: 3000,      // primo retry dopo FORCED_DISCONNECT (3s) - evita loop immediato
    maxReconnectAttempts: 3,   // numero massimo tentativi prima di passare a DISCONNECTED
    // ── Heartbeat Ping ──
    pingIntervalMs: 2000,      // intervallo invio PING al server (ms)
    // ── Silence window ──
    maxSilenceMs: 60000,       // clamp massimo per silenceMs ricevuto dal WIFI snapshot
  };

  // --- STATO INTERNO ---
  let state = SocketState.DISCONNECTED;
  let ws = null;
  let url = null;

  let retryDelay = CONFIG.backoffBase;
  let watchdogTimer = null;
  let reconnectTimer = null; // ⭐ Timer per il reconnect
  let pingTimer = null;           // Timer periodico per invio PING
  let forcedDisconnectRetryMs = 0; // FASE 4: retryAfterMs da FORCED_DISCONNECT (0 = nessun wait forzato)
  let reconnectAttempts = 0; // 🔄 Contatore tentativi di riconnessione
  let stayDisconnected = false; // 🔒 Flag: una volta DISCONNECTED, non mostrare più CONNECTING al client
  let silenceUntilMs = 0; // 🔇 Wi-Fi silence window: timestamp (Date.now()) fino a cui non disconnettere
  let autoReconnectEnabled = true; // 🚫 ONE-WS-PER-IP: false after REPLACED, blocks ALL auto-reconnect

  const statusSubscribers = [];
  const messageSubscribers = [];
  const openSubscribers = [];

  // --- FUNZIONI PRIVATE ---
  function setState(newState) {
    // 🔒 Se siamo in modalità "stayDisconnected", blocca stati intermedi per il client
    // L'utente vedrà solo DISCONNECTED finché non si riconnette davvero
    if (stayDisconnected && newState !== SocketState.CONNECTED && newState !== SocketState.DISCONNECTED) {
      state = newState; // Aggiorna stato interno per la logica
      return; // Non notificare i subscriber
    }
    
    if (state !== newState) {
      state = newState;
      
      // 🎨 Gestione opacità body basata sullo stato di connessione
      updateBodyOpacity(newState);
      
      statusSubscribers.forEach(cb => cb(state));
    }
  }

  /**
   * Update body opacity based on socket connection state.
   * Sets opacity to 0.4 when disconnected, 1.0 otherwise.
   * Applied to document.body for full page effect.
   * @param {string} state - Socket state
   */
  function updateBodyOpacity(state) {
    if (state === SocketState.DISCONNECTED) {
      document.body.style.opacity = '0.4';
      document.body.style.transition = 'opacity 0.3s ease';
    } else {
      document.body.style.opacity = '1';
      document.body.style.transition = 'opacity 0.3s ease';
    }
  }

  function resetWatchdog() {
    clearTimeout(watchdogTimer);
    // Dynamic timeout: if inside a silence window, extend the watchdog accordingly
    const now = Date.now();
    let timeout = CONFIG.disconnectTimeout;
    if (silenceUntilMs > now) {
      // Within silence window: use remaining silence + base timeout as grace
      timeout = (silenceUntilMs - now) + CONFIG.disconnectTimeout;
    }
    watchdogTimer = setTimeout(() => {
      console.warn("⚠️ ESP non risponde da troppo tempo, considerato offline");
      console.warn("⏱️ Nessun messaggio ricevuto per", timeout, "ms");
      setState("disconnected");
      safeClose();
      if (autoReconnectEnabled) {
        scheduleReconnect();
      }
    }, timeout);
  }

  function scheduleReconnect() {
    // 🚫 ONE-WS-PER-IP: If replaced, never auto-reconnect
    if (!autoReconnectEnabled) {
      return;
    }

    // ⭐ Cancella eventuali reconnect già in corso
    clearTimeout(reconnectTimer);
    
    // 🔄 Incrementa contatore tentativi
    reconnectAttempts++;
    
    // FASE 4: Se FORCED_DISCONNECT con retryAfterMs, usa quel delay
    let currentDelay;
    if (forcedDisconnectRetryMs > 0) {
      currentDelay = forcedDisconnectRetryMs;
      forcedDisconnectRetryMs = 0; // Reset dopo primo uso
    } else {
      // 🔥 FIX: Primo retry con delay maggiore (3s) per evitare storm con LRU
      currentDelay = retryDelay === CONFIG.backoffBase ? CONFIG.initialBackoff : retryDelay;
    }
    
    // 🚨 Dopo N tentativi, passa a DISCONNECTED e STOP (no more timer)
    if (reconnectAttempts >= CONFIG.maxReconnectAttempts) {
      console.warn(`⚠️ Raggiunto limite di ${CONFIG.maxReconnectAttempts} tentativi - stato: DISCONNECTED`);
      stayDisconnected = true; // 🔒 Blocca stati intermedi per il client
      setState(SocketState.DISCONNECTED);
      return; // 🛑 STOP: don't schedule another reconnect timer
    }
    
    setState(SocketState.RECONNECTING);
    reconnectTimer = setTimeout(() => {
      retryDelay = Math.min(retryDelay * CONFIG.backoffFactor, CONFIG.backoffMax);
      connect(); // tenta di nuovo
    }, currentDelay);
  }

  function safeClose() {
    stopHeartbeat();
    if (ws) {
      try { ws.close(1000, "Client closed"); } catch(e) {}
      ws = null;
    }
  }

  /**
   * Start periodic PING heartbeat (no PONG expected — watchdog handles liveness).
   * Sends "PING|heartbeat" every pingIntervalMs to keep the connection alive.
   */
  function startHeartbeat() {
    stopHeartbeat();
    pingTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send("PING|heartbeat");
      }
    }, CONFIG.pingIntervalMs);
  }

  function stopHeartbeat() {
    clearInterval(pingTimer);
    pingTimer = null;
  }

  // --- API PUBBLICHE ---
  function setConfig(dataConfig) {
    // Single URL: /ws on port 80 (AsyncWebSocket)
    url = dataConfig.url || dataConfig.asyncUrl || null;
  }

  function connect() {
    // return; // disabilitato per sviluppo
    if (!url) {
      throw new Error("Socket config non inizializzata! Usa setConfig(url) prima di connect().");
    }
    
    safeClose();
    setState(SocketState.CONNECTING);

    try {
      ws = new WebSocket(`ws://${url}`);

      ws.onopen = () => {
        clearTimeout(reconnectTimer); // ⭐ Cancella il timer di reconnect
        retryDelay = CONFIG.backoffBase; // resetta il backoff
        reconnectAttempts = 0; // 🔄 Reset contatore tentativi
        stayDisconnected = false; // 🔓 Sblocca - ora siamo connessi, possiamo mostrare stati al client
        autoReconnectEnabled = true; // 🔓 Re-enable reconnect on successful connect (page refresh scenario)
        removeReplacedOverlay(); // Remove overlay if present from previous REPLACED state
        setState(SocketState.CONNECTED);
        // FASE 1: MAC rimosso — nessun invio MAC|{mac} su connect

        // 🏓 Avvia heartbeat con ping/pong configurabile
        startHeartbeat();

        // ⚠️ Auto RTC update rimosso - ora gestito da App.js tramite parametro #36
        // L'interval da 60sec per updateRTC() è controllato dal parametro AUTO_CLOCK_UPDATE

        const openSubscribersSnapshot = openSubscribers.slice();
        openSubscribersSnapshot.forEach((cb, index) => {
          try {
            cb();
          } catch (err) {
            console.error(`⚠️ [Socket.onOpen] subscriber error #${index + 1}/${openSubscribersSnapshot.length}:`, err);
          }
        });
      };

      ws.onmessage = e => {
        const msg = String(e.data).trim();

        // 🐕 Every inbound message resets the watchdog (ESP is alive)
        resetWatchdog();
        
        // 🚨 FORCED_DISCONNECT: ESP richiede disconnessione
        if (msg.startsWith('FORCE_DISCONNECT')) {
          const parts = msg.split("|");
          const reason = parts[1] || "Unknown reason";
          
          // Estrai retryAfterMs se presente (es. "retryAfterMs=15000")
          let retryMs = 0;
          for (let i = 2; i < parts.length; i++) {
            if (parts[i].startsWith("retryAfterMs=")) {
              retryMs = parseInt(parts[i].split("=")[1]) || 0;
            }
          }

          // 🚫 ONE-WS-PER-IP: REPLACED = permanent hard stop (never auto-reconnect)
          if (reason === "REPLACED") {
            console.warn("🚫 ══════════════════════════════════════════════════════════");
            console.warn("🚫 SESSION REPLACED BY ANOTHER PAGE");
            console.warn("🚫 Auto-reconnect PERMANENTLY disabled");
            console.warn("🚫 Refresh (F5) to regain control");
            console.warn("🚫 ══════════════════════════════════════════════════════════");
            autoReconnectEnabled = false;
            stayDisconnected = true;
            clearTimeout(reconnectTimer);
            clearTimeout(watchdogTimer);
            stopHeartbeat();
            safeClose();
            setState(SocketState.DISCONNECTED);
            showReplacedOverlay();
            return;
          }
          
          // SERVER_FULL e IDLE_TIMEOUT sono temporanei: permetti retry con backoff
          const isTemporary = reason === "SERVER_FULL" || reason === "IDLE_TIMEOUT";
          
          if (isTemporary && retryMs > 0) {
            console.warn("⏳ FORCED_DISCONNECT temporaneo:", reason, "— retry tra", retryMs, "ms");
            
            // Cancella timer attivi
            clearTimeout(reconnectTimer);
            clearTimeout(watchdogTimer);
            safeClose();
            setState(SocketState.DISCONNECTED);
            
            // Programma retry con il delay suggerito dal server
            forcedDisconnectRetryMs = retryMs;
            reconnectAttempts = 0;
            stayDisconnected = false;
            reconnectTimer = setTimeout(() => {
              retryDelay = CONFIG.backoffBase;
              connect();
            }, retryMs);
          } else {
            // Disconnessione permanente (motivi non recuperabili)
            console.warn("🚨 ════════════════════════════════════════════════════════");
            console.warn("🚨 ESP HA FORZATO LA DISCONNESSIONE");
            console.warn("🚨 Motivo:", reason);
            console.warn("🚨 Reconnect automatico DISABILITATO");
            console.warn("🚨 ════════════════════════════════════════════════════════");
            stayDisconnected = true;
            clearTimeout(reconnectTimer);
            clearTimeout(watchdogTimer);
            setState(SocketState.DISCONNECTED);
            safeClose();
          }
          
          // Non propagare il messaggio agli altri handler (è un comando di sistema)
          return;
        }
        
        // �🔍 Log dettagliato per messaggi MENU
        messageSubscribers.forEach(cb => cb(msg));
      };

      ws.onclose = (event) => {
        clearTimeout(watchdogTimer);
        setState(SocketState.DISCONNECTED);

        if (autoReconnectEnabled) {
          scheduleReconnect();
        }
      };

      ws.onerror = err => {
        console.error("⚠️ WS errore:", err);
        setState(SocketState.DISCONNECTED);
        safeClose();

        if (autoReconnectEnabled) {
          scheduleReconnect();
        }
      };
    } catch (err) {
      console.error("⚠️ WS eccezione:", err);
      setState(SocketState.DISCONNECTED);
      if (autoReconnectEnabled) {
        scheduleReconnect();
      }
    }
  }

  function send(msg) {
    if (!autoReconnectEnabled) {
      console.warn("🚫 Send blocked: session replaced. Refresh to reconnect.");
      return;
    }
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    } else {
      console.warn("⚠️ Tentativo di invio senza connessione:", msg);
    }
  }

  function close() {
    clearTimeout(reconnectTimer); // ⭐ Cancella il timer di reconnect
    clearTimeout(watchdogTimer);  // ⭐ Cancella anche il watchdog
    stopHeartbeat();              // 🏓 Ferma heartbeat
    safeClose();
    setState(SocketState.DISCONNECTED);
  }

  function onStatus(cb) {
    if (typeof cb !== 'function') {
      return () => {};
    }

    if (!statusSubscribers.includes(cb)) {
      statusSubscribers.push(cb);
    }

    return () => {
      const idx = statusSubscribers.indexOf(cb);
      if (idx >= 0) {
        statusSubscribers.splice(idx, 1);
      }
    };
  }

  function onMessage(cb) {
    if (typeof cb !== 'function') {
      return () => {};
    }

    if (!messageSubscribers.includes(cb)) {
      messageSubscribers.push(cb);
    }

    return () => {
      const idx = messageSubscribers.indexOf(cb);
      if (idx >= 0) {
        messageSubscribers.splice(idx, 1);
      }
    };
  }

  function onOpen(cb) {
    if (typeof cb !== 'function') {
      return () => {};
    }

    if (!openSubscribers.includes(cb)) {
      openSubscribers.push(cb);
    }

    return () => {
      const idx = openSubscribers.indexOf(cb);
      if (idx >= 0) {
        openSubscribers.splice(idx, 1);
      }
    };
  }

  // Chiusura pulita quando la pagina viene chiusa
  window.addEventListener("beforeunload", () => {
    close();
  });

  // FASE 4: Page Visibility API — chiudi WS quando tab va in background,
  // riconnetti quando torna in foreground. Previene socket zombie.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      // Tab va in background: chiudi WS dopo un breve grace period
      // (il tab potrebbe tornare visibile subito, es. switch rapido)
      reconnectTimer = setTimeout(() => {
        if (document.visibilityState === "hidden" && ws) {
          safeClose();
          setState(SocketState.DISCONNECTED);
        }
      }, 5000);
    } else if (document.visibilityState === "visible") {
      // Tab torna in foreground: riconnetti immediatamente
      clearTimeout(reconnectTimer);
      if (state !== SocketState.CONNECTED && autoReconnectEnabled) {
        retryDelay = CONFIG.backoffBase;
        reconnectAttempts = 0;
        stayDisconnected = false;
        connect();
      }
    }
  });

  // 🔇 Listen for wifi-silence events dispatched by adapter.js parseWifi()
  // Extends the watchdog during Wi-Fi operations so the socket doesn't disconnect prematurely
  window.addEventListener("wifi-silence", (e) => {
    const ms = e.detail?.silenceMs || 0;
    if (ms <= 0) return;
    const clamped = Math.min(ms, CONFIG.maxSilenceMs);
    silenceUntilMs = Date.now() + clamped;
    // Re-arm watchdog with extended timeout
    resetWatchdog();
  });

  // 🚫 ONE-WS-PER-IP: Overlay for replaced sessions
  function showReplacedOverlay() {
    if (document.getElementById('ws-replaced-overlay')) return; // Already shown
    const overlay = document.createElement('div');
    overlay.id = 'ws-replaced-overlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.65); z-index: 99999;
      display: flex; align-items: center; justify-content: center;
      pointer-events: auto;
    `;
    overlay.innerHTML = `
      <div style="
        background: #1a1a2e; color: #e0e0e0; border-radius: 16px;
        padding: 32px 28px; max-width: 380px; text-align: center;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4); font-family: system-ui, sans-serif;
      ">
        <div style="font-size: 48px; margin-bottom: 12px;">🚫</div>
        <h2 style="margin: 0 0 8px; font-size: 18px; color: #ff6b6b;">Sessione Sostituita</h2>
        <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.5; color: #aaa;">
          Un'altra pagina ha preso il controllo.<br>
          Ricarica per riprendere la connessione.
        </p>
        <button onclick="location.reload()" style="
          background: #4a90d9; color: white; border: none; border-radius: 8px;
          padding: 12px 32px; font-size: 15px; cursor: pointer;
          font-weight: 600; transition: background 0.2s;
        " onmouseover="this.style.background='#5aa0e9'"
           onmouseout="this.style.background='#4a90d9'">Ricarica Pagina</button>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  function removeReplacedOverlay() {
    const overlay = document.getElementById('ws-replaced-overlay');
    if (overlay) overlay.remove();
  }

  return { setConfig, connect, send, close, onStatus, onMessage, onOpen, CONFIG };
})();

export { Socket };
