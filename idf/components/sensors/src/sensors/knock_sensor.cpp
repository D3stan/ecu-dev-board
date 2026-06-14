#include "sensors/sensors/knock_sensor.hpp"

namespace ecu::sensors {

KnockSensor::KnockSensor(KnockConfig config) : config_(config) {}

KnockWindowMeasurement KnockSensor::unavailable(const KnockWindowContext &context, SensorFault fault) const {
    KnockWindowMeasurement measurement{};
    measurement.revolution_id = context.revolution_id;
    measurement.pickup_edge_at = context.pickup_edge_at;
    measurement.window_opened_at = context.window_opened_at;
    measurement.window_closed_at = context.window_closed_at;
    measurement.rpm = context.rpm;
    measurement.tps_permille = context.tps_permille;
    measurement.ignition_angle_deg = context.ignition_angle_deg;
    measurement.config_generation = context.config_generation;
    measurement.valid_for_control = false;
    measurement.health = SensorHealthState::Failed;
    measurement.quality = SensorQuality::Bad;
    measurement.faults.add(fault);
    return measurement;
}

KnockWindowMeasurement KnockSensor::process(const KnockWindowContext &context, const TpicWindowResult &result) {
    if (context.window_closed_at <= context.window_opened_at) {
        return unavailable(context, SensorFault::WindowTiming);
    }

    KnockWindowMeasurement measurement{};
    measurement.revolution_id = context.revolution_id;
    measurement.pickup_edge_at = context.pickup_edge_at;
    measurement.window_opened_at = context.window_opened_at;
    measurement.window_closed_at = context.window_closed_at;
    measurement.read_at = result.read_at;
    measurement.raw_integrator_count = result.integrator_count;
    measurement.rpm = context.rpm;
    measurement.tps_permille = context.tps_permille;
    measurement.ignition_angle_deg = context.ignition_angle_deg;
    measurement.config_generation = context.config_generation;

    switch (result.status) {
    case KnockDeviceStatus::Ok:
        if (result.integrator_count >= config_.saturation_count) {
            measurement.valid_for_control = false;
            measurement.health = SensorHealthState::Degraded;
            measurement.quality = SensorQuality::Bad;
            measurement.faults.add(SensorFault::Saturation);
        } else {
            measurement.valid_for_control = true;
            measurement.health = SensorHealthState::Valid;
            measurement.quality = SensorQuality::Good;
        }
        break;
    case KnockDeviceStatus::Missing:
        measurement.valid_for_control = false;
        measurement.health = SensorHealthState::Stale;
        measurement.quality = SensorQuality::Bad;
        measurement.faults.add(SensorFault::Missing);
        break;
    case KnockDeviceStatus::Saturated:
        measurement.valid_for_control = false;
        measurement.health = SensorHealthState::Degraded;
        measurement.quality = SensorQuality::Bad;
        measurement.faults.add(SensorFault::Saturation);
        break;
    case KnockDeviceStatus::CommunicationFault:
        measurement.valid_for_control = false;
        measurement.health = SensorHealthState::Failed;
        measurement.quality = SensorQuality::Bad;
        measurement.faults.add(SensorFault::Communication);
        break;
    case KnockDeviceStatus::ConfigurationFault:
        measurement.valid_for_control = false;
        measurement.health = SensorHealthState::Failed;
        measurement.quality = SensorQuality::Bad;
        measurement.faults.add(SensorFault::InvalidConfiguration);
        break;
    case KnockDeviceStatus::TimingFault:
        measurement.valid_for_control = false;
        measurement.health = SensorHealthState::Failed;
        measurement.quality = SensorQuality::Bad;
        measurement.faults.add(SensorFault::WindowTiming);
        break;
    }
    return measurement;
}

KnockFeatureExtractor::KnockFeatureExtractor(KnockFeatureConfig config)
    : config_(config),
      background_(config.background_default) {}

bool KnockFeatureExtractor::submit(const KnockWindowMeasurement &measurement) {
    if (queue_.size() >= config_.queue_capacity) {
        ++dropped_count_;
        return false;
    }
    queue_.push_back(measurement);
    return true;
}

std::optional<KnockFeatureRecord> KnockFeatureExtractor::extract_next() {
    if (queue_.empty()) {
        return std::nullopt;
    }
    auto measurement = queue_.front();
    queue_.pop_front();

    if (measurement.valid_for_control) {
        background_ = (background_ * 0.95f) + (static_cast<float>(measurement.raw_integrator_count) * 0.05f);
    }

    KnockFeatureRecord record{};
    record.revolution_id = measurement.revolution_id;
    record.normalized_index = background_ > 0.0f ? static_cast<float>(measurement.raw_integrator_count) / background_ : 0.0f;
    record.candidate_knock = measurement.valid_for_control && record.normalized_index > 2.0f;
    record.requests_ignition_authority = false;
    record.health = measurement.health;
    record.quality = measurement.quality;
    record.faults = measurement.faults;
    return record;
}

} // namespace ecu::sensors
