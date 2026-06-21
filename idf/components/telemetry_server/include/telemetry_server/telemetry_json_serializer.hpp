#pragma once

#include <cstddef>
#include <cstdint>
#include <string>

#include "telemetry/sensor_telemetry_collector.hpp"
#include "telemetry_server/telemetry_transport.hpp"

namespace ecu::telemetry_server {

struct TelemetryDeviceIdentity {
    const char *hwid{""};
    const char *hardware_revision{"unknown"};
    const char *chip_model{"unknown"};
    std::uint32_t flash_size_bytes{0};
    const char *firmware_version{""};
};

struct RecordingConfigSnapshot {
    bool auto_enabled{false};
    std::uint32_t rpm_threshold{300};
    std::uint32_t start_debounce_ms{1000};
    std::uint32_t stop_debounce_ms{3000};
};

struct TelemetryJsonSerializerConfig {
    const char *schema{"ecu.telemetry.v1"};
    std::uint32_t schema_version{1};
    std::uint32_t state_hz{10};
    std::size_t events_per_batch{8};
    TelemetryDeviceIdentity device{};
    RecordingConfigSnapshot recording{};
};

class TelemetryJsonSerializer {
public:
    explicit TelemetryJsonSerializer(TelemetryJsonSerializerConfig config = {});

    std::string serialize_capabilities() const;
    std::string serialize_recording_config() const;
    std::string serialize_batch(const ecu::telemetry::TelemetryBatch &batch,
                                const TelemetryTransportCounters &transport) const;

    const TelemetryJsonSerializerConfig &config() const { return config_; }
    void set_config(TelemetryJsonSerializerConfig config) { config_ = config; }

private:
    TelemetryJsonSerializerConfig config_{};
};

} // namespace ecu::telemetry_server
