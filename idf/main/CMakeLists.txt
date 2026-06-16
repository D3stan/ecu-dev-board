idf_component_register(
    SRCS "main.cpp"
    INCLUDE_DIRS "."
    REQUIRES sensors sensor_drivers sensor_harness telemetry_server driver esp_adc
)

target_compile_features(${COMPONENT_LIB} PUBLIC cxx_std_17)
