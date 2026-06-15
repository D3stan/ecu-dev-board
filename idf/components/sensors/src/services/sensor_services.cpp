#include "sensors/services/sensor_services.hpp"

namespace ecu::sensors {

namespace {

SensorFault first_fault(const FaultBitset &faults) {
    const SensorFault ordered_faults[] = {
        SensorFault::Overflow,
        SensorFault::DeviceFault,
        SensorFault::Duplicate,
        SensorFault::Plausibility,
        SensorFault::Stale,
    };

    for (SensorFault fault : ordered_faults) {
        if (faults.has(fault)) {
            return fault;
        }
    }
    return SensorFault::DeviceFault;
}

SensorReading<EngineSpeedState> untrusted_engine_speed_reading(const PickupCaptureEvent &event) {
    SensorReading<EngineSpeedState> reading{};
    reading.acquired_at = event.capture.captured_at;
    reading.value.reference_at = event.capture.captured_at;
    reading.value.synchronized = false;
    reading.value.crank_reference_trusted = false;
    reading.valid_for_control = false;
    reading.health = event.health;
    reading.quality = event.quality;
    reading.faults = event.faults;
    return reading;
}

FaultTransition fault_transition(SensorFault fault, SensorHealthState health, TimestampUs at) {
    FaultTransition transition{};
    transition.fault = fault;
    transition.health = health;
    transition.first_at = at;
    transition.last_at = at;
    transition.count = 1;
    return transition;
}

} // namespace

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
    } else {
        store_.publish_engine_speed(untrusted_engine_speed_reading(event));
        store_.publish_fault(fault_transition(first_fault(event.faults), event.health, event.capture.captured_at));
    }
    return true;
}

std::size_t PickupAcquisitionService::drain_available(std::string_view pickup_input, std::size_t max_events) {
    std::size_t drained = 0;
    while (drained < max_events && run_once(pickup_input)) {
        ++drained;
    }
    return drained;
}

SensorReading<EngineSpeedState> PickupAcquisitionService::check_stale(TimestampUs now) {
    const SensorHealthState previous_health = store_.snapshot().engine_speed.health;
    auto reading = estimator_.check_stale(now);
    if (reading.health == SensorHealthState::Stale && previous_health != SensorHealthState::Stale) {
        store_.publish_engine_speed(reading);
        store_.publish_fault(fault_transition(SensorFault::Stale, reading.health, now));
    }
    return reading;
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
