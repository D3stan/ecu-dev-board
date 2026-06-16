#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <iostream>
#include <string>

#include "sensor_harness/sensor_harness.hpp"
#include "sensor_drivers/adc_sample_source_logic.hpp"
#include "sensor_drivers/capture_tick_converter.hpp"
#include "sensor_drivers/fixed_raw_queue.hpp"
#include "sensor_drivers/mcpwm_capture_logic.hpp"
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

AnalogSample analog_sample(int raw_code,
                           int millivolts,
                           bool millivolts_valid,
                           TimestampUs acquired_at,
                           AnalogSampleStatus status = AnalogSampleStatus::Ok) {
    return AnalogSample{raw_code, millivolts, millivolts_valid, acquired_at, status};
}

void test_mcpwm_capture_tick_converter_uses_resolution_and_wrap() {
    ecu::sensor_drivers::CaptureTickConverter converter(80000000, 1000);
    EXPECT_EQ(3400ull, converter.to_timestamp_us(192000));
    converter.reset(500);
    EXPECT_EQ(502ull, converter.to_timestamp_us(160));

    ecu::sensor_drivers::CaptureTickConverter wrap_converter(80000000, 0);
    const auto before_wrap = wrap_converter.to_timestamp_us(0xFFFFFFF0u);
    const auto after_wrap = wrap_converter.to_timestamp_us(0x00000130u);

    EXPECT_EQ(53687091ull, before_wrap);
    EXPECT_EQ(53687095ull, after_wrap);
    EXPECT_EQ(4ull, after_wrap - before_wrap);
}

void test_pullup_ntc_transfer_rejects_invalid_inputs() {
    PullupNtcConfig invalid_config{};
    invalid_config.vref_mv = 0;
    PullupNtcTransfer invalid_transfer(invalid_config);
    EXPECT_FALSE(invalid_transfer.config_valid());
    EXPECT_FALSE(invalid_transfer.celsius_from_millivolts(1000).has_value());

    PullupNtcConfig config{};
    config.vref_mv = 3300;
    config.fixed_resistance_ohms = 10000.0f;
    config.nominal_resistance_ohms = 10000.0f;
    config.nominal_temperature_celsius = 25.0f;
    config.beta_kelvin = 3950.0f;
    PullupNtcTransfer transfer(config);
    EXPECT_TRUE(transfer.config_valid());
    EXPECT_FALSE(transfer.celsius_from_millivolts(0).has_value());
    EXPECT_FALSE(transfer.celsius_from_millivolts(3300).has_value());

    config.beta_kelvin = 100.0f;
    PullupNtcTransfer implausible_transfer(config);
    EXPECT_FALSE(implausible_transfer.celsius_from_millivolts(1).has_value());
}

void test_non_spi_driver_helpers_cover_hardware_independent_logic() {
    using namespace ecu::sensor_drivers;

    auto raw_failure = make_adc_sample_from_conversion(123, false, false, false, false, 0, 1000);
    EXPECT_EQ(enum_value(AnalogSampleStatus::HardwareFault), enum_value(raw_failure.status));
    EXPECT_FALSE(raw_failure.millivolts_valid);

    auto calibrated = make_adc_sample_from_conversion(234, true, true, true, true, 1210, 2000);
    EXPECT_EQ(enum_value(AnalogSampleStatus::Ok), enum_value(calibrated.status));
    EXPECT_TRUE(calibrated.millivolts_valid);
    EXPECT_EQ(1210, calibrated.millivolts);

    auto calibration_failed = make_adc_sample_from_conversion(345, true, true, true, false, 0, 3000);
    EXPECT_EQ(enum_value(AnalogSampleStatus::CalibrationFault), enum_value(calibration_failed.status));
    EXPECT_FALSE(calibration_failed.millivolts_valid);

    auto calibration_absent_required = make_adc_sample_from_conversion(456, true, true, false, false, 0, 4000);
    EXPECT_EQ(enum_value(AnalogSampleStatus::CalibrationFault), enum_value(calibration_absent_required.status));

    auto calibration_absent_optional = make_adc_sample_from_conversion(567, true, false, false, false, 0, 5000);
    EXPECT_EQ(enum_value(AnalogSampleStatus::Ok), enum_value(calibration_absent_optional.status));
    EXPECT_FALSE(calibration_absent_optional.millivolts_valid);

    FixedRawQueue<int, 2> queue;
    EXPECT_FALSE(queue.pop().has_value());
    EXPECT_TRUE(queue.push(10));
    EXPECT_TRUE(queue.push(20));
    EXPECT_FALSE(queue.push(30));
    EXPECT_EQ(1u, queue.overflow_count());
    auto first_queue_value = queue.pop();
    REQUIRE_TRUE(first_queue_value.has_value());
    EXPECT_EQ(10, *first_queue_value);
    auto second_queue_value = queue.pop();
    REQUIRE_TRUE(second_queue_value.has_value());
    EXPECT_EQ(20, *second_queue_value);
    EXPECT_FALSE(queue.pop().has_value());

    EXPECT_EQ(1u, clamp_mcpwm_capture_queue_depth(0));
    EXPECT_EQ(4u, clamp_mcpwm_capture_queue_depth(4));
    EXPECT_EQ(kMcpwmCaptureMaxQueueDepth, clamp_mcpwm_capture_queue_depth(kMcpwmCaptureMaxQueueDepth + 5));

    auto falling = make_mcpwm_raw_capture(1234, McpwmCaptureEdge::Negative);
    EXPECT_EQ(1234u, falling.capture_ticks);
    EXPECT_EQ(enum_value(EdgePolarity::Falling), enum_value(falling.polarity));
    EXPECT_EQ(enum_value(CaptureStatus::Ok), enum_value(falling.status));

    auto rising = make_mcpwm_raw_capture(5678, McpwmCaptureEdge::Positive);
    EXPECT_EQ(enum_value(EdgePolarity::Rising), enum_value(rising.polarity));
    EXPECT_EQ(enum_value(CaptureStatus::HardwareFault), enum_value(rising.status));
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

    SensorEvent<MapSwitchState> map_event{};
    EXPECT_TRUE(store.publish_map_switch_event(map_event));
    EXPECT_FALSE(store.publish_map_switch_event(map_event));
    EXPECT_EQ(1u, store.overflow_counters().map_switch_events);

    KnockWindowMeasurement knock{};
    EXPECT_TRUE(store.publish_knock_measurement(knock));
    EXPECT_FALSE(store.publish_knock_measurement(knock));
    EXPECT_EQ(1u, store.overflow_counters().knock_measurements);

    FaultTransition fault{};
    EXPECT_TRUE(store.publish_fault(fault));
    EXPECT_FALSE(store.publish_fault(fault));
    EXPECT_EQ(1u, store.overflow_counters().fault_events);
}

void test_tps_valid_sweep_stale_and_fallback() {
    TpsConfig config{};
    config.closed_mv = 500;
    config.open_mv = 2500;
    config.minimum_valid_mv = 400;
    config.maximum_valid_mv = 2600;
    config.stale_timeout_us = 100000;
    config.recovery_samples = 2;
    config.filter_alpha_permille = 1000;

    TpsSensor tps(config);
    auto first = tps.process(analog_sample(4095, 1500, true, 1000));
    EXPECT_TRUE(first.valid_for_control);
    EXPECT_EQ(500, first.value.permille);

    auto current = tps.check_stale(50000);
    EXPECT_TRUE(current.valid_for_control);
    EXPECT_EQ(500, current.value.permille);

    tps.process(analog_sample(0, 2500, true, 2000));
    auto stale = tps.check_stale(150000);
    EXPECT_FALSE(stale.valid_for_control);
    EXPECT_EQ(SensorHealthState::Stale, stale.health);
    EXPECT_EQ(700, stale.value.permille);
    EXPECT_TRUE(stale.faults.has(SensorFault::Stale));

    auto fresh = tps.check_stale(150001);
    EXPECT_FALSE(fresh.valid_for_control);
    EXPECT_TRUE(fresh.faults.has(SensorFault::Stale));

    auto missing_calibration = tps.process(analog_sample(1600, 0, false, 160000));
    EXPECT_FALSE(missing_calibration.valid_for_control);
    EXPECT_TRUE(missing_calibration.faults.has(SensorFault::Communication));

    auto hardware_fault = tps.process(analog_sample(1600, 0, false, 165000, AnalogSampleStatus::HardwareFault));
    EXPECT_FALSE(hardware_fault.valid_for_control);
    EXPECT_TRUE(hardware_fault.faults.has(SensorFault::Communication));

    auto below_range = tps.process(analog_sample(1200, 399, true, 170000));
    EXPECT_FALSE(below_range.valid_for_control);
    EXPECT_TRUE(below_range.faults.has(SensorFault::ShortToGround));

    auto above_range = tps.process(analog_sample(1200, 2601, true, 180000));
    EXPECT_FALSE(above_range.valid_for_control);
    EXPECT_TRUE(above_range.faults.has(SensorFault::ShortToSupply));

    TpsConfig invalid_config{};
    invalid_config.closed_mv = 2000;
    invalid_config.open_mv = 1000;
    auto bad_cal = TpsSensor(invalid_config);
    auto bad = bad_cal.process(analog_sample(1500, 1500, true, 1));
    EXPECT_EQ(SensorHealthState::Failed, bad.health);
    EXPECT_TRUE(bad.faults.has(SensorFault::InvalidConfiguration));
}

void test_tps_optional_rate_and_stuck_validators_are_configurable() {
    TpsConfig rate_config{};
    rate_config.closed_mv = 500;
    rate_config.open_mv = 2500;
    rate_config.maximum_rate_permille_per_s = 1000;
    TpsSensor rate_tps(rate_config);
    EXPECT_TRUE(rate_tps.process(analog_sample(0, 500, true, 1000)).valid_for_control);
    auto rate_fault = rate_tps.process(analog_sample(0, 2500, true, 101000));
    EXPECT_FALSE(rate_fault.valid_for_control);
    EXPECT_TRUE(rate_fault.faults.has(SensorFault::Rate));

    TpsConfig stuck_config{};
    stuck_config.closed_mv = 500;
    stuck_config.open_mv = 2500;
    stuck_config.stuck_sample_limit = 3;
    stuck_config.stuck_delta_mv = 0;
    TpsSensor stuck_tps(stuck_config);
    EXPECT_TRUE(stuck_tps.process(analog_sample(0, 1000, true, 1000)).valid_for_control);
    EXPECT_TRUE(stuck_tps.process(analog_sample(0, 1000, true, 2000)).valid_for_control);
    auto stuck = stuck_tps.process(analog_sample(0, 1000, true, 3000));
    EXPECT_FALSE(stuck.valid_for_control);
    EXPECT_TRUE(stuck.faults.has(SensorFault::Stuck));

    TpsConfig noise_config{};
    noise_config.closed_mv = 500;
    noise_config.open_mv = 2500;
    noise_config.noise_delta_mv = 100;
    noise_config.noise_sample_limit = 2;
    TpsSensor noise_tps(noise_config);
    EXPECT_TRUE(noise_tps.process(analog_sample(0, 1000, true, 1000)).valid_for_control);
    EXPECT_TRUE(noise_tps.process(analog_sample(0, 1125, true, 2000)).valid_for_control);
    auto noise = noise_tps.process(analog_sample(0, 1000, true, 3000));
    EXPECT_FALSE(noise.valid_for_control);
    EXPECT_TRUE(noise.faults.has(SensorFault::Noise));
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

    auto timeout = egt.process(Max31856Sample{100.0f, 4000, SpiSampleStatus::Timeout, 0});
    EXPECT_FALSE(timeout.valid_for_control);
    EXPECT_TRUE(timeout.faults.has(SensorFault::Communication));

    auto range_high = egt.process(Max31856Sample{1200.0f, 5000, SpiSampleStatus::Ok, 0});
    EXPECT_FALSE(range_high.valid_for_control);
    EXPECT_TRUE(range_high.faults.has(SensorFault::RangeHigh));

    auto stale_egt = egt.check_stale(1000000);
    EXPECT_FALSE(stale_egt.valid_for_control);
    EXPECT_EQ(SensorHealthState::Stale, stale_egt.health);
    EXPECT_TRUE(stale_egt.faults.has(SensorFault::Stale));

    EgtSensor rate_egt(EgtConfig{});
    auto first_egt_rate = rate_egt.process(Max31856Sample{100.0f, 1000000, SpiSampleStatus::Ok, 0});
    auto second_egt_rate = rate_egt.process(Max31856Sample{112.5f, 2000000, SpiSampleStatus::Ok, 0});
    EXPECT_TRUE(first_egt_rate.valid_for_control);
    EXPECT_TRUE(second_egt_rate.valid_for_control);
    EXPECT_NEAR(12.5, second_egt_rate.value.rate_c_per_s, 0.01);

    WaterTemperatureConfig water_config{};
    water_config.ntc.vref_mv = 3300;
    water_config.ntc.fixed_resistance_ohms = 10000.0f;
    water_config.ntc.nominal_resistance_ohms = 10000.0f;
    water_config.ntc.nominal_temperature_celsius = 25.0f;
    water_config.ntc.beta_kelvin = 3950.0f;
    water_config.minimum_valid_mv = 50;
    water_config.maximum_valid_mv = 3250;
    water_config.short_to_ground_mv = 25;
    water_config.open_circuit_mv = 3275;

    WaterTemperatureSensor water(water_config);
    auto normal = water.process(analog_sample(4095, 1650, true, 1000));
    EXPECT_TRUE(normal.valid_for_control);
    EXPECT_NEAR(25.0, normal.value.celsius, 0.2);

    WaterTemperatureSensor water_rate(water_config);
    auto first_water_rate = water_rate.process(analog_sample(0, 1650, true, 1000000));
    auto second_water_rate = water_rate.process(analog_sample(0, 1600, true, 2000000));
    EXPECT_TRUE(first_water_rate.valid_for_control);
    EXPECT_TRUE(second_water_rate.valid_for_control);
    EXPECT_NEAR(second_water_rate.value.celsius - first_water_rate.value.celsius,
                second_water_rate.value.rate_c_per_s,
                0.01);
    auto stale_water = water_rate.check_stale(3000001);
    EXPECT_FALSE(stale_water.valid_for_control);
    EXPECT_TRUE(stale_water.faults.has(SensorFault::Stale));

    auto shorted = water.process(analog_sample(0, 0, true, 2000));
    EXPECT_FALSE(shorted.valid_for_control);
    EXPECT_TRUE(shorted.faults.has(SensorFault::ShortToGround));
    auto open = water.process(analog_sample(4095, 3300, true, 3000));
    EXPECT_FALSE(open.valid_for_control);
    EXPECT_TRUE(open.faults.has(SensorFault::OpenCircuit));

    auto communication_fault = water.process(analog_sample(0, 1650, true, 4000, AnalogSampleStatus::HardwareFault));
    EXPECT_FALSE(communication_fault.valid_for_control);
    EXPECT_TRUE(communication_fault.faults.has(SensorFault::Communication));

    auto missing_mv = water.process(analog_sample(0, 0, false, 5000));
    EXPECT_FALSE(missing_mv.valid_for_control);
    EXPECT_TRUE(missing_mv.faults.has(SensorFault::Communication));

    WaterTemperatureConfig invalid_water_config = water_config;
    invalid_water_config.ntc.vref_mv = 0;
    WaterTemperatureSensor invalid_water(invalid_water_config);
    auto invalid_config = invalid_water.process(analog_sample(0, 1650, true, 6000));
    EXPECT_FALSE(invalid_config.valid_for_control);
    EXPECT_TRUE(invalid_config.faults.has(SensorFault::InvalidConfiguration));
}

void test_thermal_optional_rate_and_frozen_validators_are_configurable() {
    EgtConfig egt_config{};
    egt_config.maximum_rate_c_per_s = 50.0f;
    EgtSensor egt(egt_config);
    EXPECT_TRUE(egt.process(Max31856Sample{100.0f, 1000000, SpiSampleStatus::Ok, 0}).valid_for_control);
    auto fast_egt = egt.process(Max31856Sample{200.0f, 1100000, SpiSampleStatus::Ok, 0});
    EXPECT_FALSE(fast_egt.valid_for_control);
    EXPECT_TRUE(fast_egt.faults.has(SensorFault::Rate));

    EgtConfig frozen_egt_config{};
    frozen_egt_config.frozen_sample_limit = 3;
    frozen_egt_config.frozen_delta_celsius = 0.0f;
    EgtSensor frozen_egt(frozen_egt_config);
    EXPECT_TRUE(frozen_egt.process(Max31856Sample{120.0f, 1000, SpiSampleStatus::Ok, 0}).valid_for_control);
    EXPECT_TRUE(frozen_egt.process(Max31856Sample{120.0f, 2000, SpiSampleStatus::Ok, 0}).valid_for_control);
    auto frozen_egt_reading = frozen_egt.process(Max31856Sample{120.0f, 3000, SpiSampleStatus::Ok, 0});
    EXPECT_FALSE(frozen_egt_reading.valid_for_control);
    EXPECT_TRUE(frozen_egt_reading.faults.has(SensorFault::Frozen));

    WaterTemperatureConfig water_config{};
    water_config.ntc.vref_mv = 3300;
    water_config.ntc.fixed_resistance_ohms = 10000.0f;
    water_config.ntc.nominal_resistance_ohms = 10000.0f;
    water_config.ntc.nominal_temperature_celsius = 25.0f;
    water_config.ntc.beta_kelvin = 3950.0f;
    water_config.minimum_valid_mv = 50;
    water_config.maximum_valid_mv = 3250;
    water_config.short_to_ground_mv = 25;
    water_config.open_circuit_mv = 3275;
    water_config.maximum_rate_c_per_s = 20.0f;
    WaterTemperatureSensor water(water_config);
    EXPECT_TRUE(water.process(analog_sample(0, 1650, true, 1000000)).valid_for_control);
    auto fast_water = water.process(analog_sample(0, 1000, true, 1100000));
    EXPECT_FALSE(fast_water.valid_for_control);
    EXPECT_TRUE(fast_water.faults.has(SensorFault::Rate));

    water_config.maximum_rate_c_per_s = 0.0f;
    water_config.frozen_sample_limit = 3;
    water_config.frozen_delta_celsius = 0.0f;
    WaterTemperatureSensor frozen_water(water_config);
    EXPECT_TRUE(frozen_water.process(analog_sample(0, 1650, true, 1000)).valid_for_control);
    EXPECT_TRUE(frozen_water.process(analog_sample(0, 1650, true, 2000)).valid_for_control);
    auto frozen_water_reading = frozen_water.process(analog_sample(0, 1650, true, 3000));
    EXPECT_FALSE(frozen_water_reading.valid_for_control);
    EXPECT_TRUE(frozen_water_reading.faults.has(SensorFault::Frozen));
}

void test_digital_inputs_debounce_rearm_and_map_state() {
    QuickShifterInput quick(QuickShifterConfig{});
    auto inactive_startup = quick.initialize(DigitalSample{true, 500, DigitalSampleStatus::Ok});
    EXPECT_TRUE(inactive_startup.valid_for_control);
    EXPECT_TRUE(inactive_startup.value.armed);
    auto inactive_stuck = quick.check_stuck(2000000);
    EXPECT_FALSE(inactive_stuck.value.active);

    QuickShifterInput quick_faults(QuickShifterConfig{});
    quick_faults.initialize(DigitalSample{true, 900, DigitalSampleStatus::Ok});
    auto quick_comm = quick_faults.process(DigitalEdge{false, EdgeKind::Falling, 30000, DigitalSampleStatus::HardwareFault});
    EXPECT_FALSE(quick_comm.state.valid_for_control);
    EXPECT_TRUE(quick_comm.state.faults.has(SensorFault::Communication));

    QuickShifterInput quick_debounce_input(QuickShifterConfig{});
    quick_debounce_input.initialize(DigitalSample{true, 1000, DigitalSampleStatus::Ok});
    auto quick_debounce = quick_debounce_input.process(DigitalEdge{false, EdgeKind::Falling, 11000, DigitalSampleStatus::Ok});
    EXPECT_FALSE(quick_debounce.has_request);
    EXPECT_TRUE(quick_debounce.state.faults.has(SensorFault::Debounce));

    QuickShifterConfig active_high_config{};
    active_high_config.active_low = false;
    QuickShifterInput active_high(active_high_config);
    active_high.initialize(DigitalSample{false, 1000, DigitalSampleStatus::Ok});
    auto active_high_request = active_high.process(DigitalEdge{true, EdgeKind::Rising, 30000, DigitalSampleStatus::Ok});
    EXPECT_TRUE(active_high_request.has_request);

    QuickShifterConfig duration_config{};
    duration_config.debounce_us = 0;
    duration_config.minimum_active_us = 5000;
    duration_config.maximum_active_us = 50000;
    QuickShifterInput duration_quick(duration_config);
    duration_quick.initialize(DigitalSample{true, 1000, DigitalSampleStatus::Ok});
    auto short_start = duration_quick.process(DigitalEdge{false, EdgeKind::Falling, 30000, DigitalSampleStatus::Ok});
    EXPECT_FALSE(short_start.has_request);
    auto short_release = duration_quick.process(DigitalEdge{true, EdgeKind::Rising, 32000, DigitalSampleStatus::Ok});
    EXPECT_FALSE(short_release.has_request);
    EXPECT_TRUE(short_release.state.faults.has(SensorFault::Plausibility));
    auto valid_start = duration_quick.process(DigitalEdge{false, EdgeKind::Falling, 60000, DigitalSampleStatus::Ok});
    EXPECT_FALSE(valid_start.has_request);
    auto valid_release = duration_quick.process(DigitalEdge{true, EdgeKind::Rising, 70000, DigitalSampleStatus::Ok});
    EXPECT_TRUE(valid_release.has_request);
    EXPECT_EQ(60000ull, valid_release.request.event.activated_at);
    EXPECT_EQ(70000ull, valid_release.request.event.released_at);
    EXPECT_EQ(10000u, valid_release.request.event.duration_us);
    duration_quick.process(DigitalEdge{false, EdgeKind::Falling, 100000, DigitalSampleStatus::Ok});
    auto long_release = duration_quick.process(DigitalEdge{true, EdgeKind::Rising, 200000, DigitalSampleStatus::Ok});
    EXPECT_FALSE(long_release.has_request);
    EXPECT_TRUE(long_release.state.faults.has(SensorFault::Stuck));

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

    MapSwitchInput map_secondary(MapSwitchConfig{});
    auto startup_secondary = map_secondary.initialize(DigitalSample{false, 1000, DigitalSampleStatus::Ok});
    EXPECT_EQ(PhysicalMapRequest::Secondary, startup_secondary.value.request);
    auto map_comm = map_secondary.process(DigitalEdge{true, EdgeKind::Rising, 30000, DigitalSampleStatus::HardwareFault});
    EXPECT_FALSE(map_comm.reading.valid_for_control);
    EXPECT_TRUE(map_comm.reading.faults.has(SensorFault::Communication));
    MapSwitchInput map_debounce_input(MapSwitchConfig{});
    map_debounce_input.initialize(DigitalSample{false, 1000, DigitalSampleStatus::Ok});
    auto map_debounce = map_debounce_input.process(DigitalEdge{true, EdgeKind::Rising, 11000, DigitalSampleStatus::Ok});
    EXPECT_FALSE(map_debounce.has_event);
    EXPECT_TRUE(map_debounce.reading.faults.has(SensorFault::Debounce));
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

    auto still_fresh = estimator.check_stale(105000);
    EXPECT_TRUE(still_fresh.valid_for_control);
    EXPECT_EQ(SensorHealthState::Valid, still_fresh.health);

    auto duplicate = pickup.process(EdgeCapture{104010, EdgePolarity::Falling, CaptureStatus::Ok});
    EXPECT_FALSE(duplicate.valid);
    EXPECT_TRUE(duplicate.faults.has(SensorFault::Duplicate));

    auto hardware_fault = pickup.process(EdgeCapture{105000, EdgePolarity::Falling, CaptureStatus::HardwareFault});
    EXPECT_FALSE(hardware_fault.valid);
    EXPECT_TRUE(hardware_fault.faults.has(SensorFault::DeviceFault));

    auto wrong_polarity = pickup.process(EdgeCapture{106000, EdgePolarity::Rising, CaptureStatus::Ok});
    EXPECT_FALSE(wrong_polarity.valid);
    EXPECT_TRUE(wrong_polarity.faults.has(SensorFault::Plausibility));

    auto stale = estimator.check_stale(300000);
    EXPECT_FALSE(stale.valid_for_control);
    EXPECT_EQ(SensorHealthState::Stale, stale.health);

    auto not_stale = estimator.check_stale(301000);
    EXPECT_EQ(SensorHealthState::Stale, not_stale.health);
}

void test_pickup_estimator_rejects_impossible_rpm_limits() {
    EngineStateConfig config{};
    config.minimum_rpm = 1000.0f;
    config.maximum_rpm = 10000.0f;
    EngineStateEstimator estimator(config);
    estimator.process(EdgeCapture{100000, EdgePolarity::Falling, CaptureStatus::Ok});

    auto too_slow = estimator.process(EdgeCapture{200000, EdgePolarity::Falling, CaptureStatus::Ok});
    EXPECT_FALSE(too_slow.valid_for_control);
    EXPECT_TRUE(too_slow.faults.has(SensorFault::Plausibility));

    EngineStateEstimator fast_estimator(config);
    fast_estimator.process(EdgeCapture{100000, EdgePolarity::Falling, CaptureStatus::Ok});
    auto too_fast = fast_estimator.process(EdgeCapture{101000, EdgePolarity::Falling, CaptureStatus::Ok});
    EXPECT_FALSE(too_fast.valid_for_control);
    EXPECT_TRUE(too_fast.faults.has(SensorFault::Plausibility));
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
    REQUIRE_TRUE(duplicate_fault.has_value());
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
    REQUIRE_TRUE(overflow_fault.has_value());
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

    auto ok_saturated = knock.process(context, TpicWindowResult{65535, 3000, KnockDeviceStatus::Ok});
    EXPECT_FALSE(ok_saturated.valid_for_control);
    EXPECT_TRUE(ok_saturated.faults.has(SensorFault::Saturation));

    KnockWindowContext bad_timing = context;
    bad_timing.window_closed_at = bad_timing.window_opened_at;
    auto invalid_window = knock.process(bad_timing, TpicWindowResult{10, 3000, KnockDeviceStatus::Ok});
    EXPECT_FALSE(invalid_window.valid_for_control);
    EXPECT_TRUE(invalid_window.faults.has(SensorFault::WindowTiming));

    auto missing = knock.process(context, TpicWindowResult{10, 3000, KnockDeviceStatus::Missing});
    EXPECT_EQ(SensorHealthState::Stale, missing.health);
    EXPECT_TRUE(missing.faults.has(SensorFault::Missing));
    auto communication = knock.process(context, TpicWindowResult{10, 3000, KnockDeviceStatus::CommunicationFault});
    EXPECT_TRUE(communication.faults.has(SensorFault::Communication));
    auto configuration = knock.process(context, TpicWindowResult{10, 3000, KnockDeviceStatus::ConfigurationFault});
    EXPECT_TRUE(configuration.faults.has(SensorFault::InvalidConfiguration));
    auto timing = knock.process(context, TpicWindowResult{10, 3000, KnockDeviceStatus::TimingFault});
    EXPECT_TRUE(timing.faults.has(SensorFault::WindowTiming));

    KnockConfig stuck_config{};
    stuck_config.stuck_result_limit = 3;
    stuck_config.stuck_delta_count = 0;
    KnockSensor stuck_knock(stuck_config);
    EXPECT_TRUE(stuck_knock.process(context, TpicWindowResult{100, 1000, KnockDeviceStatus::Ok}).valid_for_control);
    EXPECT_TRUE(stuck_knock.process(context, TpicWindowResult{100, 2000, KnockDeviceStatus::Ok}).valid_for_control);
    auto stuck = stuck_knock.process(context, TpicWindowResult{100, 3000, KnockDeviceStatus::Ok});
    EXPECT_FALSE(stuck.valid_for_control);
    EXPECT_TRUE(stuck.faults.has(SensorFault::Stuck));

    KnockFeatureConfig feature_config{};
    feature_config.queue_capacity = 1;
    KnockFeatureExtractor extractor(feature_config);
    EXPECT_FALSE(extractor.extract_next().has_value());
    EXPECT_TRUE(extractor.submit(valid));
    EXPECT_FALSE(extractor.submit(valid));
    EXPECT_EQ(1u, extractor.dropped_count());
    auto feature = extractor.extract_next();
    REQUIRE_TRUE(feature.has_value());
    EXPECT_FALSE(feature->requests_ignition_authority);
}

void test_knock_acquisition_service_publishes_device_failures() {
    FakeKnockWindowDevice device;
    SensorDataStore store(4, 4, 4, 4);
    KnockSensor knock(KnockConfig{});
    KnockAcquisitionService service(device, store, knock);
    KnockWindowContext context{};
    context.revolution_id = 11;
    context.window_opened_at = 1000;
    context.window_closed_at = 2000;

    EXPECT_FALSE(service.run_once(context));
    auto missing = store.pop_knock_measurement();
    REQUIRE_TRUE(missing.has_value());
    EXPECT_TRUE(missing->faults.has(SensorFault::Missing));

    device.open_ok = false;
    EXPECT_FALSE(service.run_once(context));
    auto timing = store.pop_knock_measurement();
    REQUIRE_TRUE(timing.has_value());
    EXPECT_TRUE(timing->faults.has(SensorFault::WindowTiming));
}

void test_services_and_health_aggregation_are_sensor_only() {
    SensorDataStore store(4, 4, 4, 4);
    FakeTimeSource time;
    time.set(1000);
    FakeAnalogSampleSource analog;
    analog.push("tps", analog_sample(0, 1000, true, 1000));

    TpsConfig service_tps_config{};
    service_tps_config.closed_mv = 0;
    service_tps_config.open_mv = 2000;
    TpsSensor tps(service_tps_config);
    AnalogSensorService analog_service(analog, store, tps);
    EXPECT_TRUE(analog_service.run_once("tps"));
    EXPECT_TRUE(store.snapshot().tps.valid_for_control);
    EXPECT_FALSE(analog_service.run_once("tps"));

    WaterTemperatureConfig water_config{};
    water_config.ntc.vref_mv = 3300;
    water_config.ntc.fixed_resistance_ohms = 10000.0f;
    water_config.ntc.nominal_resistance_ohms = 10000.0f;
    water_config.ntc.nominal_temperature_celsius = 25.0f;
    water_config.ntc.beta_kelvin = 3950.0f;
    water_config.minimum_valid_mv = 50;
    water_config.maximum_valid_mv = 3250;
    water_config.short_to_ground_mv = 25;
    water_config.open_circuit_mv = 3275;

    FakeAnalogSampleSource thermal_analog;
    FakeSpiMeasurementSource thermal_spi;
    thermal_analog.push("water", analog_sample(0, 1650, true, 2000));
    thermal_spi.push("egt", Max31856Sample{150.0f, 2000, SpiSampleStatus::Ok, 0});
    EgtSensor service_egt(EgtConfig{});
    WaterTemperatureSensor service_water(water_config);
    ThermalSensorService thermal_service(thermal_analog, thermal_spi, store, service_egt, service_water);
    EXPECT_TRUE(thermal_service.run_once("egt", "water"));
    EXPECT_TRUE(store.snapshot().egt.valid_for_control);
    EXPECT_TRUE(store.snapshot().water_temperature.valid_for_control);
    EXPECT_FALSE(thermal_service.run_once("egt", "water"));

    FakeDigitalInputSource digital;
    QuickShifterInput service_quick(QuickShifterConfig{});
    MapSwitchInput service_map(MapSwitchConfig{});
    service_quick.initialize(DigitalSample{true, 1000, DigitalSampleStatus::Ok});
    service_map.initialize(DigitalSample{true, 1000, DigitalSampleStatus::Ok});
    digital.push_edge("quick", DigitalEdge{false, EdgeKind::Falling, 30000, DigitalSampleStatus::Ok});
    digital.push_edge("map", DigitalEdge{false, EdgeKind::Falling, 30000, DigitalSampleStatus::Ok});
    DigitalInputService digital_service(digital, store, service_quick, service_map);
    EXPECT_TRUE(digital_service.run_once("quick", "map"));
    EXPECT_TRUE(store.pop_quick_shift_request().has_value());
    EXPECT_TRUE(store.pop_map_switch_event().has_value());
    EXPECT_FALSE(digital_service.run_once("quick", "map"));

    FakeKnockWindowDevice knock_device;
    KnockSensor service_knock(KnockConfig{});
    KnockAcquisitionService knock_service(knock_device, store, service_knock);
    KnockWindowContext knock_context{};
    knock_context.config_generation = 7;
    knock_context.window_opened_at = 4000;
    knock_context.window_closed_at = 5000;
    knock_device.push_result(TpicWindowResult{321, 5100, KnockDeviceStatus::Ok});
    EXPECT_TRUE(knock_service.run_once(knock_context));
    auto service_measurement = store.pop_knock_measurement();
    REQUIRE_TRUE(service_measurement.has_value());
    EXPECT_TRUE(service_measurement->valid_for_control);
    EXPECT_EQ(7u, knock_device.configured_generation);

    KnockFeatureExtractor signal_extractor(KnockFeatureConfig{});
    EXPECT_TRUE(signal_extractor.submit(*service_measurement));
    KnockSignalProcessingService signal_service(signal_extractor);
    EXPECT_TRUE(signal_service.run_once().has_value());
    EXPECT_FALSE(signal_service.run_once().has_value());

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

    SensorEvent<MapSwitchState> map_event{};
    map_event.event.request = PhysicalMapRequest::Secondary;
    map_event.acquired_at = 3000;
    EXPECT_TRUE(store.publish_map_switch_event(map_event));
    FaultTransition fault{};
    fault.fault = SensorFault::Overflow;
    fault.health = SensorHealthState::Failed;
    fault.first_at = 4000;
    fault.last_at = 5000;
    fault.count = 2;
    EXPECT_TRUE(store.publish_fault(fault));

    auto more_events = ecu::sensor_harness::drain_event_lines(store);
    EXPECT_EQ(2u, more_events.size());
    EXPECT_EQ(std::string("# event,map_switch,1,3000"), more_events.front());
    EXPECT_EQ(std::string("# event,fault,16,5,4000,5000,2"), more_events.back());
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
    fake_analog.push(ecu::sensor_harness::kWaterChannel, analog_sample(111, 111, true, 1000));
    real_analog.push(ecu::sensor_harness::kTpsChannel, analog_sample(222, 222, true, 2000));
    ecu::sensor_harness::MuxAnalogSampleSource analog_mux(fake_analog, real_analog, routes);
    auto mux_tps = analog_mux.read(ecu::sensor_harness::kTpsChannel);
    REQUIRE_TRUE(mux_tps.has_value());
    EXPECT_EQ(222, mux_tps->raw_code);
    auto mux_water = analog_mux.read(ecu::sensor_harness::kWaterChannel);
    REQUIRE_TRUE(mux_water.has_value());
    EXPECT_EQ(111, mux_water->raw_code);
    EXPECT_FALSE(analog_mux.read("unknown").has_value());

    FakeSpiMeasurementSource fake_spi;
    FakeSpiMeasurementSource real_spi;
    fake_spi.push(ecu::sensor_harness::kEgtDevice, Max31856Sample{10.0f, 3000, SpiSampleStatus::Ok, 0});
    real_spi.push(ecu::sensor_harness::kEgtDevice, Max31856Sample{20.0f, 4000, SpiSampleStatus::Ok, 0});
    ecu::sensor_harness::MuxSpiMeasurementSource spi_mux(fake_spi, real_spi, routes);
    auto mux_egt = spi_mux.read(ecu::sensor_harness::kEgtDevice);
    REQUIRE_TRUE(mux_egt.has_value());
    EXPECT_NEAR(20.0, mux_egt->celsius, 0.01);
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
    auto mux_quick_state = digital_mux.read_state(ecu::sensor_harness::kQuickInput);
    REQUIRE_TRUE(mux_quick_state.has_value());
    EXPECT_TRUE(mux_quick_state->level_high);
    auto mux_map_state = digital_mux.read_state(ecu::sensor_harness::kMapInput);
    REQUIRE_TRUE(mux_map_state.has_value());
    EXPECT_FALSE(mux_map_state->level_high);
    auto mux_quick_edge = digital_mux.read_edge(ecu::sensor_harness::kQuickInput);
    REQUIRE_TRUE(mux_quick_edge.has_value());
    EXPECT_EQ(8000ull, mux_quick_edge->acquired_at);
    auto mux_map_edge = digital_mux.read_edge(ecu::sensor_harness::kMapInput);
    REQUIRE_TRUE(mux_map_edge.has_value());
    EXPECT_EQ(6000ull, mux_map_edge->acquired_at);
    EXPECT_FALSE(digital_mux.read_edge("unknown").has_value());

    FakeEdgeCaptureSource fake_pickup;
    FakeEdgeCaptureSource real_pickup;
    fake_pickup.push(ecu::sensor_harness::kPickupInput, EdgeCapture{9000, EdgePolarity::Falling, CaptureStatus::Ok});
    real_pickup.push(ecu::sensor_harness::kPickupInput, EdgeCapture{10000, EdgePolarity::Falling, CaptureStatus::Ok});
    ecu::sensor_harness::MuxEdgeCaptureSource pickup_mux(fake_pickup, real_pickup, routes);
    auto mux_pickup = pickup_mux.read_capture(ecu::sensor_harness::kPickupInput);
    REQUIRE_TRUE(mux_pickup.has_value());
    EXPECT_EQ(10000ull, mux_pickup->captured_at);
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
    auto mux_knock = knock_mux.read_result();
    REQUIRE_TRUE(mux_knock.has_value());
    EXPECT_EQ(20u, mux_knock->integrator_count);
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
    test_pullup_ntc_transfer_rejects_invalid_inputs();
    test_non_spi_driver_helpers_cover_hardware_independent_logic();
    test_data_store_sequences_and_queue_overflow();
    test_tps_valid_sweep_stale_and_fallback();
    test_tps_optional_rate_and_stuck_validators_are_configurable();
    test_thermal_sensors_publish_requests_without_final_authority();
    test_thermal_optional_rate_and_frozen_validators_are_configurable();
    test_digital_inputs_debounce_rearm_and_map_state();
    test_pickup_estimator_sync_loss_and_recovery();
    test_pickup_estimator_rejects_impossible_rpm_limits();
    test_pickup_service_publishes_invalid_capture_faults();
    test_pickup_service_stale_recovery_requires_new_startup_sequence();
    test_pickup_service_accepts_high_rpm_and_rapid_ramp();
    test_knock_measurement_validation_and_feature_backlog();
    test_knock_acquisition_service_publishes_device_failures();
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
