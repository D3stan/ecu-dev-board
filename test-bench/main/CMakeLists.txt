idf_component_register(
    SRCS "test-bench.c"
    INCLUDE_DIRS "."
    PRIV_REQUIRES esp_driver_gpio esp_driver_rmt
)
