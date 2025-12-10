#pragma once
#include <Arduino.h>
#include <LittleFS.h>
#include <ArduinoJson.h>
#include "QuickShifterEngine.hpp"

/**
 * @brief Storage Handler - Abstraction layer for persistent configuration
 * 
 * Manages all file system operations with LittleFS
 * Ensures safe serialization/deserialization without flash corruption
 * Uses atomic writes (write to temp file, then rename)
 */
class StorageHandler {
public:
    // Cut map structure
    struct CutMap {
        char name[32];                      // Map name (user-defined)
        std::array<uint16_t, 11> cutTimeMap; // Cut time in ms for RPM ranges 5k-15k (step 1k)
    };
    
    // QuickShifter configuration with multiple maps
    struct QsMapConfig {
        uint16_t minRpmThreshold;           // Minimum RPM to enable quickshift
        uint16_t debounceTimeMs;            // Shift sensor debounce time
        uint8_t activeMapIndex;             // Index of currently active map (0-9)
        uint8_t mapCount;                   // Number of configured maps (1-10)
        std::array<CutMap, 10> maps;        // Up to 10 cut maps
    };
    
    // Network configuration structure
    struct NetworkConfig {
        char apSsid[32];        // AP mode SSID
        char apPassword[64];    // AP mode password
        char staSsid[32];       // STA mode SSID
        char staPassword[64];   // STA mode password
        bool staMode;           // true = Station mode, false = AP mode
        char lastError[128];    // Last connection error message
    };
    
    // Telemetry configuration
    struct TelemetryConfig {
        uint16_t updateRateMs;  // WebSocket update rate (default: 100ms)
    };
    
    // Complete system configuration
    struct SystemConfig {
        QsMapConfig qsMapConfig;
        NetworkConfig networkConfig;
        TelemetryConfig telemetryConfig;
    };

    StorageHandler();
    
    /**
     * @brief Initialize LittleFS and load configuration
     * @return true if successful, false otherwise
     */
    bool begin();
    
    /**
     * @brief Load complete system configuration from flash
     * @param config Output parameter for loaded configuration
     * @return true if loaded successfully, false if using defaults
     */
    bool loadConfig(SystemConfig& config);
    
    /**
     * @brief Save complete system configuration to flash
     * @param config Configuration to save
     * @return true if saved successfully
     */
    bool saveConfig(const SystemConfig& config);
    
    /**
     * @brief Load QuickShifter configuration only
     */
    bool loadQsConfig(QuickShifterEngine::Config& config);
    
    /**
     * @brief Save QuickShifter configuration only
     */
    bool saveQsConfig(const QuickShifterEngine::Config& config);
    
    /**
     * @brief Load QuickShifter map configuration (multi-map support)
     */
    bool loadQsMapConfig(QsMapConfig& config);
    
    /**
     * @brief Save QuickShifter map configuration (multi-map support)
     */
    bool saveQsMapConfig(const QsMapConfig& config);
    
    /**
     * @brief Get active map as QuickShifterEngine::Config
     * @return Current active map configuration with validation
     */
    bool getActiveMapConfig(QuickShifterEngine::Config& config);
    
    /**
     * @brief Set active map by index (with validation)
     * @param mapIndex Index of map to activate (0-9)
     * @return true if successful, false if invalid index
     */
    bool setActiveMap(uint8_t mapIndex);
    
    /**
     * @brief Load network configuration only
     */
    bool loadNetworkConfig(NetworkConfig& config);
    
    /**
     * @brief Save network configuration only
     */
    bool saveNetworkConfig(const NetworkConfig& config);
    
    /**
     * @brief Load telemetry configuration only
     */
    bool loadTelemetryConfig(TelemetryConfig& config);
    
    /**
     * @brief Save telemetry configuration only
     */
    bool saveTelemetryConfig(const TelemetryConfig& config);
    
    /**
     * @brief Check if web interface HTML exists
     */
    bool hasWebInterface() const;
    
    /**
     * @brief Get file system info
     */
    void printInfo();

private:
    static constexpr const char* CONFIG_FILE = "/config.json";
    static constexpr const char* CONFIG_TEMP_FILE = "/config.tmp";
    static constexpr const char* WEB_HTML_FILE = "/index.html";
    
    bool _initialized;
    
    /**
     * @brief Get default configuration
     */
    void getDefaultConfig(SystemConfig& config);
    
    /**
     * @brief Perform atomic file write (write to temp, then rename)
     */
    bool atomicWrite(const char* filename, const char* data, size_t len);
};
