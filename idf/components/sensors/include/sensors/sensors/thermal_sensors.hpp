#pragma once

#include "sensors/domain/types.hpp"
#include "sensors/sensors/analog_transfer.hpp"

namespace ecu::sensors {

struct EgtConfig {
    float minimum_celsius{0.0f};
    float maximum_celsius{1000.0f};
    float warning_celsius{650.0f};
    float derating_celsius{700.0f};
    float critical_celsius{750.0f};
    TimestampUs stale_timeout_us{500000};
};

struct WaterTemperatureConfig {
    PullupNtcConfig ntc{};
    int minimum_valid_mv{1};
    int maximum_valid_mv{3299};
    int short_to_ground_mv{0};
    int open_circuit_mv{3300};
    float cold_celsius{40.0f};
    float high_celsius{95.0f};
    float critical_celsius{110.0f};
    TimestampUs stale_timeout_us{1000000};
};

class EgtSensor {
public:
    explicit EgtSensor(EgtConfig config);
    SensorReading<TemperatureReading> process(const Max31856Sample &sample);
    SensorReading<TemperatureReading> check_stale(TimestampUs now);

private:
    SensorReading<TemperatureReading> invalid(TimestampUs acquired_at, SensorFault fault, SensorHealthState health);
    TemperatureReading classify(float celsius, TimestampUs acquired_at);

    EgtConfig config_{};
    SensorReading<TemperatureReading> last_{};
    bool has_previous_{false};
    float maximum_{0.0f};
};

class WaterTemperatureSensor {
public:
    explicit WaterTemperatureSensor(WaterTemperatureConfig config);
    SensorReading<TemperatureReading> process(const AnalogSample &sample);
    SensorReading<TemperatureReading> check_stale(TimestampUs now);

private:
    SensorReading<TemperatureReading> invalid(TimestampUs acquired_at, SensorFault fault, SensorHealthState health);
    TemperatureReading classify(float celsius, TimestampUs acquired_at);
    bool config_valid() const;

    WaterTemperatureConfig config_{};
    SensorReading<TemperatureReading> last_{};
    bool has_previous_{false};
    float maximum_{0.0f};
};

} // namespace ecu::sensors
