#include "sensors/sensors/digital_inputs.hpp"

namespace ecu::sensors {

QuickShifterInput::QuickShifterInput(QuickShifterConfig config) : config_(config) {}

bool QuickShifterInput::normalize_active(bool level_high) const {
    return config_.active_low ? !level_high : level_high;
}

SensorReading<QuickShifterState> QuickShifterInput::make_state(TimestampUs at,
                                                               bool active,
                                                               bool armed,
                                                               SensorHealthState health,
                                                               SensorFault *fault) {
    SensorReading<QuickShifterState> reading{};
    reading.value.active = active;
    reading.value.armed = armed;
    reading.acquired_at = at;
    reading.valid_for_control = (health == SensorHealthState::Valid);
    reading.health = health;
    reading.quality = reading.valid_for_control ? SensorQuality::Good : SensorQuality::Bad;
    if (fault != nullptr) {
        reading.faults.add(*fault);
    }
    state_ = reading;
    return reading;
}

SensorReading<QuickShifterState> QuickShifterInput::initialize(const DigitalSample &sample) {
    initialized_ = true;
    const bool active = normalize_active(sample.level_high);
    last_accepted_edge_at_ = sample.acquired_at;
    active_since_ = active ? sample.acquired_at : 0;
    armed_ = !active;
    if (active) {
        SensorFault fault = SensorFault::StartupActive;
        return make_state(sample.acquired_at, active, false, SensorHealthState::Failed, &fault);
    }
    return make_state(sample.acquired_at, active, true, SensorHealthState::Valid, nullptr);
}

QuickShifterProcessResult QuickShifterInput::process(const DigitalEdge &edge) {
    QuickShifterProcessResult result{};
    const bool active = normalize_active(edge.level_high);

    if (!initialized_) {
        DigitalSample sample{edge.level_high, edge.acquired_at, edge.status};
        result.state = initialize(sample);
        return result;
    }

    if (edge.status != DigitalSampleStatus::Ok) {
        SensorFault fault = SensorFault::Communication;
        result.state = make_state(edge.acquired_at, active, false, SensorHealthState::Failed, &fault);
        return result;
    }

    if (edge.acquired_at - last_accepted_edge_at_ < config_.debounce_us) {
        result.state = state_;
        result.state.faults.add(SensorFault::Debounce);
        return result;
    }

    last_accepted_edge_at_ = edge.acquired_at;

    if (!active) {
        const bool had_pending_duration_request = pending_duration_request_;
        const TimestampUs activated_at = active_since_;
        const TimestampUs duration_us =
            activated_at != 0 && edge.acquired_at >= activated_at ? edge.acquired_at - activated_at : 0;
        armed_ = true;
        active_since_ = 0;
        pending_duration_request_ = false;
        result.state = make_state(edge.acquired_at, false, true, SensorHealthState::Valid, nullptr);
        if (had_pending_duration_request) {
            if (config_.minimum_active_us > 0 && duration_us < config_.minimum_active_us) {
                SensorFault fault = SensorFault::Plausibility;
                result.state = make_state(edge.acquired_at, false, true, SensorHealthState::Degraded, &fault);
                return result;
            }
            if (config_.maximum_active_us > 0 && duration_us > config_.maximum_active_us) {
                SensorFault fault = SensorFault::Stuck;
                result.state = make_state(edge.acquired_at, false, true, SensorHealthState::Failed, &fault);
                return result;
            }
            result.has_request = true;
            result.request.event.active = true;
            result.request.event.activated_at = activated_at;
            result.request.event.released_at = edge.acquired_at;
            result.request.event.duration_us = static_cast<std::uint32_t>(duration_us);
            result.request.acquired_at = edge.acquired_at;
            result.request.valid_for_control = true;
            result.request.health = SensorHealthState::Valid;
            result.request.quality = SensorQuality::Good;
        }
        return result;
    }

    active_since_ = edge.acquired_at;
    if (armed_) {
        armed_ = false;
        if (config_.minimum_active_us > 0 || config_.maximum_active_us > 0) {
            pending_duration_request_ = true;
        } else {
            result.has_request = true;
            result.request.event.active = true;
            result.request.event.activated_at = edge.acquired_at;
            result.request.acquired_at = edge.acquired_at;
            result.request.valid_for_control = true;
            result.request.health = SensorHealthState::Valid;
            result.request.quality = SensorQuality::Good;
        }
    }

    result.state = make_state(edge.acquired_at, true, armed_, SensorHealthState::Valid, nullptr);
    return result;
}

SensorReading<QuickShifterState> QuickShifterInput::check_stuck(TimestampUs now) {
    if (state_.value.active && active_since_ != 0 && now - active_since_ > config_.stuck_active_us) {
        SensorFault fault = SensorFault::Stuck;
        return make_state(now, true, false, SensorHealthState::Failed, &fault);
    }
    return state_;
}

MapSwitchInput::MapSwitchInput(MapSwitchConfig config) : config_(config) {}

PhysicalMapRequest MapSwitchInput::normalize(bool level_high) const {
    const bool secondary = config_.secondary_active_low ? !level_high : level_high;
    return secondary ? PhysicalMapRequest::Secondary : PhysicalMapRequest::Primary;
}

SensorReading<MapSwitchState> MapSwitchInput::initialize(const DigitalSample &sample) {
    initialized_ = true;
    last_accepted_edge_at_ = sample.acquired_at;
    SensorReading<MapSwitchState> reading{};
    reading.value.request = normalize(sample.level_high);
    reading.acquired_at = sample.acquired_at;
    reading.valid_for_control = sample.status == DigitalSampleStatus::Ok;
    reading.health = reading.valid_for_control ? SensorHealthState::Valid : SensorHealthState::Failed;
    reading.quality = reading.valid_for_control ? SensorQuality::Good : SensorQuality::Bad;
    reading_ = reading;
    return reading;
}

MapSwitchProcessResult MapSwitchInput::process(const DigitalEdge &edge) {
    MapSwitchProcessResult result{};
    if (!initialized_) {
        result.reading = initialize(DigitalSample{edge.level_high, edge.acquired_at, edge.status});
        return result;
    }
    if (edge.status != DigitalSampleStatus::Ok) {
        reading_.valid_for_control = false;
        reading_.health = SensorHealthState::Failed;
        reading_.quality = SensorQuality::Bad;
        reading_.faults.add(SensorFault::Communication);
        result.reading = reading_;
        return result;
    }
    if (edge.acquired_at - last_accepted_edge_at_ < config_.debounce_us) {
        result.reading = reading_;
        result.reading.faults.add(SensorFault::Debounce);
        return result;
    }
    const auto request = normalize(edge.level_high);
    last_accepted_edge_at_ = edge.acquired_at;
    const bool changed = request != reading_.value.request;
    reading_.value.request = request;
    reading_.acquired_at = edge.acquired_at;
    reading_.valid_for_control = true;
    reading_.health = SensorHealthState::Valid;
    reading_.quality = SensorQuality::Good;
    result.reading = reading_;

    if (changed) {
        result.has_event = true;
        result.event.event = reading_.value;
        result.event.acquired_at = edge.acquired_at;
        result.event.valid_for_control = true;
        result.event.health = SensorHealthState::Valid;
        result.event.quality = SensorQuality::Good;
    }
    return result;
}

} // namespace ecu::sensors
