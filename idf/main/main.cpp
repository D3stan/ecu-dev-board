#include <cstddef>
#include <cstdio>
#include <cstdint>

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

#if defined(CONFIG_SENSOR_HARNESS_WATER_SOURCE_REAL_ADC)
#error "Real water-temperature ADC source is not wired yet. Confirm the ADC channel/divider before enabling it."
#endif

#if defined(CONFIG_SENSOR_HARNESS_EGT_SOURCE_REAL_MAX31856)
#error "Real MAX31856 EGT source is not wired yet. Confirm SPI bus pins and CS before enabling it."
#endif

#if defined(CONFIG_SENSOR_HARNESS_PICKUP_SOURCE_REAL_CAPTURE)
#error "Real pickup capture source is not wired yet. Confirm the GPIO and ISR-safe capture path before enabling it."
#endif

#if defined(CONFIG_SENSOR_HARNESS_KNOCK_SOURCE_REAL_TPIC8101)
#error "Real TPIC8101 knock source is not wired yet. Confirm SPI, HOLD/window pin, and signal conditioning before enabling it."
#endif

namespace {

using namespace ecu::sensors;
using ecu::sensor_drivers::AdcChannelBinding;
using ecu::sensor_drivers::EspAdcSampleSource;
using ecu::sensor_drivers::EspGpioInputSource;
using ecu::sensor_drivers::EspTimeSource;
using ecu::sensor_drivers::GpioInputBinding;
using ecu::sensor_harness::HarnessInputRoutes;
using ecu::sensor_harness::HarnessInputSource;

constexpr int kSerialBaud = 115200;
constexpr std::uint32_t kPrintIntervalMs = 100;
constexpr std::uint32_t kStoreQueueCapacity = 8;
constexpr std::uint32_t kHarnessTaskStackBytes = 16384;
constexpr UBaseType_t kHarnessTaskPriority = tskIDLE_PRIORITY + 1;

constexpr gpio_num_t kQuickShifterGpio = GPIO_NUM_9;
constexpr gpio_num_t kMapSwitchGpio = GPIO_NUM_14;
constexpr adc_channel_t kTpsAdcChannel = ADC_CHANNEL_6;

#if defined(CONFIG_SENSOR_HARNESS_TPS_SOURCE_REAL_ADC)
constexpr bool kTpsUsesRealAdc = true;
#else
constexpr bool kTpsUsesRealAdc = false;
#endif

#if defined(CONFIG_SENSOR_HARNESS_QUICK_SOURCE_REAL_GPIO)
constexpr bool kQuickUsesRealGpio = true;
#else
constexpr bool kQuickUsesRealGpio = false;
#endif

#if defined(CONFIG_SENSOR_HARNESS_MAP_SOURCE_REAL_GPIO)
constexpr bool kMapUsesRealGpio = true;
#else
constexpr bool kMapUsesRealGpio = false;
#endif

constexpr bool kAnyRealAdc = kTpsUsesRealAdc;
constexpr bool kAnyRealGpio = kQuickUsesRealGpio || kMapUsesRealGpio;

struct PolledDigitalInput {
    const char *name;
    gpio_num_t gpio;
    bool initialized{false};
    bool last_level_high{true};
};

HarnessInputRoutes make_harness_routes() {
    HarnessInputRoutes routes{};

    if constexpr (kTpsUsesRealAdc) {
        routes.tps = HarnessInputSource::Real;
    }
    if constexpr (kQuickUsesRealGpio) {
        routes.quick = HarnessInputSource::Real;
    }
    if constexpr (kMapUsesRealGpio) {
        routes.map = HarnessInputSource::Real;
    }

    return routes;
}

const char *source_name(HarnessInputSource source) {
    return source == HarnessInputSource::Real ? "real" : "fake";
}

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

void print_harness_config(const HarnessInputRoutes &routes) {
    std::printf("# sensor_harness_mode,mixed\n");
    std::printf("# sensor_harness_sources,tps=%s,water=%s,egt=%s,quick=%s,map=%s,pickup=%s,knock=%s\n",
                source_name(routes.tps),
                source_name(routes.water),
                source_name(routes.egt),
                source_name(routes.quick),
                source_name(routes.map),
                source_name(routes.pickup),
                source_name(routes.knock));

    std::printf("# real_inputs");
    bool printed_any = false;
    if constexpr (kTpsUsesRealAdc) {
        std::printf(",tps_gpio7_adc1_ch6");
        printed_any = true;
    }
    if constexpr (kQuickUsesRealGpio) {
        std::printf(",quick_gpio9");
        printed_any = true;
    }
    if constexpr (kMapUsesRealGpio) {
        std::printf(",map_gpio14");
        printed_any = true;
    }
    if (!printed_any) {
        std::printf(",none");
    }
    std::printf("\n");
    std::printf("%s\n", ecu::sensor_harness::csv_header());
}

void configure_real_gpio_inputs() {
    std::uint64_t pin_mask = 0;
    if constexpr (kQuickUsesRealGpio) {
        pin_mask |= 1ULL << kQuickShifterGpio;
    }
    if constexpr (kMapUsesRealGpio) {
        pin_mask |= 1ULL << kMapSwitchGpio;
    }
    if (pin_mask == 0) {
        return;
    }

    gpio_config_t config{};
    config.pin_bit_mask = pin_mask;
    config.mode = GPIO_MODE_INPUT;
    config.pull_up_en = GPIO_PULLUP_ENABLE;
    config.pull_down_en = GPIO_PULLDOWN_DISABLE;
    config.intr_type = GPIO_INTR_DISABLE;
    ESP_ERROR_CHECK(gpio_config(&config));
}

adc_oneshot_unit_handle_t configure_real_adc() {
    if constexpr (!kAnyRealAdc) {
        return nullptr;
    }

    adc_oneshot_unit_handle_t adc_handle = nullptr;
    adc_oneshot_unit_init_cfg_t unit_config{};
    unit_config.unit_id = ADC_UNIT_1;
    ESP_ERROR_CHECK(adc_oneshot_new_unit(&unit_config, &adc_handle));

    if constexpr (kTpsUsesRealAdc) {
        adc_oneshot_chan_cfg_t channel_config{};
        channel_config.atten = ADC_ATTEN_DB_12;
        channel_config.bitwidth = ADC_BITWIDTH_DEFAULT;
        ESP_ERROR_CHECK(adc_oneshot_config_channel(adc_handle, kTpsAdcChannel, &channel_config));
    }

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

void run_mixed_harness(EspTimeSource &time_source) {
    SensorDataStore store(kStoreQueueCapacity, kStoreQueueCapacity, kStoreQueueCapacity, kStoreQueueCapacity);
    const HarnessInputRoutes routes = make_harness_routes();
    const auto fake_mask = ecu::sensor_harness::fake_stimulus_mask_from_routes(routes);

    FakeAnalogSampleSource fake_analog_source;
    FakeSpiMeasurementSource fake_spi_source;
    FakeDigitalInputSource fake_digital_source;
    FakeEdgeCaptureSource fake_pickup_source;
    FakeKnockWindowDevice fake_knock_device;
    ecu::sensor_harness::FakeSensorStimulus stimulus;

    adc_oneshot_unit_handle_t adc_handle = configure_real_adc();
    const AdcChannelBinding adc_bindings[] = {
        {ecu::sensor_harness::kTpsChannel, kTpsAdcChannel},
    };
    EspAdcSampleSource real_analog_source(adc_handle, adc_bindings, kAnyRealAdc ? 1 : 0, time_source);

    configure_real_gpio_inputs();
    const GpioInputBinding gpio_bindings[] = {
        {ecu::sensor_harness::kQuickInput, kQuickShifterGpio},
        {ecu::sensor_harness::kMapInput, kMapSwitchGpio},
    };
    EspGpioInputSource real_digital_source(gpio_bindings, kAnyRealGpio ? 2 : 0, time_source);

    FakeSpiMeasurementSource unavailable_real_spi_source;
    FakeEdgeCaptureSource unavailable_real_pickup_source;
    FakeKnockWindowDevice unavailable_real_knock_device;

    ecu::sensor_harness::MuxAnalogSampleSource analog_source(fake_analog_source, real_analog_source, routes);
    ecu::sensor_harness::MuxSpiMeasurementSource spi_source(fake_spi_source, unavailable_real_spi_source, routes);
    ecu::sensor_harness::MuxDigitalInputSource digital_source(fake_digital_source, real_digital_source, routes);
    ecu::sensor_harness::MuxEdgeCaptureSource pickup_source(fake_pickup_source, unavailable_real_pickup_source, routes);
    ecu::sensor_harness::MuxKnockWindowDevice knock_device(fake_knock_device, unavailable_real_knock_device, routes);

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

    PolledDigitalInput quick_input{ecu::sensor_harness::kQuickInput, kQuickShifterGpio};
    PolledDigitalInput map_input{ecu::sensor_harness::kMapInput, kMapSwitchGpio};
    KnockWindowMeasurement latest_knock{};

    print_harness_config(routes);

    while (true) {
        stimulus.push_next(fake_analog_source,
                           fake_spi_source,
                           fake_digital_source,
                           fake_pickup_source,
                           fake_knock_device,
                           fake_mask);

        if constexpr (kQuickUsesRealGpio) {
            poll_edge(real_digital_source, time_source, quick_input);
        }
        if constexpr (kMapUsesRealGpio) {
            poll_edge(real_digital_source, time_source, map_input);
        }

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

void sensor_harness_task(void *) {
    EspTimeSource time_source;
    run_mixed_harness(time_source);
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
