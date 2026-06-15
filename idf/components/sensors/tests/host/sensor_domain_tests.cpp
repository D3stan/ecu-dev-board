#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <iostream>
#include <string>

#include "sensor_harness/sensor_harness.hpp"
#include "sensors/domain/fake_sources.hpp"
#include "sensors/domain/sensor_data_store.hpp"
#include "sensors/domain/sensor_health_service.hpp"
#include "sensors/sensors/digital_inputs.hpp"
#include "sensors/sensors/knock_sensor.hpp"
#include "sensors/sensors/pickup_sensor.hpp"
#include "sensors/sensors/thermal_sensors.hpp"
#include "sensors/sensors/tps_sensor.hpp"
#include "sensors/services/sensor_services.hpp"

namespace {

int failures = 0;

#define EXPECT_TRUE(expr) do { if (!(expr)) fail(__FILE__, __LINE__, #expr); } while (false)
#define EXPECT_FALSE(expr) EXPECT_TRUE(!(expr))
#define EXPECT_EQ(expected, actual) do { auto e = (expected); auto a = (actual); if (!(e == a)) fail_eq(__FILE__, __LINE__, #expected, #actual, e, a); } while (false)
#define EXPECT_NEAR(expected, actual, tolerance) do { auto e = static_cast<double>(expected); auto a = static_cast<double>(actual); if (std::fabs(e - a) > static_cast<double>(tolerance)) fail_near(__FILE__, __LINE__, #expected, #actual, e, a); } while (false)

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

using namespace ecu::sensors;

void test_data_store_sequences_and_queue_overflow() {
    SensorDataStore store(1, 1, 1, 1);

    SensorReading<ThrottlePositionPermille> tps{};
    tps.value.permille = 123;
    tps.acquired_at = 1000;
    tps.valid_for_control = true;
    tps.health = SensorHealthState::Valid;
    tps.quality = SensorQuality::Good;

    store.publish_tps(tps);
    auto first = store.snapshot();
    store.publish_tps(tps);
    auto second = store.snapshot();

    EXPECT_EQ(1u, first.tps.sequence);
    EXPECT_EQ(2u, second.tps.sequence);
    EXPECT_EQ(2u, second.generation);

    SensorEvent<QuickShiftRequest> request{};
    request.event.active = true;
    EXPECT_TRUE(store.publish_quick_shift_request(request));
    EXPECT_FALSE(store.publish_quick_shift_request(request));
    EXPECT_EQ(1u, store.overflow_counters().quick_shift_events);
}

void test_tps_valid_sweep_stale_and_fallback() {
    TpsConfig config{};
    config.closed_adc = 100;
    config.open_adc = 3100;
    config.minimum_valid_adc = 50;
    config.maximum_valid_adc = 3200;
    config.stale_timeout_us = 100000;
    config.recovery_samples = 2;
    config.filter_alpha_permille = 1000;

    TpsSensor tps(config);
    auto first = tps.process({1600, 1500, 1000, AnalogSampleStatus::Ok});
    EXPECT_TRUE(first.valid_for_control);
    EXPECT_EQ(500, first.value.permille);

    tps.process({3100, 3100, 2000, AnalogSampleStatus::Ok});
    auto stale = tps.check_stale(150000);
    EXPECT_FALSE(stale.valid_for_control);
    EXPECT_EQ(SensorHealthState::Stale, stale.health);
    EXPECT_EQ(700, stale.value.permille);
    EXPECT_TRUE(stale.faults.has(SensorFault::Stale));

    TpsConfig invalid_config{};
    invalid_config.closed_adc = 2000;
    invalid_config.open_adc = 1000;
    auto bad_cal = TpsSensor(invalid_config);
    auto bad = bad_cal.process({1500, 1500, 1, AnalogSampleStatus::Ok});
    EXPECT_EQ(SensorHealthState::Failed, bad.health);
    EXPECT_TRUE(bad.faults.has(SensorFault::InvalidConfiguration));
}

void test_thermal_sensors_publish_requests_without_final_authority() {
    EgtSensor egt(EgtConfig{});
    auto cold = egt.process(Max31856Sample{25.0f, 1000, SpiSampleStatus::Ok, 0});
    EXPECT_TRUE(cold.valid_for_control);
    EXPECT_EQ(ThermalRequestLevel::Normal, cold.value.request);

    auto hot = egt.process(Max31856Sample{710.0f, 2000, SpiSampleStatus::Ok, 0});
    EXPECT_EQ(ThermalRequestLevel::DeratingRequested, hot.value.request);
    EXPECT_EQ(SensorHealthState::Valid, hot.health);

    auto failed = egt.process(Max31856Sample{710.0f, 3000, SpiSampleStatus::ConverterFault, 1});
    EXPECT_FALSE(failed.valid_for_control);
    EXPECT_EQ(ThermalRequestLevel::SensorInvalid, failed.value.request);
    EXPECT_TRUE(failed.faults.has(SensorFault::Communication));

    WaterTemperatureSensor water(WaterTemperatureConfig{});
    auto normal = water.process(AnalogSample{1800, 1800, 1000, AnalogSampleStatus::Ok});
    EXPECT_TRUE(normal.valid_for_control);
    EXPECT_TRUE(normal.value.celsius > -40.0f);
    auto shorted = water.process(AnalogSample{0, 0, 2000, AnalogSampleStatus::Ok});
    EXPECT_FALSE(shorted.valid_for_control);
    EXPECT_TRUE(shorted.faults.has(SensorFault::ShortToGround));
}

void test_digital_inputs_debounce_rearm_and_map_state() {
    QuickShifterInput quick(QuickShifterConfig{});
    auto startup = quick.initialize(DigitalSample{false, 1000, DigitalSampleStatus::Ok});
    EXPECT_EQ(SensorHealthState::Failed, startup.health);
    EXPECT_TRUE(startup.faults.has(SensorFault::StartupActive));

    quick.process(DigitalEdge{true, EdgeKind::Rising, 50000, DigitalSampleStatus::Ok});
    auto ignored = quick.process(DigitalEdge{false, EdgeKind::Falling, 51000, DigitalSampleStatus::Ok});
    EXPECT_FALSE(ignored.has_request);

    auto request = quick.process(DigitalEdge{false, EdgeKind::Falling, 80000, DigitalSampleStatus::Ok});
    EXPECT_TRUE(request.has_request);
    EXPECT_TRUE(request.request.event.active);

    auto held = quick.check_stuck(2000000);
    EXPECT_EQ(SensorHealthState::Failed, held.health);
    EXPECT_TRUE(held.faults.has(SensorFault::Stuck));

    MapSwitchInput map(MapSwitchConfig{});
    auto primary = map.initialize(DigitalSample{true, 1000, DigitalSampleStatus::Ok});
    EXPECT_EQ(PhysicalMapRequest::Primary, primary.value.request);
    auto changed = map.process(DigitalEdge{false, EdgeKind::Falling, 50000, DigitalSampleStatus::Ok});
    EXPECT_TRUE(changed.has_event);
    EXPECT_EQ(PhysicalMapRequest::Secondary, changed.reading.value.request);
}

void test_pickup_estimator_sync_loss_and_recovery() {
    PickupSensor pickup(PickupConfig{});
    EngineStateEstimator estimator(EngineStateConfig{});

    auto first = pickup.process(EdgeCapture{100000, EdgePolarity::Falling, CaptureStatus::Ok});
    EXPECT_TRUE(first.valid);
    auto s0 = estimator.process(first.capture);
    EXPECT_EQ(SensorHealthState::Stabilizing, s0.health);

    auto second = pickup.process(EdgeCapture{104000, EdgePolarity::Falling, CaptureStatus::Ok});
    auto s1 = estimator.process(second.capture);
    EXPECT_TRUE(s1.valid_for_control);
    EXPECT_NEAR(15000.0, s1.value.rpm, 0.1);
    EXPECT_EQ(1ull, s1.value.revolution_id);

    auto duplicate = pickup.process(EdgeCapture{104010, EdgePolarity::Falling, CaptureStatus::Ok});
    EXPECT_FALSE(duplicate.valid);
    EXPECT_TRUE(duplicate.faults.has(SensorFault::Duplicate));

    auto stale = estimator.check_stale(300000);
    EXPECT_FALSE(stale.valid_for_control);
    EXPECT_EQ(SensorHealthState::Stale, stale.health);
}

void test_knock_measurement_validation_and_feature_backlog() {
    KnockSensor knock(KnockConfig{});
    KnockWindowContext context{};
    context.revolution_id = 42;
    context.pickup_edge_at = 1000;
    context.window_opened_at = 1200;
    context.window_closed_at = 1800;
    context.rpm = 10000.0f;
    context.tps_permille = 600;
    context.ignition_angle_deg = 15.0f;

    auto valid = knock.process(context, TpicWindowResult{1234, 2000, KnockDeviceStatus::Ok});
    EXPECT_TRUE(valid.valid_for_control);
    EXPECT_EQ(42ull, valid.revolution_id);
    EXPECT_EQ(1234u, valid.raw_integrator_count);

    auto saturated = knock.process(context, TpicWindowResult{65535, 3000, KnockDeviceStatus::Saturated});
    EXPECT_FALSE(saturated.valid_for_control);
    EXPECT_TRUE(saturated.faults.has(SensorFault::Saturation));

    KnockFeatureConfig feature_config{};
    feature_config.queue_capacity = 1;
    KnockFeatureExtractor extractor(feature_config);
    EXPECT_TRUE(extractor.submit(valid));
    EXPECT_FALSE(extractor.submit(valid));
    EXPECT_EQ(1u, extractor.dropped_count());
    auto feature = extractor.extract_next();
    EXPECT_TRUE(feature.has_value());
    EXPECT_FALSE(feature->requests_ignition_authority);
}

void test_services_and_health_aggregation_are_sensor_only() {
    SensorDataStore store(4, 4, 4, 4);
    FakeTimeSource time;
    time.set(1000);
    FakeAnalogSampleSource analog;
    analog.push("tps", AnalogSample{1000, 1000, 1000, AnalogSampleStatus::Ok});

    TpsConfig service_tps_config{};
    service_tps_config.closed_adc = 0;
    service_tps_config.open_adc = 2000;
    TpsSensor tps(service_tps_config);
    AnalogSensorService analog_service(analog, store, tps);
    EXPECT_TRUE(analog_service.run_once("tps"));
    EXPECT_TRUE(store.snapshot().tps.valid_for_control);

    SensorHealthService health;
    auto snapshot = store.snapshot();
    auto health_snapshot = health.aggregate(snapshot);
    EXPECT_EQ(SensorHealthState::Valid, health_snapshot.tps);
    EXPECT_EQ(SensorHealthState::Uninitialized, health_snapshot.pickup);
}

void test_sensor_harness_csv_and_events_are_numeric_and_plot_friendly() {
    SensorDataStore store(4, 4, 4, 4);

    SensorReading<ThrottlePositionPermille> tps{};
    tps.value.permille = 512;
    tps.acquired_at = 1000;
    tps.valid_for_control = true;
    tps.health = SensorHealthState::Valid;
    tps.quality = SensorQuality::Good;
    store.publish_tps(tps);

    SensorReading<EngineSpeedState> rpm{};
    rpm.value.rpm = 6000.0f;
    rpm.valid_for_control = true;
    store.publish_engine_speed(rpm);

    SensorReading<TemperatureReading> egt{};
    egt.value.celsius = 42.5f;
    store.publish_egt(egt);

    SensorReading<TemperatureReading> water{};
    water.value.celsius = 31.0f;
    store.publish_water_temperature(water);

    SensorReading<QuickShifterState> quick{};
    quick.value.active = false;
    store.publish_quick_shifter_state(quick);

    SensorReading<MapSwitchState> map{};
    map.value.request = PhysicalMapRequest::Secondary;
    store.publish_map_switch_state(map);

    KnockWindowMeasurement knock{};
    knock.raw_integrator_count = 1180;
    knock.valid_for_control = true;
    EXPECT_TRUE(store.publish_knock_measurement(knock));

    EXPECT_EQ(std::string("# t_us,tps_permille,tps_valid,rpm,rpm_valid,egt_c,water_c,qs_active,map_secondary,knock_raw,knock_valid"),
              ecu::sensor_harness::csv_header());
    EXPECT_EQ(std::string("1234567,512,1,6000.0,1,42.5,31.0,0,1,1180,1"),
              ecu::sensor_harness::format_snapshot_csv(store.snapshot(), 1234567, knock));

    SensorEvent<QuickShiftRequest> request{};
    request.event.active = true;
    request.event.activated_at = 2000;
    request.event.released_at = 2500;
    request.event.duration_us = 500;
    EXPECT_TRUE(store.publish_quick_shift_request(request));

    auto events = ecu::sensor_harness::drain_event_lines(store);
    EXPECT_EQ(1u, events.size());
    EXPECT_EQ(std::string("# event,quick_shift,1,2000,2500,500"), events.front());
}

void test_sensor_harness_fake_stimulus_feeds_all_service_sources() {
    ecu::sensor_harness::FakeSensorStimulus stimulus;
    FakeAnalogSampleSource analog;
    FakeSpiMeasurementSource spi;
    FakeDigitalInputSource digital;
    FakeEdgeCaptureSource pickup;
    FakeKnockWindowDevice knock;

    stimulus.push_next(analog, spi, digital, pickup, knock);
    stimulus.push_next(analog, spi, digital, pickup, knock);

    EXPECT_TRUE(analog.read("tps").has_value());
    EXPECT_TRUE(analog.read("water").has_value());
    EXPECT_TRUE(spi.read("egt").has_value());
    EXPECT_TRUE(digital.read_edge("quick").has_value());
    EXPECT_TRUE(digital.read_edge("map").has_value());
    EXPECT_TRUE(pickup.read_capture("pickup").has_value());
    EXPECT_TRUE(knock.read_result().has_value());
}

} // namespace

int main() {
    test_data_store_sequences_and_queue_overflow();
    test_tps_valid_sweep_stale_and_fallback();
    test_thermal_sensors_publish_requests_without_final_authority();
    test_digital_inputs_debounce_rearm_and_map_state();
    test_pickup_estimator_sync_loss_and_recovery();
    test_knock_measurement_validation_and_feature_backlog();
    test_services_and_health_aggregation_are_sensor_only();
    test_sensor_harness_csv_and_events_are_numeric_and_plot_friendly();
    test_sensor_harness_fake_stimulus_feeds_all_service_sources();

    if (failures != 0) {
        std::cerr << failures << " sensor domain test failure(s)\n";
        return EXIT_FAILURE;
    }
    std::cout << "sensor domain tests passed\n";
    return EXIT_SUCCESS;
}
