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
    std::size_t http_task_stack_bytes{12288};
    std::uint16_t http_max_open_sockets{7};
    bool http_lru_purge_enable{true};
    const char *static_base_path{"/www"};
    const char *static_partition_label{"www"};
    std::size_t static_max_open_files{8};
    bool static_close_connection{true};
    bool diagnostics_heap_checks{true};
    std::uint32_t state_hz{10};
    std::size_t max_events_per_batch{8};
    std::uint32_t task_stack_bytes{8192};
    std::uint32_t task_priority_offset{2};
    const char *digital_twin_hardware_revision{""};
    std::uint32_t digital_twin_auto_rpm_threshold{0};
    std::uint32_t digital_twin_auto_start_ms{0};
    std::uint32_t digital_twin_auto_stop_ms{0};
};

esp_err_t start(ecu::sensors::SensorDataStore &store,
                const TelemetryServerConfig &config = {});

} // namespace ecu::telemetry_server
