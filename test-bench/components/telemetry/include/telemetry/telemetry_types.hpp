#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <optional>
#include <variant>

#include "telemetry/telemetry_source.h"

namespace ecu::telemetry {

using TimestampUs = std::uint64_t;
inline constexpr std::size_t kTelemetryEventBatchCapacity = 8;
inline constexpr std::size_t kTelemetryEventBacklogCapacity = 32;

enum class DataOrigin { Measured, Derived, Simulated };
enum class HealthState { Uninitialized, Stabilizing, Valid, Degraded, Stale, Failed, Disabled };
enum class Quality { Unknown, Good, Suspect, Bad };
enum class ThermalState { Cold, Warming, Normal, High, Critical, SensorInvalid };
enum class ThermalRequest { Normal, Warning, DeratingRequested, CriticalProtectionRequested, SensorInvalid };
enum class MapRequest { Primary, Secondary };
enum class FaultKind { Noise, WindowTiming, DeviceFault };
enum class EventKind { QuickShiftRequest, MapSwitchChange, FaultTransition };

struct TelemetryHealth {
    TimestampUs acquired_at{0};
    std::uint64_t sequence{0};
    bool valid_for_control{false};
    HealthState health{HealthState::Uninitialized};
    Quality quality{Quality::Unknown};
    std::uint64_t fault_bits{0};
    DataOrigin origin{DataOrigin::Derived};
};

struct TelemetryOverflowCounters {
    std::uint32_t quick_shift_events{0};
    std::uint32_t map_switch_events{0};
    std::uint32_t knock_measurements{0};
    std::uint32_t fault_events{0};
};

struct TpsTelemetryState {
    int permille{0};
    int fallback_permille{0};
    bool fallback_used{false};
    TelemetryHealth meta{};
};

struct EngineSpeedTelemetryState {
    float rpm{0.0f};
    float period_us{0.0f};
    float acceleration_rpm_per_s{0.0f};
    bool synchronized{false};
    bool crank_reference_trusted{false};
    std::uint64_t revolution_id{0};
    TimestampUs reference_at{0};
    TelemetryHealth meta{};
};

struct ThermalTelemetryState {
    float celsius{20.0f};
    float rate_c_per_s{0.0f};
    float maximum_celsius{20.0f};
    ThermalState state{ThermalState::Cold};
    ThermalRequest request{ThermalRequest::Normal};
    TelemetryHealth meta{};
};

struct QuickShifterTelemetryState {
    bool active{false};
    bool armed{false};
    TelemetryHealth meta{};
};

struct MapSwitchTelemetryState {
    MapRequest request{MapRequest::Primary};
    TelemetryHealth meta{};
};

struct KnockTelemetryState {
    std::uint64_t revolution_id{0};
    TimestampUs pickup_edge_at{0};
    TimestampUs window_opened_at{0};
    TimestampUs window_closed_at{0};
    TimestampUs read_at{0};
    std::uint32_t raw_integrator_count{0};
    float background_estimate{100.0f};
    float normalized_index{0.5f};
    bool candidate_knock{false};
    bool valid_for_control{false};
    HealthState health{HealthState::Stale};
    Quality quality{Quality::Suspect};
    std::uint64_t fault_bits{0};
    float rpm{0.0f};
    int tps_permille{0};
    float ignition_angle_deg{0.0f};
    std::uint32_t config_generation{1};
    DataOrigin origin{DataOrigin::Simulated};
};

struct TestBenchTelemetryState {
    telemetry_engine_state_t engine_state{TELEMETRY_ENGINE_NO_SIGNAL};
    std::uint16_t advance_tenths{0};
    std::uint32_t fire_delay_us{0};
    std::uint32_t rejected_edges{0};
    std::uint32_t late_fires{0};
    std::uint32_t schedule_errors{0};
    DataOrigin origin{DataOrigin::Derived};
};

struct TelemetryStateFrame {
    std::uint32_t snapshot_generation{0};
    TpsTelemetryState tps{};
    EngineSpeedTelemetryState engine_speed{};
    ThermalTelemetryState egt{};
    ThermalTelemetryState water_temperature{};
    QuickShifterTelemetryState quick_shifter{};
    MapSwitchTelemetryState map_switch{};
    KnockTelemetryState latest_knock{};
    TestBenchTelemetryState test_bench{};
};

struct QuickShiftTelemetryEvent {
    bool active{false};
    TimestampUs activated_at{0};
    TimestampUs released_at{0};
    std::uint32_t duration_us{0};
    TelemetryHealth meta{};
};

struct MapSwitchTelemetryEvent {
    MapRequest request{MapRequest::Primary};
    TelemetryHealth meta{};
};

struct FaultTelemetryEvent {
    FaultKind fault{FaultKind::DeviceFault};
    HealthState health{HealthState::Degraded};
    TimestampUs first_at{0};
    TimestampUs last_at{0};
    std::uint32_t count{0};
};

using TelemetryEventPayload = std::variant<QuickShiftTelemetryEvent,
                                           MapSwitchTelemetryEvent,
                                           FaultTelemetryEvent>;

struct TelemetryEventFrame {
    EventKind kind{EventKind::FaultTransition};
    TimestampUs occurred_at{0};
    TelemetryEventPayload payload{FaultTelemetryEvent{}};
};

struct TelemetryBatch {
    TimestampUs collected_at{0};
    TelemetryStateFrame state{};
    std::array<TelemetryEventFrame, kTelemetryEventBatchCapacity> events{};
    std::size_t event_count{0};
    TelemetryOverflowCounters overflow{};
};

} // namespace ecu::telemetry
