#ifndef SIM_IO_OUTPUTS_H
#define SIM_IO_OUTPUTS_H

#include <stdint.h>

/**
 * @brief Initialize all hardware simulator outputs (LEDC, DAC, GPIO).
 */
void sim_io_init(void);

/**
 * @brief Dynamically set the pick-up coil frequency in Hz.
 * 
 * @param freq Target frequency in Hz (0 to stop pulsing).
 */
void sim_io_pickup_set_frequency(uint32_t freq);

/**
 * @brief Set the throttle position sensor (TPS) simulated analog output.
 * 
 * @param percent Throttle opening percentage (0.0 to 100.0%).
 */
void sim_io_set_tps_voltage(float percent);

/**
 * @brief Set the exhaust gas temperature (EGT) simulated analog output.
 * 
 * @param percent EGT percentage scaling (0.0 to 100.0%).
 */
void sim_io_set_egt_voltage(float percent);

/**
 * @brief Trigger a non-blocking active-low Quick-Shifter pulse.
 */
void sim_io_qs_trigger(void);

/**
 * @brief Fast polling function to be called in the superloop.
 *
 * Handles active QS output pulse timing and debounced physical QS input polling.
 */
void sim_io_fast_poll(void);

/**
 * @brief Read analog cockpit potentiometer values (TPS and EGT) and update global simulator state.
 */
void sim_io_read_potentiometers(void);

#endif // SIM_IO_OUTPUTS_H
