#include "telemetry/sensor_telemetry_collector.hpp"

#include <algorithm>

namespace ecu::telemetry {

namespace {

template <typename T>
TelemetryHealth meta_from_reading(const ecu::sensors::SensorReading<T> &reading) {
    TelemetryHealth meta{};
    meta.acquired_at = reading.acquired_at;
    meta.sequence = reading.sequence;
    meta.valid_for_control = reading.valid_for_control;
    meta.health = reading.health;
    meta.quality = reading.quality;
    meta.fault_bits = reading.faults.bits();
    return meta;
}

template <typename T>
TelemetryHealth meta_from_event(const ecu::sensors::SensorEvent<T> &event) {
    TelemetryHealth meta{};
    meta.acquired_at = event.acquired_at;
    meta.sequence = event.sequence;
    meta.valid_for_control = event.valid_for_control;
    meta.health = event.health;
    meta.quality = event.quality;
    meta.fault_bits = event.faults.bits();
    return meta;
}

KnockTelemetryState make_knock_state(const ecu::sensors::KnockWindowMeasurement &measurement) {
    KnockTelemetryState state{};
    state.revolution_id = measurement.revolution_id;
    state.pickup_edge_at = measurement.pickup_edge_at;
    state.window_opened_at = measurement.window_opened_at;
    state.window_closed_at = measurement.window_closed_at;
    state.read_at = measurement.read_at;
    state.raw_integrator_count = measurement.raw_integrator_count;
    state.background_estimate = measurement.background_estimate;
    state.normalized_index = measurement.normalized_index;
    state.candidate_knock = measurement.candidate_knock;
    state.valid_for_control = measurement.valid_for_control;
    state.health = measurement.health;
    state.quality = measurement.quality;
    state.fault_bits = measurement.faults.bits();
    state.rpm = measurement.rpm;
    state.tps_permille = measurement.tps_permille;
    state.ignition_angle_deg = measurement.ignition_angle_deg;
    state.config_generation = measurement.config_generation;
    return state;
}

} // namespace

SensorTelemetryCollector::SensorTelemetryCollector(ecu::sensors::SensorDataStore &store,
                                                   SensorTelemetryCollectorConfig config)
    : store_(store), config_(config) {}

std::optional<TelemetryBatch> SensorTelemetryCollector::collect(ecu::sensors::TimestampUs now) {
    const auto snapshot = store_.snapshot();
    drain_knock_measurements();
    drain_events();

    TelemetryBatch batch{};
    batch.collected_at = now;
    batch.state = make_state(snapshot);

    std::stable_sort(pending_events_.begin(),
                     pending_events_.end(),
                     [](const TelemetryEventFrame &left, const TelemetryEventFrame &right) {
                         return left.occurred_at < right.occurred_at;
                     });

    const std::size_t event_count = std::min(config_.max_events_per_batch, pending_events_.size());
    batch.events.reserve(event_count);
    for (std::size_t index = 0; index < event_count; ++index) {
        batch.events.push_back(pending_events_[index]);
    }
    pending_events_.erase(pending_events_.begin(), pending_events_.begin() + static_cast<std::ptrdiff_t>(event_count));

    const auto overflow = store_.overflow_counters();
    batch.overflow.quick_shift_events = overflow.quick_shift_events;
    batch.overflow.map_switch_events = overflow.map_switch_events;
    batch.overflow.knock_measurements = overflow.knock_measurements;
    batch.overflow.fault_events = overflow.fault_events;

    return batch;
}

TelemetryStateFrame SensorTelemetryCollector::make_state(const ecu::sensors::EngineInputSnapshot &snapshot) const {
    TelemetryStateFrame state{};
    state.snapshot_generation = snapshot.generation;

    state.tps.permille = snapshot.tps.value.permille;
    state.tps.fallback_permille = snapshot.tps.value.fallback_permille;
    state.tps.fallback_used = snapshot.tps.value.fallback_used;
    state.tps.meta = meta_from_reading(snapshot.tps);

    state.engine_speed.rpm = snapshot.engine_speed.value.rpm;
    state.engine_speed.period_us = snapshot.engine_speed.value.period_us;
    state.engine_speed.acceleration_rpm_per_s = snapshot.engine_speed.value.acceleration_rpm_per_s;
    state.engine_speed.synchronized = snapshot.engine_speed.value.synchronized;
    state.engine_speed.crank_reference_trusted = snapshot.engine_speed.value.crank_reference_trusted;
    state.engine_speed.revolution_id = snapshot.engine_speed.value.revolution_id;
    state.engine_speed.reference_at = snapshot.engine_speed.value.reference_at;
    state.engine_speed.meta = meta_from_reading(snapshot.engine_speed);

    state.egt.celsius = snapshot.egt.value.celsius;
    state.egt.rate_c_per_s = snapshot.egt.value.rate_c_per_s;
    state.egt.maximum_celsius = snapshot.egt.value.maximum_celsius;
    state.egt.state = snapshot.egt.value.state;
    state.egt.request = snapshot.egt.value.request;
    state.egt.meta = meta_from_reading(snapshot.egt);

    state.water_temperature.celsius = snapshot.water_temperature.value.celsius;
    state.water_temperature.rate_c_per_s = snapshot.water_temperature.value.rate_c_per_s;
    state.water_temperature.maximum_celsius = snapshot.water_temperature.value.maximum_celsius;
    state.water_temperature.state = snapshot.water_temperature.value.state;
    state.water_temperature.request = snapshot.water_temperature.value.request;
    state.water_temperature.meta = meta_from_reading(snapshot.water_temperature);

    state.quick_shifter.active = snapshot.quick_shifter_state.value.active;
    state.quick_shifter.armed = snapshot.quick_shifter_state.value.armed;
    state.quick_shifter.meta = meta_from_reading(snapshot.quick_shifter_state);

    state.map_switch.request = snapshot.map_switch.value.request;
    state.map_switch.meta = meta_from_reading(snapshot.map_switch);

    state.latest_knock = latest_knock_;

    return state;
}

void SensorTelemetryCollector::drain_knock_measurements() {
    while (auto measurement = store_.pop_knock_measurement()) {
        latest_knock_ = make_knock_state(*measurement);
    }
}

void SensorTelemetryCollector::drain_events() {
    while (auto request = store_.pop_quick_shift_request()) {
        QuickShiftTelemetryEvent event{};
        event.active = request->event.active;
        event.activated_at = request->event.activated_at;
        event.released_at = request->event.released_at;
        event.duration_us = request->event.duration_us;
        event.meta = meta_from_event(*request);

        TelemetryEventFrame frame{};
        frame.kind = TelemetryEventKind::QuickShiftRequest;
        frame.occurred_at = request->acquired_at;
        frame.payload = event;
        pending_events_.push_back(frame);
    }

    while (auto map = store_.pop_map_switch_event()) {
        MapSwitchTelemetryEvent event{};
        event.request = map->event.request;
        event.meta = meta_from_event(*map);

        TelemetryEventFrame frame{};
        frame.kind = TelemetryEventKind::MapSwitchChange;
        frame.occurred_at = map->acquired_at;
        frame.payload = event;
        pending_events_.push_back(frame);
    }

    while (auto fault = store_.pop_fault()) {
        FaultTelemetryEvent event{};
        event.fault = fault->fault;
        event.health = fault->health;
        event.first_at = fault->first_at;
        event.last_at = fault->last_at;
        event.count = fault->count;

        TelemetryEventFrame frame{};
        frame.kind = TelemetryEventKind::FaultTransition;
        frame.occurred_at = fault->first_at;
        frame.payload = event;
        pending_events_.push_back(frame);
    }
}

} // namespace ecu::telemetry
