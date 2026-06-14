#pragma once

#include <optional>
#include <string_view>

#include "driver/spi_master.h"
#include "sensors/ports/hardware_ports.hpp"

namespace ecu::sensor_drivers {

class Max31856SpiSource final : public ecu::sensors::ISpiMeasurementSource {
public:
    Max31856SpiSource(spi_device_handle_t device, ecu::sensors::ITimeSource &time_source);
    std::optional<ecu::sensors::Max31856Sample> read(std::string_view device) override;

private:
    spi_device_handle_t device_{nullptr};
    ecu::sensors::ITimeSource &time_source_;
};

} // namespace ecu::sensor_drivers
