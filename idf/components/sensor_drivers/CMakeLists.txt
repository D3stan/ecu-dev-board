idf_component_register(
    SRCS
        "src/adc_sample_source.cpp"
        "src/capture_tick_converter.cpp"
        "src/esp_time_source.cpp"
        "src/gpio_input_source.cpp"
        "src/max31856_spi_source.cpp"
        "src/mcpwm_edge_capture_source.cpp"
        "src/tpic8101_window_device.cpp"
    INCLUDE_DIRS "include"
    REQUIRES sensors driver esp_timer esp_adc esp_driver_mcpwm
)

target_compile_features(${COMPONENT_LIB} PUBLIC cxx_std_17)
