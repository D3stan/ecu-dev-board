#pragma once
#include <Arduino.h>

// LED Pins
// constexpr uint8_t LED_BUILTIN_PIN = 2;
constexpr uint8_t R_LED = 21;
constexpr uint8_t G_LED = 33;
constexpr uint8_t B_LED = 34;

// Pickup Pins
constexpr uint8_t PICKUP_SIM_P = 17;
constexpr uint8_t PICKUP_SIM_N = 18;
constexpr uint8_t PICKUP_SQUARE = 2;

// Quickshift Pins
constexpr uint8_t QS_SSR = 15;
constexpr uint8_t QS_SCR = 16;
constexpr uint8_t QS_TCI = 35;
constexpr uint8_t QS_RELAY = 6;

// Actuator Pins
constexpr uint8_t POWERJET = 36;
constexpr uint8_t CDI = 4;
constexpr uint8_t RELAY_PIN = 27;

// Sensor Pins
constexpr uint8_t TSP = 7;
constexpr uint8_t MAP_SW = 14;

constexpr uint8_t PIEZO = 8;
constexpr uint8_t PIEZO_SCHMITT = 10;

constexpr uint8_t QS_SW = 9;
constexpr uint8_t QS_ENABLE = 13;

constexpr uint8_t SPARK_TCI = 37;
constexpr uint8_t SPARK_CDI_SSR = 3;
constexpr uint8_t SPARK_CDI = 11;
constexpr uint8_t SPARK_CDI_AC = 12;
