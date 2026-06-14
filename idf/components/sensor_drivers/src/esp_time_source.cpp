#include "sensor_drivers/esp_time_source.hpp"

#include "esp_timer.h"

namespace ecu::sensor_drivers {

ecu::sensors::TimestampUs EspTimeSource::now() const {
    return static_cast<ecu::sensors::TimestampUs>(esp_timer_get_time());
}

} // namespace ecu::sensor_drivers
