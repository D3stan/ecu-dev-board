#pragma once

#include "sensors/ports/hardware_ports.hpp"

namespace ecu::sensor_drivers {

class EspTimeSource final : public ecu::sensors::ITimeSource {
public:
    ecu::sensors::TimestampUs now() const override;
};

} // namespace ecu::sensor_drivers
