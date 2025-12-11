#pragma once
#include <Arduino.h>
#include <array>

/**
 * @brief Core QuickShifter Engine - Handles real-time ignition cut logic
 * 
 * This component manages the critical path operations:
 * - RPM calculation from pickup coil pulses
 * - Shift sensor debouncing
 * - Ignition cut timing based on RPM map
 * - Hardware timer management for precise cut duration
 */
class QuickShifterEngine {
public:
    // Configuration structure (loaded from storage)
    struct Config {
        uint16_t minRpmThreshold;           // Minimum RPM to enable quickshift (default: 3000)
        uint16_t debounceTimeMs;            // Shift sensor debounce time (default: 50ms)
        std::array<uint16_t, 11> cutTimeMap; // Cut time in ms for RPM ranges 5k-15k (step 1k)
    };

    QuickShifterEngine();
    
    /**
     * @brief Initialize the engine with pin configuration and default config
     */
    void begin(uint8_t pickupPin, uint8_t shiftSensorPin, uint8_t ignitionCutPin);
    
    /**
     * @brief Update configuration from storage
     */
    void setConfig(const Config& config);
    
    /**
     * @brief Get current configuration
     */
    Config getConfig() const { return _config; }
    
    /**
     * @brief Main loop update - must be called frequently
     * Handles signal timeout detection and non-critical processing
     */
    void update();
    
    /**
     * @brief Get current RPM (thread-safe)
     */
    uint16_t getCurrentRpm() const;
    
    /**
     * @brief Check if signal is active
     */
    bool isSignalActive() const { return _signalActive; }
    
    /**
     * @brief Get ignition cut state
     */
    bool isCutActive() const { return _cutActive; }

    /**
     * @brief ISR trampolines - must be public for interrupt attachment
     */
    static void IRAM_ATTR pickupCoilISR();
    static void IRAM_ATTR shiftSensorISR();
    
private:
    // Singleton instance pointer for ISR trampolines
    static QuickShifterEngine* _instance;
    
    // Configuration
    Config _config;
    
    // Pin assignments
    uint8_t _pickupPin;
    uint8_t _shiftSensorPin;
    uint8_t _ignitionCutPin;
    
    // Timing variables (accessed from ISR - must be volatile)
    volatile unsigned long _lastPulseTime;
    volatile unsigned long _pulseInterval;
    volatile unsigned long _lastValidInterval;
    volatile bool _isIntervalValid;
    volatile unsigned long _lastShiftSensorTime;
    volatile uint16_t _currentRpm;
    volatile bool _cutActive;
    
    // Signal timeout tracking
    bool _signalActive;
    unsigned long _lastUpdateTime;
    static constexpr unsigned long SIGNAL_TIMEOUT_MS = 1000;
    
    // Hardware timer for ignition cut
    TimerHandle_t _cutTimer;
    
    /**
     * @brief Timer callback to end ignition cut
     */
    static void cutTimerCallback(TimerHandle_t xTimer);
    
    /**
     * @brief Calculate cut time based on current RPM
     */
    uint16_t calculateCutTime(uint16_t rpm) const;
    
    /**
     * @brief Handle pickup coil pulse (called from ISR)
     */
    void IRAM_ATTR handlePickupPulse();
    
    /**
     * @brief Handle shift sensor trigger (called from ISR)
     */
    void IRAM_ATTR handleShiftSensor();
    
    /**
     * @brief Trigger ignition cut
     */
    void IRAM_ATTR triggerIgnitionCut(uint16_t cutTimeMs);
};
