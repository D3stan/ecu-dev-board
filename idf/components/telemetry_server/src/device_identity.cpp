#include "telemetry_server/device_identity.hpp"

#include <cstdio>
#include <cstring>
#include <mutex>

#include "esp_chip_info.h"
#include "esp_efuse.h"
#include "esp_flash.h"
#include "esp_log.h"
#include "sdkconfig.h"

namespace ecu::telemetry_server {

namespace {

constexpr char kTag[] = "device_identity";

const char *chip_model_string(esp_chip_model_t model) {
    switch (model) {
    case CHIP_ESP32:   return "ESP32";
    case CHIP_ESP32S2: return "ESP32-S2";
    case CHIP_ESP32S3: return "ESP32-S3";
    case CHIP_ESP32C3: return "ESP32-C3";
    case CHIP_ESP32H2: return "ESP32-H2";
    case CHIP_ESP32C2: return "ESP32-C2";
    default:           return "ESP32-Unknown";
    }
}

} // namespace

DeviceIdentity get_device_identity() {
    static DeviceIdentity cached{};
    static bool           ready = false;
    static std::mutex     mu;

    std::lock_guard<std::mutex> lock(mu);
    if (ready) return cached;

    // HWID from eFuse MAC
    uint8_t mac[6] = {};
    const esp_err_t mac_err = esp_efuse_mac_get_default(mac);
    if (mac_err == ESP_OK) {
        std::snprintf(cached.hwid, sizeof(cached.hwid),
                      "esp32s3-%02x%02x%02x%02x%02x%02x",
                      mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
    } else {
        ESP_LOGW(kTag, "failed to read eFuse MAC: %s", esp_err_to_name(mac_err));
        std::strncpy(cached.hwid, "esp32s3-unknown", sizeof(cached.hwid) - 1);
    }

    // Chip model
    esp_chip_info_t chip{};
    esp_chip_info(&chip);
    cached.chip_model       = chip_model_string(chip.model);
    cached.hardware_revision = CONFIG_DIGITAL_TWIN_HARDWARE_REVISION;

    // Flash size
    uint32_t flash_size = 0;
    if (esp_flash_get_size(nullptr, &flash_size) != ESP_OK) {
        ESP_LOGW(kTag, "failed to read flash size");
    }
    cached.flash_size_bytes = flash_size;

    ready = true;
    ESP_LOGI(kTag, "hwid=%s chip=%s flash=%lu B",
             cached.hwid, cached.chip_model,
             static_cast<unsigned long>(cached.flash_size_bytes));
    return cached;
}

} // namespace ecu::telemetry_server
