#include "sensor_drivers/max31856_spi_source.hpp"

#include <cstdint>
#include <cstring>

namespace ecu::sensor_drivers {

namespace {

constexpr std::uint8_t kLinearizedTemperatureRegister = 0x0C;
constexpr std::uint8_t kFaultStatusRegister = 0x0F;

float decode_max31856_temperature(const std::uint8_t *data) {
    std::int32_t raw = (static_cast<std::int32_t>(data[0]) << 16) |
                       (static_cast<std::int32_t>(data[1]) << 8) |
                       static_cast<std::int32_t>(data[2]);
    raw >>= 5;
    if ((raw & 0x40000) != 0) {
        raw |= ~0x7FFFF;
    }
    return static_cast<float>(raw) * 0.0078125f;
}

} // namespace

Max31856SpiSource::Max31856SpiSource(spi_device_handle_t device, ecu::sensors::ITimeSource &time_source)
    : device_(device), time_source_(time_source) {}

std::optional<ecu::sensors::Max31856Sample> Max31856SpiSource::read(std::string_view device) {
    (void)device;
    if (device_ == nullptr) {
        return std::nullopt;
    }

    std::uint8_t tx[4] = {kLinearizedTemperatureRegister, 0, 0, 0};
    std::uint8_t rx[4] = {};
    spi_transaction_t temp_transaction{};
    temp_transaction.length = sizeof(tx) * 8;
    temp_transaction.tx_buffer = tx;
    temp_transaction.rx_buffer = rx;

    ecu::sensors::Max31856Sample sample{};
    sample.acquired_at = time_source_.now();

    if (spi_device_transmit(device_, &temp_transaction) != ESP_OK) {
        sample.status = ecu::sensors::SpiSampleStatus::CommunicationFault;
        return sample;
    }

    std::uint8_t fault_tx[2] = {kFaultStatusRegister, 0};
    std::uint8_t fault_rx[2] = {};
    spi_transaction_t fault_transaction{};
    fault_transaction.length = sizeof(fault_tx) * 8;
    fault_transaction.tx_buffer = fault_tx;
    fault_transaction.rx_buffer = fault_rx;

    if (spi_device_transmit(device_, &fault_transaction) != ESP_OK) {
        sample.status = ecu::sensors::SpiSampleStatus::CommunicationFault;
        return sample;
    }

    sample.celsius = decode_max31856_temperature(&rx[1]);
    sample.diagnostic_flags = fault_rx[1];
    sample.status = sample.diagnostic_flags == 0 ? ecu::sensors::SpiSampleStatus::Ok
                                                 : ecu::sensors::SpiSampleStatus::ConverterFault;
    return sample;
}

} // namespace ecu::sensor_drivers
