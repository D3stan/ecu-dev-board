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
    // QuickShifter defaults
    config.qsConfig.minRpmThreshold = 3000;
    config.qsConfig.debounceTimeMs = 50;
    for (auto& cutTime : config.qsConfig.cutTimeMap) {
        cutTime = 80;  // 80ms default for all RPM ranges
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
    
    // Load QuickShifter config
    config.qsConfig.minRpmThreshold = doc["qs"]["minRpm"] | 3000;
    config.qsConfig.debounceTimeMs = doc["qs"]["debounce"] | 50;
    
    JsonArray cutTimeArray = doc["qs"]["cutTimeMap"];
    if (cutTimeArray.size() == 11) {
        for (size_t i = 0; i < 11; i++) {
            config.qsConfig.cutTimeMap[i] = cutTimeArray[i] | 80;
        }
    } else {
        for (auto& cutTime : config.qsConfig.cutTimeMap) {
            cutTime = 80;
        }
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
    
    // QuickShifter config
    JsonObject qs = doc.createNestedObject("qs");
    qs["minRpm"] = config.qsConfig.minRpmThreshold;
    qs["debounce"] = config.qsConfig.debounceTimeMs;
    
    JsonArray cutTimeArray = qs.createNestedArray("cutTimeMap");
    for (const auto& cutTime : config.qsConfig.cutTimeMap) {
        cutTimeArray.add(cutTime);
    }
    
    // Network config
    JsonObject network = doc.createNestedObject("network");
    network["apSsid"] = config.networkConfig.apSsid;
    network["apPassword"] = config.networkConfig.apPassword;
    network["staSsid"] = config.networkConfig.staSsid;
    network["staPassword"] = config.networkConfig.staPassword;
    network["staMode"] = config.networkConfig.staMode;
    network["lastError"] = config.networkConfig.lastError;
    
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
    config = sysConfig.qsConfig;
    return result;
}

bool StorageHandler::saveQsConfig(const QuickShifterEngine::Config& config) {
    SystemConfig sysConfig;
    loadConfig(sysConfig);
    sysConfig.qsConfig = config;
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
