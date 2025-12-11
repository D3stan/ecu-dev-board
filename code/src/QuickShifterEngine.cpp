#include "QuickShifterEngine.hpp"

// Static instance pointer for ISR trampolines
QuickShifterEngine* QuickShifterEngine::_instance = nullptr;

QuickShifterEngine::QuickShifterEngine()
    : _pickupPin(0)
    , _shiftSensorPin(0)
    , _ignitionCutPin(0)
    , _lastPulseTime(0)
    , _pulseInterval(0)
    , _lastShiftSensorTime(0)
    , _currentRpm(0)
    , _cutActive(false)
    , _signalActive(false)
    , _lastUpdateTime(0)
    , _cutTimer(nullptr)
{
    // Set default configuration
    _config.minRpmThreshold = 3000;
    _config.debounceTimeMs = 50;
    
    // Initialize cut time map to 80ms for all RPM ranges
    for (auto& cutTime : _config.cutTimeMap) {
        cutTime = 80;
    }
    
    // Set singleton instance for ISR trampolines
    _instance = this;
}

void QuickShifterEngine::begin(uint8_t pickupPin, uint8_t shiftSensorPin, uint8_t ignitionCutPin) {
    _pickupPin = pickupPin;
    _shiftSensorPin = shiftSensorPin;
    _ignitionCutPin = ignitionCutPin;
    _lastValidInterval = 0;
    
    // Configure pins
    pinMode(_ignitionCutPin, OUTPUT);
    digitalWrite(_ignitionCutPin, LOW);
    
    pinMode(_pickupPin, INPUT);
    pinMode(_shiftSensorPin, INPUT);
    
    // Attach interrupts
    attachInterrupt(digitalPinToInterrupt(_pickupPin), pickupCoilISR, RISING);
    attachInterrupt(digitalPinToInterrupt(_shiftSensorPin), shiftSensorISR, RISING);
    
    // Create hardware timer for ignition cut
    _cutTimer = xTimerCreate(
        "IgnitionCut",
        pdMS_TO_TICKS(80),  // Default period (will be updated per cut)
        pdFALSE,            // One-shot timer
        this,               // Pass instance pointer as timer ID
        cutTimerCallback
    );
    
    
}

void QuickShifterEngine::setConfig(const Config& config) {
    _config = config;
    
}

void QuickShifterEngine::update() {
    unsigned long currentMicros = micros();
    
    // Check signal timeout
    bool wasActive = _signalActive;
    _signalActive = (_lastPulseTime > 0) && 
                    ((currentMicros - _lastPulseTime) < (SIGNAL_TIMEOUT_MS * 1000));
    
    if (wasActive && !_signalActive) {
        // Signal lost
        noInterrupts();
        _currentRpm = 0;
        interrupts();
    }
}

uint16_t QuickShifterEngine::getCurrentRpm() const {
    // Thread-safe read of volatile variable
    noInterrupts();
    uint16_t rpm = _currentRpm;
    interrupts();
    return rpm;
}

uint16_t QuickShifterEngine::calculateCutTime(uint16_t rpm) const {
    // Map RPM to array index: 5000-5999 -> index 0, 6000-6999 -> index 1, etc.
    if (rpm < 5000) {
        return _config.cutTimeMap[0];  // Use first value for RPM < 5k
    }
    if (rpm >= 15000) {
        return _config.cutTimeMap[10]; // Use last value for RPM >= 15k
    }
    
    // Calculate index: (rpm - 5000) / 1000
    size_t index = (rpm - 5000) / 1000;
    return _config.cutTimeMap[index];
}

void IRAM_ATTR QuickShifterEngine::handlePickupPulse() {
    unsigned long currentTime = micros();

    // 1. Handle Ignition Cut & Signal Loss
    // If the cut is active, or if we haven't seen a pulse in >100ms (stall/startup),
    // we reset the filter state. The next pulse will be used only to establish a baseline.
    if (_cutActive || _lastPulseTime == 0 || (currentTime - _lastPulseTime) > 100000) {
        _lastPulseTime = currentTime;
        _lastValidInterval = 0; // Reset predictive filter
        return;
    }

    unsigned long currentInterval = currentTime - _lastPulseTime;
    
    // 2. Predictive Filtering
    // We expect the new interval to be within +/- 40% of the previous valid one.
    // This filters out noise spikes (too short) and missed pulses (too long).
    _isIntervalValid = true;
    
    if (_lastValidInterval > 0) {
        // Calculate absolute difference
        unsigned long diff = (currentInterval > _lastValidInterval) 
                           ? (currentInterval - _lastValidInterval) 
                           : (_lastValidInterval - currentInterval);
                           
        // Threshold: 40% of previous interval
        // e.g. at 5000us (12k RPM), range is 3000us - 7000us
        if (diff > (_lastValidInterval * 4 / 10)) {
            _isIntervalValid = false;
        }
    }
    
    // 3. Absolute Sanity Check
    // Filter physically impossible RPMs (> 20,000 RPM -> < 3000us)
    if (currentInterval < 3000) {
        _isIntervalValid = false;
    }

    if (_isIntervalValid) {
        // Valid pulse: Update state and RPM
        _pulseInterval = currentInterval;
        _lastValidInterval = currentInterval;
        
        // Calculate RPM (safe from div/0 due to <3000 check)
        _currentRpm = 60000000UL / _pulseInterval;
        
        // Update timestamp only for valid pulses
        _lastPulseTime = currentTime;
    } else {
        // Invalid pulse (Noise or Glitch)
        // We do NOT update _lastPulseTime.
        // This effectively ignores the noise spike, measuring the next interval 
        // from the last *valid* pulse.
    }
}

void IRAM_ATTR QuickShifterEngine::handleShiftSensor() {
    unsigned long currentTime = micros();
    unsigned long debounceTimeUs = _config.debounceTimeMs * 1000UL;
    
    // Debounce check
    if (_lastShiftSensorTime != 0 && 
        (currentTime - _lastShiftSensorTime) < debounceTimeUs) {
        return; // Ignore bounce
    }
    
    _lastShiftSensorTime = currentTime;
    
    // Check if RPM is above threshold
    if (_currentRpm < _config.minRpmThreshold) {
        return; // RPM too low, ignore shift request
    }
    
    // Calculate cut time based on current RPM
    uint16_t cutTime = calculateCutTime(_currentRpm);
    
    // Trigger ignition cut
    triggerIgnitionCut(cutTime);
}

void IRAM_ATTR QuickShifterEngine::triggerIgnitionCut(uint16_t cutTimeMs) {
    // Set ignition cut pin HIGH
    digitalWrite(_ignitionCutPin, HIGH);
    _cutActive = true;
    
    // Start timer to turn off cut
    BaseType_t xHigherPriorityTaskWoken = pdFALSE;
    
    // Update timer period
    xTimerChangePeriodFromISR(_cutTimer, pdMS_TO_TICKS(cutTimeMs), &xHigherPriorityTaskWoken);
    xTimerStartFromISR(_cutTimer, &xHigherPriorityTaskWoken);
    
    if (xHigherPriorityTaskWoken) {
        portYIELD_FROM_ISR();
    }
}

void QuickShifterEngine::cutTimerCallback(TimerHandle_t xTimer) {
    // Get instance pointer from timer ID
    QuickShifterEngine* instance = static_cast<QuickShifterEngine*>(pvTimerGetTimerID(xTimer));
    
    // End ignition cut
    digitalWrite(instance->_ignitionCutPin, LOW);
    instance->_cutActive = false;
}

// ISR Trampolines
void IRAM_ATTR QuickShifterEngine::pickupCoilISR() {
    if (_instance) {
        _instance->handlePickupPulse();
    }
}

void IRAM_ATTR QuickShifterEngine::shiftSensorISR() {
    if (_instance) {
        _instance->handleShiftSensor();
    }
}
