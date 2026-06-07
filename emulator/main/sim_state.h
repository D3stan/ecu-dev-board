/**
 * @file sim_state.h
 * @brief Global state and dynamic simulator telemetry structures.
 * 
 * Part of the ECU Simulator Node implementation (Phase 2).
 */

#pragma once

#include <stdbool.h>

/**
 * @brief Structure tracking dynamic and virtual variables of the ECU Simulator.
 */
typedef struct {
    float tps;              // Throttle Position Sensor (0.0 - 100.0 %)
    float egt;              // Exhaust Gas Temp (20.0 - 1000.0 °C)
    float rpm;              // Engine Rotational Speed (0.0 - 18000.0 RPM)
    bool spark_detected;    // True if active spark captured within past rotation periods
    float spark_advance;    // Calculated spark advance angle (BTDC degrees)
} sim_state_t;
