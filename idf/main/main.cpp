#include <cstdio>
#include <string>

#include "driver/gpio.h"
#include "driver/uart.h"
#include "esp_adc/adc_oneshot.h"
#include "esp_err.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "sensor_drivers/adc_sample_source.hpp"
#include "sensor_drivers/esp_time_source.hpp"
#include "sensor_drivers/gpio_input_source.hpp"
#include "sensor_harness/sensor_harness.hpp"
#include "sensors/domain/fake_sources.hpp"
#include "sensors/domain/sensor_data_store.hpp"
#include "sensors/services/sensor_services.hpp"
#include "sdkconfig.h"

#ifndef SENSOR_HARNESS_FAKE_MODE
#if defined(CONFIG_SENSOR_HARNESS_MODE_REAL)
#define SENSOR_HARNESS_FAKE_MODE 0
#else
#define SENSOR_HARNESS_FAKE_MODE 1
#endif
#endif

namespace {

using namespace ecu::sensors;
using ecu::sensor_drivers::AdcChannelBinding;
using ecu::sensor_drivers::EspAdcSampleSource;
using ecu::sensor_drivers::EspEdgeCaptureSource;
using ecu::sensor_drivers::EspGpioInputSource;
using ecu::sensor_drivers::EspTimeSource;
using ecu::sensor_drivers::GpioInputBinding;

constexpr bool kHarnessFakeMode = SENSOR_HARNESS_FAKE_MODE != 0;
constexpr int kSerialBaud = 115200;
constexpr std::uint32_t kPrintIntervalMs = 100;
constexpr std::uint32_t kStoreQueueCapacity = 8;
constexpr std::uint32_t kHarnessTaskStackBytes = 16384;
constexpr UBaseType_t kHarnessTaskPriority = tskIDLE_PRIORITY + 1;

constexpr gpio_num_t kQuickShifterGpio = GPIO_NUM_9;
constexpr gpio_num_t kMapSwitchGpio = GPIO_NUM_14;
constexpr adc_channel_t kTpsAdcChannel = ADC_CHANNEL_6;

TpsConfig make_tps_config() {
    TpsConfig config{};
    config.closed_adc = 0;
    config.open_adc = 4095;
    config.minimum_valid_adc = 0;
    config.maximum_valid_adc = 4095;
    config.filter_alpha_permille = 1000;
    return config;
}

KnockWindowContext make_knock_context(const EngineInputSnapshot &snapshot) {
    const TimestampUs reference_at = snapshot.engine_speed.value.reference_at != 0
                                         ? snapshot.engine_speed.value.reference_at
                                         : snapshot.tps.acquired_at;

    KnockWindowContext context{};
    context.revolution_id = snapshot.engine_speed.value.revolution_id;
    context.pickup_edge_at = reference_at;
    context.window_opened_at = reference_at + 100;
    context.window_closed_at = reference_at + 600;
    context.rpm = snapshot.engine_speed.value.rpm;
    context.tps_permille = snapshot.tps.value.permille;
    context.ignition_angle_deg = 15.0f;
    context.config_generation = 1;
    return context;
}

void update_latest_knock(SensorDataStore &store, KnockWindowMeasurement &latest_knock) {
    while (auto measurement = store.pop_knock_measurement()) {
        latest_knock = *measurement;
    }
}

void print_snapshot(SensorDataStore &store, TimestampUs now, const KnockWindowMeasurement &latest_knock) {
    const auto line = ecu::sensor_harness::format_snapshot_csv(store.snapshot(), now, latest_knock);
    std::printf("%s\n", line.c_str());

    for (const auto &event_line : ecu::sensor_harness::drain_event_lines(store)) {
        std::printf("%s\n", event_line.c_str());
    }
}

void run_fake_harness(EspTimeSource &time_source) {
    SensorDataStore store(kStoreQueueCapacity, kStoreQueueCapacity, kStoreQueueCapacity, kStoreQueueCapacity);

    FakeAnalogSampleSource analog_source;
    FakeSpiMeasurementSource spi_source;
    FakeDigitalInputSource digital_source;
    FakeEdgeCaptureSource pickup_source;
    FakeKnockWindowDevice knock_device;
    ecu::sensor_harness::FakeSensorStimulus stimulus;

    TpsSensor tps(make_tps_config());
    EgtSensor egt(EgtConfig{});
    WaterTemperatureSensor water(WaterTemperatureConfig{});
    QuickShifterInput quick(QuickShifterConfig{});
    MapSwitchInput map(MapSwitchConfig{});
    PickupSensor pickup(PickupConfig{});
    EngineStateEstimator estimator(EngineStateConfig{});
    KnockSensor knock(KnockConfig{});

    AnalogSensorService analog_service(analog_source, store, tps);
    ThermalSensorService thermal_service(analog_source, spi_source, store, egt, water);
    DigitalInputService digital_service(digital_source, store, quick, map);
    PickupAcquisitionService pickup_service(pickup_source, store, pickup, estimator);
    KnockAcquisitionService knock_service(knock_device, store, knock);

    KnockWindowMeasurement latest_knock{};

    std::printf("# sensor_harness_mode,fake\n");
    std::printf("%s\n", ecu::sensor_harness::csv_header());

    while (true) {
        stimulus.push_next(analog_source, spi_source, digital_source, pickup_source, knock_device);

        analog_service.run_once(ecu::sensor_harness::kTpsChannel);
        thermal_service.run_once(ecu::sensor_harness::kEgtDevice, ecu::sensor_harness::kWaterChannel);
        digital_service.run_once(ecu::sensor_harness::kQuickInput, ecu::sensor_harness::kMapInput);
        pickup_service.run_once(ecu::sensor_harness::kPickupInput);
        knock_service.run_once(make_knock_context(store.snapshot()));

        update_latest_knock(store, latest_knock);
        print_snapshot(store, time_source.now(), latest_knock);
        vTaskDelay(pdMS_TO_TICKS(kPrintIntervalMs));
    }
}

#if !SENSOR_HARNESS_FAKE_MODE

struct PolledDigitalInput {
    const char *name;
    gpio_num_t gpio;
    bool initialized{false};
    bool last_level_high{true};
};

void configure_real_gpio_inputs() {
    gpio_config_t config{};
    config.pin_bit_mask = (1ULL << kQuickShifterGpio) | (1ULL << kMapSwitchGpio);
    config.mode = GPIO_MODE_INPUT;
    config.pull_up_en = GPIO_PULLUP_ENABLE;
    config.pull_down_en = GPIO_PULLDOWN_DISABLE;
    config.intr_type = GPIO_INTR_DISABLE;
    ESP_ERROR_CHECK(gpio_config(&config));
}

adc_oneshot_unit_handle_t configure_real_adc() {
    adc_oneshot_unit_handle_t adc_handle = nullptr;
    adc_oneshot_unit_init_cfg_t unit_config{};
    unit_config.unit_id = ADC_UNIT_1;
    ESP_ERROR_CHECK(adc_oneshot_new_unit(&unit_config, &adc_handle));

    adc_oneshot_chan_cfg_t channel_config{};
    channel_config.atten = ADC_ATTEN_DB_12;
    channel_config.bitwidth = ADC_BITWIDTH_DEFAULT;
    ESP_ERROR_CHECK(adc_oneshot_config_channel(adc_handle, kTpsAdcChannel, &channel_config));
    return adc_handle;
}

void poll_edge(EspGpioInputSource &source, EspTimeSource &time_source, PolledDigitalInput &input) {
    const bool level_high = gpio_get_level(input.gpio) != 0;
    if (!input.initialized || level_high != input.last_level_high) {
        const EdgeKind edge = level_high ? EdgeKind::Rising : EdgeKind::Falling;
        source.record_edge(input.name, level_high, edge, time_source.now());
        input.initialized = true;
        input.last_level_high = level_high;
    }
}

void run_real_harness(EspTimeSource &time_source) {
    SensorDataStore store(kStoreQueueCapacity, kStoreQueueCapacity, kStoreQueueCapacity, kStoreQueueCapacity);

    configure_real_gpio_inputs();
    adc_oneshot_unit_handle_t adc_handle = configure_real_adc();

    const AdcChannelBinding adc_bindings[] = {
        {ecu::sensor_harness::kTpsChannel, kTpsAdcChannel},
    };
    const GpioInputBinding gpio_bindings[] = {
        {ecu::sensor_harness::kQuickInput, kQuickShifterGpio},
        {ecu::sensor_harness::kMapInput, kMapSwitchGpio},
    };

    EspAdcSampleSource analog_source(adc_handle, adc_bindings, 1, time_source);
    EspGpioInputSource digital_source(gpio_bindings, 2, time_source);
    FakeSpiMeasurementSource disabled_spi_source;
    EspEdgeCaptureSource disabled_pickup_source(time_source);
    FakeKnockWindowDevice disabled_knock_device;

    TpsSensor tps(make_tps_config());
    EgtSensor egt(EgtConfig{});
    WaterTemperatureSensor water(WaterTemperatureConfig{});
    QuickShifterInput quick(QuickShifterConfig{});
    MapSwitchInput map(MapSwitchConfig{});
    PickupSensor pickup(PickupConfig{});
    EngineStateEstimator estimator(EngineStateConfig{});

    AnalogSensorService analog_service(analog_source, store, tps);
    ThermalSensorService thermal_service(analog_source, disabled_spi_source, store, egt, water);
    DigitalInputService digital_service(digital_source, store, quick, map);
    PickupAcquisitionService pickup_service(disabled_pickup_source, store, pickup, estimator);

    PolledDigitalInput quick_input{ecu::sensor_harness::kQuickInput, kQuickShifterGpio};
    PolledDigitalInput map_input{ecu::sensor_harness::kMapInput, kMapSwitchGpio};
    KnockWindowMeasurement latest_knock{};

    std::printf("# sensor_harness_mode,real\n");
    std::printf("# real_inputs,tps_gpio7_adc1_ch6,quick_gpio9,map_gpio14\n");
    std::printf("%s\n", ecu::sensor_harness::csv_header());

    while (true) {
        poll_edge(digital_source, time_source, quick_input);
        poll_edge(digital_source, time_source, map_input);

        analog_service.run_once(ecu::sensor_harness::kTpsChannel);
        thermal_service.run_once(ecu::sensor_harness::kEgtDevice, ecu::sensor_harness::kWaterChannel);
        digital_service.run_once(ecu::sensor_harness::kQuickInput, ecu::sensor_harness::kMapInput);
        pickup_service.run_once(ecu::sensor_harness::kPickupInput);

        print_snapshot(store, time_source.now(), latest_knock);
        vTaskDelay(pdMS_TO_TICKS(kPrintIntervalMs));
    }
}

#endif

void sensor_harness_task(void *) {
    EspTimeSource time_source;

    if constexpr (kHarnessFakeMode) {
        run_fake_harness(time_source);
    } else {
#if !SENSOR_HARNESS_FAKE_MODE
        run_real_harness(time_source);
#endif
    }

    vTaskDelete(nullptr);
}

} // namespace

extern "C" void app_main(void) {
    uart_set_baudrate(UART_NUM_0, kSerialBaud);
    setvbuf(stdout, nullptr, _IONBF, 0);

    const BaseType_t created = xTaskCreate(sensor_harness_task,
                                           "sensor_harness",
                                           kHarnessTaskStackBytes,
                                           nullptr,
                                           kHarnessTaskPriority,
                                           nullptr);
    if (created != pdPASS) {
        std::printf("# sensor_harness_error,task_create_failed\n");
    }
}
