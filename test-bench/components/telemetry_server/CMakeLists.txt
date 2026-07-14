idf_component_register(
    SRCS
        "src/static_file_resolver.cpp"
        "src/telemetry_json_serializer.cpp"
        "src/telemetry_pump.cpp"
    INCLUDE_DIRS "include"
    REQUIRES telemetry esp_common
)
target_compile_features(${COMPONENT_LIB} PUBLIC cxx_std_17)
