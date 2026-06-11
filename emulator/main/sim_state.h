/**
 * @file sim_state.h
 * @brief Global state and dynamic simulator telemetry structures.
 * 
 * Part of the ECU Simulator Node implementation (Phase 2).
 */

#pragma once

#include <stdbool.h>
#include <stdint.h>

/**
 * @brief Structure tracking a single simulator parameter with support for virtual overrides.
 */
typedef struct {
    float physical_val;   // Read directly from hardware ADC/potentiometer
    float virtual_val;    // Overridden value from Web UI slider
    bool is_overridden;   // Override active flag
} sim_parameter_t;

typedef struct {
    int tps_raw;
    int tps_mv;
    float tps_fraction;
    float tps_physical;
    float active_tps;
    uint8_t tps_dac_code;
    bool tps_dac_ok;
    bool tps_override;

    int egt_raw;
    int egt_mv;
    float egt_fraction;
    float egt_physical;
    float current_egt;
    uint8_t egt_dac_code;
    bool egt_dac_ok;
    bool egt_override;
} sim_io_debug_t;

/**
 * @brief Structure tracking dynamic and virtual variables of the ECU Simulator.
 */
typedef struct {
    sim_parameter_t tps;
    sim_parameter_t egt;
    sim_parameter_t rpm;  // Allowing manual RPM lock (bypassing throttle)
    bool fault_egt_overheat; // Artificially force EGT above ALARM threshold (>800°C)
    float current_rpm;
    float current_tps;
    float current_egt;
    bool spark_detected;    // True if active spark captured within past rotation periods
    float spark_advance;    // Calculated spark advance angle (BTDC degrees)
    sim_io_debug_t io_debug;
} sim_state_t;

extern volatile sim_state_t g_sim_state;

