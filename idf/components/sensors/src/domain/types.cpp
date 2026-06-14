#include "sensors/domain/types.hpp"

#include <ostream>

namespace ecu::sensors {

namespace {
template <typename E>
std::ostream &write_enum(std::ostream &out, E value) {
    return out << static_cast<int>(value);
}
} // namespace

std::ostream &operator<<(std::ostream &out, SensorHealthState state) { return write_enum(out, state); }
std::ostream &operator<<(std::ostream &out, SensorQuality quality) { return write_enum(out, quality); }
std::ostream &operator<<(std::ostream &out, ThermalState state) { return write_enum(out, state); }
std::ostream &operator<<(std::ostream &out, ThermalRequestLevel level) { return write_enum(out, level); }
std::ostream &operator<<(std::ostream &out, PhysicalMapRequest request) { return write_enum(out, request); }

} // namespace ecu::sensors
