#include "sensors/sensors/tps_sensor.hpp"

#include <algorithm>

namespace ecu::sensors {

TpsSensor::TpsSensor(TpsConfig config) : config_(config) {}

bool TpsSensor::config_valid() const {
    return config_.open_adc > config_.closed_adc &&
           config_.minimum_valid_adc <= config_.closed_adc &&
           config_.maximum_valid_adc >= config_.open_adc &&
           config_.filter_alpha_permille >= 0 &&
           config_.filter_alpha_permille <= 1000;
}

SensorReading<ThrottlePositionPermille> TpsSensor::invalid_reading(TimestampUs acquired_at,
                                                                    SensorFault fault,
                                                                    SensorHealthState health) {
    SensorReading<ThrottlePositionPermille> reading{};
    reading.value.permille = config_.fallback_permille;
    reading.value.fallback_permille = config_.fallback_permille;
    reading.value.fallback_used = true;
    reading.acquired_at = acquired_at;
    reading.valid_for_control = false;
    reading.health = health;
    reading.quality = SensorQuality::Bad;
    reading.faults.add(fault);
    last_ = reading;
    return reading;
}

SensorReading<ThrottlePositionPermille> TpsSensor::process(const AnalogSample &sample) {
    if (!config_valid()) {
        return invalid_reading(sample.acquired_at, SensorFault::InvalidConfiguration, SensorHealthState::Failed);
    }

    if (sample.status != AnalogSampleStatus::Ok) {
        return invalid_reading(sample.acquired_at, SensorFault::Communication, SensorHealthState::Failed);
    }

    if (sample.raw_code < config_.minimum_valid_adc) {
        return invalid_reading(sample.acquired_at, SensorFault::ShortToGround, SensorHealthState::Failed);
    }

    if (sample.raw_code > config_.maximum_valid_adc) {
        return invalid_reading(sample.acquired_at, SensorFault::ShortToSupply, SensorHealthState::Failed);
    }

    int permille = ((sample.raw_code - config_.closed_adc) * 1000) / (config_.open_adc - config_.closed_adc);
    permille = std::clamp(permille, 0, 1000);

    if (!has_filtered_) {
        filtered_permille_ = permille;
        has_filtered_ = true;
    } else {
        const int alpha = config_.filter_alpha_permille;
        filtered_permille_ = ((alpha * permille) + ((1000 - alpha) * filtered_permille_)) / 1000;
    }

    SensorReading<ThrottlePositionPermille> reading{};
    reading.value.permille = filtered_permille_;
    reading.value.fallback_permille = config_.fallback_permille;
    reading.value.fallback_used = false;
    reading.acquired_at = sample.acquired_at;
    reading.valid_for_control = true;
    reading.health = SensorHealthState::Valid;
    reading.quality = SensorQuality::Good;

    last_sample_at_ = sample.acquired_at;
    last_ = reading;
    return reading;
}

SensorReading<ThrottlePositionPermille> TpsSensor::check_stale(TimestampUs now) {
    if (last_sample_at_ == 0 || now - last_sample_at_ > config_.stale_timeout_us) {
        return invalid_reading(now, SensorFault::Stale, SensorHealthState::Stale);
    }
    return last_;
}

} // namespace ecu::sensors
