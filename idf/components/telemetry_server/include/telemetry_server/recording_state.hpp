#pragma once

#include <cstdint>

#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"

namespace ecu::telemetry_server {

/// Command types posted from the WS HTTP handler to the recording task.
enum class RecordingCommandType : uint8_t {
    SetAutoEnabled,
};

struct RecordingCommand {
    RecordingCommandType type;
    bool                 auto_enabled;
};

/// Thresholds for auto-record decision (all Kconfig-driven; not stored in NVS).
struct RecordingConfig {
    bool     auto_enabled{false};
    uint32_t rpm_threshold{300};
    uint32_t start_debounce_ms{1000};
    uint32_t stop_debounce_ms{3000};
};

} // namespace ecu::telemetry_server
