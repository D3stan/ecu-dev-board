#pragma once

#include <deque>
#include <optional>

#include "sensors/domain/types.hpp"

namespace ecu::sensors {

struct KnockConfig {
    std::uint32_t saturation_count{65535};
};

class KnockSensor {
public:
    explicit KnockSensor(KnockConfig config);
    KnockWindowMeasurement process(const KnockWindowContext &context, const TpicWindowResult &result);
    KnockWindowMeasurement unavailable(const KnockWindowContext &context, SensorFault fault) const;

private:
    KnockConfig config_{};
};

struct KnockFeatureConfig {
    std::size_t queue_capacity{8};
    float background_default{1000.0f};
};

class KnockFeatureExtractor {
public:
    explicit KnockFeatureExtractor(KnockFeatureConfig config);
    bool submit(const KnockWindowMeasurement &measurement);
    std::optional<KnockFeatureRecord> extract_next();
    std::uint32_t dropped_count() const { return dropped_count_; }

private:
    KnockFeatureConfig config_{};
    std::deque<KnockWindowMeasurement> queue_{};
    std::uint32_t dropped_count_{0};
    float background_{0.0f};
};

} // namespace ecu::sensors
