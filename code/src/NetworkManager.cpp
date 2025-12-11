#include "NetworkManager.hpp"
#include <HTTPClient.h>
#include <HTTPUpdate.h>
#include <esp_ota_ops.h>
#include <esp_partition.h>

NetworkManager::NetworkManager(StorageHandler& storage, QuickShifterEngine& qsEngine, LedController& led)
    : _storage(storage)
    , _qsEngine(qsEngine)
    , _led(led)
    , _state(State::INIT)
    , _server(80)
    , _ws("/ws")
    , _lastTelemetryUpdate(0)
    , _telemetryUpdateRate(100)
    , _otaState(OTAState::IDLE)
    , _lastOtaError(OTAError::NONE)
    , _otaProgress(0)
    , _otaStartTime(0)
    , _lastProgressUpdate(0)
    , _totalSize(0)
    , _writtenSize(0)
    , _updateInProgress(false)
{
}

bool NetworkManager::begin() {
    // Generate hardware ID
    generateHardwareId();
    
    
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
    if (netConfig.staMode && strlen(netConfig.staSsid) > 0) {
        if (switchToStaMode(netConfig.staSsid, netConfig.staPassword)) {
            _state = State::STA_MODE;
            _led.setStatus(LedController::Status::WIFI_STA);
        }
    } else {
        
        
        switchToApMode();
    }
    
    // Setup mDNS
    setupMdns();
    
    // Start server
    _server.begin();
    
    
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
    
    
    
    // Ensure clean state before switching modes
    WiFi.disconnect(true);
    delay(100);
    
    WiFi.mode(WIFI_AP);
    delay(100);  // Give WiFi time to switch modes
    
    
    

    IPAddress apIP(42, 42, 42, 42);
    IPAddress gateway(42, 42, 42, 42);
    IPAddress subnet(255, 255, 255, 0);
    
    // Configure AP with custom IP before starting
    WiFi.softAPConfig(apIP, gateway, subnet);
    
    StorageHandler::NetworkConfig netConfig;
    _storage.loadNetworkConfig(netConfig);
    
    
    
    bool success;
    if (strlen(netConfig.apPassword) > 0) {
        success = WiFi.softAP(netConfig.apSsid, netConfig.apPassword);
    } else {
        success = WiFi.softAP(netConfig.apSsid);
    }
    
    if (success) {
        Serial.printf("[Network] AP Mode: SSID=%s, IP=%s\n", 
                     netConfig.apSsid, apIP.toString().c_str());
        
        _state = State::AP_MODE;
        _led.setStatus(LedController::Status::WIFI_AP);
        _lastError = "";  // Clear any previous errors
    } else {
        
          // Ensure message is printed
        _lastError = "Failed to start AP mode";
        _state = State::ERROR;
        _led.setStatus(LedController::Status::ERROR);
        _led.setBlinking(true);
    }
}

bool NetworkManager::switchToStaMode(const char* ssid, const char* password) {
    
    
    
    
    
    // Ensure clean state before switching modes
    // Use disconnect(false) to keep credentials - we'll handle cleanup on failure
    WiFi.disconnect(false);
    delay(100);
    
    WiFi.mode(WIFI_STA);
    delay(100);
    
    
    
    
    WiFi.begin(ssid, password);
    delay(100);
    
    
    
    
    // First attempt: Wait up to 5 seconds for connection
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 10) {
        delay(500);
        
        if (attempts % 10 == 9) {
            
        }
        
        attempts++;
    }
    
    
    
    if (WiFi.status() == WL_CONNECTED) {
        
        
        
        
        _state = State::STA_MODE;
        _led.setStatus(LedController::Status::WIFI_STA);
        
        // Clear any previous error
        StorageHandler::NetworkConfig netConfig;
        _storage.loadNetworkConfig(netConfig);
        if (strlen(netConfig.lastError) > 0) {
            netConfig.lastError[0] = '\0';
            _storage.saveNetworkConfig(netConfig);
        }
        _lastError = "";
        
        return true;
    }
    
    // First attempt failed, try one more time with 5s timeout
    
    WiFi.disconnect();
    delay(1000);
    WiFi.begin(ssid, password);
    
    attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 10) {
        delay(500);
        
        attempts++;
    }
    
    
    if (WiFi.status() == WL_CONNECTED) {
        
        _state = State::STA_MODE;
        _led.setStatus(LedController::Status::WIFI_STA);
        
        // Clear any previous error
        StorageHandler::NetworkConfig netConfig;
        _storage.loadNetworkConfig(netConfig);
        if (strlen(netConfig.lastError) > 0) {
            netConfig.lastError[0] = '\0';
            _storage.saveNetworkConfig(netConfig);
        }
        _lastError = "";
        
        return true;
    }
    
    // Both attempts failed - save error and switch to AP mode
    
    
    String errorMsg = "Failed to connect to WiFi network '";
    errorMsg += ssid;
    errorMsg += "'. Check SSID and password.";
    _lastError = errorMsg;
    
    // Save error to persistent storage
    StorageHandler::NetworkConfig netConfig;
    _storage.loadNetworkConfig(netConfig);
    strlcpy(netConfig.lastError, errorMsg.c_str(), sizeof(netConfig.lastError));
    _storage.saveNetworkConfig(netConfig);
    
    
    WiFi.disconnect();
    delay(500);
    switchToApMode();
    
    return false;
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
            
            break;
            
        case WS_EVT_DISCONNECT:
            
            break;
            
        case WS_EVT_DATA: {
            AwsFrameInfo* info = (AwsFrameInfo*)arg;
            if (info->final && info->index == 0 && info->len == len && info->opcode == WS_TEXT) {
                data[len] = 0;  // Null terminate
                
                handleConfigUpdate((char*)data);
            }
            break;
        }
            
        case WS_EVT_ERROR:
            
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
    doc["uptime"] = millis();
    
    // Check for overflow
    if (doc.overflowed()) {
        doc.clear();
        return;
    }
    
    char jsonBuffer[256];
    size_t jsonSize = serializeJson(doc, jsonBuffer, sizeof(jsonBuffer));
    
    if (jsonSize == 0 || jsonSize >= sizeof(jsonBuffer)) {
        doc.clear();
        return;
    }
    
    _ws.textAll(jsonBuffer, jsonSize);
    doc.clear();
}

void NetworkManager::handleConfigUpdate(const char* jsonData) {
    // Use StaticJsonDocument with sufficient buffer size to avoid heap fragmentation
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, jsonData);
    
    if (error) {
        
        return;
    }
    
    // Check for overflow
    if (doc.overflowed()) {
        doc.clear();
        return;
    }


    // Load current configuration once
    StorageHandler::SystemConfig sysConfig;
    _storage.loadConfig(sysConfig);
    bool configChanged = false;
    
    // Update QuickShifter configuration
    if (doc.containsKey("qs")) {
        JsonObject qs = doc["qs"];
        
        if (qs.containsKey("minRpm")) {
            sysConfig.qsConfig.minRpmThreshold = qs["minRpm"];
            configChanged = true;
        }
        if (qs.containsKey("debounce")) {
            sysConfig.qsConfig.debounceTimeMs = qs["debounce"];
            configChanged = true;
        }
        if (qs.containsKey("cutTimeMap")) {
            JsonArray arr = qs["cutTimeMap"];
            if (arr.size() == 11) {
                for (size_t i = 0; i < 11; i++) {
                    sysConfig.qsConfig.cutTimeMap[i] = arr[i];
                }
                configChanged = true;
            }
        }
        
        if (configChanged) {
            _qsEngine.setConfig(sysConfig.qsConfig);
            
        }
    }
    
    // Update network configuration
    if (doc.containsKey("network")) {
        JsonObject net = doc["network"];
        
        // Update mode
        if (net.containsKey("staMode")) {
            sysConfig.networkConfig.staMode = net["staMode"];
            configChanged = true;
        }
        
        // Update AP credentials
        if (net.containsKey("apSsid")) {
            const char* apSsid = net["apSsid"];
            if (apSsid) {
                strlcpy(sysConfig.networkConfig.apSsid, apSsid, sizeof(sysConfig.networkConfig.apSsid));
                
                configChanged = true;
            }
        }
        if (net.containsKey("apPassword")) {
            const char* apPassword = net["apPassword"];
            if (apPassword) {
                strlcpy(sysConfig.networkConfig.apPassword, apPassword, sizeof(sysConfig.networkConfig.apPassword));
                
                configChanged = true;
            }
        }
        
        // Update STA credentials
        if (net.containsKey("staSsid")) {
            const char* staSsid = net["staSsid"];
            if (staSsid) {
                strlcpy(sysConfig.networkConfig.staSsid, staSsid, sizeof(sysConfig.networkConfig.staSsid));
                
                configChanged = true;
            }
        }
        if (net.containsKey("staPassword")) {
            const char* staPassword = net["staPassword"];
            if (staPassword) {
                strlcpy(sysConfig.networkConfig.staPassword, staPassword, sizeof(sysConfig.networkConfig.staPassword));
                
                configChanged = true;
            }
        }
        
        if (doc.containsKey("network")) {
            
            if (sysConfig.networkConfig.staMode) {
                
            } else {
                
            }
            
        }
    }
    
    // Update telemetry configuration
    if (doc.containsKey("telemetry")) {
        JsonObject tel = doc["telemetry"];
        if (tel.containsKey("updateRate")) {
            _telemetryUpdateRate = tel["updateRate"];
            sysConfig.telemetryConfig.updateRateMs = _telemetryUpdateRate;
            configChanged = true;
            
            
        }
    }
    
    // Save all changes in a single write operation
    if (configChanged) {
        _storage.saveConfig(sysConfig);
        
    }
    
    // Check for OTA trigger (legacy support for simple trigger message)
    if (doc.containsKey("ota") && doc["ota"].as<bool>() == true) {
        doc.clear();
        startOtaUpdate();
    }
    doc.clear();

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
        
        // Network config (include passwords for owner access)
        StorageHandler::NetworkConfig netConfig;
        _storage.loadNetworkConfig(netConfig);
        JsonObject net = doc.createNestedObject("network");
        net["apSsid"] = String(netConfig.apSsid);
        net["apPassword"] = String(netConfig.apPassword);
        net["staSsid"] = String(netConfig.staSsid);
        net["staPassword"] = String(netConfig.staPassword);
        net["staMode"] = netConfig.staMode;
        
        // Include stored error if present
        if (strlen(netConfig.lastError) > 0) {
            net["lastError"] = String(netConfig.lastError);
        }
        
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
            doc.clear();
            return;
        }
        
        char jsonBuffer[1024];
        size_t jsonSize = serializeJson(doc, jsonBuffer, sizeof(jsonBuffer));
        
        if (jsonSize == 0 || jsonSize >= sizeof(jsonBuffer)) {
            request->send(500, "text/plain", "Serialization failed");
            doc.clear();
            return;
        }

        doc.clear();
        request->send(200, "application/json", jsonBuffer);
    });
    
    // Reboot endpoint
    _server.on("/api/reboot", HTTP_POST, [](AsyncWebServerRequest* request) {
        request->send(200, "text/plain", "Rebooting...");
        delay(1000);
        ESP.restart();
    });
    
    // Clear error endpoint
    _server.on("/api/clearError", HTTP_POST, [this](AsyncWebServerRequest* request) {
        StorageHandler::NetworkConfig netConfig;
        _storage.loadNetworkConfig(netConfig);
        netConfig.lastError[0] = '\0';
        _storage.saveNetworkConfig(netConfig);
        _lastError = "";
        
        request->send(200, "text/plain", "Error cleared");
    });
    
    // OTA endpoints
    _server.on("/ota", HTTP_GET, [this](AsyncWebServerRequest* request) {
        handleOTAPage(request);
    });
    
    _server.on("/api/ota/info", HTTP_GET, [this](AsyncWebServerRequest* request) {
        handleOTAInfo(request);
    });
    
    _server.on("/api/ota/url", HTTP_POST, [this](AsyncWebServerRequest* request) {
        handleOTAURL(request);
    });
    
    _server.on("/api/ota/status", HTTP_GET, [this](AsyncWebServerRequest* request) {
        handleOTAStatus(request);
    });
    
    _server.on("/api/ota/rollback", HTTP_POST, [this](AsyncWebServerRequest* request) {
        handleOTARollback(request);
    });
    
    // Upload handler with data callback
    _server.on("/api/ota/upload", HTTP_POST,
        [this](AsyncWebServerRequest* request) {
            handleOTAUpload(request);
        },
        [this](AsyncWebServerRequest* request, String filename, size_t index, uint8_t* data, size_t len, bool final) {
            handleOTAUploadData(request, filename, index, data, len, final);
        }
    );
    
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
    _ws.closeAll();           // Close all WebSocket connections
    _ws.cleanupClients();     // Clean up WebSocket clients
    _server.end();            // Stop the web server
    
    // Give time for connections to close
    delay(500);

    Serial.printf("[OTA] Free heap: %d bytes\n", ESP.getFreeHeap());
    const esp_partition_t* partition = esp_ota_get_next_update_partition(nullptr);
    Serial.printf("[OTA] OTA Partition size: %u bytes\n", partition->size);
    
    bool firmwareSuccess = performOtaUpdate(true);
    
    if (!firmwareSuccess) {
        
        
          // Ensure error message is printed
        _lastError = "Firmware update failed. Check firmware server and try again.";
        StorageHandler::NetworkConfig netConfig;
        _storage.loadNetworkConfig(netConfig);
        strlcpy(netConfig.lastError, _lastError.c_str(), sizeof(netConfig.lastError));
        _storage.saveNetworkConfig(netConfig);
        _led.setStatus(LedController::Status::ERROR);
        _led.setBlinking(true);
        delay(3000);  // Give more time to read error
        ESP.restart();
        return;
    }
    
    
    
    
    // Then, update filesystem
    bool filesystemSuccess = performOtaUpdate(false);
    
    if (filesystemSuccess) {
        
        
        _lastError = "";  // Clear any previous error
        delay(1000);
        ESP.restart();
    } else {
        
        
        
        _lastError = "Filesystem update failed, but firmware is updated.";
                StorageHandler::NetworkConfig netConfig;
        _storage.loadNetworkConfig(netConfig);
        strlcpy(netConfig.lastError, _lastError.c_str(), sizeof(netConfig.lastError));
        _storage.saveNetworkConfig(netConfig);
        
        delay(2000);
        ESP.restart();
    }
}

void update_started() {
    Serial.println("CALLBACK:  HTTP update process started");
}

void update_finished() {
    Serial.println("CALLBACK:  HTTP update process finished");
    // set led to solid on to indicate completion
}

void update_progress(int cur, int total) {
    Serial.printf("CALLBACK:  HTTP update process at %d of %d bytes...\n", cur, total);
    // blink led to show progress
}

void update_error(int err) {
    Serial.printf("CALLBACK:  HTTP update fatal error code %d\n", err);
    // set led to error state
}

bool NetworkManager::performOtaUpdate(bool updateFirmware) {
    if (WiFi.status() != WL_CONNECTED) {
        
        _lastError = "Not connected to WiFi";
        return false;
    }

    // http client created outside from the HTTPupdate request so
    // we can add custom headers
    WiFiClientSecure wifiClient;
    HTTPClient httpClient;

    // wifiClient.setCACert(GITHUB_ROOT_CERT);
    wifiClient.setInsecure(); // Temporary for testing - replace with proper cert validation
    // HTTPupdate class does this automatically if we pass the wificlient
    // in this case we are passing it the http client so
    // we have to manually begin the req
    httpClient.begin(wifiClient, "https://test.rsp-industries.com/firmware.bin");  // Start connection to the server
    httpClient.setTimeout(30000);

    // Add security headers
    httpClient.addHeader("hwid", _hardwareId);     // HTTPupdate class adds ESP.getChipId() in the x-ESP8266-Chip-ID header

    // Add functionality headers
    // httpClient.addHeader("fwid", config.fw_version);
    // httpClient.addHeader("fsid", config.fs_version);
    // httpClient.addHeader("device", device);
    // httpClient.addHeader("platform", platform);
    // httpClient.addHeader("mode", firstTime ? "firmware" : "filesystem");
    
    HTTPUpdate myESPhttpUpdate;
    
    // Needed to follow redirects for GitHub releases
    myESPhttpUpdate.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
    // Remove automatic reboot
    myESPhttpUpdate.rebootOnUpdate(false);
    // Add optional led flashing
    myESPhttpUpdate.setLedPin(LED_BUILTIN, LOW);

    // Add optional callback notifiers
    myESPhttpUpdate.onStart(update_started);
    myESPhttpUpdate.onEnd(update_finished);
    myESPhttpUpdate.onProgress(update_progress);
    myESPhttpUpdate.onError(update_error);
    
    Serial.println("Starting update from: " + String(OTA_UPDATE_URL));
    t_httpUpdate_return ret = updateFirmware ? myESPhttpUpdate.update(httpClient) : myESPhttpUpdate.updateSpiffs(httpClient);
    Serial.println("Update process returned: " + String(ret));
    

    if (ret == HTTP_UPDATE_FAILED) {
        Serial.printf("HTTP_UPDATE_FAILED Error (%d): %s\n", myESPhttpUpdate.getLastError(), myESPhttpUpdate.getLastErrorString().c_str());
        // char err[100];
        // sprintf(err, "Update Failed: %s", myESPhttpUpdate.getLastErrorString().c_str());
        // _lastError = err;
        // _state = State::AP_MODE;
        // saveConfiguration(config_file_path, config);
        // delay(1500);
        // ESP.restart();
        return false;

    } else {
        if (ret == HTTP_UPDATE_NO_UPDATES) {
            Serial.println("No updates available");
            return false;
        } else {
            Serial.printf("Update %s successfully", updateFirmware ? "firmware" : "filesystem");
        }

        // if (firstTime) {
        //     httpClient.end();
        //     wifiClient.stop();
        //     checkForUpdate(false);
        // }
        // else {
        //     config.wifiMode = WIFI_AP;
        //     saveConfiguration(config_file_path, config);
        //     delay(1500);
        //     ESP.restart();
        // }
    }

    
    // // Create secure WiFi client and HTTP client
    // WiFiClientSecure wifiClient;
    // HTTPClient httpClient;
    
    // // Set SSL certificate for HTTPS
    // wifiClient.setCACert(GITHUB_ROOT_CERT);
    
    // // Begin HTTPS connection
    // String url = String(OTA_UPDATE_URL);
    // if (!updateFirmware) {
    //     // Change URL to filesystem.bin for filesystem update
    //     url.replace("firmware.bin", "littlefs.bin");
    // }
    
    // Serial.printf("[Network] Fetching %s update from: %s\n", 
    //               updateFirmware ? "firmware" : "filesystem", url.c_str());
    
    // httpClient.begin(wifiClient, url);
    // httpClient.setTimeout(15000);  // 15 second timeout
    
    // // Add security and functionality headers (not query parameters)
    // httpClient.addHeader("hwid", _hardwareId);
    // httpClient.addHeader("fwid", FIRMWARE_VERSION);
    // httpClient.addHeader("fsid", FILESYSTEM_VERSION);
    // httpClient.addHeader("device", "QuickShifter");
    // httpClient.addHeader("platform", "ESP32-S2");
    // httpClient.addHeader("mode", updateFirmware ? "firmware" : "filesystem");
    
    // int httpCode = httpClient.GET();
    
    // if (httpCode != HTTP_CODE_OK) {
        
    //     _lastError = "OTA failed: HTTP error " + String(httpCode);
    //     httpClient.end();
    //     return false;
    // }
    
    // int contentLength = httpClient.getSize();
    // if (contentLength <= 0) {
        
    //     _lastError = "OTA failed: Invalid " + String(updateFirmware ? "firmware" : "filesystem") + " file";
    //     httpClient.end();
    //     return false;
    // }
    
    // Serial.printf("[Network] %s size: %d bytes\n", 
    //               updateFirmware ? "Firmware" : "Filesystem", contentLength);
    
    // // Begin OTA update (firmware or filesystem)
    // int updateType = updateFirmware ? U_FLASH : U_SPIFFS;
    // if (!Update.begin(contentLength, updateType)) {
        
    //     _lastError = "OTA failed: " + String(Update.errorString());
    //     httpClient.end();
    //     return false;
    // }
    
    // // Write firmware/filesystem
    // WiFiClient* stream = httpClient.getStreamPtr();
    // size_t written = Update.writeStream(*stream);
    
    // if (written != contentLength) {
        
    //     _lastError = "OTA failed: Incomplete write (" + String(written) + "/" + String(contentLength) + " bytes)";
    //     httpClient.end();
    //     return false;
    // }
    
    // // Finalize update
    // if (!Update.end()) {
        
    //     _lastError = "OTA failed: " + String(Update.errorString());
    //     httpClient.end();
    //     return false;
    // }
    
    // if (!Update.isFinished()) {
        
    //     _lastError = "OTA failed: Update incomplete";
    //     httpClient.end();
    //     return false;
    // }
    
    // httpClient.end();
    // Serial.printf("[Network] %s OTA update completed successfully\n", 
    //               updateFirmware ? "Firmware" : "Filesystem");
    return true;
}

void NetworkManager::setupMdns() {
    // Start mDNS with hostname "rspqs"
    if (MDNS.begin("rspqs")) {
        
        
        // Add service to advertise HTTP server
        MDNS.addService("http", "tcp", 80);
        MDNS.addServiceTxt("http", "tcp", "hwid", _hardwareId.c_str());
        MDNS.addServiceTxt("http", "tcp", "device", "QuickShifter");
    } else {
        
    }
}

// OTA utility functions
bool NetworkManager::validateURL(const String& url) {
    if (url.length() == 0) {
        return false;
    }
    
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
        return false;
    }
    
    if (!url.endsWith(".bin")) {
        return false;
    }
    
    return true;
}

bool NetworkManager::checkSpace(size_t requiredSize) {
    size_t available = getAvailableSpace();
    
    if (requiredSize > available) {
        Serial.printf("[OTA] Insufficient space: required=%d, available=%d\n", 
                      requiredSize, available);
        return false;
    }
    
    return true;
}

bool NetworkManager::beginOTA(size_t size, int type) {
    Serial.printf("[OTA] Beginning OTA update (type=%d)...\n", type);
    
    if (!Update.begin(size, type)) {
        Serial.printf("[OTA] Begin failed: %s\n", Update.errorString());
        return false;
    }
    
    setOTAState(OTAState::WRITING);
    return true;
}

bool NetworkManager::writeOTA(uint8_t* data, size_t len) {
    size_t written = Update.write(data, len);
    
    if (written != len) {
        Serial.printf("[OTA] Write failed: written=%d, expected=%d\n", written, len);
        Serial.printf("[OTA] Error: %s\n", Update.errorString());
        return false;
    }
    
    _writtenSize += written;
    return true;
}

bool NetworkManager::endOTA() {
    Serial.println("[OTA] Finalizing OTA update...");
    
    if (!Update.end(true)) {
        Serial.printf("[OTA] End failed: %s\n", Update.errorString());
        return false;
    }
    
    Serial.println("[OTA] OTA update finalized successfully");
    return true;
}

void NetworkManager::setOTAState(OTAState state) {
    _otaState = state;
    Serial.printf("[OTA] State changed: %s\n", getOTAStateString());
}

void NetworkManager::setOTAError(OTAError error) {
    _lastOtaError = error;
    _otaState = OTAState::ERROR;
    Serial.printf("[OTA] Error: %s\n", getOTAErrorString().c_str());
}

void NetworkManager::updateOTAProgress(size_t current, size_t total) {
    if (total == 0) {
        _otaProgress = 0;
        return;
    }
    
    _otaProgress = (current * 100) / total;
    
    // Log progress every second
    unsigned long now = millis();
    if (now - _lastProgressUpdate > 1000) {
        Serial.printf("[OTA] Progress: %d%% (%d / %d bytes)\n", _otaProgress, current, total);
        _lastProgressUpdate = now;
    }
}

const char* NetworkManager::getOTAStateString() const {
    switch (_otaState) {
        case OTAState::IDLE:        return "IDLE";
        case OTAState::CONNECTING:  return "CONNECTING";
        case OTAState::DOWNLOADING: return "DOWNLOADING";
        case OTAState::UPLOADING:   return "UPLOADING";
        case OTAState::WRITING:     return "WRITING";
        case OTAState::VERIFYING:   return "VERIFYING";
        case OTAState::REBOOTING:   return "REBOOTING";
        case OTAState::SUCCESS:     return "SUCCESS";
        case OTAState::ERROR:       return "ERROR";
        default:                    return "UNKNOWN";
    }
}

String NetworkManager::getOTAErrorString() const {
    return String(otaErrorToString(_lastOtaError));
}

const char* NetworkManager::otaErrorToString(OTAError error) const {
    switch (error) {
        case OTAError::NONE:                return "No error";
        case OTAError::CONNECTION_REFUSED:  return "Connection refused";
        case OTAError::TIMEOUT:             return "Timeout";
        case OTAError::DNS_FAILED:          return "DNS resolution failed";
        case OTAError::SSL_FAILED:          return "SSL/TLS error";
        case OTAError::HTTP_404:            return "File not found (HTTP 404)";
        case OTAError::HTTP_500:            return "Server error (HTTP 5xx)";
        case OTAError::INVALID_RESPONSE:    return "Invalid HTTP response";
        case OTAError::FILE_TOO_LARGE:      return "File too large";
        case OTAError::PARTITION_NOT_FOUND: return "OTA partition not found";
        case OTAError::FLASH_WRITE_FAILED:  return "Flash write failed";
        case OTAError::FLASH_VERIFY_FAILED: return "Flash verification failed";
        case OTAError::INSUFFICIENT_SPACE:  return "Insufficient space";
        case OTAError::OTA_BEGIN_FAILED:    return "OTA begin failed";
        case OTAError::OTA_END_FAILED:      return "OTA end failed";
        case OTAError::ROLLBACK_FAILED:     return "Rollback failed";
        case OTAError::INVALID_URL:         return "Invalid URL";
        case OTAError::INVALID_FILE:        return "Invalid file";
        case OTAError::UNKNOWN:             return "Unknown error";
        default:                            return "Undefined error";
    }
}

String NetworkManager::getCurrentPartition() const {
    const esp_partition_t* partition = esp_ota_get_running_partition();
    
    if (!partition) {
        return "unknown";
    }
    
    if (partition->subtype == ESP_PARTITION_SUBTYPE_APP_OTA_0) {
        return "OTA_0";
    } else if (partition->subtype == ESP_PARTITION_SUBTYPE_APP_OTA_1) {
        return "OTA_1";
    } else if (partition->subtype == ESP_PARTITION_SUBTYPE_APP_FACTORY) {
        return "factory";
    }
    
    return String(partition->label);
}

size_t NetworkManager::getAvailableSpace() const {
    const esp_partition_t* partition = esp_ota_get_next_update_partition(nullptr);
    
    if (!partition) {
        return 0;
    }
    
    return partition->size;
}

size_t NetworkManager::getMaxFirmwareSize() const {
    return getAvailableSpace();
}

bool NetworkManager::canRollback() const {
    const esp_partition_t* partition = esp_ota_get_last_invalid_partition();
    return (partition != nullptr);
}

bool NetworkManager::rollback() {
    Serial.println("[OTA] Performing manual rollback...");
    
    const esp_partition_t* partition = esp_ota_get_last_invalid_partition();
    
    if (!partition) {
        Serial.println("[OTA] No partition available for rollback");
        setOTAError(OTAError::ROLLBACK_FAILED);
        return false;
    }
    
    esp_err_t err = esp_ota_set_boot_partition(partition);
    
    if (err != ESP_OK) {
        Serial.printf("[OTA] Rollback failed: %d\n", err);
        setOTAError(OTAError::ROLLBACK_FAILED);
        return false;
    }
    
    Serial.println("[OTA] Rollback successful, rebooting...");
    delay(1000);
    ESP.restart();
    
    return true;
}

String NetworkManager::getPartitionInfo() const {
    String info = "{";
    
    const esp_partition_t* running = esp_ota_get_running_partition();
    const esp_partition_t* next = esp_ota_get_next_update_partition(nullptr);
    
    info += "\"current\":\"" + getCurrentPartition() + "\",";
    info += "\"current_size\":" + String(running ? running->size : 0) + ",";
    info += "\"next\":\"" + String(next ? next->label : "none") + "\",";
    info += "\"next_size\":" + String(next ? next->size : 0) + ",";
    info += "\"max_firmware_size\":" + String(getMaxFirmwareSize()) + ",";
    info += "\"can_rollback\":" + String(canRollback() ? "true" : "false");
    
    info += "}";
    return info;
}

// OTA HTTP Handlers
void NetworkManager::handleOTAPage(AsyncWebServerRequest* request) {
    if (LittleFS.exists("/ota.html")) {
        request->send(LittleFS, "/ota.html", "text/html");
    } else {
        String html = "<!DOCTYPE html><html><head><title>OTA Update</title>";
        html += "<meta name='viewport' content='width=device-width, initial-scale=1.0'></head>";
        html += "<body style='background:#1a1a1a;color:#fff;font-family:sans-serif;padding:40px;'>";
        html += "<h1>OTA Update</h1>";
        html += "<p>OTA page not installed. Please upload ota.html to filesystem.</p>";
        html += "<p><a href='/' style='color:#00ff88;'>Back to Home</a></p>";
        html += "</body></html>";
        request->send(200, "text/html", html);
    }
}

void NetworkManager::handleOTAInfo(AsyncWebServerRequest* request) {
    String json = "{";
    json += "\"current_partition\":\"" + getCurrentPartition() + "\",";
    json += "\"available_space\":" + String(getAvailableSpace()) + ",";
    json += "\"max_firmware_size\":" + String(getMaxFirmwareSize()) + ",";
    json += "\"can_rollback\":" + String(canRollback() ? "true" : "false") + ",";
    json += "\"state\":\"" + String(getOTAStateString()) + "\",";
    json += "\"progress\":" + String(_otaProgress);
    json += "}";
    
    request->send(200, "application/json", json);
}

void NetworkManager::handleOTAURL(AsyncWebServerRequest* request) {
    if (!request->hasParam("url", true)) {
        request->send(400, "application/json", "{\"success\":false,\"message\":\"Missing URL parameter\"}");
        return;
    }
    
    String url = request->getParam("url", true)->value();
    
    if (!validateURL(url)) {
        request->send(400, "application/json", "{\"success\":false,\"message\":\"Invalid URL format\"}");
        return;
    }
    
    request->send(200, "application/json", "{\"success\":true,\"message\":\"Update started\"}");
    
    // Start update in background
    // Note: This is a simplified version - in production you'd want to handle this asynchronously
    delay(100);
    startOtaUpdate();
}

void NetworkManager::handleOTAStatus(AsyncWebServerRequest* request) {
    String json = "{";
    json += "\"state\":\"" + String(getOTAStateString()) + "\",";
    json += "\"progress\":" + String(_otaProgress) + ",";
    json += "\"error\":\"" + getOTAErrorString() + "\"";
    json += "}";
    
    request->send(200, "application/json", json);
}

void NetworkManager::handleOTARollback(AsyncWebServerRequest* request) {
    if (!canRollback()) {
        request->send(400, "application/json", "{\"success\":false,\"message\":\"Rollback not available\"}");
        return;
    }
    
    request->send(200, "application/json", "{\"success\":true,\"message\":\"Rollback initiated\"}");
    
    delay(100);
    rollback();
}

void NetworkManager::handleOTAUpload(AsyncWebServerRequest* request) {
    // This is called after upload completes
    if (Update.hasError()) {
        String error = "{\"success\":false,\"message\":\"" + String(Update.errorString()) + "\"}";
        request->send(500, "application/json", error);
        setOTAState(OTAState::ERROR);
        setOTAError(OTAError::FLASH_WRITE_FAILED);
        _updateInProgress = false;
    } else {
        request->send(200, "application/json", "{\"success\":true,\"message\":\"Update successful\"}");
        setOTAState(OTAState::SUCCESS);
        _updateInProgress = false;
        
        Serial.println("[OTA] Upload successful! Rebooting in 3 seconds...");
        delay(3000);
        ESP.restart();
    }
}

void NetworkManager::handleOTAUploadData(AsyncWebServerRequest* request, String filename, 
                                         size_t index, uint8_t* data, size_t len, bool final) {
    if (index == 0) {
        Serial.printf("[OTA] Upload started: %s\n", filename.c_str());
        
        _updateInProgress = true;
        _otaStartTime = millis();
        _writtenSize = 0;
        _totalSize = 0;
        _otaProgress = 0;
        
        // Determine update type from filename
        int updateType = U_FLASH;
        if (filename.indexOf("littlefs") >= 0 || filename.indexOf("spiffs") >= 0 || 
            filename.indexOf("filesystem") >= 0) {
            updateType = U_SPIFFS;
            Serial.println("[OTA] Filesystem update detected");
        } else {
            Serial.println("[OTA] Firmware update detected");
        }
        
        setOTAState(OTAState::UPLOADING);
        
        if (!Update.begin(UPDATE_SIZE_UNKNOWN, updateType)) {
            Serial.printf("[OTA] Begin failed: %s\n", Update.errorString());
            setOTAError(OTAError::OTA_BEGIN_FAILED);
        }
    }
    
    if (len) {
        if (Update.write(data, len) != len) {
            Serial.printf("[OTA] Write failed: %s\n", Update.errorString());
            setOTAError(OTAError::FLASH_WRITE_FAILED);
        } else {
            _writtenSize += len;
            
            // Update progress (approximate since we don't know total size)
            unsigned long now = millis();
            if (now - _lastProgressUpdate > 1000) {
                Serial.printf("[OTA] Uploaded: %d bytes\n", _writtenSize);
                _lastProgressUpdate = now;
            }
        }
    }
    
    if (final) {
        if (Update.end(true)) {
            Serial.printf("[OTA] Upload complete: %d bytes\n", index + len);
            _totalSize = index + len;
            _otaProgress = 100;
        } else {
            Serial.printf("[OTA] End failed: %s\n", Update.errorString());
            setOTAError(OTAError::OTA_END_FAILED);
        }
    }
}
