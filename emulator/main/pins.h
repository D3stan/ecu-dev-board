// pins.h - Centralized Pin Assignments
#pragma once

#include "sdkconfig.h"

#if CONFIG_IDF_TARGET_ESP32S2
#define SIM_PIN_PICKUP      13    // Pick-up Coil Pulse Output (LEDC)
#define SIM_PIN_TPS_OUT     18    // TPS Simulated Analog Output (DAC Channel 2 / GPIO 18 on ESP32-S2)
#define SIM_PIN_EGT_OUT     17    // EGT Simulated Analog Output (DAC Channel 1 / GPIO 17 on ESP32-S2)
#define SIM_PIN_SPARK       21    // CDI Spark Input (GPIO Interrupt)
#define SIM_PIN_QS_OUT      12    // Quick-Shifter digital pulse output (Active-Low)
#define SIM_PIN_QS_IN       14    // Physical Quick-Shifter button input (Active-Low)

#define SIM_PIN_TPS_POT     1     // Physical TPS Potentiometer Input (ADC1_CH0)
#define SIM_PIN_EGT_POT     2     // Physical EGT Potentiometer Input (ADC1_CH1)
#else
// Default/Standard ESP32 pin definitions, avoiding pin conflict on GPIO 25
#define SIM_PIN_PICKUP      4     // Pick-up Coil Pulse Output (LEDC)
#define SIM_PIN_TPS_OUT     26    // TPS Simulated Analog Output (DAC Channel 2 / GPIO 26 on ESP32)
#define SIM_PIN_EGT_OUT     25    // EGT Simulated Analog Output (DAC Channel 1 / GPIO 25 on ESP32)
#define SIM_PIN_SPARK       34    // CDI Spark Input (GPIO Interrupt)
#define SIM_PIN_QS_OUT      12    // Quick-Shifter digital pulse output (Active-Low)
#define SIM_PIN_QS_IN       13    // Physical Quick-Shifter button input (Active-Low)

#define SIM_PIN_TPS_POT     32    // Physical TPS Potentiometer Input (ADC1)
#define SIM_PIN_EGT_POT     33    // Physical EGT Potentiometer Input (ADC1)
#endif
