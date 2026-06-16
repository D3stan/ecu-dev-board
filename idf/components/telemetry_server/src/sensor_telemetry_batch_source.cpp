#include "telemetry_server/telemetry_pump.hpp"

namespace ecu::telemetry_server {

SensorTelemetryBatchSource::SensorTelemetryBatchSource(ecu::sensors::SensorDataStore &store,
                                                       ecu::telemetry::SensorTelemetryCollectorConfig config)
    : collector_(store, config) {}

std::optional<ecu::telemetry::TelemetryBatch> SensorTelemetryBatchSource::collect(ecu::sensors::TimestampUs now) {
    return collector_.collect(now);
}

} // namespace ecu::telemetry_server
