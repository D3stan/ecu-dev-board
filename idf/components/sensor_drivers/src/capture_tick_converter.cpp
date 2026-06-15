#include "sensor_drivers/capture_tick_converter.hpp"

#include <limits>

namespace ecu::sensor_drivers {

CaptureTickConverter::CaptureTickConverter(std::uint32_t resolution_hz, ecu::sensors::TimestampUs epoch_us)
    : resolution_hz_(resolution_hz == 0 ? 1 : resolution_hz), epoch_us_(epoch_us) {}

void CaptureTickConverter::reset(ecu::sensors::TimestampUs epoch_us) {
    epoch_us_ = epoch_us;
    has_last_ticks_ = false;
    last_ticks_ = 0;
    wrap_count_ = 0;
}

ecu::sensors::TimestampUs CaptureTickConverter::to_timestamp_us(std::uint32_t capture_ticks) {
    if (has_last_ticks_ && capture_ticks < last_ticks_) {
        ++wrap_count_;
    }

    has_last_ticks_ = true;
    last_ticks_ = capture_ticks;

    const std::uint64_t extended_ticks =
        (wrap_count_ << std::numeric_limits<std::uint32_t>::digits) | capture_ticks;
    return epoch_us_ + ticks_to_us(extended_ticks);
}

ecu::sensors::TimestampUs CaptureTickConverter::ticks_to_us(std::uint64_t ticks) const {
    return (ticks * 1000000ull) / resolution_hz_;
}

} // namespace ecu::sensor_drivers
