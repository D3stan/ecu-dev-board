idf_component_register(
    SRCS
        "test-bench.c"
        "engine_control.c"
        "ignition_map.c"
        "status_led.c"
        "telemetry_bridge.c"
        "tps.c"
    INCLUDE_DIRS "."
    PRIV_REQUIRES
        esp_adc
        esp_driver_gpio
        esp_driver_gptimer
        esp_timer
        telemetry
        telemetry_server
)
