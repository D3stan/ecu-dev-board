#pragma once

#include "sensors/domain/types.hpp"

namespace ecu::sensors {

struct TpsConfig {
    int closed_mv{0};
    int open_mv{3300};
    int minimum_valid_mv{0};
    int maximum_valid_mv{3300};
    TimestampUs stale_timeout_us{100000};
    std::uint8_t recovery_samples{2};
    int filter_alpha_permille{1000};
    int fallback_permille{700};
};

class TpsSensor {
public:
    explicit TpsSensor(TpsConfig config);

    SensorReading<ThrottlePositionPermille> process(const AnalogSample &sample);
    SensorReading<ThrottlePositionPermille> check_stale(TimestampUs now);
    const SensorReading<ThrottlePositionPermille> &last_reading() const { return last_; }

private:
    SensorReading<ThrottlePositionPermille> invalid_reading(TimestampUs acquired_at, SensorFault fault, SensorHealthState health);
    bool config_valid() const;

    TpsConfig config_{};
    SensorReading<ThrottlePositionPermille> last_{};
    bool has_filtered_{false};
    int filtered_permille_{0};
    TimestampUs last_sample_at_{0};
};

} // namespace ecu::sensors
