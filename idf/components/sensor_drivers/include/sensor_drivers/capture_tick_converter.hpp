#pragma once

#include <cstdint>

#include "sensors/domain/types.hpp"

namespace ecu::sensor_drivers {

class CaptureTickConverter {
public:
    CaptureTickConverter(std::uint32_t resolution_hz, ecu::sensors::TimestampUs epoch_us = 0);

    ecu::sensors::TimestampUs to_timestamp_us(std::uint32_t capture_ticks);
    void reset(ecu::sensors::TimestampUs epoch_us = 0);
    std::uint32_t resolution_hz() const { return resolution_hz_; }

private:
    ecu::sensors::TimestampUs ticks_to_us(std::uint64_t ticks) const;

    std::uint32_t resolution_hz_{1};
    ecu::sensors::TimestampUs epoch_us_{0};
    bool has_last_ticks_{false};
    std::uint32_t last_ticks_{0};
    std::uint64_t wrap_count_{0};
};

} // namespace ecu::sensor_drivers
