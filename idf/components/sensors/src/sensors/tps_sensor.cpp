#include "sensors/sensors/tps_sensor.hpp"

#include <algorithm>
#include <cstdlib>

namespace ecu::sensors {

TpsSensor::TpsSensor(TpsConfig config) : config_(config) {}

bool TpsSensor::config_valid() const {
    return config_.open_mv > config_.closed_mv &&
           config_.minimum_valid_mv <= config_.closed_mv &&
           config_.maximum_valid_mv >= config_.open_mv &&
           config_.filter_alpha_permille >= 0 &&
           config_.filter_alpha_permille <= 1000 &&
           config_.maximum_rate_permille_per_s >= 0 &&
           config_.stuck_delta_mv >= 0 &&
           config_.noise_delta_mv >= 0;
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

    if (has_last_valid_sample_ &&
        config_.maximum_rate_permille_per_s > 0 &&
        sample.acquired_at > last_valid_at_) {
        const int delta_permille = std::abs(permille - last_valid_permille_);
        const auto elapsed_us = sample.acquired_at - last_valid_at_;
        const auto rate_permille_per_s =
            static_cast<std::uint64_t>(delta_permille) * 1000000ull / elapsed_us;
        if (rate_permille_per_s > static_cast<std::uint64_t>(config_.maximum_rate_permille_per_s)) {
            return invalid_reading(sample.acquired_at, SensorFault::Rate, SensorHealthState::Degraded);
        }
    }

    int current_delta_mv = 0;
    std::uint8_t next_noise_sample_count = 0;
    if (has_last_valid_sample_) {
        current_delta_mv = sample.millivolts - last_valid_mv_;
        if (config_.noise_sample_limit > 0 && config_.noise_delta_mv > 0) {
            const bool significant_delta = std::abs(current_delta_mv) >= config_.noise_delta_mv;
            const bool reversed_direction =
                (current_delta_mv > 0 && last_valid_delta_mv_ < 0) ||
                (current_delta_mv < 0 && last_valid_delta_mv_ > 0);
            next_noise_sample_count = significant_delta
                                          ? static_cast<std::uint8_t>(reversed_direction ? noise_sample_count_ + 1 : 1)
                                          : 0;
            if (next_noise_sample_count >= config_.noise_sample_limit) {
                noise_sample_count_ = next_noise_sample_count;
                return invalid_reading(sample.acquired_at, SensorFault::Noise, SensorHealthState::Degraded);
            }
        }
    }

    std::uint8_t next_repeated_sample_count = 1;
    if (has_last_valid_sample_) {
        const int delta_mv = std::abs(current_delta_mv);
        next_repeated_sample_count = delta_mv <= config_.stuck_delta_mv
                                         ? static_cast<std::uint8_t>(repeated_sample_count_ + 1)
                                         : 1;
        if (config_.stuck_sample_limit > 0 &&
            next_repeated_sample_count >= config_.stuck_sample_limit) {
            repeated_sample_count_ = next_repeated_sample_count;
            return invalid_reading(sample.acquired_at, SensorFault::Stuck, SensorHealthState::Degraded);
        }
    }

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
    last_valid_at_ = sample.acquired_at;
    last_valid_permille_ = permille;
    last_valid_mv_ = sample.millivolts;
    last_valid_delta_mv_ = current_delta_mv;
    has_last_valid_sample_ = true;
    repeated_sample_count_ = next_repeated_sample_count;
    noise_sample_count_ = next_noise_sample_count;
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
