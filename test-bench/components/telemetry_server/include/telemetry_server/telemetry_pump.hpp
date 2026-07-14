#pragma once

#include <cstddef>
#include <memory>

#include "telemetry/telemetry_collector.hpp"
#include "telemetry_server/telemetry_json_serializer.hpp"
#include "telemetry_server/telemetry_transport.hpp"

namespace ecu::telemetry_server {

class TelemetryPump {
public:
    TelemetryPump(ecu::telemetry::TelemetryCollector &collector,
                  const TelemetryJsonSerializer &serializer,
                  ITelemetryTransport &transport,
                  std::size_t maximum_frame_bytes);

    bool valid() const;
    bool tick(ecu::telemetry::TimestampUs now);

private:
    ecu::telemetry::TelemetryCollector &collector_;
    const TelemetryJsonSerializer &serializer_;
    ITelemetryTransport &transport_;
    std::unique_ptr<char[]> buffer_{};
    std::size_t buffer_size_{0};
};

} // namespace ecu::telemetry_server
