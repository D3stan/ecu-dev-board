#pragma once

#include "sensors/domain/types.hpp"

namespace ecu::sensors {

struct QuickShifterConfig {
    bool active_low{true};
    TimestampUs debounce_us{20000};
    TimestampUs stuck_active_us{1000000};
    TimestampUs rearm_us{20000};
};

struct QuickShifterProcessResult {
    SensorReading<QuickShifterState> state{};
    SensorEvent<QuickShiftRequest> request{};
    bool has_request{false};
};

class QuickShifterInput {
public:
    explicit QuickShifterInput(QuickShifterConfig config);
    SensorReading<QuickShifterState> initialize(const DigitalSample &sample);
    QuickShifterProcessResult process(const DigitalEdge &edge);
    SensorReading<QuickShifterState> check_stuck(TimestampUs now);

private:
    bool normalize_active(bool level_high) const;
    SensorReading<QuickShifterState> make_state(TimestampUs at, bool active, bool armed, SensorHealthState health, SensorFault *fault = nullptr);

    QuickShifterConfig config_{};
    SensorReading<QuickShifterState> state_{};
    TimestampUs last_accepted_edge_at_{0};
    TimestampUs active_since_{0};
    bool initialized_{false};
    bool armed_{true};
};

struct MapSwitchConfig {
    bool secondary_active_low{true};
    TimestampUs debounce_us{20000};
};

struct MapSwitchProcessResult {
    SensorReading<MapSwitchState> reading{};
    SensorEvent<MapSwitchState> event{};
    bool has_event{false};
};

class MapSwitchInput {
public:
    explicit MapSwitchInput(MapSwitchConfig config);
    SensorReading<MapSwitchState> initialize(const DigitalSample &sample);
    MapSwitchProcessResult process(const DigitalEdge &edge);

private:
    PhysicalMapRequest normalize(bool level_high) const;

    MapSwitchConfig config_{};
    SensorReading<MapSwitchState> reading_{};
    TimestampUs last_accepted_edge_at_{0};
    bool initialized_{false};
};

} // namespace ecu::sensors
