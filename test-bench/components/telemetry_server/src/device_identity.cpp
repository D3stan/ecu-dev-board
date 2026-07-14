#include "runtime_internal.hpp"

#include <cstdio>
#include <cstring>

#include "esp_app_desc.h"
#include "esp_flash.h"
#include "esp_log.h"
#include "esp_mac.h"

namespace ecu::telemetry_server {
namespace {

constexpr char kTag[] = "telemetry_server";

template <std::size_t Capacity>
void copy_string(std::array<char, Capacity> &destination,
                 const char *source) {
    destination.fill('\0');
    if (source != nullptr) {
        std::strncpy(destination.data(), source, Capacity - 1);
    }
}

} // namespace

RuntimeDeviceIdentity read_device_identity(
    const telemetry_server_config_t &config) {
    RuntimeDeviceIdentity identity{};
    copy_string(identity.hwid, "esp32s2-unknown");
    copy_string(identity.hardware_revision, config.hardware_revision);
    copy_string(identity.chip_model, "ESP32-S2");

    std::uint8_t mac[6]{};
    const esp_err_t mac_error = esp_efuse_mac_get_default(mac);
    if (mac_error == ESP_OK) {
        (void)std::snprintf(identity.hwid.data(),
                            identity.hwid.size(),
                            "esp32s2-%02x%02x%02x%02x%02x%02x",
                            static_cast<unsigned>(mac[0]),
                            static_cast<unsigned>(mac[1]),
                            static_cast<unsigned>(mac[2]),
                            static_cast<unsigned>(mac[3]),
                            static_cast<unsigned>(mac[4]),
                            static_cast<unsigned>(mac[5]));
        identity.hwid.back() = '\0';
    } else {
        ESP_LOGW(kTag,
                 "failed to read eFuse MAC: %s",
                 esp_err_to_name(mac_error));
    }

    std::uint32_t flash_size = 0;
    const esp_err_t flash_error = esp_flash_get_size(nullptr, &flash_size);
    if (flash_error == ESP_OK) {
        identity.flash_size_bytes = flash_size;
    } else {
        ESP_LOGW(kTag,
                 "failed to read flash size: %s",
                 esp_err_to_name(flash_error));
    }

    const esp_app_desc_t *description = esp_app_get_description();
    if (description != nullptr) {
        copy_string(identity.firmware_version, description->version);
    }
    return identity;
}

} // namespace ecu::telemetry_server
