idf_component_register(
    SRCS
        "src/domain/sensor_data_store.cpp"
        "src/domain/sensor_health_service.cpp"
        "src/domain/fake_sources.cpp"
        "src/domain/types.cpp"
        "src/sensors/tps_sensor.cpp"
        "src/sensors/thermal_sensors.cpp"
        "src/sensors/digital_inputs.cpp"
        "src/sensors/pickup_sensor.cpp"
        "src/sensors/knock_sensor.cpp"
        "src/services/sensor_services.cpp"
    INCLUDE_DIRS "include"
)

target_compile_features(${COMPONENT_LIB} PUBLIC cxx_std_17)
