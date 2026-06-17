idf_component_register(
    SRCS
        "src/static_file_resolver.cpp"
        "src/telemetry_json_serializer.cpp"
        "src/telemetry_pump.cpp"
        "src/sensor_telemetry_batch_source.cpp"
        "src/telemetry_server.cpp"
    INCLUDE_DIRS "include"
    REQUIRES telemetry sensors esp_event esp_http_server esp_netif esp_timer esp_wifi nvs_flash spiffs
)

target_compile_features(${COMPONENT_LIB} PUBLIC cxx_std_17)

set(WEB_ASSET_DIR "${CMAKE_SOURCE_DIR}/data")
if(EXISTS "${WEB_ASSET_DIR}/index.html")
    spiffs_create_partition_image(www "${WEB_ASSET_DIR}" FLASH_IN_PROJECT)
else()
    message(FATAL_ERROR "Missing ${WEB_ASSET_DIR}/index.html. Run the web UI build before building firmware.")
endif()
