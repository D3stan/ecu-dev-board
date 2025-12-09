#include "NetworkManager.hpp"
#include <HTTPClient.h>

NetworkManager::NetworkManager(StorageHandler& storage, QuickShifterEngine& qsEngine, LedController& led)
    : _storage(storage)
    , _qsEngine(qsEngine)
    , _led(led)
    , _state(State::INIT)
    , _server(80)
    , _ws("/ws")
    , _dnsServer(nullptr)
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
        Serial.println("[Network] Config requests STA mode");
        Serial.flush();
        
        if (switchToStaMode(netConfig.ssid, netConfig.password)) {
            _state = State::STA_MODE;
            _led.setStatus(LedController::Status::WIFI_STA);
        } else {
            // Fall back to AP mode if STA fails
            Serial.println("[Network] STA mode failed, falling back to AP");
            Serial.flush();
            switchToApMode();
        }
    } else {
        Serial.println("[Network] Config requests AP mode");
        Serial.flush();
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
    // Process DNS requests for captive portal
    if (_dnsServer) {
        _dnsServer->processNextRequest();
    }
    
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
    Serial.println("[Network] ========== AP MODE START ==========");
    Serial.flush();
    
    // Ensure clean state before switching modes
    WiFi.disconnect(true);
    delay(100);
    
    WiFi.mode(WIFI_AP);
    delay(100);  // Give WiFi time to switch modes
    
    Serial.println("[Network] WiFi mode set to AP");
    Serial.flush();

    IPAddress apIP(42, 42, 42, 42);
    IPAddress gateway(42, 42, 42, 42);
    IPAddress subnet(255, 255, 255, 0);
    
    // Configure AP with custom IP before starting
    WiFi.softAPConfig(apIP, gateway, subnet);
    
    StorageHandler::NetworkConfig netConfig;
    _storage.loadNetworkConfig(netConfig);
    
    Serial.printf("[Network] Starting AP mode with SSID: %s\n", netConfig.ssid);
    
    bool success;
    if (strlen(netConfig.password) > 0) {
        success = WiFi.softAP(netConfig.ssid, netConfig.password);
        Serial.printf("[Network] AP password length: %d\n", strlen(netConfig.password));
    } else {
        success = WiFi.softAP(netConfig.ssid);
        Serial.println("[Network] AP started without password (open network)");
    }
    
    if (success) {
        Serial.printf("[Network] AP Mode: SSID=%s, IP=%s\n", 
                     netConfig.ssid, apIP.toString().c_str());
        Serial.printf("[Network] Connect to '%s' and navigate to http://%s\n",
                     netConfig.ssid, apIP.toString().c_str());
        
        // Start DNS server for captive portal
        _dnsServer = new DNSServer();
        _dnsServer->start(53, "*", apIP);
        Serial.println("[Network] DNS Server started (Captive Portal enabled)");
        
        _state = State::AP_MODE;
        _led.setStatus(LedController::Status::WIFI_AP);
        _lastError = "";  // Clear any previous errors
    } else {
        Serial.println("[Network] CRITICAL: Failed to start AP mode!");
        Serial.flush();  // Ensure message is printed
        _lastError = "Failed to start AP mode";
        _state = State::ERROR;
        _led.setStatus(LedController::Status::ERROR);
        _led.setBlinking(true);
    }
}

bool NetworkManager::switchToStaMode(const char* ssid, const char* password) {
    Serial.println("[Network] ========== STA MODE START ==========");
    Serial.printf("[Network] SSID: %s\n", ssid);
    Serial.printf("[Network] Password length: %d\n", strlen(password));
    Serial.flush();
    
    // Ensure clean state before switching modes
    // Use disconnect(false) to keep credentials - we'll handle cleanup on failure
    WiFi.disconnect(false);
    delay(100);
    
    WiFi.mode(WIFI_STA);
    delay(100);
    
    Serial.println("[Network] Starting WiFi connection...");
    Serial.flush();
    
    WiFi.begin(ssid, password);
    delay(100);
    
    Serial.printf("[Network] Connecting to %s", ssid);
    Serial.flush();
    
    // Wait up to 15 seconds for connection with better feedback
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 30) {
        delay(500);
        Serial.print(".");
        if (attempts % 10 == 9) {
            Serial.printf(" [Status: %d]\n", WiFi.status());
        }
        Serial.flush();
        attempts++;
    }
    Serial.println();
    Serial.flush();
    
    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("[Network] ✓ Connected! IP: %s\n", WiFi.localIP().toString().c_str());
        Serial.printf("[Network] Gateway: %s\n", WiFi.gatewayIP().toString().c_str());
        Serial.printf("[Network] DNS: %s\n", WiFi.dnsIP().toString().c_str());
        Serial.flush();
        _state = State::STA_MODE;
        _led.setStatus(LedController::Status::WIFI_STA);
        _lastError = "";  // Clear any previous error
        return true;
    } else {
        Serial.println("[Network] ✗ Failed to connect to WiFi");
        Serial.printf("[Network] WiFi Status: %d\n", WiFi.status());
        Serial.flush();
        
        _lastError = "Failed to connect to WiFi: " + String(ssid);
        
        // Disconnect but keep credentials stored for next attempt
        // Use disconnect(false) to preserve the config
        WiFi.disconnect(false);
        delay(100);
        
        Serial.println("[Network] Will fall back to AP mode...");
        Serial.flush();
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
    
    // Create telemetry JSON with fixed buffer
    StaticJsonDocument<256> doc;
    doc["rpm"] = _qsEngine.getCurrentRpm();
    doc["signalActive"] = _qsEngine.isSignalActive();
    doc["cutActive"] = _qsEngine.isCutActive();
    doc["hwid"] = _hardwareId;
    doc["uptime"] = millis();
    
    // Check for overflow
    if (doc.overflowed()) {
        Serial.println("[Network] Telemetry JSON overflow");
        return;
    }
    
    char jsonBuffer[256];
    size_t jsonSize = serializeJson(doc, jsonBuffer, sizeof(jsonBuffer));
    
    if (jsonSize == 0 || jsonSize >= sizeof(jsonBuffer)) {
        Serial.println("[Network] Telemetry serialization failed");
        return;
    }
    
    _ws.textAll(jsonBuffer, jsonSize);
}

void NetworkManager::handleConfigUpdate(const char* jsonData) {
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, jsonData);
    
    if (error) {
        Serial.printf("[Network] JSON parse error: %s\n", error.c_str());
        return;
    }
    
    if (doc.overflowed()) {
        Serial.println("[Network] JSON document overflow");
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
        
        if (doc.containsKey("ssid")) {
            strlcpy(netConfig.ssid, doc["ssid"], sizeof(netConfig.ssid));
        }
        if (doc.containsKey("password")) {
            strlcpy(netConfig.password, doc["password"], sizeof(netConfig.password));
        }
        if (doc.containsKey("staMode")) {
            netConfig.staMode = doc["staMode"];
        }
        
        _storage.saveNetworkConfig(netConfig);
        Serial.println("[Network] Network config updated - reboot required");
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
    
    // Serve telemetry page
    _server.on("/telemetry.html", HTTP_GET, [this](AsyncWebServerRequest* request) {
        if (_storage.hasWebInterface()) {
            request->send(LittleFS, "/telemetry.html", "text/html");
        } else {
            request->send(404, "text/plain", "Telemetry page not found");
        }
    });
    
    // Get current configuration
    _server.on("/api/config", HTTP_GET, [this](AsyncWebServerRequest* request) {
        StaticJsonDocument<1024> doc;
        
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
        
        // Check for overflow
        if (doc.overflowed()) {
            request->send(500, "text/plain", "Config too large");
            return;
        }
        
        char jsonBuffer[1024];
        size_t jsonSize = serializeJson(doc, jsonBuffer, sizeof(jsonBuffer));
        
        if (jsonSize == 0 || jsonSize >= sizeof(jsonBuffer)) {
            request->send(500, "text/plain", "Serialization failed");
            return;
        }
        
        request->send(200, "application/json", jsonBuffer);
    });
    
    // Reboot endpoint
    _server.on("/api/reboot", HTTP_POST, [](AsyncWebServerRequest* request) {
        request->send(200, "text/plain", "Rebooting...");
        delay(1000);
        ESP.restart();
    });
    
    // Captive portal - redirect all other requests to main page
    _server.onNotFound([this](AsyncWebServerRequest* request) {
        // For captive portal, redirect to root
        if (request->host() != WiFi.softAPIP().toString()) {
            request->redirect("http://" + WiFi.softAPIP().toString());
        } else {
            // Serve main page for any unmatched route
            if (_storage.hasWebInterface()) {
                request->send(LittleFS, "/index.html", "text/html");
            } else {
                String html = "<!DOCTYPE html><html><head><title>QuickShifter</title></head>";
                html += "<body><h1>QuickShifter Control</h1>";
                html += "<p>Hardware ID: " + _hardwareId + "</p>";
                html += "<p>Access the main page at: http://" + WiFi.softAPIP().toString() + "</p>";
                html += "</body></html>";
                request->send(200, "text/html", html);
            }
        }
    });
}

void NetworkManager::startOtaUpdate() {
    _state = State::OTA_UPDATE;
    _led.setStatus(LedController::Status::OTA_UPDATE);
    
    // First, update firmware
    Serial.println("[Network] Starting firmware update...");
    Serial.flush();
    bool firmwareSuccess = performOtaUpdate(true);
    
    if (!firmwareSuccess) {
        Serial.println("[Network] Firmware update failed, rebooting to AP mode...");
        Serial.printf("[Network] Error: %s\n", _lastError.c_str());
        Serial.flush();  // Ensure error message is printed
        _lastError = "Firmware update failed. Check firmware server and try again.";
        _led.setStatus(LedController::Status::ERROR);
        _led.setBlinking(true);
        delay(3000);  // Give more time to read error
        ESP.restart();
        return;
    }
    
    Serial.println("[Network] Firmware update successful, starting filesystem update...");
    Serial.flush();
    
    // Then, update filesystem
    bool filesystemSuccess = performOtaUpdate(false);
    
    if (filesystemSuccess) {
        Serial.println("[Network] Both updates successful, rebooting...");
        Serial.flush();
        _lastError = "";  // Clear any previous error
        delay(1000);
        ESP.restart();
    } else {
        Serial.println("[Network] Filesystem update failed, but firmware was updated. Rebooting...");
        Serial.printf("[Network] Error: %s\n", _lastError.c_str());
        Serial.flush();
        _lastError = "Filesystem update failed, but firmware is updated.";
        delay(2000);
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
