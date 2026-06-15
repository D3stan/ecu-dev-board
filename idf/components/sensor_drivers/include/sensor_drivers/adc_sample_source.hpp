#pragma once

#include <cstddef>
#include <optional>
#include <string_view>

#include "esp_adc/adc_oneshot.h"
#include "esp_adc/adc_cali.h"
#include "sensors/ports/hardware_ports.hpp"

namespace ecu::sensor_drivers {

struct AdcChannelBinding {
    const char *name;
    adc_channel_t channel;
    adc_atten_t attenuation{ADC_ATTEN_DB_12};
    adc_bitwidth_t bitwidth{ADC_BITWIDTH_DEFAULT};
    adc_cali_handle_t calibration_handle{nullptr};
    bool calibration_required{false};
};

class EspAdcSampleSource final : public ecu::sensors::IAnalogSampleSource {
public:
    EspAdcSampleSource(adc_oneshot_unit_handle_t unit,
                       const AdcChannelBinding *bindings,
                       std::size_t binding_count,
                       ecu::sensors::ITimeSource &time_source);

    std::optional<ecu::sensors::AnalogSample> read(std::string_view channel) override;

private:
    adc_oneshot_unit_handle_t unit_{nullptr};
    const AdcChannelBinding *bindings_{nullptr};
    std::size_t binding_count_{0};
    ecu::sensors::ITimeSource &time_source_;
};

} // namespace ecu::sensor_drivers
