#include "sensors/domain/sensor_health_service.hpp"

namespace ecu::sensors {

SensorHealthSnapshot SensorHealthService::aggregate(const EngineInputSnapshot &snapshot) const {
    SensorHealthSnapshot health{};
    health.tps = snapshot.tps.health;
    health.egt = snapshot.egt.health;
    health.water_temperature = snapshot.water_temperature.health;
    health.pickup = snapshot.engine_speed.health;
    health.quick_shifter = snapshot.quick_shifter_state.health;
    health.map_switch = snapshot.map_switch.health;
    return health;
}

} // namespace ecu::sensors
