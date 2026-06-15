#include "sensors/sensors/tps_sensor.hpp"

#include <algorithm>

namespace ecu::sensors {

TpsSensor::TpsSensor(TpsConfig config) : config_(config) {}

bool TpsSensor::config_valid() const {
    return config_.open_mv > config_.closed_mv &&
           config_.minimum_valid_mv <= config_.closed_mv &&
           config_.maximum_valid_mv >= config_.open_mv &&
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

    if (!sample.millivolts_valid) {
        return invalid_reading(sample.acquired_at, SensorFault::Communication, SensorHealthState::Failed);
    }

    if (sample.millivolts < config_.minimum_valid_mv) {
        return invalid_reading(sample.acquired_at, SensorFault::ShortToGround, SensorHealthState::Failed);
    }

    if (sample.millivolts > config_.maximum_valid_mv) {
        return invalid_reading(sample.acquired_at, SensorFault::ShortToSupply, SensorHealthState::Failed);
    }

    int permille = ((sample.millivolts - config_.closed_mv) * 1000) / (config_.open_mv - config_.closed_mv);
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
