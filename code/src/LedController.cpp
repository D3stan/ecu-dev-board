#include "LedController.hpp"

LedController::LedController()
    : _redPin(0)
    , _greenPin(0)
    , _bluePin(0)
    , _builtinPin(0)
    , _currentStatus(Status::NO_SIGNAL)
    , _blinkEnabled(false)
    , _blinkPeriod(500)
    , _lastBlinkTime(0)
    , _blinkState(false)
    , _currentR(0)
    , _currentG(0)
    , _currentB(0)
{
}

void LedController::begin(uint8_t redPin, uint8_t greenPin, uint8_t bluePin, uint8_t builtinPin) {
    _redPin = redPin;
    _greenPin = greenPin;
    _bluePin = bluePin;
    _builtinPin = builtinPin;
    
    // Configure pins as outputs
    pinMode(_redPin, OUTPUT);
    pinMode(_greenPin, OUTPUT);
    pinMode(_bluePin, OUTPUT);
    pinMode(_builtinPin, OUTPUT);
    
    // Initialize to OFF
    setRgb(0, 0, 0);
    setBuiltinLed(false);
    
    Serial.println("[LED] Initialized");
}

void LedController::update() {
    if (!_blinkEnabled) {
        return;
    }
    
    unsigned long currentMillis = millis();
    if (currentMillis - _lastBlinkTime >= _blinkPeriod) {
        _lastBlinkTime = currentMillis;
        _blinkState = !_blinkState;
        
        if (_blinkState) {
            applyRgb();
        } else {
            analogWrite(_redPin, 0);
            analogWrite(_greenPin, 0);
            analogWrite(_bluePin, 0);
        }
    }
}

void LedController::setStatus(Status status) {
    _currentStatus = status;
    
    // Get color for this status
    getStatusColor(status, _currentR, _currentG, _currentB);
    
    // Apply immediately if not blinking
    if (!_blinkEnabled) {
        applyRgb();
    }
}

void LedController::setRgb(uint8_t r, uint8_t g, uint8_t b) {
    _currentR = r;
    _currentG = g;
    _currentB = b;
    _blinkEnabled = false;
    applyRgb();
}

void LedController::setBuiltinLed(bool state) {
    digitalWrite(_builtinPin, state ? HIGH : LOW);
}

void LedController::setBlinking(bool enabled, uint16_t periodMs) {
    _blinkEnabled = enabled;
    _blinkPeriod = periodMs;
    _lastBlinkTime = millis();
    _blinkState = false;
    
    if (!enabled) {
        applyRgb(); // Restore solid color
    }
}

void LedController::getStatusColor(Status status, uint8_t& r, uint8_t& g, uint8_t& b) {
    switch (status) {
        case Status::NO_SIGNAL:
            r = 255; g = 0; b = 0;  // Red
            break;
        case Status::SIGNAL_OK:
            r = 0; g = 255; b = 0;  // Green
            break;
        case Status::IGNITION_CUT:
            r = 0; g = 0; b = 255;  // Blue
            break;
        case Status::WIFI_AP:
            r = 255; g = 255; b = 0;  // Yellow
            break;
        case Status::WIFI_STA:
            r = 0; g = 255; b = 255;  // Cyan
            break;
        case Status::OTA_UPDATE:
            r = 255; g = 0; b = 255;  // Magenta
            break;
        case Status::ERROR:
            r = 255; g = 0; b = 0;  // Red (with blink)
            break;
        default:
            r = 0; g = 0; b = 0;  // Off
            break;
    }
}

void LedController::applyRgb() {
    analogWrite(_redPin, _currentR);
    analogWrite(_greenPin, _currentG);
    analogWrite(_bluePin, _currentB);
}
