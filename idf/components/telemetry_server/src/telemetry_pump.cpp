#include "telemetry_server/telemetry_pump.hpp"

namespace ecu::telemetry_server {

TelemetryPump::TelemetryPump(ITelemetryBatchSource &source,
                             const TelemetryJsonSerializer &serializer,
                             ITelemetryTransport &transport)
    : source_(source), serializer_(serializer), transport_(transport) {}

bool TelemetryPump::tick(ecu::sensors::TimestampUs now) {
    if (!transport_.connected()) {
        return false;
    }

    if (!transport_.ready()) {
        transport_.note_dropped_frame();
        return false;
    }

    auto batch = source_.collect(now);
    if (!batch.has_value()) {
        return false;
    }

    const auto payload = serializer_.serialize_batch(*batch, transport_.counters(), next_batch_seq_);
    const bool sent = transport_.send_text(payload);
    if (sent) {
        ++next_batch_seq_;
    }
    return sent;
}

} // namespace ecu::telemetry_server
