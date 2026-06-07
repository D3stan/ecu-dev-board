idf_component_register(SRCS "main.c"
                            "sim_io_outputs.c"
                            "sim_io_capture.c"
                            "sim_net.c"
                    INCLUDE_DIRS "."
                    REQUIRES driver esp_http_server esp_timer esp_adc json nvs_flash esp_wifi)
