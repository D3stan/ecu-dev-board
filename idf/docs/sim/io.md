# Simulator I/O Interface Specification

The **I/O Interface** is the physical hardware layer of the Simulator. It leverages ESP32 on-chip peripherals (LEDC, DAC, ADC, and GPIO hardware interrupts) to generate and measure engine signals with microsecond-level accuracy.

---

## 1. Pick-up Coil Signal Generator (Crankshaft Output)

The Simulator must emit a precise square wave representing the pick-up sensor pulse. 
- **Physical Output Pin**: `GPIO 25` (connected to ECU Crank Input `GPIO 4`).
- **Frequency Range**: 0 to 300 Hz (corresponding to 0–18,000 RPM on a single-pulse-per-revolution single-cylinder motor).
  
  $$\text{Frequency (Hz)} = \frac{\text{RPM}}{60}$$

### Hardware Implementation: LEDC (Hardware PWM)
Instead of software-toggling a GPIO (which is vulnerable to interrupt jitter and CPU stalling), the simulator uses the ESP32 **LEDC (LED Control)** peripheral. Once configured, LEDC runs entirely in hardware, consuming 0% CPU.

```c
#include "driver/ledc.h"

void sim_io_pickup_init(void) {
    ledc_timer_config_t ledc_timer = {
        .speed_mode       = LEDC_HIGH_SPEED_MODE,
        .timer_num        = LEDC_TIMER_0,
        .duty_resolution  = LEDC_TIMER_10_BIT,
        .freq_hz          = 10,                 // Start frequency (10 Hz)
        .clk_cfg          = LEDC_AUTO_CLK
    };
    ledc_timer_config(&ledc_timer);

    ledc_channel_config_t ledc_channel = {
        .speed_mode     = LEDC_HIGH_SPEED_MODE,
        .channel        = LEDC_CHANNEL_0,
        .timer_sel      = LEDC_TIMER_0,
        .intr_type      = LEDC_INTR_DISABLE,
        .gpio_num       = 25,
        .duty           = 512,                 // 50% duty cycle square wave
        .hpoint         = 0
    };
    ledc_channel_config(&ledc_channel);
}

void sim_io_pickup_set_frequency(uint32_t freq) {
    if (freq == 0) {
        ledc_set_duty(LEDC_HIGH_SPEED_MODE, LEDC_CHANNEL_0, 0); // Stop pulsing
    } else {
        ledc_set_freq(LEDC_HIGH_SPEED_MODE, LEDC_TIMER_0, freq);
        ledc_set_duty(LEDC_HIGH_SPEED_MODE, LEDC_CHANNEL_0, 512); // Keep 50% duty
    }
    ledc_update_duty(LEDC_HIGH_SPEED_MODE, LEDC_CHANNEL_0);
}
```

---

## 2. Analog Sensor Simulation (TPS & EGT Voltages)

The ECU reads TPS and EGT via analog voltages (0–3.3V). The simulator produces these signals using the ESP32's on-chip DACs or high-frequency filtered PWM.
- **TPS Output Pin**: `GPIO 26` (ECU TPS input `GPIO 5`).
- **EGT Output Pin**: `GPIO 27` (ECU EGT input `GPIO 6`).

### Hardware Implementation: On-Chip DAC
The ESP32 features two 8-bit Digital-to-Analog Converters (DAC) mapped to GPIO 25 and GPIO 26. Since GPIO 25 is assigned to Pick-up generation, we combine:
1. **TPS**: Handled via DAC Channel 2 on `GPIO 26` (direct voltage output).
2. **EGT**: Handled via **High-Frequency LEDC PWM** on `GPIO 27` paired with an external RC low-pass filter (10 kΩ resistor, 10 μF capacitor) to smooth the pulse-width modulation into a clean, noise-free analog DC voltage.

```c
#include "driver/dac.h"

void sim_io_analog_out_init(void) {
    // Enable DAC channel 2 for TPS
    dac_output_enable(DAC_CHANNEL_2); 
    
    // Initialize EGT PWM output channel on GPIO 27 (frequency > 50 kHz for easy RC filtering)
    // ... ledc configuration on GPIO 27 ...
}

void sim_io_set_tps_voltage(float percent) {
    // scale 0.0-100.0% to 0-255 DAC value
    uint8_t dac_val = (uint8_t)((percent / 100.0f) * 255.0f);
    dac_output_voltage(DAC_CHANNEL_2, dac_val);
}
```

---

## 3. CDI Spark Advance Measurement (Input Capture)

The simulator measures the exact crankshaft degree offset when the ECU triggers the ignition.
- **Spark Input Pin**: `GPIO 34` (connected to ECU CDI Trigger `GPIO 7`).
- **Measurement Method**: GPIO Interrupt Service Routine (ISR) capturing hardware timestamps.

### Time-to-Angle Calculation
In single-cylinder CDI systems, the ECU fires the spark *before* the crankshaft reaches the pick-up sensor point. The simulator calculates this advance by measuring the time delay between the spark pulse and the subsequent pick-up trigger.

```
Pick-up (LEDC Gen):  ______|¯¯¯¯¯¯¯¯|______ (Generated)
                            ^ t_pickup
Spark (ECU Trigger):   __|¯|________________ (Captured)
                         ^ t_spark
                         |<-- Delta T -->|
```

1. **Spark Interrupt**: On a rising edge on `GPIO 34`, record `t_spark = esp_timer_get_time()`.
2. **Pick-up Output Event**: When generating the pick-up pulse edge, record `t_pickup`.
3. **Advance Angle Equation**:
   
   $$\text{Delta T (seconds)} = \frac{t_{\text{pickup}} - t_{\text{spark}}}{1,000,000}$$
   
   $$\text{Advance Degrees} = \text{Delta T} \times 360^\circ \times \left(\frac{\text{RPM}}{60}\right)$$

```c
static volatile uint64_t t_spark = 0;
static volatile uint64_t t_pickup = 0;

static void IRAM_ATTR spark_isr_handler(void* arg) {
    t_spark = esp_timer_get_time();
}

float sim_io_get_spark_advance(float current_rpm) {
    if (t_spark == 0 || t_pickup == 0 || current_rpm < 100) return 0.0f;
    
    uint64_t dt = t_pickup - t_spark;
    
    // Filter out historical spark captures
    if (dt > 100000) return 0.0f; // Limit to 100ms
    
    float dt_sec = (float)dt / 1000000.0f;
    float rps = current_rpm / 60.0f;
    float advance = dt_sec * 360.0f * rps;
    
    return advance;
}
```

---

## 4. Physical Potentiometers (Manual Cockpit)

For quick bench-top manual tuning, the simulator reads physical knobs connected to ADC1:
- **TPS Potentiometer**: `GPIO 32` (ADC1 Channel 4).
- **EGT Potentiometer**: `GPIO 33` (ADC1 Channel 5).

The inputs are read periodically inside the superloop, smoothed using a **4-sample moving average filter** to eliminate ADC noise, and passed to the MCU Core parameter engine.
