#pragma once

#include <cstdint>
#include <string>
#include <vector>

#include "sensors/domain/fake_sources.hpp"
#include "sensors/domain/sensor_data_store.hpp"

namespace ecu::sensor_harness {

inline constexpr char kTpsChannel[] = "tps";
inline constexpr char kWaterChannel[] = "water";
inline constexpr char kEgtDevice[] = "egt";
inline constexpr char kQuickInput[] = "quick";
inline constexpr char kMapInput[] = "map";
inline constexpr char kPickupInput[] = "pickup";

class FakeSensorStimulus {
public:
    void push_next(ecu::sensors::FakeAnalogSampleSource &analog,
                   ecu::sensors::FakeSpiMeasurementSource &spi,
                   ecu::sensors::FakeDigitalInputSource &digital,
                   ecu::sensors::FakeEdgeCaptureSource &pickup,
                   ecu::sensors::FakeKnockWindowDevice &knock);

private:
    ecu::sensors::TimestampUs now_us_{0};
    std::uint32_t step_{0};
    bool map_level_high_{true};
};

const char *csv_header();

std::string format_snapshot_csv(const ecu::sensors::EngineInputSnapshot &snapshot,
                                ecu::sensors::TimestampUs now,
                                const ecu::sensors::KnockWindowMeasurement &latest_knock);

std::vector<std::string> drain_event_lines(ecu::sensors::SensorDataStore &store);

} // namespace ecu::sensor_harness
