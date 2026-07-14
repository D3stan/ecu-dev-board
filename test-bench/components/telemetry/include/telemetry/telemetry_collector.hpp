#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <optional>

#include "telemetry/telemetry_source.h"
#include "telemetry/telemetry_types.hpp"

namespace ecu::telemetry {

struct TelemetryCollectorConfig {
    std::size_t max_events_per_batch{8};
    std::size_t event_backlog_capacity{32};
    float ambient_c{20.0f};
    float egt_base_c{200.0f};
    float egt_rpm_gain{0.025f};
    float egt_tps_gain{3.0f};
    float egt_max_c{900.0f};
    float egt_heat_c_per_s{80.0f};
    float egt_cool_c_per_s{30.0f};
    float water_base_c{45.0f};
    float water_rpm_gain{0.002f};
    float water_tps_gain{0.25f};
    float water_max_c{115.0f};
    float water_heat_c_per_s{5.0f};
    float water_cool_c_per_s{2.0f};
    std::uint32_t quick_shift_arm_rpm{1500};
    std::uint32_t quick_shift_period_ms{8000};
    std::uint32_t quick_shift_active_ms{100};
    std::uint8_t secondary_map_tps_percent{70};
    float knock_candidate_index{4.0f};
};

class TelemetryCollector {
public:
    TelemetryCollector(telemetry_source_t source,
                       TelemetryCollectorConfig config);

    std::optional<TelemetryBatch> collect(TimestampUs now);

private:
    TelemetryStateFrame make_state(const telemetry_real_sample_t &sample,
                                   TimestampUs now);
    void advance_thermal(ThermalTelemetryState &state,
                         float target,
                         float heat_rate,
                         float cool_rate,
                         float elapsed_s,
                         bool egt);
    void detect_events(const telemetry_real_sample_t &sample,
                       const TelemetryStateFrame &state,
                       TimestampUs now);
    void enqueue(TelemetryEventFrame event);

    telemetry_source_t source_{};
    TelemetryCollectorConfig config_{};
    std::uint32_t generation_{0};
    TimestampUs last_collected_at_{0};
    telemetry_real_sample_t previous_real_{};
    bool has_previous_real_{false};
    bool previous_quick_active_{false};
    TimestampUs quick_activated_at_{0};
    MapRequest previous_map_request_{MapRequest::Primary};
    ThermalTelemetryState egt_{};
    ThermalTelemetryState water_{};
    std::array<TelemetryEventFrame, kTelemetryEventBacklogCapacity> pending_events_{};
    std::size_t pending_event_count_{0};
    TelemetryOverflowCounters overflow_{};
};

} // namespace ecu::telemetry
