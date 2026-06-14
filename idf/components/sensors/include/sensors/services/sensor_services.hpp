#pragma once

#include <string_view>

#include "sensors/domain/sensor_data_store.hpp"
#include "sensors/ports/hardware_ports.hpp"
#include "sensors/sensors/digital_inputs.hpp"
#include "sensors/sensors/knock_sensor.hpp"
#include "sensors/sensors/pickup_sensor.hpp"
#include "sensors/sensors/thermal_sensors.hpp"
#include "sensors/sensors/tps_sensor.hpp"

namespace ecu::sensors {

class AnalogSensorService {
public:
    AnalogSensorService(IAnalogSampleSource &source, SensorDataStore &store, TpsSensor &tps);
    bool run_once(std::string_view tps_channel);

private:
    IAnalogSampleSource &source_;
    SensorDataStore &store_;
    TpsSensor &tps_;
};

class ThermalSensorService {
public:
    ThermalSensorService(IAnalogSampleSource &analog_source,
                         ISpiMeasurementSource &spi_source,
                         SensorDataStore &store,
                         EgtSensor &egt,
                         WaterTemperatureSensor &water);

    bool run_once(std::string_view egt_device, std::string_view water_channel);

private:
    IAnalogSampleSource &analog_source_;
    ISpiMeasurementSource &spi_source_;
    SensorDataStore &store_;
    EgtSensor &egt_;
    WaterTemperatureSensor &water_;
};

class DigitalInputService {
public:
    DigitalInputService(IDigitalInputSource &source,
                        SensorDataStore &store,
                        QuickShifterInput &quick,
                        MapSwitchInput &map);

    bool run_once(std::string_view quick_input, std::string_view map_input);

private:
    IDigitalInputSource &source_;
    SensorDataStore &store_;
    QuickShifterInput &quick_;
    MapSwitchInput &map_;
};

class PickupAcquisitionService {
public:
    PickupAcquisitionService(IEdgeCaptureSource &source,
                             SensorDataStore &store,
                             PickupSensor &pickup,
                             EngineStateEstimator &estimator);

    bool run_once(std::string_view pickup_input);

private:
    IEdgeCaptureSource &source_;
    SensorDataStore &store_;
    PickupSensor &pickup_;
    EngineStateEstimator &estimator_;
};

class KnockAcquisitionService {
public:
    KnockAcquisitionService(IKnockWindowDevice &device, SensorDataStore &store, KnockSensor &knock);
    bool run_once(const KnockWindowContext &context);

private:
    IKnockWindowDevice &device_;
    SensorDataStore &store_;
    KnockSensor &knock_;
};

class KnockSignalProcessingService {
public:
    explicit KnockSignalProcessingService(KnockFeatureExtractor &extractor);
    std::optional<KnockFeatureRecord> run_once();

private:
    KnockFeatureExtractor &extractor_;
};

} // namespace ecu::sensors
