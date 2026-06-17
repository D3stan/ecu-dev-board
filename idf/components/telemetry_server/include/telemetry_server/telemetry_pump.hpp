#pragma once

#include <optional>

#include "sensors/domain/types.hpp"
#include "telemetry/sensor_telemetry_collector.hpp"
#include "telemetry_server/telemetry_json_serializer.hpp"
#include "telemetry_server/telemetry_transport.hpp"

namespace ecu::telemetry_server {

class ITelemetryBatchSource {
public:
    virtual ~ITelemetryBatchSource() = default;

    virtual std::optional<ecu::telemetry::TelemetryBatch> collect(ecu::sensors::TimestampUs now) = 0;
};

class TelemetryPump {
public:
    TelemetryPump(ITelemetryBatchSource &source,
                  const TelemetryJsonSerializer &serializer,
                  ITelemetryTransport &transport);

    bool tick(ecu::sensors::TimestampUs now);

private:
    ITelemetryBatchSource &source_;
    const TelemetryJsonSerializer &serializer_;
    ITelemetryTransport &transport_;
    uint32_t next_batch_seq_{1};
};

class SensorTelemetryBatchSource final : public ITelemetryBatchSource {
public:
    SensorTelemetryBatchSource(ecu::sensors::SensorDataStore &store,
                               ecu::telemetry::SensorTelemetryCollectorConfig config = {});

    std::optional<ecu::telemetry::TelemetryBatch> collect(ecu::sensors::TimestampUs now) override;

private:
    ecu::telemetry::SensorTelemetryCollector collector_;
};

} // namespace ecu::telemetry_server
