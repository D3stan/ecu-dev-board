#pragma once
#include <Arduino.h>

// LED Pins
// consteval uint8_t LED_BUILTIN_PIN = 2;
consteval uint8_t R_LED = 21;
consteval uint8_t G_LED = 33;
consteval uint8_t B_LED = 34;

// Pickup Pins
consteval uint8_t PICKUP_SIM_P = 17;
consteval uint8_t PICKUP_SIM_N = 18;
consteval uint8_t PICKUP_SQUARE = 2;

// Quickshift Pins
consteval uint8_t QS_SSR = 15;
consteval uint8_t QS_SCR = 16;
consteval uint8_t QS_TCI = 35;
consteval uint8_t QS_RELAY = 6;

// Spark Pins
consteval uint8_t SPARK_TCI = 37;
consteval uint8_t SPARK_CDI_SSR = 3;

// Actuator Pins
consteval uint8_t POWERJET = 36;
consteval uint8_t CDI = 4;
consteval uint8_t RELAY_PIN = 27;

// Sensor Pins
consteval uint8_t TSP = 7;
consteval uint8_t MAP_SW = 14;

consteval uint8_t PIEZO = 8;
consteval uint8_t PIEZO_SCHMITT = 10;

consteval uint8_t QS_SW = 9;
consteval uint8_t QS_ENABLE = 13;

consteval uint8_t SPARK_TCI = 37;
consteval uint8_t SPARK_CDI_SSR = 3;
consteval uint8_t SPARK_CDI = 11;
consteval uint8_t SPARK_CDI_AC = 12;
