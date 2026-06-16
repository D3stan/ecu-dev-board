#pragma once

#include <cstddef>
#include <cstdint>

#include "sensors/domain/types.hpp"

namespace ecu::sensor_drivers {

inline constexpr std::size_t kMcpwmCaptureMaxQueueDepth = 32;

enum class McpwmCaptureEdge {
    Positive,
    Negative,
};

struct McpwmRawCapture {
    std::uint32_t capture_ticks{0};
    ecu::sensors::EdgePolarity polarity{ecu::sensors::EdgePolarity::Falling};
    ecu::sensors::CaptureStatus status{ecu::sensors::CaptureStatus::Ok};
};

inline std::size_t clamp_mcpwm_capture_queue_depth(std::size_t requested_depth) {
    if (requested_depth == 0) {
        return 1;
    }
    if (requested_depth > kMcpwmCaptureMaxQueueDepth) {
        return kMcpwmCaptureMaxQueueDepth;
    }
    return requested_depth;
}

inline McpwmRawCapture make_mcpwm_raw_capture(std::uint32_t capture_ticks, McpwmCaptureEdge edge) {
    McpwmRawCapture raw{};
    raw.capture_ticks = capture_ticks;
    raw.polarity = edge == McpwmCaptureEdge::Positive ? ecu::sensors::EdgePolarity::Rising
                                                      : ecu::sensors::EdgePolarity::Falling;
    raw.status = edge == McpwmCaptureEdge::Negative ? ecu::sensors::CaptureStatus::Ok
                                                    : ecu::sensors::CaptureStatus::HardwareFault;
    return raw;
}

} // namespace ecu::sensor_drivers

