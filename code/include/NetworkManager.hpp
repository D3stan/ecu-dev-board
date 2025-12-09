#pragma once
#include <Arduino.h>
#include <WiFi.h>
#include <ESPAsyncWebServer.h>
#include <AsyncTCP.h>
#include <DNSServer.h>
#include <Update.h>
#include "StorageHandler.hpp"
#include "QuickShifterEngine.hpp"
#include "LedController.hpp"

/**
 * @brief Network Manager - Handles all network operations
 * 
 * Manages:
 * - WiFi modes (AP and STA)
 * - HTTP server for web interface
 * - WebSocket for real-time telemetry
 * - OTA firmware updates
 * - Hardware ID generation
 */
class NetworkManager {
public:
    enum class State {
        INIT,
        AP_MODE,
        STA_MODE,
        OTA_UPDATE,
        ERROR
    };

    NetworkManager(StorageHandler& storage, QuickShifterEngine& qsEngine, LedController& led);
    
    /**
     * @brief Initialize network with configuration
     */
    bool begin();
    
    /**
     * @brief Main loop update - handles WebSocket broadcasts and state machine
     */
    void update();
    
    /**
     * @brief Get current network state
     */
    State getState() const { return _state; }
    
    /**
     * @brief Get unique hardware ID based on MAC address
     */
    String getHardwareId() const { return _hardwareId; }
    
    /**
     * @brief Switch to AP mode
     */
    void switchToApMode();
    
    /**
     * @brief Switch to STA mode with credentials
     */
    bool switchToStaMode(const char* ssid, const char* password);
    
    /**
     * @brief Start OTA update process
     */
    void startOtaUpdate();

private:
    // Component references
    StorageHandler& _storage;
    QuickShifterEngine& _qsEngine;
    LedController& _led;
    
    // Network state
    State _state;
    String _hardwareId;
    AsyncWebServer _server;
    AsyncWebSocket _ws;
    DNSServer* _dnsServer;
    
    // Telemetry timing
    unsigned long _lastTelemetryUpdate;
    uint16_t _telemetryUpdateRate;
    
    // OTA update server URL (placeholder)
    static constexpr const char* OTA_UPDATE_URL = "https://github.com/D3stan/ecu-dev-board/releases/latest/download/firmware.bin";
    
    /**
     * @brief Generate hardware ID from MAC address
     */
    void generateHardwareId();
    
    /**
     * @brief Setup HTTP routes
     */
    void setupHttpRoutes();
    
    /**
     * @brief Setup WebSocket handlers
     */
    void setupWebSocket();
    
    /**
     * @brief Handle WebSocket events
     */
    void onWebSocketEvent(AsyncWebSocket* server, AsyncWebSocketClient* client,
                         AwsEventType type, void* arg, uint8_t* data, size_t len);
    
    /**
     * @brief Broadcast telemetry to all WebSocket clients
     */
    void broadcastTelemetry();
    
    /**
     * @brief Handle configuration update from web interface
     */
    void handleConfigUpdate(const char* jsonData);
    
    /**
     * @brief Perform OTA update from server
     */
    bool performOtaUpdate();
};
