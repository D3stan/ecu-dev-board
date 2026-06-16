cmake_minimum_required(VERSION 3.20)

project(telemetry_host_tests LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

enable_testing()

add_library(telemetry_domain
    ../../src/sensor_telemetry_collector.cpp
    ../../../sensors/src/domain/sensor_data_store.cpp
    ../../../sensors/src/domain/types.cpp
)

target_include_directories(telemetry_domain PUBLIC ../../include)
target_include_directories(telemetry_domain PUBLIC ../../../sensors/include)

add_executable(telemetry_tests
    telemetry_tests.cpp
)

target_link_libraries(telemetry_tests PRIVATE telemetry_domain)

add_test(NAME telemetry_tests COMMAND telemetry_tests)
