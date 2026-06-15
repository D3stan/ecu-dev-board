#include "sensors/sensors/pickup_sensor.hpp"

namespace ecu::sensors {

PickupSensor::PickupSensor(PickupConfig config) : config_(config) {}

PickupCaptureEvent PickupSensor::process(const EdgeCapture &capture) {
    PickupCaptureEvent event{};
    event.capture = capture;
    event.health = SensorHealthState::Valid;
    event.quality = SensorQuality::Good;

    if (capture.status == CaptureStatus::Overflow) {
        event.health = SensorHealthState::Failed;
        event.quality = SensorQuality::Bad;
        event.faults.add(SensorFault::Overflow);
        return event;
    }
    if (capture.status == CaptureStatus::HardwareFault) {
        event.health = SensorHealthState::Failed;
        event.quality = SensorQuality::Bad;
        event.faults.add(SensorFault::DeviceFault);
        return event;
    }
    if (capture.polarity != config_.relevant_edge) {
        event.health = SensorHealthState::Degraded;
        event.quality = SensorQuality::Suspect;
        event.faults.add(SensorFault::Plausibility);
        return event;
    }
    if (has_last_ && capture.captured_at - last_valid_at_ < config_.minimum_interval_us) {
        event.health = SensorHealthState::Degraded;
        event.quality = SensorQuality::Bad;
        event.faults.add(SensorFault::Duplicate);
        return event;
    }

    has_last_ = true;
    last_valid_at_ = capture.captured_at;
    event.valid = true;
    return event;
}

EngineStateEstimator::EngineStateEstimator(EngineStateConfig config) : config_(config) {}

SensorReading<EngineSpeedState> EngineStateEstimator::process(const EdgeCapture &capture) {
    SensorReading<EngineSpeedState> reading{};
    reading.acquired_at = capture.captured_at;
    reading.value.reference_at = capture.captured_at;

    if (!has_last_capture_) {
        has_last_capture_ = true;
        last_capture_at_ = capture.captured_at;
        accepted_edges_ = 1;
        reading.health = SensorHealthState::Stabilizing;
        reading.quality = SensorQuality::Suspect;
        last_ = reading;
        return reading;
    }

    const TimestampUs period = capture.captured_at - last_capture_at_;
    const float rpm = period > 0 ? 60000000.0f / static_cast<float>(period) : 0.0f;

    if (rpm < config_.minimum_rpm || rpm > config_.maximum_rpm) {
        reading.health = SensorHealthState::Failed;
        reading.quality = SensorQuality::Bad;
        reading.faults.add(SensorFault::Plausibility);
        last_ = reading;
        return reading;
    }

    ++accepted_edges_;
    ++revolution_id_;
    reading.value.period_us = static_cast<float>(period);
    reading.value.rpm = rpm;
    reading.value.acceleration_rpm_per_s =
        period > 0 ? ((rpm - last_rpm_) / (static_cast<float>(period) / 1000000.0f)) : 0.0f;
    reading.value.revolution_id = revolution_id_;
    reading.value.synchronized = accepted_edges_ >= config_.startup_edges_required;
    reading.value.crank_reference_trusted = reading.value.synchronized;
    reading.valid_for_control = reading.value.crank_reference_trusted;
    reading.health = reading.value.synchronized ? SensorHealthState::Valid : SensorHealthState::Stabilizing;
    reading.quality = SensorQuality::Good;

    last_capture_at_ = capture.captured_at;
    last_rpm_ = rpm;
    last_ = reading;
    return reading;
}

SensorReading<EngineSpeedState> EngineStateEstimator::check_stale(TimestampUs now) {
    if (!has_last_capture_ || now - last_capture_at_ > config_.stale_timeout_us) {
        SensorReading<EngineSpeedState> reading = last_;
        reading.acquired_at = now;
        reading.valid_for_control = false;
        reading.health = SensorHealthState::Stale;
        reading.quality = SensorQuality::Bad;
        reading.value.synchronized = false;
        reading.value.crank_reference_trusted = false;
        reading.faults.add(SensorFault::Stale);
        last_ = reading;
        has_last_capture_ = false;
        accepted_edges_ = 0;
        last_rpm_ = 0.0f;
        return reading;
    }
    return last_;
}

} // namespace ecu::sensors
