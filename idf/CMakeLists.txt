# The following five lines of boilerplate have to be in your project's
# CMakeLists in this exact order for cmake to work correctly
cmake_minimum_required(VERSION 3.16)

include($ENV{IDF_PATH}/tools/cmake/project.cmake)

# Derive firmware version from git describe (e.g. "v1.2.3-4-gabcdef0").
# Falls back to "0.0.0-unknown" when git is not available or the repo has no tags.
find_package(Git QUIET)
if(GIT_FOUND)
    execute_process(
        COMMAND ${GIT_EXECUTABLE} describe --tags --always --dirty
        WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
        OUTPUT_VARIABLE GIT_DESCRIBE
        OUTPUT_STRIP_TRAILING_WHITESPACE
        ERROR_QUIET
    )
endif()
if(NOT GIT_DESCRIBE OR GIT_DESCRIBE STREQUAL "")
    set(GIT_DESCRIBE "0.0.0-unknown")
endif()
set(PROJECT_VER "${GIT_DESCRIBE}")

project(idf)
