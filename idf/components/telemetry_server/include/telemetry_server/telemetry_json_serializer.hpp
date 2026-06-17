#pragma once

#include <cstddef>
#include <cstdint>
#include <string>

#include "telemetry/sensor_telemetry_collector.hpp"
#include "telemetry_server/device_identity.hpp"
#include "telemetry_server/recording_state.hpp"
#include "telemetry_server/telemetry_transport.hpp"

namespace ecu::telemetry_server {

struct TelemetryJsonSerializerConfig {
    const char *schema{"ecu.telemetry.v1"};
    std::uint32_t schema_version{1};
    std::uint32_t state_hz{10};
    std::size_t   events_per_batch{8};
    DeviceIdentity device{};
    RecordingConfig recording{};
};

class TelemetryJsonSerializer {
public:
    explicit TelemetryJsonSerializer(TelemetryJsonSerializerConfig config = {});

    /// Capabilities frame (sent on WS connect).
    std::string serialize_capabilities() const;

    /// Telemetry batch frame (periodic). batch_seq is a monotonically-increasing counter.
    std::string serialize_batch(const ecu::telemetry::TelemetryBatch &batch,
                                const TelemetryTransportCounters &transport,
                                uint32_t batch_seq) const;

    /// recording_config response frame.
    std::string serialize_recording_config(const RecordingConfig &cfg) const;

    /// run_started event frame.
    std::string serialize_run_started(uint32_t ecu_run_id, uint64_t started_at_us) const;

    /// run_ended event frame.
    std::string serialize_run_ended(uint32_t ecu_run_id, uint64_t ended_at_us) const;

    const TelemetryJsonSerializerConfig &config() const { return config_; }

private:
    TelemetryJsonSerializerConfig config_{};
};

} // namespace ecu::telemetry_server
