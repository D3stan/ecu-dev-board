/**
 * @file main.cpp
 * @brief ESP32-S2 QuickShifter - Component-Based Architecture
 * 
 * This system uses dependency injection to separate concerns:
 * - QuickShifterEngine: Real-time ignition cut logic (hard real-time)
 * - NetworkManager: WiFi, HTTP server, WebSockets, OTA (soft real-time)
 * - StorageHandler: LittleFS persistence layer
 * - LedController: Visual feedback abstraction
 * 
 * All components are initialized in setup() and updated in loop().
 * Static allocation is used throughout to prevent heap fragmentation.
 */

#include <Arduino.h>
#include <pins.hpp>
#include "QuickShifterEngine.hpp"
#include "NetworkManager.hpp"
#include "StorageHandler.hpp"
#include "LedController.hpp"

// Component instances (static allocation)
QuickShifterEngine qsEngine;
StorageHandler storage;
LedController led;
NetworkManager* networkManager = nullptr;  // Initialized after storage

// Timing for status updates
unsigned long lastStatusUpdate = 0;
constexpr unsigned long STATUS_UPDATE_INTERVAL = 500;  // Update LED status every 500ms

void setup() {
    // Initialize serial for debugging
    Serial.begin(115200);
    
    // 1. Initialize LED Controller first for visual feedback
    
    led.begin(R_LED, G_LED, B_LED, LED_BUILTIN);
    led.setStatus(LedController::Status::NO_SIGNAL);
    
    // 2. Initialize Storage Handler
    
    if (!storage.begin()) {
        
        led.setStatus(LedController::Status::ERROR);
        led.setBlinking(true);
        while (1) { delay(1000); }  // Halt on critical error
    }
    
    // 3. Initialize QuickShifter Engine
    
    qsEngine.begin(SPARK_CDI, QS_SW, POWERJET);
    
    // Load configuration from storage
    QuickShifterEngine::Config qsConfig;
    if (storage.loadQsConfig(qsConfig)) {
        qsEngine.setConfig(qsConfig);
        
    } else {
        
        // Save default config for next boot
        qsConfig = qsEngine.getConfig();
        storage.saveQsConfig(qsConfig);
    }
    
    // 4. Initialize Network Manager (dependency injection)
    
    
    networkManager = new NetworkManager(storage, qsEngine, led);
    if (!networkManager->begin()) {
        
        
        
        // Continue anyway - system can run without network
    } else {
        
        
    }
    
    
    
    
    
    // Print system info
    
    
    
    
    for (size_t i = 0; i < qsConfig.cutTimeMap.size(); i++) {
        
        if (i < qsConfig.cutTimeMap.size() - 1);
    }
    
    
    
    // Print network status
    
    if (networkManager->getState() == NetworkManager::State::AP_MODE) {
        
        
        
    } else if (networkManager->getState() == NetworkManager::State::STA_MODE) {
        
        
    } else if (networkManager->getState() == NetworkManager::State::ERROR) {
        
        
    }
    
    
}

void loop() {
    // Update all components
    // QuickShifterEngine handles its own interrupts, just needs periodic update for signal timeout
    qsEngine.update();
    
    // Update network (WebSocket broadcasts, etc.)
    if (networkManager) {
        networkManager->update();
    }
    
    // Update LED controller (for blinking effects)
    led.update();
    
    // Periodic status updates based on system state
    unsigned long currentMillis = millis();
    if (currentMillis - lastStatusUpdate >= STATUS_UPDATE_INTERVAL) {
        lastStatusUpdate = currentMillis;
        
        // Update LED status based on system state
        if (qsEngine.isCutActive()) {
            led.setStatus(LedController::Status::IGNITION_CUT);
            led.setBuiltinLed(true);
        } else if (qsEngine.isSignalActive()) {
            led.setStatus(LedController::Status::SIGNAL_OK);
            led.setBuiltinLed(false);
        } else {
            led.setStatus(LedController::Status::NO_SIGNAL);
            led.setBuiltinLed(false);
        }
        
        // Debug output to serial
        uint16_t rpm = qsEngine.getCurrentRpm();
        if (rpm > 0) {
            Serial.printf("[Status] RPM: %d, Signal: %s, Cut: %s\n",
                         rpm,
                         qsEngine.isSignalActive() ? "Active" : "Lost",
                         qsEngine.isCutActive() ? "Active" : "Inactive");
        }
    }
    
    // Small yield to prevent watchdog triggers
    yield();
}