#include "sensor_drivers/tpic8101_window_device.hpp"

#include <cstdint>

namespace ecu::sensor_drivers {

namespace {
constexpr std::uint8_t kIntegratorResultRegister = 0x00;
}

Tpic8101WindowDevice::Tpic8101WindowDevice(spi_device_handle_t spi_device,
                                           gpio_num_t hold_pin,
                                           ecu::sensors::ITimeSource &time_source)
    : spi_device_(spi_device),
      hold_pin_(hold_pin),
      time_source_(time_source) {}

bool Tpic8101WindowDevice::configure(std::uint32_t config_generation) {
    active_config_generation_ = config_generation;
    return spi_device_ != nullptr;
}

bool Tpic8101WindowDevice::open_window(ecu::sensors::TimestampUs at) {
    (void)at;
    if (hold_pin_ == GPIO_NUM_NC) {
        return false;
    }
    return gpio_set_level(hold_pin_, 1) == ESP_OK;
}

bool Tpic8101WindowDevice::close_window(ecu::sensors::TimestampUs at) {
    (void)at;
    if (hold_pin_ == GPIO_NUM_NC) {
        return false;
    }
    return gpio_set_level(hold_pin_, 0) == ESP_OK;
}

std::optional<ecu::sensors::TpicWindowResult> Tpic8101WindowDevice::read_result() {
    if (spi_device_ == nullptr) {
        return std::nullopt;
    }

    std::uint8_t tx[3] = {kIntegratorResultRegister, 0, 0};
    std::uint8_t rx[3] = {};
    spi_transaction_t transaction{};
    transaction.length = sizeof(tx) * 8;
    transaction.tx_buffer = tx;
    transaction.rx_buffer = rx;

    ecu::sensors::TpicWindowResult result{};
    result.read_at = time_source_.now();
    if (spi_device_transmit(spi_device_, &transaction) != ESP_OK) {
        result.status = ecu::sensors::KnockDeviceStatus::CommunicationFault;
        return result;
    }

    (void)active_config_generation_;
    result.integrator_count = (static_cast<std::uint32_t>(rx[1]) << 8) | rx[2];
    result.status = ecu::sensors::KnockDeviceStatus::Ok;
    return result;
}

} // namespace ecu::sensor_drivers
