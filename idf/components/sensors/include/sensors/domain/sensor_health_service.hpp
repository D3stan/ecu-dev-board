#pragma once

#include "sensors/domain/sensor_data_store.hpp"

namespace ecu::sensors {

struct SensorHealthSnapshot {
    SensorHealthState tps{SensorHealthState::Uninitialized};
    SensorHealthState egt{SensorHealthState::Uninitialized};
    SensorHealthState water_temperature{SensorHealthState::Uninitialized};
    SensorHealthState pickup{SensorHealthState::Uninitialized};
    SensorHealthState quick_shifter{SensorHealthState::Uninitialized};
    SensorHealthState map_switch{SensorHealthState::Uninitialized};
    SensorHealthState knock{SensorHealthState::Uninitialized};
};

class SensorHealthService {
public:
    SensorHealthSnapshot aggregate(const EngineInputSnapshot &snapshot) const;
};

} // namespace ecu::sensors
