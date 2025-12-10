#include "StorageHandler.hpp"

StorageHandler::StorageHandler()
    : _initialized(false)
{
}

bool StorageHandler::begin() {
    if (!LittleFS.begin(true)) {  // true = format on mount failure
        Serial.println("[Storage] Failed to mount LittleFS");
        return false;
    }
    
    _initialized = true;
    Serial.println("[Storage] LittleFS mounted successfully");
    printInfo();
    
    return true;
}

void StorageHandler::getDefaultConfig(SystemConfig& config) {
    // QuickShifter defaults with single default map
    config.qsMapConfig.minRpmThreshold = 3000;
    config.qsMapConfig.debounceTimeMs = 50;
    config.qsMapConfig.activeMapIndex = 0;
    config.qsMapConfig.mapCount = 1;
    
    // Initialize first map as default
    strcpy(config.qsMapConfig.maps[0].name, "Default Map");
    for (auto& cutTime : config.qsMapConfig.maps[0].cutTimeMap) {
        cutTime = 80;  // 80ms default for all RPM ranges
    }
    
    // Initialize remaining maps with empty names
    for (size_t i = 1; i < 10; i++) {
        config.qsMapConfig.maps[i].name[0] = '\0';
        for (auto& cutTime : config.qsMapConfig.maps[i].cutTimeMap) {
            cutTime = 80;
        }
    }
    
    // Network defaults
    strcpy(config.networkConfig.apSsid, "rspqs");
    config.networkConfig.apPassword[0] = '\0';  // Empty password for AP
    config.networkConfig.staSsid[0] = '\0';     // Empty STA SSID
    config.networkConfig.staPassword[0] = '\0'; // Empty STA password
    config.networkConfig.staMode = false;  // Start in AP mode
    config.networkConfig.lastError[0] = '\0';  // No error
    
    // Telemetry defaults
    config.telemetryConfig.updateRateMs = 100;
}

bool StorageHandler::loadConfig(SystemConfig& config) {
    if (!_initialized) {
        Serial.println("[Storage] Not initialized");
        getDefaultConfig(config);
        return false;
    }
    
    File file = LittleFS.open(CONFIG_FILE, "r");
    if (!file) {
        Serial.println("[Storage] No config file, using defaults");
        getDefaultConfig(config);
        return false;
    }
    
    // Read file content
    size_t size = file.size();
    if (size == 0 || size > 2048) {
        Serial.println("[Storage] Invalid config file size");
        file.close();
        getDefaultConfig(config);
        return false;
    }
    
    // Parse JSON
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, file);
    file.close();
    
    if (error) {
        Serial.print("[Storage] JSON parse error: ");
        Serial.println(error.c_str());
        getDefaultConfig(config);
        return false;
    }
    
    // Load QuickShifter config with multi-map support
    config.qsMapConfig.minRpmThreshold = doc["qs"]["minRpm"] | 3000;
    config.qsMapConfig.debounceTimeMs = doc["qs"]["debounce"] | 50;
    config.qsMapConfig.activeMapIndex = doc["qs"]["activeMapIndex"] | 0;
    
    // Load maps array
    JsonArray mapsArray = doc["qs"]["maps"];
    if (mapsArray.size() > 0 && mapsArray.size() <= 10) {
        config.qsMapConfig.mapCount = mapsArray.size();
        
        for (size_t i = 0; i < mapsArray.size() && i < 10; i++) {
            JsonObject mapObj = mapsArray[i];
            
            // Load map name with validation
            const char* mapName = mapObj["name"] | nullptr;
            if (mapName && strlen(mapName) > 0) {
                strlcpy(config.qsMapConfig.maps[i].name, mapName, sizeof(config.qsMapConfig.maps[i].name));
            } else {
                // Generate default name if missing
                snprintf(config.qsMapConfig.maps[i].name, sizeof(config.qsMapConfig.maps[i].name), "Map %d", (int)(i + 1));
            }
            
            // Load cut time map
            JsonArray cutTimeArray = mapObj["cutTimeMap"];
            if (cutTimeArray.size() == 11) {
                for (size_t j = 0; j < 11; j++) {
                    config.qsMapConfig.maps[i].cutTimeMap[j] = cutTimeArray[j] | 80;
                }
            } else {
                // Use default values if array is invalid
                for (auto& cutTime : config.qsMapConfig.maps[i].cutTimeMap) {
                    cutTime = 80;
                }
            }
        }
        
        // Validate active map index
        if (config.qsMapConfig.activeMapIndex >= config.qsMapConfig.mapCount) {
            Serial.println("[Storage] Invalid activeMapIndex, resetting to 0");
            config.qsMapConfig.activeMapIndex = 0;
        }
    } else {
        // Invalid or missing maps array - use defaults
        Serial.println("[Storage] Invalid maps array, using defaults");
        getDefaultConfig(config);
    }
    
    // Load Network config
    strlcpy(config.networkConfig.apSsid, doc["network"]["apSsid"] | "rspqs", sizeof(config.networkConfig.apSsid));
    strlcpy(config.networkConfig.apPassword, doc["network"]["apPassword"] | "", sizeof(config.networkConfig.apPassword));
    strlcpy(config.networkConfig.staSsid, doc["network"]["staSsid"] | "", sizeof(config.networkConfig.staSsid));
    strlcpy(config.networkConfig.staPassword, doc["network"]["staPassword"] | "", sizeof(config.networkConfig.staPassword));
    config.networkConfig.staMode = doc["network"]["staMode"] | false;
    strlcpy(config.networkConfig.lastError, doc["network"]["lastError"] | "", sizeof(config.networkConfig.lastError));
    
    // Load Telemetry config
    config.telemetryConfig.updateRateMs = doc["telemetry"]["updateRate"] | 100;
    
    Serial.println("[Storage] Configuration loaded successfully");
    return true;
}

bool StorageHandler::saveConfig(const SystemConfig& config) {
    if (!_initialized) {
        Serial.println("[Storage] Not initialized");
        return false;
    }
    
    // Create JSON document
    JsonDocument doc;
    
    // QuickShifter config with multi-map support
    JsonObject qs = doc.createNestedObject("qs");
    qs["minRpm"] = config.qsMapConfig.minRpmThreshold;
    qs["debounce"] = config.qsMapConfig.debounceTimeMs;
    qs["activeMapIndex"] = config.qsMapConfig.activeMapIndex;
    
    // Save maps array
    JsonArray mapsArray = qs.createNestedArray("maps");
    for (size_t i = 0; i < config.qsMapConfig.mapCount && i < 10; i++) {
        JsonObject mapObj = mapsArray.createNestedObject();
        mapObj["name"] = String(config.qsMapConfig.maps[i].name);
        
        JsonArray cutTimeArray = mapObj.createNestedArray("cutTimeMap");
        for (const auto& cutTime : config.qsMapConfig.maps[i].cutTimeMap) {
            cutTimeArray.add(cutTime);
        }
    }
    
    // Network config
    JsonObject network = doc.createNestedObject("network");
    network["apSsid"] = String(config.networkConfig.apSsid);
    network["apPassword"] = String(config.networkConfig.apPassword);
    network["staSsid"] = String(config.networkConfig.staSsid);
    network["staPassword"] = String(config.networkConfig.staPassword);
    network["staMode"] = config.networkConfig.staMode;
    network["lastError"] = String(config.networkConfig.lastError);
    
    // Telemetry config
    JsonObject telemetry = doc.createNestedObject("telemetry");
    telemetry["updateRate"] = config.telemetryConfig.updateRateMs;
    
    // Serialize to string
    String jsonString;
    serializeJson(doc, jsonString);
    
    // Atomic write
    bool success = atomicWrite(CONFIG_FILE, jsonString.c_str(), jsonString.length());
    
    if (success) {
        Serial.println("[Storage] Configuration saved successfully");
    } else {
        Serial.println("[Storage] Failed to save configuration");
    }
    
    return success;
}

bool StorageHandler::loadQsConfig(QuickShifterEngine::Config& config) {
    SystemConfig sysConfig;
    bool result = loadConfig(sysConfig);
    
    // Get active map with fallback validation
    if (result && sysConfig.qsMapConfig.mapCount > 0) {
        uint8_t activeIdx = sysConfig.qsMapConfig.activeMapIndex;
        if (activeIdx >= sysConfig.qsMapConfig.mapCount) {
            activeIdx = 0; // Fallback to first map
        }
        
        config.minRpmThreshold = sysConfig.qsMapConfig.minRpmThreshold;
        config.debounceTimeMs = sysConfig.qsMapConfig.debounceTimeMs;
        config.cutTimeMap = sysConfig.qsMapConfig.maps[activeIdx].cutTimeMap;
    } else {
        // Return default config
        config.minRpmThreshold = 3000;
        config.debounceTimeMs = 50;
        for (auto& cutTime : config.cutTimeMap) {
            cutTime = 80;
        }
    }
    
    return result;
}

bool StorageHandler::saveQsConfig(const QuickShifterEngine::Config& config) {
    SystemConfig sysConfig;
    loadConfig(sysConfig);
    
    // Update active map
    uint8_t activeIdx = sysConfig.qsMapConfig.activeMapIndex;
    if (activeIdx >= sysConfig.qsMapConfig.mapCount) {
        activeIdx = 0;
    }
    
    sysConfig.qsMapConfig.minRpmThreshold = config.minRpmThreshold;
    sysConfig.qsMapConfig.debounceTimeMs = config.debounceTimeMs;
    sysConfig.qsMapConfig.maps[activeIdx].cutTimeMap = config.cutTimeMap;
    
    return saveConfig(sysConfig);
}

bool StorageHandler::loadQsMapConfig(QsMapConfig& config) {
    SystemConfig sysConfig;
    bool result = loadConfig(sysConfig);
    config = sysConfig.qsMapConfig;
    return result;
}

bool StorageHandler::saveQsMapConfig(const QsMapConfig& config) {
    SystemConfig sysConfig;
    loadConfig(sysConfig);
    sysConfig.qsMapConfig = config;
    return saveConfig(sysConfig);
}

bool StorageHandler::getActiveMapConfig(QuickShifterEngine::Config& config) {
    return loadQsConfig(config);
}

bool StorageHandler::setActiveMap(uint8_t mapIndex) {
    SystemConfig sysConfig;
    if (!loadConfig(sysConfig)) {
        return false;
    }
    
    // Validate map index
    if (mapIndex >= sysConfig.qsMapConfig.mapCount) {
        Serial.printf("[Storage] Invalid map index %d (max: %d)\n", mapIndex, sysConfig.qsMapConfig.mapCount - 1);
        return false;
    }
    
    sysConfig.qsMapConfig.activeMapIndex = mapIndex;
    return saveConfig(sysConfig);
}

bool StorageHandler::loadNetworkConfig(NetworkConfig& config) {
    SystemConfig sysConfig;
    bool result = loadConfig(sysConfig);
    config = sysConfig.networkConfig;
    return result;
}

bool StorageHandler::saveNetworkConfig(const NetworkConfig& config) {
    SystemConfig sysConfig;
    loadConfig(sysConfig);
    sysConfig.networkConfig = config;
    return saveConfig(sysConfig);
}

bool StorageHandler::loadTelemetryConfig(TelemetryConfig& config) {
    SystemConfig sysConfig;
    bool result = loadConfig(sysConfig);
    config = sysConfig.telemetryConfig;
    return result;
}

bool StorageHandler::saveTelemetryConfig(const TelemetryConfig& config) {
    SystemConfig sysConfig;
    loadConfig(sysConfig);
    sysConfig.telemetryConfig = config;
    return saveConfig(sysConfig);
}

bool StorageHandler::hasWebInterface() const {
    if (!_initialized) return false;
    return LittleFS.exists(WEB_HTML_FILE);
}

void StorageHandler::printInfo() {
    if (!_initialized) return;
    
    size_t total = LittleFS.totalBytes();
    size_t used = LittleFS.usedBytes();
    
    Serial.printf("[Storage] Total: %d bytes, Used: %d bytes, Free: %d bytes\n", 
                  total, used, total - used);
}

bool StorageHandler::atomicWrite(const char* filename, const char* data, size_t len) {
    // Write to temporary file first
    File tmpFile = LittleFS.open(CONFIG_TEMP_FILE, "w");
    if (!tmpFile) {
        Serial.println("[Storage] Failed to open temp file");
        return false;
    }
    
    size_t written = tmpFile.write((const uint8_t*)data, len);
    tmpFile.close();
    
    if (written != len) {
        Serial.println("[Storage] Failed to write complete data");
        LittleFS.remove(CONFIG_TEMP_FILE);
        return false;
    }
    
    // Remove old file if exists
    if (LittleFS.exists(filename)) {
        LittleFS.remove(filename);
    }
    
    // Rename temp file to actual filename
    if (!LittleFS.rename(CONFIG_TEMP_FILE, filename)) {
        Serial.println("[Storage] Failed to rename temp file");
        return false;
    }
    
    return true;
}
