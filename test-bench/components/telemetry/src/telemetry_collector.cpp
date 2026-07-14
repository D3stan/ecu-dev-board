#include "telemetry/telemetry_collector.hpp"

#include <algorithm>
#include <cmath>
#include <limits>
#include <utility>

namespace ecu::telemetry {
namespace {

constexpr std::uint64_t kUsPerSecond = 1000000ULL;
constexpr std::uint64_t kUsPerMillisecond = 1000ULL;

float move_toward(float current, float target, float max_delta) {
    if (current < target) return std::min(target, current + max_delta);
    return std::max(target, current - max_delta);
}

bool synchronized(telemetry_engine_state_t state) {
    return state == TELEMETRY_ENGINE_SYNCHRONIZED;
}

TelemetryHealth real_meta(TimestampUs acquired_at,
                          std::uint64_t sequence,
                          bool valid,
                          HealthState health) {
    TelemetryHealth meta{};
    meta.acquired_at = acquired_at;
    meta.sequence = sequence;
    meta.valid_for_control = valid;
    meta.health = health;
    meta.quality = valid ? Quality::Good : Quality::Suspect;
    meta.origin = DataOrigin::Measured;
    return meta;
}

TelemetryHealth simulated_meta(TimestampUs now,
                               std::uint64_t sequence,
                               bool valid) {
    TelemetryHealth meta{};
    meta.acquired_at = now;
    meta.sequence = sequence;
    meta.valid_for_control = valid;
    meta.health = valid ? HealthState::Valid : HealthState::Stale;
    meta.quality = valid ? Quality::Good : Quality::Suspect;
    meta.origin = DataOrigin::Simulated;
    return meta;
}

} // namespace

TelemetryCollector::TelemetryCollector(telemetry_source_t source,
                                       TelemetryCollectorConfig config)
    : source_(source), config_(config) {
    egt_.celsius = egt_.maximum_celsius = config_.ambient_c;
    water_.celsius = water_.maximum_celsius = config_.ambient_c;
}

std::optional<TelemetryBatch> TelemetryCollector::collect(TimestampUs now) {
    if (source_.read == nullptr) return std::nullopt;

    telemetry_real_sample_t sample{};
    if (!source_.read(source_.context, &sample)) return std::nullopt;

    TelemetryBatch batch{};
    batch.collected_at = now;
    batch.state = make_state(sample, now);
    detect_events(sample, batch.state, now);

    batch.event_count = std::min({config_.max_events_per_batch,
                                  pending_event_count_,
                                  batch.events.size()});
    for (std::size_t index = 0; index < batch.event_count; ++index) {
        batch.events[index] = pending_events_[index];
    }
    for (std::size_t index = batch.event_count;
         index < pending_event_count_;
         ++index) {
        pending_events_[index - batch.event_count] =
            std::move(pending_events_[index]);
    }
    pending_event_count_ -= batch.event_count;
    batch.overflow = overflow_;

    previous_real_ = sample;
    has_previous_real_ = true;
    last_collected_at_ = now;
    return batch;
}

TelemetryStateFrame TelemetryCollector::make_state(
    const telemetry_real_sample_t &sample,
    TimestampUs now) {
    TelemetryStateFrame state{};
    state.snapshot_generation = ++generation_;

    state.tps.permille = static_cast<int>(sample.tps_percent) * 10;
    state.tps.fallback_permille = state.tps.permille;
    state.tps.fallback_used = false;
    state.tps.meta = real_meta(sample.tps_acquired_at_us,
                               sample.tps_sequence,
                               sample.tps_valid,
                               sample.tps_valid ? HealthState::Valid
                                                : HealthState::Stale);

    const bool sync = synchronized(sample.engine_state);
    HealthState engine_health = HealthState::Stale;
    if (sample.engine_state == TELEMETRY_ENGINE_ACQUISITION) {
        engine_health = HealthState::Stabilizing;
    } else if (sync) {
        engine_health = HealthState::Valid;
    }

    state.engine_speed.rpm = static_cast<float>(sample.rpm);
    state.engine_speed.period_us = static_cast<float>(sample.period_us);
    state.engine_speed.synchronized = sync;
    state.engine_speed.crank_reference_trusted = sync;
    state.engine_speed.revolution_id = sample.revolution_id;
    state.engine_speed.reference_at = sample.rpm_acquired_at_us;
    state.engine_speed.meta = real_meta(sample.rpm_acquired_at_us,
                                        sample.revolution_id,
                                        sync,
                                        engine_health);

    if (has_previous_real_ && sync &&
        synchronized(previous_real_.engine_state) &&
        sample.observed_at_us > previous_real_.observed_at_us) {
        const float elapsed_s = static_cast<float>(
                                    sample.observed_at_us -
                                    previous_real_.observed_at_us) /
                                static_cast<float>(kUsPerSecond);
        state.engine_speed.acceleration_rpm_per_s =
            elapsed_s > 0.0f
                ? (static_cast<float>(sample.rpm) -
                   static_cast<float>(previous_real_.rpm)) /
                      elapsed_s
                : 0.0f;
    }

    const float elapsed_s =
        has_previous_real_ && now > last_collected_at_
            ? static_cast<float>(now - last_collected_at_) /
                  static_cast<float>(kUsPerSecond)
            : 0.0f;
    const float rpm = static_cast<float>(sample.rpm);
    const float tps = static_cast<float>(sample.tps_percent);
    const float egt_target = sync
        ? std::clamp(config_.egt_base_c + config_.egt_rpm_gain * rpm +
                         config_.egt_tps_gain * tps,
                     config_.ambient_c,
                     config_.egt_max_c)
        : config_.ambient_c;
    const float water_target = sync
        ? std::clamp(config_.water_base_c + config_.water_rpm_gain * rpm +
                         config_.water_tps_gain * tps,
                     config_.ambient_c,
                     config_.water_max_c)
        : config_.ambient_c;

    advance_thermal(egt_,
                    egt_target,
                    config_.egt_heat_c_per_s,
                    config_.egt_cool_c_per_s,
                    elapsed_s,
                    true);
    egt_.meta = simulated_meta(now, generation_, sync);
    state.egt = egt_;

    advance_thermal(water_,
                    water_target,
                    config_.water_heat_c_per_s,
                    config_.water_cool_c_per_s,
                    elapsed_s,
                    false);
    water_.meta = simulated_meta(now, generation_, sync);
    state.water_temperature = water_;

    state.quick_shifter.armed =
        sync && sample.rpm >= config_.quick_shift_arm_rpm;
    const std::uint64_t period_us =
        static_cast<std::uint64_t>(config_.quick_shift_period_ms) *
        kUsPerMillisecond;
    const std::uint64_t active_us =
        static_cast<std::uint64_t>(config_.quick_shift_active_ms) *
        kUsPerMillisecond;
    state.quick_shifter.active =
        state.quick_shifter.armed && period_us != 0U &&
        (now % period_us) < active_us;
    state.quick_shifter.meta = simulated_meta(now, generation_, sync);

    state.map_switch.request =
        sample.tps_percent >= config_.secondary_map_tps_percent
            ? MapRequest::Secondary
            : MapRequest::Primary;
    state.map_switch.meta =
        simulated_meta(now, generation_, sample.tps_valid);

    state.latest_knock.revolution_id = sample.revolution_id;
    if (sample.rpm_acquired_at_us != 0U) {
        state.latest_knock.pickup_edge_at = sample.rpm_acquired_at_us;
        state.latest_knock.window_opened_at = sample.rpm_acquired_at_us + 100U;
        state.latest_knock.window_closed_at = sample.rpm_acquired_at_us + 600U;
        state.latest_knock.read_at = sample.rpm_acquired_at_us + 700U;
    }
    state.latest_knock.rpm = rpm;
    state.latest_knock.tps_permille = state.tps.permille;
    state.latest_knock.ignition_angle_deg =
        static_cast<float>(sample.advance_tenths) / 10.0f;
    state.latest_knock.normalized_index =
        0.5f + rpm / 5000.0f + tps / 100.0f;
    state.latest_knock.raw_integrator_count = static_cast<std::uint32_t>(
        std::lround(state.latest_knock.normalized_index * 100.0f));
    state.latest_knock.candidate_knock =
        state.latest_knock.normalized_index >= config_.knock_candidate_index;
    state.latest_knock.valid_for_control = sync;
    state.latest_knock.health =
        sync ? HealthState::Valid : HealthState::Stale;
    state.latest_knock.quality = sync ? Quality::Good : Quality::Suspect;
    state.latest_knock.origin = DataOrigin::Simulated;

    state.test_bench.engine_state = sample.engine_state;
    state.test_bench.advance_tenths = sample.advance_tenths;
    state.test_bench.fire_delay_us = sample.fire_delay_us;
    state.test_bench.rejected_edges = sample.rejected_edge_count;
    state.test_bench.late_fires = sample.late_fire_count;
    state.test_bench.schedule_errors = sample.schedule_error_count;

    return state;
}

void TelemetryCollector::advance_thermal(ThermalTelemetryState &state,
                                         float target,
                                         float heat_rate,
                                         float cool_rate,
                                         float elapsed_s,
                                         bool egt) {
    const float previous = state.celsius;
    const float rate = target >= previous ? heat_rate : cool_rate;
    state.celsius = move_toward(previous, target, rate * elapsed_s);
    state.rate_c_per_s = elapsed_s > 0.0f
        ? (state.celsius - previous) / elapsed_s
        : 0.0f;
    state.maximum_celsius = std::max(state.maximum_celsius, state.celsius);

    const float cold_threshold = egt ? 100.0f : 40.0f;
    const float warming_threshold = egt ? 300.0f : 70.0f;
    const float high_threshold = egt ? 750.0f : 100.0f;
    const float critical_threshold = egt ? 850.0f : 110.0f;
    if (state.celsius < cold_threshold) {
        state.state = ThermalState::Cold;
    } else if (state.celsius < warming_threshold) {
        state.state = ThermalState::Warming;
    } else if (state.celsius < high_threshold) {
        state.state = ThermalState::Normal;
    } else if (state.celsius < critical_threshold) {
        state.state = ThermalState::High;
    } else {
        state.state = ThermalState::Critical;
    }

    if (state.state == ThermalState::High) {
        state.request = ThermalRequest::Warning;
    } else if (state.state == ThermalState::Critical) {
        state.request = ThermalRequest::CriticalProtectionRequested;
    } else {
        state.request = ThermalRequest::Normal;
    }
    state.meta.origin = DataOrigin::Simulated;
}

void TelemetryCollector::detect_events(const telemetry_real_sample_t &sample,
                                       const TelemetryStateFrame &state,
                                       TimestampUs now) {
    if (state.quick_shifter.active != previous_quick_active_) {
        QuickShiftTelemetryEvent payload{};
        payload.active = state.quick_shifter.active;
        payload.meta = state.quick_shifter.meta;
        if (payload.active) {
            quick_activated_at_ = now;
            payload.activated_at = now;
        } else {
            payload.activated_at = quick_activated_at_;
            payload.released_at = now;
            const std::uint64_t duration =
                now >= quick_activated_at_ ? now - quick_activated_at_ : 0U;
            payload.duration_us = static_cast<std::uint32_t>(
                std::min<std::uint64_t>(
                    duration,
                    std::numeric_limits<std::uint32_t>::max()));
        }

        TelemetryEventFrame event{};
        event.kind = EventKind::QuickShiftRequest;
        event.occurred_at = now;
        event.payload = payload;
        enqueue(std::move(event));
        previous_quick_active_ = state.quick_shifter.active;
    }

    if (state.map_switch.request != previous_map_request_) {
        MapSwitchTelemetryEvent payload{};
        payload.request = state.map_switch.request;
        payload.meta = state.map_switch.meta;

        TelemetryEventFrame event{};
        event.kind = EventKind::MapSwitchChange;
        event.occurred_at = now;
        event.payload = payload;
        enqueue(std::move(event));
        previous_map_request_ = state.map_switch.request;
    }

    if (!has_previous_real_) return;

    const auto enqueue_fault = [this, now](FaultKind fault,
                                           std::uint64_t delta) {
        FaultTelemetryEvent payload{};
        payload.fault = fault;
        payload.health = HealthState::Degraded;
        payload.first_at = now;
        payload.last_at = now;
        payload.count = static_cast<std::uint32_t>(
            std::min<std::uint64_t>(
                delta,
                std::numeric_limits<std::uint32_t>::max()));

        TelemetryEventFrame event{};
        event.kind = EventKind::FaultTransition;
        event.occurred_at = now;
        event.payload = payload;
        enqueue(std::move(event));
    };

    if (sample.rejected_edge_count > previous_real_.rejected_edge_count) {
        enqueue_fault(FaultKind::Noise,
                      static_cast<std::uint64_t>(sample.rejected_edge_count) -
                          previous_real_.rejected_edge_count);
    }
    if (sample.late_fire_count > previous_real_.late_fire_count) {
        enqueue_fault(FaultKind::WindowTiming,
                      static_cast<std::uint64_t>(sample.late_fire_count) -
                          previous_real_.late_fire_count);
    }
    if (sample.schedule_error_count > previous_real_.schedule_error_count) {
        enqueue_fault(FaultKind::DeviceFault,
                      static_cast<std::uint64_t>(sample.schedule_error_count) -
                          previous_real_.schedule_error_count);
    }
}

void TelemetryCollector::enqueue(TelemetryEventFrame event) {
    if (pending_event_count_ >= config_.event_backlog_capacity ||
        pending_event_count_ >= pending_events_.size()) {
        switch (event.kind) {
        case EventKind::QuickShiftRequest:
            ++overflow_.quick_shift_events;
            break;
        case EventKind::MapSwitchChange:
            ++overflow_.map_switch_events;
            break;
        case EventKind::FaultTransition:
            ++overflow_.fault_events;
            break;
        }
        return;
    }

    pending_events_[pending_event_count_++] = std::move(event);
}

} // namespace ecu::telemetry
