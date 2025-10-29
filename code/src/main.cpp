#include <pins.hpp>
#include "Arduino.h"

// Timing variables
unsigned long previousBlinkMillis = 0;
unsigned long previousColorMillis = 0;
unsigned long previousPickupMillis = 0;
const unsigned long blinkInterval = 500;    // 0.5 seconds for builtin LED
const unsigned long colorInterval = 10;     // Smooth color transition for RGB

// Pickup simulation timing (VR sensor style)
const unsigned long pickupPeriod = 16667;   // 60Hz = 16.67ms period
const unsigned long pulseWidth = 500;       // 500us pulse width (adjustable: 100-1000us)

// LED states
bool builtinLedState = false;
uint16_t colorStep = 0;  // For cycling through colors (0-1529)

// Pickup simulation state
enum PickupState {
    IDLE,           // Waiting for next pulse
    PULSE_HIGH,     // Generating positive pulse
    PULSE_LOW       // Generating negative pulse
};
PickupState pickupState = IDLE;
unsigned long pulseStartMicros = 0;

// Frequency measurement variables
volatile unsigned long lastPulseTime = 0;
volatile unsigned long pulseInterval = 0;
volatile bool newPulseDetected = false;
unsigned long previousPrintMillis = 0;
const unsigned long printInterval = 500;  // Print frequency every 0.5 seconds

// Interrupt Service Routine for PICKUP_SQUARE pin
void IRAM_ATTR pickupSquareISR() {
    unsigned long currentTime = micros();
    
    // Calculate interval between rising edges
    if (lastPulseTime != 0) {
        pulseInterval = currentTime - lastPulseTime;
        newPulseDetected = true;
    }
    
    lastPulseTime = currentTime;
}

// Function to set RGB LED color (0-255 for each channel)
void setRgbColor(uint8_t r, uint8_t g, uint8_t b) {
    analogWrite(R_LED, r);
    analogWrite(G_LED, g);
    analogWrite(B_LED, b);
}

// Function to get RGB values from color wheel position (0-1529)
void getColorFromWheel(uint16_t pos, uint8_t &r, uint8_t &g, uint8_t &b) {
    if (pos < 255) {
        // Red to Yellow
        r = 255;
        g = pos;
        b = 0;
    } else if (pos < 510) {
        // Yellow to Green
        r = 510 - pos;
        g = 255;
        b = 0;
    } else if (pos < 765) {
        // Green to Cyan
        r = 0;
        g = 255;
        b = pos - 510;
    } else if (pos < 1020) {
        // Cyan to Blue
        r = 0;
        g = 1020 - pos;
        b = 255;
    } else if (pos < 1275) {
        // Blue to Magenta
        r = pos - 1020;
        g = 0;
        b = 255;
    } else {
        // Magenta to Red
        r = 255;
        g = 0;
        b = 1530 - pos;
    }
}

void setup() {
    // Initialize serial for debugging
    Serial.begin(115200);
    
    // Configure LED pins
    pinMode(LED_BUILTIN, OUTPUT);
    pinMode(R_LED, OUTPUT);
    pinMode(G_LED, OUTPUT);
    pinMode(B_LED, OUTPUT);
    
    // Configure pickup simulation pins (complementary outputs)
    pinMode(PICKUP_SIM_P, OUTPUT);
    pinMode(PICKUP_SIM_N, OUTPUT);
    
    // Configure PICKUP_SQUARE as input with interrupt
    pinMode(PICKUP_SQUARE, INPUT);
    attachInterrupt(digitalPinToInterrupt(PICKUP_SQUARE), pickupSquareISR, RISING);
    
    // Initialize LEDs off
    digitalWrite(LED_BUILTIN, LOW);
    setRgbColor(0, 0, 0);
    
    // Initialize pickup simulation (both low for idle state)
    digitalWrite(PICKUP_SIM_P, LOW);
    digitalWrite(PICKUP_SIM_N, LOW);
    
    Serial.println("ECU Dev Board - LED Demo & 60Hz VR Pickup Simulation Started!");
    Serial.print("Pulse width: ");
    Serial.print(pulseWidth);
    Serial.println("us");
    Serial.println("Frequency measurement on PICKUP_SQUARE enabled");
    Serial.println("Waiting for VR sensor signal...");
}

void loop() {
    unsigned long currentMillis = millis();
    unsigned long currentMicros = micros();
    
    // Blink builtin LED every 0.5 seconds
    // if (currentMillis - previousBlinkMillis >= blinkInterval) {
    //     previousBlinkMillis = currentMillis;
    //     builtinLedState = !builtinLedState;
    //     digitalWrite(LED_BUILTIN, builtinLedState);
    // }
    
    // Change RGB LED color continuously
    if (currentMillis - previousColorMillis >= colorInterval) {
        previousColorMillis = currentMillis;
        
        uint8_t r, g, b;
        getColorFromWheel(colorStep, r, g, b);
        setRgbColor(r, g, b);
        
        colorStep++;
        if (colorStep >= 1530) {
            colorStep = 0;  // Reset to start of color wheel
        }
    }
    
    // Generate VR-style pickup simulation with narrow pulse pairs
    // Creates a positive pulse followed immediately by a negative pulse
    // This simulates a VR sensor passing a tooth
    //pickup(currentMicros);
    
    // Print frequency measurement every 0.5 seconds
    if (currentMillis - previousPrintMillis >= printInterval) {
        previousPrintMillis = currentMillis;
        
        if (newPulseDetected && pulseInterval > 0) {
            // Calculate frequency from pulse interval
            float frequency = 1000000.0 / pulseInterval;  // Convert microseconds to Hz
            
            // Print frequency and period
            Serial.print("VR Sensor Frequency: ");
            Serial.print(frequency, 2);
            Serial.print(" Hz | Period: ");
            Serial.print(pulseInterval / 1000.0, 3);
            Serial.println(" ms");
            
            newPulseDetected = false;
        } else {
            Serial.println("VR Sensor: No signal detected");
        }
    }
}

void pickup(unsigned long currentMicros)
{
    switch (pickupState)
    {
    case IDLE:
        // Wait for next period to start new pulse
        if (currentMicros - previousPickupMillis >= pickupPeriod)
        {
            previousPickupMillis = currentMicros;
            pulseStartMicros = currentMicros;
            pickupState = PULSE_HIGH;

            // Start positive pulse (P=HIGH, N=LOW)
            digitalWrite(PICKUP_SIM_P, HIGH);
            digitalWrite(PICKUP_SIM_N, LOW);
        }
        break;

    case PULSE_HIGH:
        // End positive pulse and immediately start negative pulse
        if (currentMicros - pulseStartMicros >= pulseWidth)
        {
            pulseStartMicros = currentMicros;
            pickupState = PULSE_LOW;

            // Start negative pulse (P=LOW, N=HIGH)
            digitalWrite(PICKUP_SIM_P, LOW);
            digitalWrite(PICKUP_SIM_N, HIGH);
        }
        break;

    case PULSE_LOW:
        // End negative pulse and return to idle
        if (currentMicros - pulseStartMicros >= pulseWidth)
        {
            pickupState = IDLE;

            // Return to idle state (both low)
            digitalWrite(PICKUP_SIM_P, LOW);
            digitalWrite(PICKUP_SIM_N, LOW);
        }
        break;
    }
}
