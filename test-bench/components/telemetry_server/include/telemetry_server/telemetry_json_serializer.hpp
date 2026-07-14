#pragma once

#include <cstddef>
#include <cstdint>

#include "telemetry/telemetry_types.hpp"
#include "telemetry_server/telemetry_transport.hpp"

namespace ecu::telemetry_server {

struct DeviceIdentity {
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

struct SerializerConfig {
    const char *schema{"ecu.telemetry.v1"};
    std::uint32_t schema_version{1};
    std::uint32_t state_hz{10};
    std::size_t events_per_batch{8};
    DeviceIdentity device{};
};

struct SerializeResult {
    bool ok{false};
    std::size_t size{0};
};

class TelemetryJsonSerializer {
public:
    explicit TelemetryJsonSerializer(SerializerConfig config = {});
    SerializeResult serialize_capabilities(const RecordingConfigSnapshot &recording,
                                           char *buffer,
                                           std::size_t capacity) const;
    SerializeResult serialize_recording_config(const RecordingConfigSnapshot &recording,
                                               char *buffer,
                                               std::size_t capacity) const;
    SerializeResult serialize_batch(const ecu::telemetry::TelemetryBatch &batch,
                                    const TelemetryTransportCounters &transport,
                                    char *buffer,
                                    std::size_t capacity) const;

private:
    SerializerConfig config_{};
};

} // namespace ecu::telemetry_server
