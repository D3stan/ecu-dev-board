#pragma once

#include <optional>

#include "driver/gpio.h"
#include "driver/spi_master.h"
#include "sensors/ports/hardware_ports.hpp"

namespace ecu::sensor_drivers {

class Tpic8101WindowDevice final : public ecu::sensors::IKnockWindowDevice {
public:
    Tpic8101WindowDevice(spi_device_handle_t spi_device,
                         gpio_num_t hold_pin,
                         ecu::sensors::ITimeSource &time_source);

    bool configure(std::uint32_t config_generation) override;
    bool open_window(ecu::sensors::TimestampUs at) override;
    bool close_window(ecu::sensors::TimestampUs at) override;
    std::optional<ecu::sensors::TpicWindowResult> read_result() override;

private:
    spi_device_handle_t spi_device_{nullptr};
    gpio_num_t hold_pin_{GPIO_NUM_NC};
    ecu::sensors::ITimeSource &time_source_;
    std::uint32_t active_config_generation_{0};
};

} // namespace ecu::sensor_drivers
