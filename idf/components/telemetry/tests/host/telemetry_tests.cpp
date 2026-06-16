#include <cstdlib>
#include <iostream>
#include <string>
#include <variant>

#include "sensors/domain/sensor_data_store.hpp"
#include "telemetry/sensor_telemetry_collector.hpp"

namespace {

int failures = 0;

#define EXPECT_TRUE(expr) do { if (!(expr)) fail(__FILE__, __LINE__, #expr); } while (false)
#define EXPECT_FALSE(expr) EXPECT_TRUE(!(expr))
#define EXPECT_EQ(expected, actual) do { auto e = (expected); auto a = (actual); if (!(e == a)) fail_eq(__FILE__, __LINE__, #expected, #actual, e, a); } while (false)
#define EXPECT_NEAR(expected, actual, tolerance) do { auto e = static_cast<double>(expected); auto a = static_cast<double>(actual); if (std::abs(e - a) > static_cast<double>(tolerance)) fail_near(__FILE__, __LINE__, #expected, #actual, e, a); } while (false)
#define REQUIRE_TRUE(expr) do { if (!(expr)) { fail(__FILE__, __LINE__, #expr); return; } } while (false)

void fail(const char *file, int line, const char *expr) {
    std::cerr << file << ":" << line << ": expected true: " << expr << "\n";
    ++failures;
}

template <typename E, typename A>
void fail_eq(const char *file, int line, const char *expected_expr, const char *actual_expr, E expected, A actual) {
    std::cerr << file << ":" << line << ": expected " << expected_expr << " == " << actual_expr
              << " (" << expected << " vs " << actual << ")\n";
    ++failures;
}

void fail_near(const char *file, int line, const char *expected_expr, const char *actual_expr, double expected, double actual) {
    std::cerr << file << ":" << line << ": expected " << expected_expr << " ~= " << actual_expr
              << " (" << expected << " vs " << actual << ")\n";
    ++failures;
}

template <typename Enum>
int enum_value(Enum value) {
    return static_cast<int>(value);
}

using namespace ecu::sensors;
using namespace ecu::telemetry;

void test_collects_complete_latest_state_and_latest_knock() {
    SensorDataStore store(4, 4, 4, 4);

    SensorReading<ThrottlePositionPermille> tps{};
    tps.value.permille = 512;
    tps.value.fallback_permille = 700;
    tps.value.fallback_used = true;
    tps.acquired_at = 1000;
    tps.valid_for_control = false;
    tps.health = SensorHealthState::Degraded;
    tps.quality = SensorQuality::Suspect;
    tps.faults.add(SensorFault::Rate);
    store.publish_tps(tps);

    SensorReading<EngineSpeedState> engine{};
    engine.value.rpm = 6250.5f;
    engine.value.period_us = 9600.0f;
    engine.value.acceleration_rpm_per_s = 1500.0f;
    engine.value.synchronized = true;
    engine.value.crank_reference_trusted = true;
    engine.value.revolution_id = 42;
    engine.value.reference_at = 2000;
    engine.acquired_at = 2100;
    engine.valid_for_control = true;
    engine.health = SensorHealthState::Valid;
    engine.quality = SensorQuality::Good;
    store.publish_engine_speed(engine);

    SensorReading<TemperatureReading> egt{};
    egt.value.celsius = 501.5f;
    egt.value.rate_c_per_s = 3.25f;
    egt.value.maximum_celsius = 510.0f;
    egt.value.state = ThermalState::High;
    egt.value.request = ThermalRequestLevel::Warning;
    egt.acquired_at = 3000;
    egt.valid_for_control = true;
    egt.health = SensorHealthState::Valid;
    egt.quality = SensorQuality::Good;
    store.publish_egt(egt);

    SensorReading<TemperatureReading> water{};
    water.value.celsius = 64.0f;
    water.value.rate_c_per_s = 0.5f;
    water.value.maximum_celsius = 66.0f;
    water.value.state = ThermalState::Normal;
    water.value.request = ThermalRequestLevel::Normal;
    water.acquired_at = 4000;
    water.valid_for_control = true;
    water.health = SensorHealthState::Valid;
    water.quality = SensorQuality::Good;
    store.publish_water_temperature(water);

    SensorReading<QuickShifterState> quick{};
    quick.value.active = true;
    quick.value.armed = false;
    quick.acquired_at = 5000;
    quick.valid_for_control = true;
    quick.health = SensorHealthState::Valid;
    quick.quality = SensorQuality::Good;
    store.publish_quick_shifter_state(quick);

    SensorReading<MapSwitchState> map{};
    map.value.request = PhysicalMapRequest::Secondary;
    map.acquired_at = 6000;
    map.valid_for_control = true;
    map.health = SensorHealthState::Valid;
    map.quality = SensorQuality::Good;
    store.publish_map_switch_state(map);

    KnockWindowMeasurement first_knock{};
    first_knock.revolution_id = 40;
    first_knock.raw_integrator_count = 1000;
    EXPECT_TRUE(store.publish_knock_measurement(first_knock));

    KnockWindowMeasurement second_knock{};
    second_knock.revolution_id = 41;
    second_knock.pickup_edge_at = 7000;
    second_knock.window_opened_at = 7100;
    second_knock.window_closed_at = 7600;
    second_knock.read_at = 7700;
    second_knock.raw_integrator_count = 1234;
    second_knock.background_estimate = 100.0f;
    second_knock.normalized_index = 12.34f;
    second_knock.candidate_knock = true;
    second_knock.valid_for_control = true;
    second_knock.health = SensorHealthState::Valid;
    second_knock.quality = SensorQuality::Good;
    second_knock.faults.add(SensorFault::Saturation);
    second_knock.rpm = 6250.0f;
    second_knock.tps_permille = 512;
    second_knock.ignition_angle_deg = 14.5f;
    second_knock.config_generation = 7;
    EXPECT_TRUE(store.publish_knock_measurement(second_knock));

    SensorTelemetryCollector collector(store);
    auto batch = collector.collect(9999);
    REQUIRE_TRUE(batch.has_value());

    EXPECT_EQ(9999ull, batch->collected_at);
    EXPECT_EQ(6u, batch->state.snapshot_generation);

    EXPECT_EQ(512, batch->state.tps.permille);
    EXPECT_EQ(700, batch->state.tps.fallback_permille);
    EXPECT_TRUE(batch->state.tps.fallback_used);
    EXPECT_EQ(1000ull, batch->state.tps.meta.acquired_at);
    EXPECT_EQ(1u, batch->state.tps.meta.sequence);
    EXPECT_FALSE(batch->state.tps.meta.valid_for_control);
    EXPECT_EQ(enum_value(SensorHealthState::Degraded), enum_value(batch->state.tps.meta.health));
    EXPECT_EQ(enum_value(SensorQuality::Suspect), enum_value(batch->state.tps.meta.quality));
    EXPECT_TRUE((batch->state.tps.meta.fault_bits & (1ull << enum_value(SensorFault::Rate))) != 0);

    EXPECT_NEAR(6250.5, batch->state.engine_speed.rpm, 0.01);
    EXPECT_NEAR(9600.0, batch->state.engine_speed.period_us, 0.01);
    EXPECT_NEAR(1500.0, batch->state.engine_speed.acceleration_rpm_per_s, 0.01);
    EXPECT_TRUE(batch->state.engine_speed.synchronized);
    EXPECT_TRUE(batch->state.engine_speed.crank_reference_trusted);
    EXPECT_EQ(42ull, batch->state.engine_speed.revolution_id);
    EXPECT_EQ(2000ull, batch->state.engine_speed.reference_at);

    EXPECT_NEAR(501.5, batch->state.egt.celsius, 0.01);
    EXPECT_NEAR(3.25, batch->state.egt.rate_c_per_s, 0.01);
    EXPECT_NEAR(510.0, batch->state.egt.maximum_celsius, 0.01);
    EXPECT_EQ(enum_value(ThermalState::High), enum_value(batch->state.egt.state));
    EXPECT_EQ(enum_value(ThermalRequestLevel::Warning), enum_value(batch->state.egt.request));

    EXPECT_NEAR(64.0, batch->state.water_temperature.celsius, 0.01);
    EXPECT_NEAR(0.5, batch->state.water_temperature.rate_c_per_s, 0.01);
    EXPECT_NEAR(66.0, batch->state.water_temperature.maximum_celsius, 0.01);

    EXPECT_TRUE(batch->state.quick_shifter.active);
    EXPECT_FALSE(batch->state.quick_shifter.armed);
    EXPECT_EQ(enum_value(PhysicalMapRequest::Secondary), enum_value(batch->state.map_switch.request));

    REQUIRE_TRUE(batch->state.latest_knock.has_value());
    EXPECT_EQ(41ull, batch->state.latest_knock->revolution_id);
    EXPECT_EQ(1234u, batch->state.latest_knock->raw_integrator_count);
    EXPECT_NEAR(12.34, batch->state.latest_knock->normalized_index, 0.01);
    EXPECT_TRUE(batch->state.latest_knock->candidate_knock);
    EXPECT_TRUE(batch->state.latest_knock->valid_for_control);
    EXPECT_TRUE((batch->state.latest_knock->fault_bits & (1ull << enum_value(SensorFault::Saturation))) != 0);
    EXPECT_EQ(7u, batch->state.latest_knock->config_generation);

    EXPECT_FALSE(store.pop_knock_measurement().has_value());
}

void test_events_are_ordered_bounded_and_overflow_counters_are_exposed() {
    SensorDataStore store(1, 4, 4, 4);

    SensorEvent<QuickShiftRequest> quick{};
    quick.event.active = true;
    quick.event.activated_at = 3000;
    quick.event.released_at = 3600;
    quick.event.duration_us = 600;
    quick.acquired_at = 3000;
    quick.valid_for_control = true;
    quick.health = SensorHealthState::Valid;
    quick.quality = SensorQuality::Good;
    EXPECT_TRUE(store.publish_quick_shift_request(quick));
    EXPECT_FALSE(store.publish_quick_shift_request(quick));

    SensorEvent<MapSwitchState> map{};
    map.event.request = PhysicalMapRequest::Secondary;
    map.acquired_at = 2000;
    map.valid_for_control = true;
    map.health = SensorHealthState::Valid;
    map.quality = SensorQuality::Good;
    EXPECT_TRUE(store.publish_map_switch_event(map));

    FaultTransition fault{};
    fault.fault = SensorFault::Overflow;
    fault.health = SensorHealthState::Failed;
    fault.first_at = 1000;
    fault.last_at = 1500;
    fault.count = 2;
    EXPECT_TRUE(store.publish_fault(fault));

    SensorTelemetryCollectorConfig config{};
    config.max_events_per_batch = 2;
    SensorTelemetryCollector collector(store, config);

    auto first_batch = collector.collect(10000);
    REQUIRE_TRUE(first_batch.has_value());
    EXPECT_EQ(2u, first_batch->events.size());
    EXPECT_EQ(1u, first_batch->overflow.quick_shift_events);
    EXPECT_EQ(0u, first_batch->overflow.map_switch_events);
    EXPECT_EQ(0u, first_batch->overflow.knock_measurements);
    EXPECT_EQ(0u, first_batch->overflow.fault_events);

    EXPECT_EQ(enum_value(TelemetryEventKind::FaultTransition), enum_value(first_batch->events[0].kind));
    EXPECT_EQ(1000ull, first_batch->events[0].occurred_at);
    const auto &fault_event = std::get<FaultTelemetryEvent>(first_batch->events[0].payload);
    EXPECT_EQ(enum_value(SensorFault::Overflow), enum_value(fault_event.fault));
    EXPECT_EQ(enum_value(SensorHealthState::Failed), enum_value(fault_event.health));
    EXPECT_EQ(2u, fault_event.count);

    EXPECT_EQ(enum_value(TelemetryEventKind::MapSwitchChange), enum_value(first_batch->events[1].kind));
    EXPECT_EQ(2000ull, first_batch->events[1].occurred_at);
    const auto &map_event = std::get<MapSwitchTelemetryEvent>(first_batch->events[1].payload);
    EXPECT_EQ(enum_value(PhysicalMapRequest::Secondary), enum_value(map_event.request));
    EXPECT_EQ(1u, map_event.meta.sequence);

    auto second_batch = collector.collect(11000);
    REQUIRE_TRUE(second_batch.has_value());
    EXPECT_EQ(1u, second_batch->events.size());
    EXPECT_EQ(enum_value(TelemetryEventKind::QuickShiftRequest), enum_value(second_batch->events[0].kind));
    EXPECT_EQ(3000ull, second_batch->events[0].occurred_at);
    const auto &quick_event = std::get<QuickShiftTelemetryEvent>(second_batch->events[0].payload);
    EXPECT_TRUE(quick_event.active);
    EXPECT_EQ(3000ull, quick_event.activated_at);
    EXPECT_EQ(3600ull, quick_event.released_at);
    EXPECT_EQ(600u, quick_event.duration_us);
    EXPECT_EQ(1u, quick_event.meta.sequence);

    auto third_batch = collector.collect(12000);
    REQUIRE_TRUE(third_batch.has_value());
    EXPECT_TRUE(third_batch->events.empty());
}

} // namespace

int main() {
    test_collects_complete_latest_state_and_latest_knock();
    test_events_are_ordered_bounded_and_overflow_counters_are_exposed();

    if (failures != 0) {
        std::cerr << failures << " telemetry test failure(s)\n";
        return EXIT_FAILURE;
    }
    std::cout << "telemetry tests passed\n";
    return EXIT_SUCCESS;
}
