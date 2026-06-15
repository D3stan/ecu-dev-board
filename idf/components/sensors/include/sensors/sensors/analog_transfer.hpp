#pragma once

#include <optional>

namespace ecu::sensors {

struct PullupNtcConfig {
    int vref_mv{3300};
    float fixed_resistance_ohms{10000.0f};
    float nominal_resistance_ohms{10000.0f};
    float nominal_temperature_celsius{25.0f};
    float beta_kelvin{3950.0f};
};

class PullupNtcTransfer {
public:
    explicit PullupNtcTransfer(PullupNtcConfig config);

    bool config_valid() const;
    std::optional<float> celsius_from_millivolts(int millivolts) const;

private:
    PullupNtcConfig config_{};
};

} // namespace ecu::sensors
