#include "sensors/services/sensor_services.hpp"

namespace ecu::sensors {

AnalogSensorService::AnalogSensorService(IAnalogSampleSource &source, SensorDataStore &store, TpsSensor &tps)
    : source_(source), store_(store), tps_(tps) {}

bool AnalogSensorService::run_once(std::string_view tps_channel) {
    auto sample = source_.read(tps_channel);
    if (!sample.has_value()) {
        return false;
    }
    store_.publish_tps(tps_.process(*sample));
    return true;
}

ThermalSensorService::ThermalSensorService(IAnalogSampleSource &analog_source,
                                           ISpiMeasurementSource &spi_source,
                                           SensorDataStore &store,
                                           EgtSensor &egt,
                                           WaterTemperatureSensor &water)
    : analog_source_(analog_source), spi_source_(spi_source), store_(store), egt_(egt), water_(water) {}

bool ThermalSensorService::run_once(std::string_view egt_device, std::string_view water_channel) {
    bool did_work = false;
    if (auto egt_sample = spi_source_.read(egt_device)) {
        store_.publish_egt(egt_.process(*egt_sample));
        did_work = true;
    }
    if (auto water_sample = analog_source_.read(water_channel)) {
        store_.publish_water_temperature(water_.process(*water_sample));
        did_work = true;
    }
    return did_work;
}

DigitalInputService::DigitalInputService(IDigitalInputSource &source,
                                         SensorDataStore &store,
                                         QuickShifterInput &quick,
                                         MapSwitchInput &map)
    : source_(source), store_(store), quick_(quick), map_(map) {}

bool DigitalInputService::run_once(std::string_view quick_input, std::string_view map_input) {
    bool did_work = false;
    if (auto quick_edge = source_.read_edge(quick_input)) {
        auto result = quick_.process(*quick_edge);
        store_.publish_quick_shifter_state(result.state);
        if (result.has_request) {
            store_.publish_quick_shift_request(result.request);
        }
        did_work = true;
    }
    if (auto map_edge = source_.read_edge(map_input)) {
        auto result = map_.process(*map_edge);
        store_.publish_map_switch_state(result.reading);
        if (result.has_event) {
            store_.publish_map_switch_event(result.event);
        }
        did_work = true;
    }
    return did_work;
}

PickupAcquisitionService::PickupAcquisitionService(IEdgeCaptureSource &source,
                                                   SensorDataStore &store,
                                                   PickupSensor &pickup,
                                                   EngineStateEstimator &estimator)
    : source_(source), store_(store), pickup_(pickup), estimator_(estimator) {}

bool PickupAcquisitionService::run_once(std::string_view pickup_input) {
    auto capture = source_.read_capture(pickup_input);
    if (!capture.has_value()) {
        return false;
    }
    auto event = pickup_.process(*capture);
    if (event.valid) {
        store_.publish_engine_speed(estimator_.process(event.capture));
    }
    return true;
}

KnockAcquisitionService::KnockAcquisitionService(IKnockWindowDevice &device, SensorDataStore &store, KnockSensor &knock)
    : device_(device), store_(store), knock_(knock) {}

bool KnockAcquisitionService::run_once(const KnockWindowContext &context) {
    if (!device_.configure(context.config_generation) ||
        !device_.open_window(context.window_opened_at) ||
        !device_.close_window(context.window_closed_at)) {
        store_.publish_knock_measurement(knock_.unavailable(context, SensorFault::WindowTiming));
        return false;
    }
    auto result = device_.read_result();
    if (!result.has_value()) {
        store_.publish_knock_measurement(knock_.unavailable(context, SensorFault::Missing));
        return false;
    }
    store_.publish_knock_measurement(knock_.process(context, *result));
    return true;
}

KnockSignalProcessingService::KnockSignalProcessingService(KnockFeatureExtractor &extractor)
    : extractor_(extractor) {}

std::optional<KnockFeatureRecord> KnockSignalProcessingService::run_once() {
    return extractor_.extract_next();
}

} // namespace ecu::sensors
