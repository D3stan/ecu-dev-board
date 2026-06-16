#pragma once

#include <cstddef>
#include <cstdint>
#include <string>

#include "telemetry/sensor_telemetry_collector.hpp"
#include "telemetry_server/telemetry_transport.hpp"

namespace ecu::telemetry_server {

struct TelemetryJsonSerializerConfig {
    const char *schema{"ecu.telemetry.v1"};
    std::uint32_t schema_version{1};
    std::uint32_t state_hz{10};
    std::size_t events_per_batch{8};
};

class TelemetryJsonSerializer {
public:
    explicit TelemetryJsonSerializer(TelemetryJsonSerializerConfig config = {});

    std::string serialize_capabilities() const;
    std::string serialize_batch(const ecu::telemetry::TelemetryBatch &batch,
                                const TelemetryTransportCounters &transport) const;

    const TelemetryJsonSerializerConfig &config() const { return config_; }

private:
    TelemetryJsonSerializerConfig config_{};
};

} // namespace ecu::telemetry_server
