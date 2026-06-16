idf_component_register(
    SRCS "src/sensor_telemetry_collector.cpp"
    INCLUDE_DIRS "include"
    REQUIRES sensors
)

target_compile_features(${COMPONENT_LIB} PUBLIC cxx_std_17)
