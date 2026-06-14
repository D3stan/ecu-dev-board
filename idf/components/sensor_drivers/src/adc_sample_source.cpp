#include "sensor_drivers/adc_sample_source.hpp"

namespace ecu::sensor_drivers {

EspAdcSampleSource::EspAdcSampleSource(adc_oneshot_unit_handle_t unit,
                                       const AdcChannelBinding *bindings,
                                       std::size_t binding_count,
                                       ecu::sensors::ITimeSource &time_source)
    : unit_(unit),
      bindings_(bindings),
      binding_count_(binding_count),
      time_source_(time_source) {}

std::optional<ecu::sensors::AnalogSample> EspAdcSampleSource::read(std::string_view channel) {
    if (unit_ == nullptr || bindings_ == nullptr) {
        return std::nullopt;
    }

    for (std::size_t i = 0; i < binding_count_; ++i) {
        if (channel == bindings_[i].name) {
            int raw = 0;
            const auto status = adc_oneshot_read(unit_, bindings_[i].channel, &raw);
            ecu::sensors::AnalogSample sample{};
            sample.acquired_at = time_source_.now();
            sample.status = (status == ESP_OK) ? ecu::sensors::AnalogSampleStatus::Ok
                                               : ecu::sensors::AnalogSampleStatus::HardwareFault;
            sample.raw_code = raw;
            sample.millivolts = 0;
            return sample;
        }
    }

    return std::nullopt;
}

} // namespace ecu::sensor_drivers
