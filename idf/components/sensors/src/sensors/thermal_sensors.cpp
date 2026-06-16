#include "sensors/sensors/thermal_sensors.hpp"

#include <algorithm>
#include <cmath>

namespace ecu::sensors {

namespace {

float rate(float previous, TimestampUs previous_at, float current, TimestampUs current_at) {
    if (previous_at == 0 || current_at <= previous_at) {
        return 0.0f;
    }
    const float dt = static_cast<float>(current_at - previous_at) / 1000000.0f;
    return (current - previous) / dt;
}

ThermalRequestLevel request_for(float celsius, float warning, float derating, float critical) {
    if (celsius >= critical) {
        return ThermalRequestLevel::CriticalProtectionRequested;
    }
    if (celsius >= derating) {
        return ThermalRequestLevel::DeratingRequested;
    }
    if (celsius >= warning) {
        return ThermalRequestLevel::Warning;
    }
    return ThermalRequestLevel::Normal;
}

ThermalState state_for(float celsius, float cold, float high, float critical) {
    if (celsius >= critical) {
        return ThermalState::Critical;
    }
    if (celsius >= high) {
        return ThermalState::High;
    }
    if (celsius <= cold) {
        return ThermalState::Cold;
    }
    return ThermalState::Normal;
}

} // namespace

EgtSensor::EgtSensor(EgtConfig config) : config_(config) {}

TemperatureReading EgtSensor::classify(float celsius, TimestampUs acquired_at) {
    TemperatureReading value{};
    value.celsius = celsius;
    value.rate_c_per_s = has_previous_ ? rate(last_.value.celsius, last_.acquired_at, celsius, acquired_at) : 0.0f;
    maximum_ = has_previous_ ? std::max(maximum_, celsius) : celsius;
    value.maximum_celsius = maximum_;
    value.state = state_for(celsius, 100.0f, config_.warning_celsius, config_.critical_celsius);
    value.request = request_for(celsius, config_.warning_celsius, config_.derating_celsius, config_.critical_celsius);
    return value;
}

SensorReading<TemperatureReading> EgtSensor::invalid(TimestampUs acquired_at, SensorFault fault, SensorHealthState health) {
    SensorReading<TemperatureReading> reading{};
    reading.acquired_at = acquired_at;
    reading.valid_for_control = false;
    reading.health = health;
    reading.quality = SensorQuality::Bad;
    reading.value = last_.value;
    reading.value.state = ThermalState::SensorInvalid;
    reading.value.request = ThermalRequestLevel::SensorInvalid;
    reading.faults.add(fault);
    last_ = reading;
    return reading;
}

SensorReading<TemperatureReading> EgtSensor::process(const Max31856Sample &sample) {
    if (sample.status == SpiSampleStatus::Timeout || sample.status == SpiSampleStatus::CommunicationFault) {
        return invalid(sample.acquired_at, SensorFault::Communication, SensorHealthState::Failed);
    }
    if (sample.status == SpiSampleStatus::ConverterFault || sample.diagnostic_flags != 0) {
        return invalid(sample.acquired_at, SensorFault::Communication, SensorHealthState::Failed);
    }
    if (sample.celsius < config_.minimum_celsius || sample.celsius > config_.maximum_celsius) {
        return invalid(sample.acquired_at, SensorFault::RangeHigh, SensorHealthState::Failed);
    }

    if (has_previous_ &&
        config_.maximum_rate_c_per_s > 0.0f &&
        std::fabs(rate(last_.value.celsius, last_.acquired_at, sample.celsius, sample.acquired_at)) >
            config_.maximum_rate_c_per_s) {
        return invalid(sample.acquired_at, SensorFault::Rate, SensorHealthState::Degraded);
    }

    std::uint32_t next_repeated_sample_count = 1;
    if (has_previous_) {
        next_repeated_sample_count =
            std::fabs(sample.celsius - last_.value.celsius) <= config_.frozen_delta_celsius
                ? repeated_sample_count_ + 1
                : 1;
        if (config_.frozen_sample_limit > 0 &&
            next_repeated_sample_count >= config_.frozen_sample_limit) {
            repeated_sample_count_ = next_repeated_sample_count;
            return invalid(sample.acquired_at, SensorFault::Frozen, SensorHealthState::Degraded);
        }
    }

    SensorReading<TemperatureReading> reading{};
    reading.value = classify(sample.celsius, sample.acquired_at);
    reading.acquired_at = sample.acquired_at;
    reading.valid_for_control = true;
    reading.health = SensorHealthState::Valid;
    reading.quality = SensorQuality::Good;
    has_previous_ = true;
    repeated_sample_count_ = next_repeated_sample_count;
    last_ = reading;
    return reading;
}

SensorReading<TemperatureReading> EgtSensor::check_stale(TimestampUs now) {
    if (!has_previous_ || now - last_.acquired_at > config_.stale_timeout_us) {
        return invalid(now, SensorFault::Stale, SensorHealthState::Stale);
    }
    return last_;
}

WaterTemperatureSensor::WaterTemperatureSensor(WaterTemperatureConfig config) : config_(config) {}

bool WaterTemperatureSensor::config_valid() const {
    return PullupNtcTransfer(config_.ntc).config_valid() &&
           config_.minimum_valid_mv > config_.short_to_ground_mv &&
           config_.maximum_valid_mv < config_.open_circuit_mv &&
           config_.minimum_valid_mv < config_.maximum_valid_mv &&
           config_.open_circuit_mv <= config_.ntc.vref_mv &&
           config_.maximum_rate_c_per_s >= 0.0f &&
           config_.frozen_delta_celsius >= 0.0f;
}

TemperatureReading WaterTemperatureSensor::classify(float celsius, TimestampUs acquired_at) {
    TemperatureReading value{};
    value.celsius = celsius;
    value.rate_c_per_s = has_previous_ ? rate(last_.value.celsius, last_.acquired_at, celsius, acquired_at) : 0.0f;
    maximum_ = has_previous_ ? std::max(maximum_, celsius) : celsius;
    value.maximum_celsius = maximum_;
    value.state = state_for(celsius, config_.cold_celsius, config_.high_celsius, config_.critical_celsius);
    value.request = request_for(celsius, config_.high_celsius, config_.critical_celsius, config_.critical_celsius);
    return value;
}

SensorReading<TemperatureReading> WaterTemperatureSensor::invalid(TimestampUs acquired_at,
                                                                  SensorFault fault,
                                                                  SensorHealthState health) {
    SensorReading<TemperatureReading> reading{};
    reading.acquired_at = acquired_at;
    reading.valid_for_control = false;
    reading.health = health;
    reading.quality = SensorQuality::Bad;
    reading.value = last_.value;
    reading.value.state = ThermalState::SensorInvalid;
    reading.value.request = ThermalRequestLevel::SensorInvalid;
    reading.faults.add(fault);
    last_ = reading;
    return reading;
}

SensorReading<TemperatureReading> WaterTemperatureSensor::process(const AnalogSample &sample) {
    if (!config_valid()) {
        return invalid(sample.acquired_at, SensorFault::InvalidConfiguration, SensorHealthState::Failed);
    }

    if (sample.status != AnalogSampleStatus::Ok) {
        return invalid(sample.acquired_at, SensorFault::Communication, SensorHealthState::Failed);
    }

    if (!sample.millivolts_valid) {
        return invalid(sample.acquired_at, SensorFault::Communication, SensorHealthState::Failed);
    }

    if (sample.millivolts <= config_.short_to_ground_mv || sample.millivolts < config_.minimum_valid_mv) {
        return invalid(sample.acquired_at, SensorFault::ShortToGround, SensorHealthState::Failed);
    }
    if (sample.millivolts >= config_.open_circuit_mv || sample.millivolts > config_.maximum_valid_mv) {
        return invalid(sample.acquired_at, SensorFault::OpenCircuit, SensorHealthState::Failed);
    }

    auto celsius = PullupNtcTransfer(config_.ntc).celsius_from_millivolts(sample.millivolts);
    if (!celsius.has_value()) {
        return invalid(sample.acquired_at, SensorFault::RangeHigh, SensorHealthState::Failed);
    }

    if (has_previous_ &&
        config_.maximum_rate_c_per_s > 0.0f &&
        std::fabs(rate(last_.value.celsius, last_.acquired_at, *celsius, sample.acquired_at)) >
            config_.maximum_rate_c_per_s) {
        return invalid(sample.acquired_at, SensorFault::Rate, SensorHealthState::Degraded);
    }

    std::uint32_t next_repeated_sample_count = 1;
    if (has_previous_) {
        next_repeated_sample_count =
            std::fabs(*celsius - last_.value.celsius) <= config_.frozen_delta_celsius
                ? repeated_sample_count_ + 1
                : 1;
        if (config_.frozen_sample_limit > 0 &&
            next_repeated_sample_count >= config_.frozen_sample_limit) {
            repeated_sample_count_ = next_repeated_sample_count;
            return invalid(sample.acquired_at, SensorFault::Frozen, SensorHealthState::Degraded);
        }
    }

    SensorReading<TemperatureReading> reading{};
    reading.value = classify(*celsius, sample.acquired_at);
    reading.acquired_at = sample.acquired_at;
    reading.valid_for_control = true;
    reading.health = SensorHealthState::Valid;
    reading.quality = SensorQuality::Good;
    has_previous_ = true;
    repeated_sample_count_ = next_repeated_sample_count;
    last_ = reading;
    return reading;
}

SensorReading<TemperatureReading> WaterTemperatureSensor::check_stale(TimestampUs now) {
    if (!has_previous_ || now - last_.acquired_at > config_.stale_timeout_us) {
        return invalid(now, SensorFault::Stale, SensorHealthState::Stale);
    }
    return last_;
}

} // namespace ecu::sensors
