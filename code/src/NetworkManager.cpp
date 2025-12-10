#include "NetworkManager.hpp"
#include <HTTPClient.h>

NetworkManager::NetworkManager(StorageHandler& storage, QuickShifterEngine& qsEngine, LedController& led)
    : _storage(storage)
    , _qsEngine(qsEngine)
    , _led(led)
    , _state(State::INIT)
    , _server(80)
    , _ws("/ws")
    , _lastTelemetryUpdate(0)
    , _telemetryUpdateRate(100)
{
}

bool NetworkManager::begin() {
    // Generate hardware ID
    generateHardwareId();
    Serial.printf("[Network] Hardware ID: %s\n", _hardwareId.c_str());
    
    // Load network configuration
    StorageHandler::NetworkConfig netConfig;
    _storage.loadNetworkConfig(netConfig);
    
    // Load telemetry configuration
    StorageHandler::TelemetryConfig telConfig;
    _storage.loadTelemetryConfig(telConfig);
    _telemetryUpdateRate = telConfig.updateRateMs;
    
    // Setup WebSocket
    setupWebSocket();
    _server.addHandler(&_ws);
    
    // Setup HTTP routes
    setupHttpRoutes();
    
    // Start in appropriate mode
    if (netConfig.staMode && strlen(netConfig.ssid) > 0) {
        if (switchToStaMode(netConfig.ssid, netConfig.password)) {
            _state = State::STA_MODE;
            _led.setStatus(LedController::Status::WIFI_STA);
        } else {
            // Fall back to AP mode if STA fails
            switchToApMode();
        }
    } else {
        switchToApMode();
    }
    
    // Setup mDNS
    setupMdns();
    
    // Start server
    _server.begin();
    Serial.println("[Network] HTTP server started");
    
    return true;
}

void NetworkManager::update() {
    // Clean up WebSocket clients
    _ws.cleanupClients();
    
    // Broadcast telemetry at configured rate
    unsigned long currentMillis = millis();
    if (currentMillis - _lastTelemetryUpdate >= _telemetryUpdateRate) {
        _lastTelemetryUpdate = currentMillis;
        broadcastTelemetry();
    }
}

void NetworkManager::generateHardwareId() {
    uint8_t mac[6];
    WiFi.macAddress(mac);
    
    char hwid[16];
    snprintf(hwid, sizeof(hwid), "%02X%02X%02X%02X", 
             mac[2], mac[3], mac[4], mac[5]);
    _hardwareId = String(hwid);
}

void NetworkManager::switchToApMode() {
    WiFi.mode(WIFI_AP);

    IPAddress apIP(42, 42, 42, 42);
    IPAddress gateway(42, 42, 42, 42);
    IPAddress subnet(255, 255, 255, 0);
    
    // Configure AP with custom IP before starting
    WiFi.softAPConfig(apIP, gateway, subnet);
    
    StorageHandler::NetworkConfig netConfig;
    _storage.loadNetworkConfig(netConfig);
    
    bool success;
    if (strlen(netConfig.password) > 0) {
        success = WiFi.softAP(netConfig.ssid, netConfig.password);
    } else {
        success = WiFi.softAP(netConfig.ssid);
    }
    
    if (success) {
        Serial.printf("[Network] AP Mode: SSID=%s, IP=%s\n", 
                     netConfig.ssid, apIP.toString().c_str());
        
        _state = State::AP_MODE;
        _led.setStatus(LedController::Status::WIFI_AP);
    } else {
        Serial.println("[Network] Failed to start AP");
        _state = State::ERROR;
        _led.setStatus(LedController::Status::ERROR);
        _led.setBlinking(true);
    }
}

bool NetworkManager::switchToStaMode(const char* ssid, const char* password) {
    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid, password);
    
    Serial.printf("[Network] Connecting to %s...\n", ssid);
    
    // Wait up to 10 seconds for connection
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print(".");
        attempts++;
    }
    Serial.println();
    
    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("[Network] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
        _state = State::STA_MODE;
        _led.setStatus(LedController::Status::WIFI_STA);
        return true;
    } else {
        Serial.println("[Network] Failed to connect");
        return false;
    }
}

void NetworkManager::setupWebSocket() {
    _ws.onEvent([this](AsyncWebSocket* server, AsyncWebSocketClient* client,
                      AwsEventType type, void* arg, uint8_t* data, size_t len) {
        this->onWebSocketEvent(server, client, type, arg, data, len);
    });
}

void NetworkManager::onWebSocketEvent(AsyncWebSocket* server, AsyncWebSocketClient* client,
                                      AwsEventType type, void* arg, uint8_t* data, size_t len) {
    switch (type) {
        case WS_EVT_CONNECT:
            Serial.printf("[WebSocket] Client #%u connected\n", client->id());
            break;
            
        case WS_EVT_DISCONNECT:
            Serial.printf("[WebSocket] Client #%u disconnected\n", client->id());
            break;
            
        case WS_EVT_DATA: {
            AwsFrameInfo* info = (AwsFrameInfo*)arg;
            if (info->final && info->index == 0 && info->len == len && info->opcode == WS_TEXT) {
                data[len] = 0;  // Null terminate
                Serial.printf("[WebSocket] Received: %s\n", (char*)data);
                handleConfigUpdate((char*)data);
            }
            break;
        }
            
        case WS_EVT_ERROR:
            Serial.printf("[WebSocket] Error from client #%u\n", client->id());
            break;
            
        default:
            break;
    }
}

void NetworkManager::broadcastTelemetry() {
    if (_ws.count() == 0) return;  // No clients connected
    
    // Create telemetry JSON
    JsonDocument doc;
    doc["rpm"] = _qsEngine.getCurrentRpm();
    doc["signalActive"] = _qsEngine.isSignalActive();
    doc["cutActive"] = _qsEngine.isCutActive();
    doc["hwid"] = _hardwareId;
    doc["uptime"] = millis();
    
    String json;
    serializeJson(doc, json);
    
    _ws.textAll(json);
}

void NetworkManager::handleConfigUpdate(const char* jsonData) {
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, jsonData);
    
    if (error) {
        Serial.printf("[Network] JSON parse error: %s\n", error.c_str());
        return;
    }
    
    // Check message type
    const char* type = doc["type"];
    if (!type) return;
    
    if (strcmp(type, "config") == 0) {
        // Update QuickShifter configuration
        QuickShifterEngine::Config qsConfig = _qsEngine.getConfig();
        
        if (doc.containsKey("minRpm")) {
            qsConfig.minRpmThreshold = doc["minRpm"];
        }
        if (doc.containsKey("debounce")) {
            qsConfig.debounceTimeMs = doc["debounce"];
        }
        if (doc.containsKey("cutTimeMap")) {
            JsonArray arr = doc["cutTimeMap"];
            if (arr.size() == 11) {
                for (size_t i = 0; i < 11; i++) {
                    qsConfig.cutTimeMap[i] = arr[i];
                }
            }
        }
        
        _qsEngine.setConfig(qsConfig);
        _storage.saveQsConfig(qsConfig);
        
        Serial.println("[Network] QuickShifter config updated");
    }
    else if (strcmp(type, "network") == 0) {
        // Update network configuration
        StorageHandler::NetworkConfig netConfig;
        _storage.loadNetworkConfig(netConfig);
        
        // Update mode
        if (doc.containsKey("staMode")) {
            netConfig.staMode = doc["staMode"];
        }
        
        // Only update SSID/password if switching to STA mode or already in STA mode
        if (netConfig.staMode) {
            if (doc.containsKey("ssid")) {
                strlcpy(netConfig.ssid, doc["ssid"], sizeof(netConfig.ssid));
            }
            if (doc.containsKey("password")) {
                strlcpy(netConfig.password, doc["password"], sizeof(netConfig.password));
            }
        }
        // If switching to AP mode, keep existing AP credentials (default "rspqs")
        
        _storage.saveNetworkConfig(netConfig);
        Serial.printf("[Network] Network config updated - Mode: %s\n", netConfig.staMode ? "STA" : "AP");
        if (netConfig.staMode) {
            Serial.printf("[Network] Will connect to: %s\n", netConfig.ssid);
        }
        Serial.println("[Network] Reboot required for changes to take effect");
    }
    else if (strcmp(type, "telemetry") == 0) {
        // Update telemetry rate
        if (doc.containsKey("updateRate")) {
            _telemetryUpdateRate = doc["updateRate"];
            
            StorageHandler::TelemetryConfig telConfig;
            telConfig.updateRateMs = _telemetryUpdateRate;
            _storage.saveTelemetryConfig(telConfig);
            
            Serial.printf("[Network] Telemetry rate updated: %d ms\n", _telemetryUpdateRate);
        }
    }
    else if (strcmp(type, "ota") == 0) {
        // Trigger OTA update
        Serial.println("[Network] OTA update requested");
        startOtaUpdate();
    }
}

void NetworkManager::setupHttpRoutes() {
    // Serve main page
    _server.on("/", HTTP_GET, [this](AsyncWebServerRequest* request) {
        if (_storage.hasWebInterface()) {
            request->send(LittleFS, "/index.html", "text/html");
        } else {
            // Serve basic fallback page
            String html = "<!DOCTYPE html><html><head><title>QuickShifter</title></head>";
            html += "<body><h1>QuickShifter Control</h1>";
            html += "<p>Hardware ID: " + _hardwareId + "</p>";
            html += "<p>Status: Running</p>";
            html += "<p>Web interface not installed. Upload index.html to LittleFS.</p>";
            html += "</body></html>";
            request->send(200, "text/html", html);
        }
    });
    
    // Serve dashboard page
    _server.on("/dashboard.html", HTTP_GET, [this](AsyncWebServerRequest* request) {
        if (LittleFS.exists("/dashboard.html")) {
            request->send(LittleFS, "/dashboard.html", "text/html");
        } else {
            String html = "<!DOCTYPE html><html><head><title>Dashboard Not Found</title></head>";
            html += "<body style='background:#1a1a1a;color:#fff;font-family:sans-serif;padding:40px;text-align:center;'>";
            html += "<h1>Dashboard Not Found</h1>";
            html += "<p>The dashboard.html file is not uploaded to the filesystem.</p>";
            html += "<p><a href='/' style='color:#00ff88;'>Return to Main Page</a></p>";
            html += "</body></html>";
            request->send(404, "text/html", html);
        }
    });
    
    // Get current configuration
    _server.on("/api/config", HTTP_GET, [this](AsyncWebServerRequest* request) {
        JsonDocument doc;
        
        // QuickShifter config
        auto qsConfig = _qsEngine.getConfig();
        JsonObject qs = doc.createNestedObject("qs");
        qs["minRpm"] = qsConfig.minRpmThreshold;
        qs["debounce"] = qsConfig.debounceTimeMs;
        JsonArray cutTimeArray = qs.createNestedArray("cutTimeMap");
        for (const auto& cutTime : qsConfig.cutTimeMap) {
            cutTimeArray.add(cutTime);
        }
        
        // Network config (don't send password)
        StorageHandler::NetworkConfig netConfig;
        _storage.loadNetworkConfig(netConfig);
        JsonObject net = doc.createNestedObject("network");
        net["ssid"] = netConfig.ssid;
        net["staMode"] = netConfig.staMode;
        
        // Telemetry config
        JsonObject tel = doc.createNestedObject("telemetry");
        tel["updateRate"] = _telemetryUpdateRate;
        
        // System info
        doc["hwid"] = _hardwareId;
        doc["uptime"] = millis();
        
        // Error info
        if (_lastError.length() > 0) {
            doc["lastError"] = _lastError;
        }
        
        String json;
        serializeJson(doc, json);
        request->send(200, "application/json", json);
    });
    
    // Reboot endpoint
    _server.on("/api/reboot", HTTP_POST, [](AsyncWebServerRequest* request) {
        request->send(200, "text/plain", "Rebooting...");
        delay(1000);
        ESP.restart();
    });
    
    // 404 handler
    _server.onNotFound([this](AsyncWebServerRequest* request) {
        String path = request->url();
        
        // Try to serve file from LittleFS if it exists
        if (LittleFS.exists(path)) {
            String contentType = "text/plain";
            if (path.endsWith(".html")) contentType = "text/html";
            else if (path.endsWith(".css")) contentType = "text/css";
            else if (path.endsWith(".js")) contentType = "application/javascript";
            else if (path.endsWith(".json")) contentType = "application/json";
            else if (path.endsWith(".png")) contentType = "image/png";
            else if (path.endsWith(".jpg")) contentType = "image/jpeg";
            else if (path.endsWith(".ico")) contentType = "image/x-icon";
            
            request->send(LittleFS, path, contentType);
            return;
        }
        
        // Otherwise send 404 page
        String html = "<!DOCTYPE html><html><head><title>404 - Not Found</title>";
        html += "<meta name='viewport' content='width=device-width, initial-scale=1.0'></head>";
        html += "<body style='background:#1a1a1a;color:#fff;font-family:-apple-system,sans-serif;padding:40px;text-align:center;'>";
        html += "<h1 style='color:#ff4444;font-size:4em;margin:0;'>404</h1>";
        html += "<h2 style='color:#aaa;margin:20px 0;'>Page Not Found</h2>";
        html += "<p style='color:#888;margin:20px 0;'>The requested resource <code style='background:#2a2a2a;padding:5px;border-radius:3px;'>" + path + "</code> was not found.</p>";
        html += "<p style='margin-top:40px;'><a href='/' style='color:#00ff88;text-decoration:none;font-weight:bold;font-size:1.1em;'>← Back to Home</a></p>";
        html += "<p style='color:#555;margin-top:60px;font-size:0.9em;'>QuickShifter Control Panel | Hardware ID: " + _hardwareId + "</p>";
        html += "</body></html>";
        request->send(404, "text/html", html);
    });
}

void NetworkManager::startOtaUpdate() {
    _state = State::OTA_UPDATE;
    _led.setStatus(LedController::Status::OTA_UPDATE);
    
    // First, update firmware
    Serial.println("[Network] Starting firmware update...");
    bool firmwareSuccess = performOtaUpdate(true);
    
    if (!firmwareSuccess) {
        Serial.println("[Network] Firmware update failed, rebooting to AP mode...");
        _lastError = "Firmware update failed. Check firmware server and try again.";
        _led.setStatus(LedController::Status::ERROR);
        _led.setBlinking(true);
        delay(2000);
        ESP.restart();
        return;
    }
    
    Serial.println("[Network] Firmware update successful, starting filesystem update...");
    
    // Then, update filesystem
    bool filesystemSuccess = performOtaUpdate(false);
    
    if (filesystemSuccess) {
        Serial.println("[Network] Both updates successful, rebooting...");
        _lastError = "";  // Clear any previous error
        delay(1000);
        ESP.restart();
    } else {
        Serial.println("[Network] Filesystem update failed, but firmware was updated. Rebooting...");
        _lastError = "Filesystem update failed, but firmware is updated.";
        delay(1000);
        ESP.restart();
    }
}

bool NetworkManager::performOtaUpdate(bool updateFirmware) {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[Network] Not connected to WiFi");
        _lastError = "Not connected to WiFi";
        return false;
    }
    
    // Create secure WiFi client and HTTP client
    WiFiClientSecure wifiClient;
    HTTPClient httpClient;
    
    // Set SSL certificate for HTTPS
    wifiClient.setCACert(GITHUB_ROOT_CERT);
    
    // Begin HTTPS connection
    String url = String(OTA_UPDATE_URL);
    if (!updateFirmware) {
        // Change URL to filesystem.bin for filesystem update
        url.replace("firmware.bin", "filesystem.bin");
    }
    
    Serial.printf("[Network] Fetching %s update from: %s\n", 
                  updateFirmware ? "firmware" : "filesystem", url.c_str());
    
    httpClient.begin(wifiClient, url);
    httpClient.setTimeout(15000);  // 15 second timeout
    
    // Add security and functionality headers (not query parameters)
    httpClient.addHeader("hwid", _hardwareId);
    httpClient.addHeader("fwid", FIRMWARE_VERSION);
    httpClient.addHeader("fsid", FILESYSTEM_VERSION);
    httpClient.addHeader("device", "QuickShifter");
    httpClient.addHeader("platform", "ESP32-S2");
    httpClient.addHeader("mode", updateFirmware ? "firmware" : "filesystem");
    
    int httpCode = httpClient.GET();
    
    if (httpCode != HTTP_CODE_OK) {
        Serial.printf("[Network] HTTP GET failed: %d\n", httpCode);
        _lastError = "OTA failed: HTTP error " + String(httpCode);
        httpClient.end();
        return false;
    }
    
    int contentLength = httpClient.getSize();
    if (contentLength <= 0) {
        Serial.println("[Network] Invalid content length");
        _lastError = "OTA failed: Invalid " + String(updateFirmware ? "firmware" : "filesystem") + " file";
        httpClient.end();
        return false;
    }
    
    Serial.printf("[Network] %s size: %d bytes\n", 
                  updateFirmware ? "Firmware" : "Filesystem", contentLength);
    
    // Begin OTA update (firmware or filesystem)
    int updateType = updateFirmware ? U_FLASH : U_SPIFFS;
    if (!Update.begin(contentLength, updateType)) {
        Serial.printf("[Network] Not enough space for OTA: %s\n", Update.errorString());
        _lastError = "OTA failed: " + String(Update.errorString());
        httpClient.end();
        return false;
    }
    
    // Write firmware/filesystem
    WiFiClient* stream = httpClient.getStreamPtr();
    size_t written = Update.writeStream(*stream);
    
    if (written != contentLength) {
        Serial.printf("[Network] Written %d of %d bytes\n", written, contentLength);
        _lastError = "OTA failed: Incomplete write (" + String(written) + "/" + String(contentLength) + " bytes)";
        httpClient.end();
        return false;
    }
    
    // Finalize update
    if (!Update.end()) {
        Serial.printf("[Network] Update error: %s\n", Update.errorString());
        _lastError = "OTA failed: " + String(Update.errorString());
        httpClient.end();
        return false;
    }
    
    if (!Update.isFinished()) {
        Serial.println("[Network] Update not finished");
        _lastError = "OTA failed: Update incomplete";
        httpClient.end();
        return false;
    }
    
    httpClient.end();
    Serial.printf("[Network] %s OTA update completed successfully\n", 
                  updateFirmware ? "Firmware" : "Filesystem");
    return true;
}

void NetworkManager::setupMdns() {
    // Start mDNS with hostname "rspqs"
    if (MDNS.begin("rspqs")) {
        Serial.println("[Network] mDNS responder started at rspqs.local");
        
        // Add service to advertise HTTP server
        MDNS.addService("http", "tcp", 80);
        MDNS.addServiceTxt("http", "tcp", "hwid", _hardwareId.c_str());
        MDNS.addServiceTxt("http", "tcp", "device", "QuickShifter");
    } else {
        Serial.println("[Network] Failed to start mDNS responder");
    }
}
