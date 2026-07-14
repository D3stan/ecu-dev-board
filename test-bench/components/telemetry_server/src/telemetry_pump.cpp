#include "telemetry_server/telemetry_pump.hpp"

#include <new>
#include <string_view>

namespace ecu::telemetry_server {

TelemetryPump::TelemetryPump(
    ecu::telemetry::TelemetryCollector &collector,
    const TelemetryJsonSerializer &serializer,
    ITelemetryTransport &transport,
    std::size_t maximum_frame_bytes)
    : collector_(collector),
      serializer_(serializer),
      transport_(transport),
      buffer_(maximum_frame_bytes == 0
                  ? nullptr
                  : new (std::nothrow) char[maximum_frame_bytes]),
      buffer_size_(maximum_frame_bytes) {}

bool TelemetryPump::valid() const {
    return buffer_ != nullptr && buffer_size_ != 0;
}

bool TelemetryPump::tick(ecu::telemetry::TimestampUs now) {
    if (!valid() || !transport_.connected()) return false;
    if (!transport_.ready()) {
        transport_.note_dropped_frame();
        return false;
    }
    auto batch = collector_.collect(now);
    if (!batch.has_value()) return false;
    const auto result = serializer_.serialize_batch(*batch,
                                                    transport_.counters(),
                                                    buffer_.get(),
                                                    buffer_size_);
    if (!result.ok) {
        transport_.note_send_error();
        return false;
    }
    return transport_.send_text(std::string_view(buffer_.get(), result.size));
}

} // namespace ecu::telemetry_server
