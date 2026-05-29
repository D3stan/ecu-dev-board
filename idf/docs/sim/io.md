# Simulator I/O Interface Specification

The **I/O Interface** is the physical hardware layer of the Simulator. It leverages on-chip peripherals (LEDC, DAC, ADC, and GPIO interrupts) to generate and measure engine signals with high precision.

---

## Centralized Pin Mappings (`pins.h`)

To ensure portability across various development board variants (such as ESP32 and ESP32-S2), all physical pin allocations are defined in a centralized `pins.h` configuration header. The following macros must be used throughout the implementation:

```c
// pins.h - Centralized Pin Assignments
#pragma once

#define SIM_PIN_PICKUP      25    // Pick-up Coil Pulse Output (LEDC)
#define SIM_PIN_TPS_OUT     26    // TPS Simulated Analog Output (DAC Channel 2)
#define SIM_PIN_EGT_OUT     27    // EGT Simulated Analog Output (LEDC PWM)
#define SIM_PIN_SPARK       34    // CDI Spark Input (GPIO Interrupt)
#define SIM_PIN_QS_OUT      12    // Quick-Shifter digital pulse output (Active-Low)

#define SIM_PIN_TPS_POT     32    // Physical TPS Potentiometer Input (ADC1)
#define SIM_PIN_EGT_POT     33    // Physical EGT Potentiometer Input (ADC1)
```

---

## 1. Pick-up Coil Signal Generator (Crankshaft Output)

The Simulator emits a precise square wave representing the pick-up sensor pulse.
- **Physical Output Pin**: `SIM_PIN_PICKUP` (defined in `pins.h`).
- **Frequency Range**: Dynamically tunable based on the RPM selected via the Web UI or analog controls, according to the equation:
  
  $$\text{Frequency (Hz)} = \frac{\text{RPM}}{60}$$

### Hardware Implementation: LEDC (Hardware PWM)
The simulator utilizes the **LEDC (LED Control)** peripheral to generate the crankshaft signal. LEDC runs in hardware, consuming 0% CPU after initialization. On ESP32-S2/ESP32, the LEDC timer clock source must be chosen to support the full dynamic frequency range without prescaler overflows (e.g. using `LEDC_USE_REF_TICK` or `LEDC_USE_RTC8M_CLK` as appropriate).

```c
#include "driver/ledc.h"
#include "pins.h"

void sim_io_pickup_init(void) {
    ledc_timer_config_t ledc_timer = {
        .speed_mode       = LEDC_HIGH_SPEED_MODE,
        .timer_num        = LEDC_TIMER_0,
        .duty_resolution  = LEDC_TIMER_10_BIT,
        .freq_hz          = 10,                 // Dynamic start frequency (10 Hz)
        .clk_cfg          = LEDC_AUTO_CLK       // Auto or REF_TICK depending on target board
    };
    ledc_timer_config(&ledc_timer);

    ledc_channel_config_t ledc_channel = {
        .speed_mode     = LEDC_HIGH_SPEED_MODE,
        .channel        = LEDC_CHANNEL_0,
        .timer_sel      = LEDC_TIMER_0,
        .intr_type      = LEDC_INTR_DISABLE,
        .gpio_num       = SIM_PIN_PICKUP,
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
        ledc_set_duty(LEDC_HIGH_SPEED_MODE, LEDC_CHANNEL_0, 512); // Maintain 50% duty
    }
    ledc_update_duty(LEDC_HIGH_SPEED_MODE, LEDC_CHANNEL_0);
}
```

---

## 2. Analog Sensor Simulation (TPS & EGT Voltages)

The ECU reads TPS and EGT via analog voltages (0–3.3V). The simulator produces these signals using the on-chip DAC or filtered PWM.
- **TPS Output Pin**: `SIM_PIN_TPS_OUT` (ECU TPS input).
- **EGT Output Pin**: `SIM_PIN_EGT_OUT` (ECU EGT input).

### Hardware Implementation
1. **TPS**: Handled via DAC Channel 2 on `SIM_PIN_TPS_OUT` (direct analog voltage output).
2. **EGT**: Handled via **High-Frequency LEDC PWM** on `SIM_PIN_EGT_OUT` (utilizing a dedicated LEDC timer separate from the pickup coil timer) paired with an external RC low-pass filter (e.g. 10 kΩ resistor, 10 μF capacitor) to smooth the signal into a noise-free DC voltage.

```c
#include "driver/dac.h"
#include "pins.h"

void sim_io_analog_out_init(void) {
    // Enable DAC channel for TPS
    dac_output_enable(DAC_CHANNEL_2); 
    
    // Initialize EGT PWM output channel on EGT pin using dedicated LEDC timer
    // ... config of EGT PWM ...
}

void sim_io_set_tps_voltage(float percent) {
    // Scale 0.0-100.0% to 0-255 DAC value
    uint8_t dac_val = (uint8_t)((percent / 100.0f) * 255.0f);
    dac_output_voltage(DAC_CHANNEL_2, dac_val);
}
```

---

## 3. CDI Spark Advance Measurement (Input Capture)

The simulator measures the relative crankshaft degree offset of the ECU's spark output.
- **Spark Input Pin**: `SIM_PIN_SPARK` (connected to ECU CDI Trigger).
- **Measurement Method**: Passive GPIO Interrupt Service Routine (ISR) capturing hardware timestamps.

### Time-to-Angle Calculation
The Pick-up signal generation operates open-loop (independent of the spark). The spark measurement system is a passive observer. It calculates spark advance by measuring the time delay between the captured ECU spark pulse and the generated pick-up signal.

```
Pick-up (LEDC Gen):  ______|¯¯¯¯¯¯¯¯|______ (Generated)
                            ^ t_pickup
Spark (ECU Trigger):   __|¯|________________ (Captured)
                          ^ t_spark
                          |<-- Delta T -->|
```

1. **Spark Interrupt**: On a rising edge on `SIM_PIN_SPARK`, the ISR records `t_spark = esp_timer_get_time()`.
2. **Pick-up Timestamp**: The system acquires `t_pickup` corresponding to the generated wave cycle.
3. **Advance Angle Equation**:
   
   $$\text{Delta T (seconds)} = \frac{t_{\text{pickup}} - t_{\text{spark}}}{1,000,000}$$
   
   $$\text{Advance Degrees} = \text{Delta T} \times 360^\circ \times \left(\frac{\text{RPM}}{60}\right)$$

```c
static volatile uint64_t t_spark = 0;
static volatile uint64_t t_pickup = 0; // Set via software track or loopback interrupt

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
- **TPS Potentiometer**: `SIM_PIN_TPS_POT` (ADC1 Channel 4).
- **EGT Potentiometer**: `SIM_PIN_EGT_POT` (ADC1 Channel 5).

The inputs are read periodically inside the superloop, smoothed using a **4-sample moving average filter** to eliminate ADC noise, and passed to the MCU Core parameter engine.

---

## 5. Quick-Shifter Switch Pulse Output

To support testing the ECU's Quick-Shifter (QS) trigger logic, the simulator features a digital pulse generator that acts as a physical button simulator.
- **Physical Output Pin**: `SIM_PIN_QS_OUT` (connected to the ECU's active-low digital input).
- **Operation**: In its default idle state, the simulator keeps `SIM_PIN_QS_OUT` in a high state (normally pulled high by the ECU or internal pullup). When triggered via the Web UI, the simulator pulls the pin low for a brief duration (e.g., 50–100ms) to simulate a physical shifter cut pulse.
