#pragma once

#include "sensors/domain/types.hpp"

namespace ecu::sensors {

struct PickupConfig {
    EdgePolarity relevant_edge{EdgePolarity::Falling};
    TimestampUs minimum_interval_us{1000};
};

class PickupSensor {
public:
    explicit PickupSensor(PickupConfig config);
    PickupCaptureEvent process(const EdgeCapture &capture);

private:
    PickupConfig config_{};
    bool has_last_{false};
    TimestampUs last_valid_at_{0};
};

struct EngineStateConfig {
    std::uint8_t startup_edges_required{2};
    TimestampUs stale_timeout_us{100000};
    float minimum_rpm{0.0f};
    float maximum_rpm{25000.0f};
};

class EngineStateEstimator {
public:
    explicit EngineStateEstimator(EngineStateConfig config);
    SensorReading<EngineSpeedState> process(const EdgeCapture &capture);
    SensorReading<EngineSpeedState> check_stale(TimestampUs now);

private:
    EngineStateConfig config_{};
    SensorReading<EngineSpeedState> last_{};
    bool has_last_capture_{false};
    TimestampUs last_capture_at_{0};
    float last_rpm_{0.0f};
    std::uint8_t accepted_edges_{0};
    RevolutionId revolution_id_{0};
};

} // namespace ecu::sensors
