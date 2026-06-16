#include "sensor_drivers/adc_sample_source.hpp"

#include "sensor_drivers/adc_sample_source_logic.hpp"

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
            bool calibration_available = false;
            bool calibration_ok = false;
            int millivolts = 0;

            if (status == ESP_OK && bindings_[i].calibration_handle != nullptr) {
                calibration_available = true;
                const auto calibration_status =
                    adc_cali_raw_to_voltage(bindings_[i].calibration_handle, raw, &millivolts);
                calibration_ok = calibration_status == ESP_OK;
            }
            return make_adc_sample_from_conversion(raw,
                                                   status == ESP_OK,
                                                   bindings_[i].calibration_required,
                                                   calibration_available,
                                                   calibration_ok,
                                                   millivolts,
                                                   time_source_.now());
        }
    }

    return std::nullopt;
}

} // namespace ecu::sensor_drivers
