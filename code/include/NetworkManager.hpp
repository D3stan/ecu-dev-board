#pragma once
#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <ESPAsyncWebServer.h>
#include <AsyncTCP.h>
#include <Update.h>
#include <HTTPClient.h>
#include <HTTPUpdate.h>
#include <ESPmDNS.h>
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
     * @brief Get last error message
     */
    String getLastError() const { return _lastError; }
    
    /**
     * @brief Switch to AP mode
     */
    void switchToApMode();
    
    /**
     * @brief Switch to STA mode with credentials
     */
    bool switchToStaMode(const char* ssid, const char* password);
    
    /**
     * @brief Start OTA update process (firmware then filesystem)
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
    
    // Telemetry timing
    unsigned long _lastTelemetryUpdate;
    uint16_t _telemetryUpdateRate;
    
    // Error tracking
    String _lastError;
    
    // OTA update server URL (placeholder)
    static constexpr const char* OTA_UPDATE_URL = "https://github.com/D3stan/ecu-dev-board/releases/latest/download/firmware.bin";
    
    // Firmware and filesystem version strings
    static constexpr const char* FIRMWARE_VERSION = "1.0.0";
    static constexpr const char* FILESYSTEM_VERSION = "1.0.0";
    
    // GitHub SSL Certificate (ISRG Root X1)
    // To get the latest certificate:
    // 1. Visit https://letsencrypt.org/certificates/
    // 2. Download the ISRG Root X1 (PEM format)
    // 3. Replace the certificate below with the downloaded content
    static constexpr const char* GITHUB_ROOT_CERT = 
        "-----BEGIN CERTIFICATE-----\n"
        "MIID0zCCArugAwIBAgIQVmcdBOpPmUxvEIFHWdJ1lDANBgkqhkiG9w0BAQwFADB7\n"
        "MQswCQYDVQQGEwJHQjEbMBkGA1UECAwSR3JlYXRlciBNYW5jaGVzdGVyMRAwDgYD\n"
        "VQQHDAdTYWxmb3JkMRowGAYDVQQKDBFDb21vZG8gQ0EgTGltaXRlZDEhMB8GA1UE\n"
        "AwwYQUFBIENlcnRpZmljYXRlIFNlcnZpY2VzMB4XDTE5MDMxMjAwMDAwMFoXDTI4\n"
        "MTIzMTIzNTk1OVowgYgxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpOZXcgSmVyc2V5\n"
        "MRQwEgYDVQQHEwtKZXJzZXkgQ2l0eTEeMBwGA1UEChMVVGhlIFVTRVJUUlVTVCBO\n"
        "ZXR3b3JrMS4wLAYDVQQDEyVVU0VSVHJ1c3QgRUNDIENlcnRpZmljYXRpb24gQXV0\n"
        "aG9yaXR5MHYwEAYHKoZIzj0CAQYFK4EEACIDYgAEGqxUWqn5aCPnetUkb1PGWthL\n"
        "q8bVttHmc3Gu3ZzWDGH926CJA7gFFOxXzu5dP+Ihs8731Ip54KODfi2X0GHE8Znc\n"
        "JZFjq38wo7Rw4sehM5zzvy5cU7Ffs30yf4o043l5o4HyMIHvMB8GA1UdIwQYMBaA\n"
        "FKARCiM+lvEH7OKvKe+CpX/QMKS0MB0GA1UdDgQWBBQ64QmG1M8ZwpZ2dEl23OA1\n"
        "xmNjmjAOBgNVHQ8BAf8EBAMCAYYwDwYDVR0TAQH/BAUwAwEB/zARBgNVHSAECjAI\n"
        "MAYGBFUdIAAwQwYDVR0fBDwwOjA4oDagNIYyaHR0cDovL2NybC5jb21vZG9jYS5j\n"
        "b20vQUFBQ2VydGlmaWNhdGVTZXJ2aWNlcy5jcmwwNAYIKwYBBQUHAQEEKDAmMCQG\n"
        "CCsGAQUFBzABhhhodHRwOi8vb2NzcC5jb21vZG9jYS5jb20wDQYJKoZIhvcNAQEM\n"
        "BQADggEBABns652JLCALBIAdGN5CmXKZFjK9Dpx1WywV4ilAbe7/ctvbq5AfjJXy\n"
        "ij0IckKJUAfiORVsAYfZFhr1wHUrxeZWEQff2Ji8fJ8ZOd+LygBkc7xGEJuTI42+\n"
        "FsMuCIKchjN0djsoTI0DQoWz4rIjQtUfenVqGtF8qmchxDM6OW1TyaLtYiKou+JV\n"
        "bJlsQ2uRl9EMC5MCHdK8aXdJ5htN978UeAOwproLtOGFfy/cQjutdAFI3tZs4RmY\n"
        "CV4Ks2dH/hzg1cEo70qLRDEmBDeNiXQ2Lu+lIg+DdEmSx/cQwgwp+7e9un/jX9Wf\n"
        "8qn0dNW44bOwgeThpWOjzOoEeJBuv/c=\n"
        "-----END CERTIFICATE-----\n";
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
     * @param updateFirmware If true, update firmware; if false, update filesystem
     */
    bool performOtaUpdate(bool updateFirmware);
    
    /**
     * @brief Setup mDNS responder
     */
    void setupMdns();
};
