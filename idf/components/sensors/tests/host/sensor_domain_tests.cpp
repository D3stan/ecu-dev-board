#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <iostream>
#include <string>

#include "sensor_harness/sensor_harness.hpp"
#include "sensor_drivers/capture_tick_converter.hpp"
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

void test_mcpwm_capture_tick_converter_uses_resolution_and_wrap() {
    ecu::sensor_drivers::CaptureTickConverter converter(80000000, 1000);
    EXPECT_EQ(3400ull, converter.to_timestamp_us(192000));

    ecu::sensor_drivers::CaptureTickConverter wrap_converter(80000000, 0);
    const auto before_wrap = wrap_converter.to_timestamp_us(0xFFFFFFF0u);
    const auto after_wrap = wrap_converter.to_timestamp_us(0x00000130u);

    EXPECT_EQ(53687091ull, before_wrap);
    EXPECT_EQ(53687095ull, after_wrap);
    EXPECT_EQ(4ull, after_wrap - before_wrap);
}

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

void test_pickup_service_publishes_invalid_capture_faults() {
    FakeEdgeCaptureSource source;
    SensorDataStore store(4, 4, 4, 4);
    PickupSensor pickup(PickupConfig{});
    EngineStateEstimator estimator(EngineStateConfig{});
    PickupAcquisitionService service(source, store, pickup, estimator);

    source.push("pickup", EdgeCapture{100000, EdgePolarity::Falling, CaptureStatus::Ok});
    source.push("pickup", EdgeCapture{104000, EdgePolarity::Falling, CaptureStatus::Ok});
    EXPECT_EQ(2u, service.drain_available("pickup", 8));
    EXPECT_TRUE(store.snapshot().engine_speed.valid_for_control);

    source.push("pickup", EdgeCapture{104010, EdgePolarity::Falling, CaptureStatus::Ok});
    EXPECT_TRUE(service.run_once("pickup"));

    auto duplicate_snapshot = store.snapshot();
    EXPECT_FALSE(duplicate_snapshot.engine_speed.valid_for_control);
    EXPECT_EQ(SensorHealthState::Degraded, duplicate_snapshot.engine_speed.health);
    EXPECT_TRUE(duplicate_snapshot.engine_speed.faults.has(SensorFault::Duplicate));

    auto duplicate_fault = store.pop_fault();
    EXPECT_TRUE(duplicate_fault.has_value());
    EXPECT_EQ(static_cast<unsigned>(SensorFault::Duplicate), static_cast<unsigned>(duplicate_fault->fault));
    EXPECT_EQ(SensorHealthState::Degraded, duplicate_fault->health);
    EXPECT_EQ(104010ull, duplicate_fault->first_at);

    source.push("pickup", EdgeCapture{108000, EdgePolarity::Falling, CaptureStatus::Overflow});
    EXPECT_TRUE(service.run_once("pickup"));

    auto overflow_snapshot = store.snapshot();
    EXPECT_FALSE(overflow_snapshot.engine_speed.valid_for_control);
    EXPECT_EQ(SensorHealthState::Failed, overflow_snapshot.engine_speed.health);
    EXPECT_TRUE(overflow_snapshot.engine_speed.faults.has(SensorFault::Overflow));

    auto overflow_fault = store.pop_fault();
    EXPECT_TRUE(overflow_fault.has_value());
    EXPECT_EQ(static_cast<unsigned>(SensorFault::Overflow), static_cast<unsigned>(overflow_fault->fault));
    EXPECT_EQ(SensorHealthState::Failed, overflow_fault->health);
    EXPECT_EQ(108000ull, overflow_fault->first_at);
}

void test_pickup_service_stale_recovery_requires_new_startup_sequence() {
    FakeEdgeCaptureSource source;
    SensorDataStore store(4, 4, 4, 4);
    PickupSensor pickup(PickupConfig{});
    EngineStateConfig engine_config{};
    engine_config.stale_timeout_us = 10000;
    engine_config.startup_edges_required = 2;
    EngineStateEstimator estimator(engine_config);
    PickupAcquisitionService service(source, store, pickup, estimator);

    source.push("pickup", EdgeCapture{100000, EdgePolarity::Falling, CaptureStatus::Ok});
    source.push("pickup", EdgeCapture{104000, EdgePolarity::Falling, CaptureStatus::Ok});
    EXPECT_EQ(2u, service.drain_available("pickup", 8));
    EXPECT_TRUE(store.snapshot().engine_speed.valid_for_control);

    auto stale = service.check_stale(200000);
    EXPECT_EQ(SensorHealthState::Stale, stale.health);
    EXPECT_FALSE(store.snapshot().engine_speed.valid_for_control);

    source.push("pickup", EdgeCapture{204000, EdgePolarity::Falling, CaptureStatus::Ok});
    EXPECT_TRUE(service.run_once("pickup"));
    EXPECT_EQ(SensorHealthState::Stabilizing, store.snapshot().engine_speed.health);
    EXPECT_FALSE(store.snapshot().engine_speed.valid_for_control);

    source.push("pickup", EdgeCapture{208000, EdgePolarity::Falling, CaptureStatus::Ok});
    EXPECT_TRUE(service.run_once("pickup"));
    EXPECT_EQ(SensorHealthState::Valid, store.snapshot().engine_speed.health);
    EXPECT_TRUE(store.snapshot().engine_speed.valid_for_control);
}

void test_pickup_service_accepts_high_rpm_and_rapid_ramp() {
    FakeEdgeCaptureSource source;
    SensorDataStore store(4, 4, 4, 4);
    PickupSensor pickup(PickupConfig{});
    EngineStateEstimator estimator(EngineStateConfig{});
    PickupAcquisitionService service(source, store, pickup, estimator);

    TimestampUs captured_at = 100000;
    const TimestampUs periods[] = {6000, 5000, 4000, 3000, 2400, 3000, 4000, 5000, 6000};
    source.push("pickup", EdgeCapture{captured_at, EdgePolarity::Falling, CaptureStatus::Ok});
    for (TimestampUs period : periods) {
        captured_at += period;
        source.push("pickup", EdgeCapture{captured_at, EdgePolarity::Falling, CaptureStatus::Ok});
    }

    EXPECT_EQ(10u, service.drain_available("pickup", 16));
    EXPECT_TRUE(store.snapshot().engine_speed.valid_for_control);
    EXPECT_NEAR(10000.0, store.snapshot().engine_speed.value.rpm, 0.1);

    source.push("pickup", EdgeCapture{captured_at + 2400, EdgePolarity::Falling, CaptureStatus::Ok});
    EXPECT_TRUE(service.run_once("pickup"));
    EXPECT_TRUE(store.snapshot().engine_speed.valid_for_control);
    EXPECT_NEAR(25000.0, store.snapshot().engine_speed.value.rpm, 0.1);
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

void test_sensor_harness_muxes_route_each_source_family_by_sensor_name() {
    using ecu::sensor_harness::HarnessInputSource;

    ecu::sensor_harness::HarnessInputRoutes routes{};
    routes.tps = HarnessInputSource::Real;
    routes.water = HarnessInputSource::Fake;
    routes.egt = HarnessInputSource::Real;
    routes.quick = HarnessInputSource::Real;
    routes.map = HarnessInputSource::Fake;
    routes.pickup = HarnessInputSource::Real;
    routes.knock = HarnessInputSource::Real;

    FakeAnalogSampleSource fake_analog;
    FakeAnalogSampleSource real_analog;
    fake_analog.push(ecu::sensor_harness::kWaterChannel, AnalogSample{111, 111, 1000, AnalogSampleStatus::Ok});
    real_analog.push(ecu::sensor_harness::kTpsChannel, AnalogSample{222, 222, 2000, AnalogSampleStatus::Ok});
    ecu::sensor_harness::MuxAnalogSampleSource analog_mux(fake_analog, real_analog, routes);
    EXPECT_EQ(222, analog_mux.read(ecu::sensor_harness::kTpsChannel)->raw_code);
    EXPECT_EQ(111, analog_mux.read(ecu::sensor_harness::kWaterChannel)->raw_code);
    EXPECT_FALSE(analog_mux.read("unknown").has_value());

    FakeSpiMeasurementSource fake_spi;
    FakeSpiMeasurementSource real_spi;
    fake_spi.push(ecu::sensor_harness::kEgtDevice, Max31856Sample{10.0f, 3000, SpiSampleStatus::Ok, 0});
    real_spi.push(ecu::sensor_harness::kEgtDevice, Max31856Sample{20.0f, 4000, SpiSampleStatus::Ok, 0});
    ecu::sensor_harness::MuxSpiMeasurementSource spi_mux(fake_spi, real_spi, routes);
    EXPECT_NEAR(20.0, spi_mux.read(ecu::sensor_harness::kEgtDevice)->celsius, 0.01);
    EXPECT_FALSE(spi_mux.read("unknown").has_value());

    FakeDigitalInputSource fake_digital;
    FakeDigitalInputSource real_digital;
    fake_digital.push_state(ecu::sensor_harness::kMapInput, DigitalSample{false, 5000, DigitalSampleStatus::Ok});
    fake_digital.push_edge(ecu::sensor_harness::kMapInput,
                           DigitalEdge{false, EdgeKind::Falling, 6000, DigitalSampleStatus::Ok});
    real_digital.push_state(ecu::sensor_harness::kQuickInput, DigitalSample{true, 7000, DigitalSampleStatus::Ok});
    real_digital.push_edge(ecu::sensor_harness::kQuickInput,
                           DigitalEdge{true, EdgeKind::Rising, 8000, DigitalSampleStatus::Ok});
    ecu::sensor_harness::MuxDigitalInputSource digital_mux(fake_digital, real_digital, routes);
    EXPECT_TRUE(digital_mux.read_state(ecu::sensor_harness::kQuickInput)->level_high);
    EXPECT_FALSE(digital_mux.read_state(ecu::sensor_harness::kMapInput)->level_high);
    EXPECT_EQ(8000ull, digital_mux.read_edge(ecu::sensor_harness::kQuickInput)->acquired_at);
    EXPECT_EQ(6000ull, digital_mux.read_edge(ecu::sensor_harness::kMapInput)->acquired_at);
    EXPECT_FALSE(digital_mux.read_edge("unknown").has_value());

    FakeEdgeCaptureSource fake_pickup;
    FakeEdgeCaptureSource real_pickup;
    fake_pickup.push(ecu::sensor_harness::kPickupInput, EdgeCapture{9000, EdgePolarity::Falling, CaptureStatus::Ok});
    real_pickup.push(ecu::sensor_harness::kPickupInput, EdgeCapture{10000, EdgePolarity::Falling, CaptureStatus::Ok});
    ecu::sensor_harness::MuxEdgeCaptureSource pickup_mux(fake_pickup, real_pickup, routes);
    EXPECT_EQ(10000ull, pickup_mux.read_capture(ecu::sensor_harness::kPickupInput)->captured_at);
    EXPECT_FALSE(pickup_mux.read_capture("unknown").has_value());

    FakeKnockWindowDevice fake_knock;
    FakeKnockWindowDevice real_knock;
    fake_knock.push_result(TpicWindowResult{10, 11000, KnockDeviceStatus::Ok});
    real_knock.push_result(TpicWindowResult{20, 12000, KnockDeviceStatus::Ok});
    ecu::sensor_harness::MuxKnockWindowDevice knock_mux(fake_knock, real_knock, routes);
    EXPECT_TRUE(knock_mux.configure(42));
    EXPECT_TRUE(knock_mux.open_window(12100));
    EXPECT_TRUE(knock_mux.close_window(12200));
    EXPECT_EQ(42u, real_knock.configured_generation);
    EXPECT_EQ(0u, fake_knock.configured_generation);
    EXPECT_EQ(20u, knock_mux.read_result()->integrator_count);
}

void test_sensor_harness_fake_stimulus_mask_skips_real_routed_sensors() {
    ecu::sensor_harness::FakeSensorStimulus stimulus;
    ecu::sensor_harness::FakeStimulusMask mask{};
    mask.tps = false;
    mask.quick = false;
    mask.knock = false;

    FakeAnalogSampleSource analog;
    FakeSpiMeasurementSource spi;
    FakeDigitalInputSource digital;
    FakeEdgeCaptureSource pickup;
    FakeKnockWindowDevice knock;

    stimulus.push_next(analog, spi, digital, pickup, knock, mask);

    EXPECT_FALSE(analog.read(ecu::sensor_harness::kTpsChannel).has_value());
    EXPECT_TRUE(analog.read(ecu::sensor_harness::kWaterChannel).has_value());
    EXPECT_TRUE(spi.read(ecu::sensor_harness::kEgtDevice).has_value());
    EXPECT_FALSE(digital.read_edge(ecu::sensor_harness::kQuickInput).has_value());
    EXPECT_TRUE(digital.read_edge(ecu::sensor_harness::kMapInput).has_value());
    EXPECT_TRUE(pickup.read_capture(ecu::sensor_harness::kPickupInput).has_value());
    EXPECT_FALSE(knock.read_result().has_value());
}

} // namespace

int main() {
    test_mcpwm_capture_tick_converter_uses_resolution_and_wrap();
    test_data_store_sequences_and_queue_overflow();
    test_tps_valid_sweep_stale_and_fallback();
    test_thermal_sensors_publish_requests_without_final_authority();
    test_digital_inputs_debounce_rearm_and_map_state();
    test_pickup_estimator_sync_loss_and_recovery();
    test_pickup_service_publishes_invalid_capture_faults();
    test_pickup_service_stale_recovery_requires_new_startup_sequence();
    test_pickup_service_accepts_high_rpm_and_rapid_ramp();
    test_knock_measurement_validation_and_feature_backlog();
    test_services_and_health_aggregation_are_sensor_only();
    test_sensor_harness_csv_and_events_are_numeric_and_plot_friendly();
    test_sensor_harness_fake_stimulus_feeds_all_service_sources();
    test_sensor_harness_muxes_route_each_source_family_by_sensor_name();
    test_sensor_harness_fake_stimulus_mask_skips_real_routed_sensors();

    if (failures != 0) {
        std::cerr << failures << " sensor domain test failure(s)\n";
        return EXIT_FAILURE;
    }
    std::cout << "sensor domain tests passed\n";
    return EXIT_SUCCESS;
}
