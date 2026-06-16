#pragma once

#include <cstdint>
#include <string_view>

namespace ecu::telemetry_server {

struct TelemetryTransportCounters {
    std::uint64_t sent_frames{0};
    std::uint64_t dropped_frames{0};
    std::uint64_t send_errors{0};
};

class ITelemetryTransport {
public:
    virtual ~ITelemetryTransport() = default;

    virtual bool connected() const = 0;
    virtual bool ready() const = 0;
    virtual bool send_text(std::string_view payload) = 0;
    virtual void note_dropped_frame() = 0;
    virtual TelemetryTransportCounters counters() const = 0;
};

} // namespace ecu::telemetry_server
