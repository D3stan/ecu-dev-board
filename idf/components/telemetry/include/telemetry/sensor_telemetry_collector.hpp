#pragma once

#include <cstddef>
#include <cstdint>
#include <optional>
#include <variant>
#include <vector>

#include "sensors/domain/sensor_data_store.hpp"
#include "sensors/domain/types.hpp"

namespace ecu::telemetry {

struct TelemetryHealth {
    ecu::sensors::TimestampUs acquired_at{0};
    ecu::sensors::SensorSequence sequence{0};
    bool valid_for_control{false};
    ecu::sensors::SensorHealthState health{ecu::sensors::SensorHealthState::Uninitialized};
    ecu::sensors::SensorQuality quality{ecu::sensors::SensorQuality::Unknown};
    std::uint64_t fault_bits{0};
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
    ecu::sensors::RevolutionId revolution_id{0};
    ecu::sensors::TimestampUs reference_at{0};
    TelemetryHealth meta{};
};

struct ThermalTelemetryState {
    float celsius{0.0f};
    float rate_c_per_s{0.0f};
    float maximum_celsius{0.0f};
    ecu::sensors::ThermalState state{ecu::sensors::ThermalState::SensorInvalid};
    ecu::sensors::ThermalRequestLevel request{ecu::sensors::ThermalRequestLevel::SensorInvalid};
    TelemetryHealth meta{};
};

struct QuickShifterTelemetryState {
    bool active{false};
    bool armed{false};
    TelemetryHealth meta{};
};

struct MapSwitchTelemetryState {
    ecu::sensors::PhysicalMapRequest request{ecu::sensors::PhysicalMapRequest::Primary};
    TelemetryHealth meta{};
};

struct KnockTelemetryState {
    ecu::sensors::RevolutionId revolution_id{0};
    ecu::sensors::TimestampUs pickup_edge_at{0};
    ecu::sensors::TimestampUs window_opened_at{0};
    ecu::sensors::TimestampUs window_closed_at{0};
    ecu::sensors::TimestampUs read_at{0};
    std::uint32_t raw_integrator_count{0};
    float background_estimate{0.0f};
    float normalized_index{0.0f};
    bool candidate_knock{false};
    bool valid_for_control{false};
    ecu::sensors::SensorHealthState health{ecu::sensors::SensorHealthState::Uninitialized};
    ecu::sensors::SensorQuality quality{ecu::sensors::SensorQuality::Unknown};
    std::uint64_t fault_bits{0};
    float rpm{0.0f};
    int tps_permille{0};
    float ignition_angle_deg{0.0f};
    std::uint32_t config_generation{0};
};

struct TelemetryStateFrame {
    std::uint32_t snapshot_generation{0};
    TpsTelemetryState tps{};
    EngineSpeedTelemetryState engine_speed{};
    ThermalTelemetryState egt{};
    ThermalTelemetryState water_temperature{};
    QuickShifterTelemetryState quick_shifter{};
    MapSwitchTelemetryState map_switch{};
    std::optional<KnockTelemetryState> latest_knock{};
};

struct QuickShiftTelemetryEvent {
    bool active{false};
    ecu::sensors::TimestampUs activated_at{0};
    ecu::sensors::TimestampUs released_at{0};
    std::uint32_t duration_us{0};
    TelemetryHealth meta{};
};

struct MapSwitchTelemetryEvent {
    ecu::sensors::PhysicalMapRequest request{ecu::sensors::PhysicalMapRequest::Primary};
    TelemetryHealth meta{};
};

struct FaultTelemetryEvent {
    ecu::sensors::SensorFault fault{ecu::sensors::SensorFault::DeviceFault};
    ecu::sensors::SensorHealthState health{ecu::sensors::SensorHealthState::Uninitialized};
    ecu::sensors::TimestampUs first_at{0};
    ecu::sensors::TimestampUs last_at{0};
    std::uint32_t count{0};
};

enum class TelemetryEventKind {
    QuickShiftRequest,
    MapSwitchChange,
    FaultTransition,
};

using TelemetryEventPayload = std::variant<QuickShiftTelemetryEvent, MapSwitchTelemetryEvent, FaultTelemetryEvent>;

struct TelemetryEventFrame {
    TelemetryEventKind kind{TelemetryEventKind::FaultTransition};
    ecu::sensors::TimestampUs occurred_at{0};
    TelemetryEventPayload payload{FaultTelemetryEvent{}};
};

struct TelemetryBatch {
    ecu::sensors::TimestampUs collected_at{0};
    TelemetryStateFrame state{};
    std::vector<TelemetryEventFrame> events{};
    TelemetryOverflowCounters overflow{};
};

struct SensorTelemetryCollectorConfig {
    std::size_t max_events_per_batch{8};
};

class SensorTelemetryCollector {
public:
    explicit SensorTelemetryCollector(ecu::sensors::SensorDataStore &store,
                                      SensorTelemetryCollectorConfig config = {});

    std::optional<TelemetryBatch> collect(ecu::sensors::TimestampUs now);

private:
    TelemetryStateFrame make_state(const ecu::sensors::EngineInputSnapshot &snapshot) const;
    void drain_knock_measurements();
    void drain_events();

    ecu::sensors::SensorDataStore &store_;
    SensorTelemetryCollectorConfig config_{};
    std::optional<KnockTelemetryState> latest_knock_{};
    std::vector<TelemetryEventFrame> pending_events_{};
};

} // namespace ecu::telemetry
