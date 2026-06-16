#include "sensors/domain/sensor_data_store.hpp"

namespace ecu::sensors {

SensorDataStore::SensorDataStore(std::size_t quick_shift_capacity,
                                 std::size_t map_switch_capacity,
                                 std::size_t knock_capacity,
                                 std::size_t fault_capacity)
    : quick_shift_capacity_(quick_shift_capacity),
      map_switch_capacity_(map_switch_capacity),
      knock_capacity_(knock_capacity),
      fault_capacity_(fault_capacity) {}

template <typename T>
void SensorDataStore::assign_sequence(SensorReading<T> &reading, SensorSequence &sequence) {
    reading.sequence = ++sequence;
    ++snapshot_.generation;
}

template <typename T>
bool SensorDataStore::push_bounded(std::deque<T> &queue, std::size_t capacity, const T &value, std::uint32_t &overflow) {
    if (queue.size() >= capacity) {
        ++overflow;
        return false;
    }
    queue.push_back(value);
    return true;
}

void SensorDataStore::publish_tps(SensorReading<ThrottlePositionPermille> reading) {
    std::lock_guard<std::mutex> lock(mutex_);
    assign_sequence(reading, tps_sequence_);
    snapshot_.tps = reading;
}

void SensorDataStore::publish_egt(SensorReading<TemperatureReading> reading) {
    std::lock_guard<std::mutex> lock(mutex_);
    assign_sequence(reading, egt_sequence_);
    snapshot_.egt = reading;
}

void SensorDataStore::publish_water_temperature(SensorReading<TemperatureReading> reading) {
    std::lock_guard<std::mutex> lock(mutex_);
    assign_sequence(reading, water_sequence_);
    snapshot_.water_temperature = reading;
}

void SensorDataStore::publish_engine_speed(SensorReading<EngineSpeedState> reading) {
    std::lock_guard<std::mutex> lock(mutex_);
    assign_sequence(reading, engine_sequence_);
    snapshot_.engine_speed = reading;
}

void SensorDataStore::publish_quick_shifter_state(SensorReading<QuickShifterState> reading) {
    std::lock_guard<std::mutex> lock(mutex_);
    assign_sequence(reading, quick_state_sequence_);
    snapshot_.quick_shifter_state = reading;
}

void SensorDataStore::publish_map_switch_state(SensorReading<MapSwitchState> reading) {
    std::lock_guard<std::mutex> lock(mutex_);
    assign_sequence(reading, map_state_sequence_);
    snapshot_.map_switch = reading;
}

bool SensorDataStore::publish_quick_shift_request(SensorEvent<QuickShiftRequest> event) {
    std::lock_guard<std::mutex> lock(mutex_);
    event.sequence = ++quick_event_sequence_;
    return push_bounded(quick_shift_events_, quick_shift_capacity_, event, overflow_.quick_shift_events);
}

bool SensorDataStore::publish_map_switch_event(SensorEvent<MapSwitchState> event) {
    std::lock_guard<std::mutex> lock(mutex_);
    event.sequence = ++map_event_sequence_;
    return push_bounded(map_switch_events_, map_switch_capacity_, event, overflow_.map_switch_events);
}

bool SensorDataStore::publish_knock_measurement(KnockWindowMeasurement measurement) {
    std::lock_guard<std::mutex> lock(mutex_);
    return push_bounded(knock_measurements_, knock_capacity_, measurement, overflow_.knock_measurements);
}

bool SensorDataStore::publish_fault(FaultTransition transition) {
    std::lock_guard<std::mutex> lock(mutex_);
    return push_bounded(fault_events_, fault_capacity_, transition, overflow_.fault_events);
}

EngineInputSnapshot SensorDataStore::snapshot() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return snapshot_;
}

SensorOverflowCounters SensorDataStore::overflow_counters() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return overflow_;
}

std::optional<SensorEvent<QuickShiftRequest>> SensorDataStore::pop_quick_shift_request() {
    std::lock_guard<std::mutex> lock(mutex_);
    if (quick_shift_events_.empty()) {
        return std::nullopt;
    }
    auto event = quick_shift_events_.front();
    quick_shift_events_.pop_front();
    return event;
}

std::optional<SensorEvent<MapSwitchState>> SensorDataStore::pop_map_switch_event() {
    std::lock_guard<std::mutex> lock(mutex_);
    if (map_switch_events_.empty()) {
        return std::nullopt;
    }
    auto event = map_switch_events_.front();
    map_switch_events_.pop_front();
    return event;
}

std::optional<KnockWindowMeasurement> SensorDataStore::pop_knock_measurement() {
    std::lock_guard<std::mutex> lock(mutex_);
    if (knock_measurements_.empty()) {
        return std::nullopt;
    }
    auto measurement = knock_measurements_.front();
    knock_measurements_.pop_front();
    return measurement;
}

std::optional<FaultTransition> SensorDataStore::pop_fault() {
    std::lock_guard<std::mutex> lock(mutex_);
    if (fault_events_.empty()) {
        return std::nullopt;
    }
    auto transition = fault_events_.front();
    fault_events_.pop_front();
    return transition;
}

} // namespace ecu::sensors
