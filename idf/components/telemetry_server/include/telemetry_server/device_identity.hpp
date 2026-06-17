#pragma once

#include <cstdint>

namespace ecu::telemetry_server {

/// Stable hardware identity derived from eFuse MAC and chip info.
struct DeviceIdentity {
    char     hwid[32];             ///< "esp32s3-<12 lower-hex MAC bytes>"
    const char *hardware_revision; ///< CONFIG_DIGITAL_TWIN_HARDWARE_REVISION
    const char *chip_model;        ///< from esp_chip_info(), e.g. "ESP32-S3"
    uint32_t    flash_size_bytes;  ///< from esp_flash_get_size()
};

/// Returns the device identity. Thread-safe after first call (result is cached).
DeviceIdentity get_device_identity();

} // namespace ecu::telemetry_server
