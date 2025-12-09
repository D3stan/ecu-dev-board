#pragma once
#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <ESPAsyncWebServer.h>
#include <AsyncTCP.h>
#include <DNSServer.h>
#include <Update.h>
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
    DNSServer* _dnsServer;
    
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
        "MIIEoTCCBEigAwIBAgIRAKtmhrVie+gFloITMBKGSfUwCgYIKoZIzj0EAwIwgY8x\n"
        "CzAJBgNVBAYTAkdCMRswGQYDVQQIExJHcmVhdGVyIE1hbmNoZXN0ZXIxEDAOBgNV\n"
        "BAcTB1NhbGZvcmQxGDAWBgNVBAoTD1NlY3RpZ28gTGltaXRlZDE3MDUGA1UEAxMu\n"
        "U2VjdGlnbyBFQ0MgRG9tYWluIFZhbGlkYXRpb24gU2VjdXJlIFNlcnZlciBDQTAe\n"
        "Fw0yNTAyMDUwMDAwMDBaFw0yNjAyMDUyMzU5NTlaMBUxEzARBgNVBAMTCmdpdGh1\n"
        "Yi5jb20wWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAAQgNFxG/yzL+CSarvC7L3ep\n"
        "H5chNnG6wiYYxR5D/Z1J4MxGnIX8KbT5fCgLoyzHXL9v50bdBIq6y4AtN4gN7gbW\n"
        "o4IC/DCCAvgwHwYDVR0jBBgwFoAU9oUKOxGG4QR9DqoLLNLuzGR7e64wHQYDVR0O\n"
        "BBYEFFPIf96emE7HTda83quVPjA9PdHIMA4GA1UdDwEB/wQEAwIHgDAMBgNVHRMB\n"
        "Af8EAjAAMB0GA1UdJQQWMBQGCCsGAQUFBwMBBggrBgEFBQcDAjBJBgNVHSAEQjBA\n"
        "MDQGCysGAQQBsjEBAgIHMCUwIwYIKwYBBQUHAgEWF2h0dHBzOi8vc2VjdGlnby5j\n"
        "b20vQ1BTMAgGBmeBDAECATCBhAYIKwYBBQUHAQEEeDB2ME8GCCsGAQUFBzAChkNo\n"
        "dHRwOi8vY3J0LnNlY3RpZ28uY29tL1NlY3RpZ29FQ0NEb21haW5WYWxpZGF0aW9u\n"
        "U2VjdXJlU2VydmVyQ0EuY3J0MCMGCCsGAQUFBzABhhdodHRwOi8vb2NzcC5zZWN0\n"
        "aWdvLmNvbTCCAX4GCisGAQQB1nkCBAIEggFuBIIBagFoAHUAlpdkv1VYl633Q4do\n"
        "NwhCd+nwOtX2pPM2bkakPw/KqcYAAAGU02uUSwAABAMARjBEAiA7i6o+LpQjt6Ae\n"
        "EjltHhs/TiECnHd0xTeer/3vD1xgsAIgYlGwRot+SqEBCs//frx/YHTPwox9QLdy\n"
        "7GjTLWHfcMAAdwAZhtTHKKpv/roDb3gqTQGRqs4tcjEPrs5dcEEtJUzH1AAAAZTT\n"
        "a5PtAAAEAwBIMEYCIQDlrInx7J+3MfqgxB2+Fvq3dMlk1qj4chOw/+HkYVfG0AIh\n"
        "AMT+JKAQfUuIdBGxfryrGrwsOD3pRs1tyAyykdPGRgsTAHYAyzj3FYl8hKFEX1vB\n"
        "3fvJbvKaWc1HCmkFhbDLFMMUWOcAAAGU02uUJQAABAMARzBFAiEA1GKW92agDFNJ\n"
        "IYrMH3gaJdXsdIVpUcZOfxH1FksbuLECIFJCfslINhc53Q0TIMJHdcFOW2tgG4tB\n"
        "A1dL881tXbMnMCUGA1UdEQQeMByCCmdpdGh1Yi5jb22CDnd3dy5naXRodWIuY29t\n"
        "MAoGCCqGSM49BAMCA0cAMEQCIHGMp27BBBJ1356lCe2WYyzYIp/fAONQM3AkeE/f\n"
        "ym0sAiBtVfN3YgIZ+neHEfwcRhhz4uDpc8F+tKmtceWJSicMkA==\n"
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
