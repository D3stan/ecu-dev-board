idf_component_register(
    SRCS
        "src/telemetry_json_serializer.cpp"
        "src/telemetry_pump.cpp"
        "src/sensor_telemetry_batch_source.cpp"
        "src/telemetry_server.cpp"
    INCLUDE_DIRS "include"
    REQUIRES telemetry sensors esp_event esp_http_server esp_netif esp_timer esp_wifi nvs_flash
)

target_compile_features(${COMPONENT_LIB} PUBLIC cxx_std_17)
