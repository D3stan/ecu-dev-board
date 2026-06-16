#pragma once

#include "sensors/domain/types.hpp"

namespace ecu::sensor_drivers {

inline ecu::sensors::AnalogSample make_adc_sample_from_conversion(int raw_code,
                                                                  bool raw_read_ok,
                                                                  bool calibration_required,
                                                                  bool calibration_available,
                                                                  bool calibration_ok,
                                                                  int millivolts,
                                                                  ecu::sensors::TimestampUs acquired_at) {
    ecu::sensors::AnalogSample sample{};
    sample.acquired_at = acquired_at;
    sample.raw_code = raw_code;
    sample.millivolts = 0;
    sample.millivolts_valid = false;
    sample.status = raw_read_ok ? ecu::sensors::AnalogSampleStatus::Ok
                                : ecu::sensors::AnalogSampleStatus::HardwareFault;

    if (!raw_read_ok) {
        return sample;
    }

    if (calibration_available) {
        if (calibration_ok) {
            sample.millivolts = millivolts;
            sample.millivolts_valid = true;
        } else if (calibration_required) {
            sample.status = ecu::sensors::AnalogSampleStatus::CalibrationFault;
        }
    } else if (calibration_required) {
        sample.status = ecu::sensors::AnalogSampleStatus::CalibrationFault;
    }

    return sample;
}

} // namespace ecu::sensor_drivers

