#include "sensors/sensors/analog_transfer.hpp"

#include <cmath>

namespace ecu::sensors {

namespace {

constexpr float kKelvinOffset = 273.15f;

float celsius_to_kelvin(float celsius) {
    return celsius + kKelvinOffset;
}

} // namespace

PullupNtcTransfer::PullupNtcTransfer(PullupNtcConfig config) : config_(config) {}

bool PullupNtcTransfer::config_valid() const {
    return config_.vref_mv > 0 &&
           config_.fixed_resistance_ohms > 0.0f &&
           config_.nominal_resistance_ohms > 0.0f &&
           config_.beta_kelvin > 0.0f &&
           celsius_to_kelvin(config_.nominal_temperature_celsius) > 0.0f;
}

std::optional<float> PullupNtcTransfer::celsius_from_millivolts(int millivolts) const {
    if (!config_valid() || millivolts <= 0 || millivolts >= config_.vref_mv) {
        return std::nullopt;
    }

    const float voltage = static_cast<float>(millivolts);
    const float vref = static_cast<float>(config_.vref_mv);
    const float ntc_resistance = config_.fixed_resistance_ohms * voltage / (vref - voltage);
    if (ntc_resistance <= 0.0f) {
        return std::nullopt;
    }

    const float nominal_kelvin = celsius_to_kelvin(config_.nominal_temperature_celsius);
    const float inverse_kelvin = (1.0f / nominal_kelvin) +
                                 (std::log(ntc_resistance / config_.nominal_resistance_ohms) /
                                  config_.beta_kelvin);
    if (inverse_kelvin <= 0.0f) {
        return std::nullopt;
    }

    return (1.0f / inverse_kelvin) - kKelvinOffset;
}

} // namespace ecu::sensors
