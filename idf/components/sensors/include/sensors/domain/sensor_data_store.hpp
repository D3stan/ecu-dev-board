#pragma once

#include <deque>
#include <mutex>
#include <optional>

#include "sensors/domain/types.hpp"

namespace ecu::sensors {

struct SensorOverflowCounters {
    std::uint32_t quick_shift_events{0};
    std::uint32_t map_switch_events{0};
    std::uint32_t knock_measurements{0};
    std::uint32_t fault_events{0};
};

struct FaultTransition {
    SensorFault fault{SensorFault::DeviceFault};
    SensorHealthState health{SensorHealthState::Uninitialized};
    TimestampUs first_at{0};
    TimestampUs last_at{0};
    std::uint32_t count{0};
};

struct EngineInputSnapshot {
    std::uint32_t generation{0};
    SensorReading<ThrottlePositionPermille> tps{};
    SensorReading<TemperatureReading> egt{};
    SensorReading<TemperatureReading> water_temperature{};
    SensorReading<EngineSpeedState> engine_speed{};
    SensorReading<QuickShifterState> quick_shifter_state{};
    SensorReading<MapSwitchState> map_switch{};
};

class SensorDataStore {
public:
    SensorDataStore(std::size_t quick_shift_capacity,
                    std::size_t map_switch_capacity,
                    std::size_t knock_capacity,
                    std::size_t fault_capacity);

    void publish_tps(SensorReading<ThrottlePositionPermille> reading);
    void publish_egt(SensorReading<TemperatureReading> reading);
    void publish_water_temperature(SensorReading<TemperatureReading> reading);
    void publish_engine_speed(SensorReading<EngineSpeedState> reading);
    void publish_quick_shifter_state(SensorReading<QuickShifterState> reading);
    void publish_map_switch_state(SensorReading<MapSwitchState> reading);

    bool publish_quick_shift_request(SensorEvent<QuickShiftRequest> event);
    bool publish_map_switch_event(SensorEvent<MapSwitchState> event);
    bool publish_knock_measurement(KnockWindowMeasurement measurement);
    bool publish_fault(FaultTransition transition);

    EngineInputSnapshot snapshot() const;
    SensorOverflowCounters overflow_counters() const;

    std::optional<SensorEvent<QuickShiftRequest>> pop_quick_shift_request();
    std::optional<SensorEvent<MapSwitchState>> pop_map_switch_event();
    std::optional<KnockWindowMeasurement> pop_knock_measurement();
    std::optional<FaultTransition> pop_fault();

private:
    template <typename T>
    void assign_sequence(SensorReading<T> &reading, SensorSequence &sequence);

    template <typename T>
    bool push_bounded(std::deque<T> &queue, std::size_t capacity, const T &value, std::uint32_t &overflow);

    EngineInputSnapshot snapshot_{};
    SensorSequence tps_sequence_{0};
    SensorSequence egt_sequence_{0};
    SensorSequence water_sequence_{0};
    SensorSequence engine_sequence_{0};
    SensorSequence quick_state_sequence_{0};
    SensorSequence map_state_sequence_{0};
    SensorSequence quick_event_sequence_{0};
    SensorSequence map_event_sequence_{0};
    SensorOverflowCounters overflow_{};
    std::size_t quick_shift_capacity_{0};
    std::size_t map_switch_capacity_{0};
    std::size_t knock_capacity_{0};
    std::size_t fault_capacity_{0};
    std::deque<SensorEvent<QuickShiftRequest>> quick_shift_events_{};
    std::deque<SensorEvent<MapSwitchState>> map_switch_events_{};
    std::deque<KnockWindowMeasurement> knock_measurements_{};
    std::deque<FaultTransition> fault_events_{};
    mutable std::mutex mutex_{};
};

} // namespace ecu::sensors
