cmake_minimum_required(VERSION 3.20)

project(sensor_domain_host_tests LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

enable_testing()

add_library(sensor_domain
    ../../../sensor_drivers/src/capture_tick_converter.cpp
    ../../../sensor_harness/src/sensor_harness.cpp
    ../../src/domain/sensor_data_store.cpp
    ../../src/domain/sensor_health_service.cpp
    ../../src/domain/fake_sources.cpp
    ../../src/domain/types.cpp
    ../../src/sensors/analog_transfer.cpp
    ../../src/sensors/tps_sensor.cpp
    ../../src/sensors/thermal_sensors.cpp
    ../../src/sensors/digital_inputs.cpp
    ../../src/sensors/pickup_sensor.cpp
    ../../src/sensors/knock_sensor.cpp
    ../../src/services/sensor_services.cpp
)

target_include_directories(sensor_domain PUBLIC ../../include)
target_include_directories(sensor_domain PUBLIC ../../../sensor_harness/include)
target_include_directories(sensor_domain PUBLIC ../../../sensor_drivers/include)

add_executable(sensor_domain_tests
    ../../../sensor_drivers/include/sensor_drivers/adc_sample_source_logic.hpp
    ../../../sensor_drivers/include/sensor_drivers/fixed_raw_queue.hpp
    ../../../sensor_drivers/include/sensor_drivers/mcpwm_capture_logic.hpp
    sensor_domain_tests.cpp
)

target_link_libraries(sensor_domain_tests PRIVATE sensor_domain)

add_test(NAME sensor_domain_tests COMMAND sensor_domain_tests)
