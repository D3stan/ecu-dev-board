#pragma once
#include <Arduino.h>

/**
 * @brief LED Controller - Hardware abstraction for visual feedback
 * 
 * Provides a clean interface for controlling the RGB LED and built-in LED
 * Isolates the rest of the system from specific pin assignments and PWM details
 */
class LedController {
public:
    enum class Status {
        NO_SIGNAL,      // Red - No pickup coil signal detected
        SIGNAL_OK,      // Green - Normal operation with signal
        IGNITION_CUT,   // Blue - Ignition cut active
        WIFI_AP,        // Yellow - WiFi in AP mode
        WIFI_STA,       // Cyan - WiFi in STA mode
        OTA_UPDATE,     // Magenta - OTA update in progress
        ERROR           // Red blink - System error
    };

    LedController();
    
    /**
     * @brief Initialize LED controller with pin assignments
     */
    void begin(uint8_t redPin, uint8_t greenPin, uint8_t bluePin, uint8_t builtinPin);
    
    /**
     * @brief Update LED state - call in main loop for blinking effects
     */
    void update();
    
    /**
     * @brief Set status LED color based on system state
     */
    void setStatus(Status status);
    
    /**
     * @brief Set custom RGB color (0-255 for each channel)
     */
    void setRgb(uint8_t r, uint8_t g, uint8_t b);
    
    /**
     * @brief Control built-in LED
     */
    void setBuiltinLed(bool state);
    
    /**
     * @brief Enable/disable blinking for current status
     */
    void setBlinking(bool enabled, uint16_t periodMs = 500);

private:
    uint8_t _redPin;
    uint8_t _greenPin;
    uint8_t _bluePin;
    uint8_t _builtinPin;
    
    Status _currentStatus;
    bool _blinkEnabled;
    uint16_t _blinkPeriod;
    unsigned long _lastBlinkTime;
    bool _blinkState;
    
    uint8_t _currentR;
    uint8_t _currentG;
    uint8_t _currentB;
    
    /**
     * @brief Get RGB values for a given status
     */
    void getStatusColor(Status status, uint8_t& r, uint8_t& g, uint8_t& b);
    
    /**
     * @brief Apply current RGB values to hardware
     */
    void applyRgb();
};
