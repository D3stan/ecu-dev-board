#pragma once

#include <cstddef>
#include <cstdint>

#include "esp_err.h"
#include "sensors/domain/sensor_data_store.hpp"

namespace ecu::telemetry_server {

struct TelemetryServerConfig {
    const char *sta_ssid{""};
    const char *sta_password{""};
    std::uint16_t http_port{80};
    const char *ws_path{"/ws"};
    std::uint32_t state_hz{10};
    std::size_t max_events_per_batch{8};
    std::uint32_t task_stack_bytes{8192};
    std::uint32_t task_priority_offset{2};
};

esp_err_t start(ecu::sensors::SensorDataStore &store,
                const TelemetryServerConfig &config = {});

} // namespace ecu::telemetry_server
