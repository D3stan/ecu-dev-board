#include <pins.hpp>
#include "Arduino.h"

// Timing variables
unsigned long previousPickupMillis = 0;

// Frequency measurement variables
volatile unsigned long lastPulseTime = 0;
volatile unsigned long pulseInterval = 0;
volatile bool newPulseDetected = false;
unsigned long previousPrintMillis = 0;
const unsigned long printInterval = 500;  // Print frequency every 0.5 seconds
const unsigned long signalTimeout = 1000; // Consider signal lost after 1 second
bool signalActive = false;

TimerHandle_t cdiOffTimer;

void cdiTimerCallback(TimerHandle_t xTimer) {
    digitalWrite(CDI, LOW);
    digitalWrite(LED_BUILTIN, LOW);
}

// Interrupt Service Routine for PICKUP_SQUARE pin
void IRAM_ATTR pickupSquareISR() {
    unsigned long currentTime = micros();
    
    // Calculate interval between rising edges
    if (lastPulseTime != 0) {
        pulseInterval = currentTime - lastPulseTime;
        newPulseDetected = true;
        digitalWrite(CDI, HIGH);
        digitalWrite(LED_BUILTIN, HIGH);
        BaseType_t xHigherPriorityTaskWoken = pdFALSE;
        xTimerStartFromISR(cdiOffTimer, &xHigherPriorityTaskWoken);

        // If starting the timer woke up the timer task, yield
        if (xHigherPriorityTaskWoken) {
            portYIELD_FROM_ISR();
        }
    }
    
    lastPulseTime = currentTime;
}

void IRAM_ATTR buttonISR() {
    digitalWrite(CDI, HIGH);
    digitalWrite(LED_BUILTIN, HIGH);
    BaseType_t xHigherPriorityTaskWoken = pdFALSE;
    xTimerStartFromISR(cdiOffTimer, &xHigherPriorityTaskWoken);

    // If starting the timer woke up the timer task, yield
    if (xHigherPriorityTaskWoken) {
        portYIELD_FROM_ISR();
    }
}

// Function to set RGB LED color (0-255 for each channel)
void setRgbColor(uint8_t r, uint8_t g, uint8_t b) {
    analogWrite(R_LED, r);
    analogWrite(G_LED, g);
    analogWrite(B_LED, b);
}

void setup() {
    // Initialize serial for debugging
    Serial.begin(115200);

    pinMode(CDI, OUTPUT);
    pinMode(0, INPUT_PULLUP);
    
    // Configure LED pins
    pinMode(LED_BUILTIN, OUTPUT);
    pinMode(R_LED, OUTPUT);
    pinMode(G_LED, OUTPUT);
    pinMode(B_LED, OUTPUT);
    
    // Configure PICKUP_SQUARE as input with interrupt
    pinMode(PICKUP_SQUARE, INPUT);
    attachInterrupt(digitalPinToInterrupt(PICKUP_SQUARE), pickupSquareISR, RISING);
    attachInterrupt(digitalPinToInterrupt(0), buttonISR, FALLING);

    // Create the one-shot timer
    // It has a 10ms period (pdMS_TO_TICKS(10))
    // pdFALSE means it's a one-shot timer, not auto-reloading
    // The ID is 0, and the callback is cdiTimerCallback
    cdiOffTimer = xTimerCreate(
        "CDI_Off_Timer",      // Name for debugging
        pdMS_TO_TICKS(10),    // Timer period in ticks
        pdFALSE,              // Don't auto-reload (one-shot)
        (void *)0,            // Timer ID (not used here)
        cdiTimerCallback      // Callback function
    );
    
    // Initialize All off
    digitalWrite(LED_BUILTIN, LOW);
    digitalWrite(CDI, LOW);
    setRgbColor(255, 0, 0);  // Start with red (no signal)
    
    Serial.println("ECU Dev Board - Started");
}

void loop() {
    unsigned long currentMillis = millis();
    unsigned long currentMicros = micros();
    
    // Check if signal is active (received pulse within timeout period)
    if (lastPulseTime > 0 && (currentMicros - lastPulseTime) < (signalTimeout * 1000)) {
        if (!signalActive) {
            signalActive = true;
            setRgbColor(0, 255, 0);  // Green when signal is active
        }
    } else {
        if (signalActive) {
            signalActive = false;
            setRgbColor(255, 0, 0);  // Red when no signal
        }
    }
    
    // Print frequency measurement every 0.5 seconds
    if (currentMillis - previousPrintMillis >= printInterval) {
        previousPrintMillis = currentMillis;
        
        if (newPulseDetected && pulseInterval > 0) {
            // Calculate frequency from pulse interval
            float frequency = 1000000.0 / pulseInterval;  // Convert microseconds to Hz
            float RPM = frequency * 60.0;  // Convert Hz to RPM
            
            // Print frequency and period
            Serial.print("RPM: ");
            Serial.print(RPM, 2);
            Serial.println();
            newPulseDetected = false;

        } else if (!signalActive) {
            Serial.println("VR Sensor: No signal detected");
        }
    }
}