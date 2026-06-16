cmake_minimum_required(VERSION 3.20)

project(telemetry_server_host_tests LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

enable_testing()

add_library(telemetry_server_host
    ../../src/telemetry_json_serializer.cpp
    ../../src/telemetry_pump.cpp
)

target_include_directories(telemetry_server_host PUBLIC ../../include)
target_include_directories(telemetry_server_host PUBLIC ../../../telemetry/include)
target_include_directories(telemetry_server_host PUBLIC ../../../sensors/include)

add_executable(telemetry_server_tests
    telemetry_server_tests.cpp
)

target_link_libraries(telemetry_server_tests PRIVATE telemetry_server_host)

add_test(NAME telemetry_server_tests COMMAND telemetry_server_tests)
