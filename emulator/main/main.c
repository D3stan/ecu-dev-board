#include <stdio.h>
#include <stdbool.h>
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "sim_state.h"
#include "sim_io_outputs.h"
#include "sim_net.h"

// Define the global volatile simulator state instance
volatile sim_state_t g_sim_state = {
    .tps = { .physical_val = 0.0f, .virtual_val = 0.0f, .is_overridden = false },
    .egt = { .physical_val = 20.0f, .virtual_val = 20.0f, .is_overridden = false },
    .rpm = { .physical_val = 1200.0f, .virtual_val = 1200.0f, .is_overridden = false },
    .fault_egt_overheat = false,
    .current_rpm = 1200.0f,       // Start at idle speed
    .current_tps = 0.0f,
    .current_egt = 20.0f,         // Start at ambient temperature
    .spark_detected = true,       // Default to spark present
    .spark_advance = 15.0f        // Default baseline timing (degrees BTDC)
};

/**
 * @brief Run one step of the physical & thermodynamic engine simulation.
 * Called at 100 Hz (dt = 0.01s).
 * 
 * @param dt Time step in seconds.
 */
void run_engine_simulation(float dt)
{
    // --- 1. Throttle Position Sensor (TPS) Input Mapping ---
    float active_tps = g_sim_state.tps.is_overridden ? 
                       g_sim_state.tps.virtual_val : 
                       g_sim_state.tps.physical_val;
    
    // Clamp active TPS to 0.0 - 100.0%
    if (active_tps < 0.0f) active_tps = 0.0f;
    if (active_tps > 100.0f) active_tps = 100.0f;
    g_sim_state.current_tps = active_tps;

    // --- 2. Engine Kinematics (RPM Calculation with Flywheel Inertia) ---
    if (g_sim_state.rpm.is_overridden) {
        g_sim_state.current_rpm = g_sim_state.rpm.virtual_val;
    } else {
        const float RPM_idle = 1200.0f;
        const float RPM_redline = 18000.0f;
        const float tau_inertia = 0.5f;

        // Target RPM depends linearly on active TPS opening percentage
        float tps_fraction = active_tps / 100.0f;
        float rpm_target = RPM_idle + tps_fraction * (RPM_redline - RPM_idle);

        // First-order lag system simulating mechanical drag and rotational inertia
        g_sim_state.current_rpm += ((rpm_target - g_sim_state.current_rpm) / tau_inertia) * dt;
    }

    // Clamp RPM to its safe operating range
    if (g_sim_state.current_rpm < 0.0f) g_sim_state.current_rpm = 0.0f;
    if (g_sim_state.current_rpm > 18000.0f) g_sim_state.current_rpm = 18000.0f;

    // --- 3. Thermodynamics (EGT Simulation) ---
    if (g_sim_state.egt.is_overridden) {
        g_sim_state.current_egt = g_sim_state.egt.virtual_val;
    } else if (g_sim_state.fault_egt_overheat) {
        // Artificially trigger overheat FSM state: rapidly ramp EGT to 850 °C
        const float EGT_target_fault = 850.0f;
        const float tau_thermal_fault = 0.2f; // Rapid thermal response (5x faster)
        g_sim_state.current_egt += ((EGT_target_fault - g_sim_state.current_egt) / tau_thermal_fault) * dt;
    } else {
        const float C_load = 4.0f;
        const float C_speed = 0.03f;
        const float tau_thermal = 2.0f;
        float active_egt_baseline = g_sim_state.egt.physical_val;

        if (active_egt_baseline < 20.0f) active_egt_baseline = 20.0f;
        if (active_egt_baseline > 1000.0f) active_egt_baseline = 1000.0f;

        float egt_target;
        if (!g_sim_state.spark_detected) {
            // Decays towards the physical EGT input if there's no ignition spark
            egt_target = active_egt_baseline;
        } else {
            // Normal EGT calculation based on TPS engine load and rotational speed
            egt_target = active_egt_baseline + (g_sim_state.current_tps * C_load) + (g_sim_state.current_rpm * C_speed);
        }

        // First-order thermal lag system
        g_sim_state.current_egt += ((egt_target - g_sim_state.current_egt) / tau_thermal) * dt;
    }

    // Clamp integrated EGT to safe bounds
    if (g_sim_state.current_egt < 20.0f) g_sim_state.current_egt = 20.0f;
    if (g_sim_state.current_egt > 1000.0f) g_sim_state.current_egt = 1000.0f;

    // Update physical hardware outputs with integrated simulator state values
    sim_io_pickup_set_frequency((uint32_t)(g_sim_state.current_rpm / 60.0f));
    sim_io_set_tps_voltage(g_sim_state.current_tps);
    
    // Scale integrated Celsius temperature to EGT output percentage (0-900 °C maps to 0.0-100.0%)
    float egt_percent = (g_sim_state.current_egt / 900.0f) * 100.0f;
    if (egt_percent < 0.0f) egt_percent = 0.0f;
    if (egt_percent > 100.0f) egt_percent = 100.0f;
    sim_io_set_egt_voltage(egt_percent);
}

/**
 * @brief Serialize current simulator state to structured JSON and output over UART.
 * Called at 10 Hz.
 */
void broadcast_simulator_telemetry(void)
{
    char json_buf[300];
    
    // Take local snapshots of volatile variables for atomic format consistency
    float rpm = g_sim_state.current_rpm;
    float tps = g_sim_state.current_tps;
    float egt = g_sim_state.current_egt;
    float spark_adv = g_sim_state.spark_advance;
    bool spark_det = g_sim_state.spark_detected;
    bool tps_overridden = g_sim_state.tps.is_overridden;
    bool egt_overridden = g_sim_state.egt.is_overridden;
    bool rpm_overridden = g_sim_state.rpm.is_overridden;
    bool fault_active = g_sim_state.fault_egt_overheat;

    // Compose telemetry JSON string
    int len = snprintf(json_buf, sizeof(json_buf),
           "{\"type\": \"sim_telemetry\", \"data\": {\"rpm\": %.1f, \"tps\": %.1f, \"egt\": %.1f, \"ecu_advance\": %.2f, \"spark_detected\": %s, \"overrides\": {\"tps\": %s, \"egt\": %s, \"rpm\": %s, \"egt_fault\": %s}}}",
           rpm, tps, egt, spark_adv,
           spark_det ? "true" : "false",
           tps_overridden ? "true" : "false",
           egt_overridden ? "true" : "false",
           rpm_overridden ? "true" : "false",
           fault_active ? "true" : "false");

    if (len > 0 && len < sizeof(json_buf)) {
        // Output JSON format directly to stdout / UART debug console (with newline)
        printf("%s\n", json_buf);
        
        // Broadcast to all connected Web clients
        sim_net_broadcast(json_buf, len);
    }
}

/**
 * @brief Main application entry point running the strict, time-sliced superloop.
 */
void app_main(void)
{
    // Initialize passive/generative hardware signals
    sim_io_init();
    
    // Initialize Web Server and WebSocket endpoints
    sim_net_init();

    int64_t last_sim_tick = esp_timer_get_time();
    int64_t last_telemetry_tick = esp_timer_get_time();

    const int64_t SIM_TICK_INTERVAL_US = 10000;      // 10ms simulation tick (100 Hz)
    const int64_t TELEMETRY_INTERVAL_US = 100000;    // 100ms telemetry tick (10 Hz)

    printf("[SIM] ECU Simulator Node (Phase 2 Core) Initialized successfully.\n");

    while (1) {
        int64_t now = esp_timer_get_time();

        // Process incoming network messages drained from network handlers
        sim_net_poll();

        // 100 Hz Kinematics and Thermodynamics physics engine tick
        if (now - last_sim_tick >= SIM_TICK_INTERVAL_US) {
            sim_io_read_potentiometers();
            run_engine_simulation(SIM_TICK_INTERVAL_US / 1000000.0f);
            last_sim_tick += SIM_TICK_INTERVAL_US;
            
            // Mitigate CPU schedule drifts or startup lock delays
            if (now - last_sim_tick > SIM_TICK_INTERVAL_US * 10) {
                last_sim_tick = now;
            }
        }

        // 10 Hz telemetry serialization and UART broadcast tick
        if (now - last_telemetry_tick >= TELEMETRY_INTERVAL_US) {
            broadcast_simulator_telemetry();
            last_telemetry_tick += TELEMETRY_INTERVAL_US;
            
            // Mitigate CPU schedule drifts or startup lock delays
            if (now - last_telemetry_tick > TELEMETRY_INTERVAL_US * 10) {
                last_telemetry_tick = now;
            }
        }

        // Fast hardware polling hook (analog cockpit sensors & CDI timing captures)
        sim_io_fast_poll();

        // Yield execution to the FreeRTOS scheduler to prevent Task Watchdog resets
        vTaskDelay(pdMS_TO_TICKS(1));
    }
}

// End of file
