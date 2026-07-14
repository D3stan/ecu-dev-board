#include "runtime_internal.hpp"

#include <cstring>

#include "cJSON.h"
#include "esp_log.h"
#include "nvs.h"

namespace ecu::telemetry_server {
namespace {

constexpr char kTag[] = "telemetry_server";
constexpr char kNvsNamespace[] = "digital_twin";
constexpr char kAutoRecordingKey[] = "auto_rec";

bool is_json_whitespace(char value) {
    return value == ' ' || value == '\t' || value == '\n' || value == '\r';
}

} // namespace

std::optional<bool> parse_recording_config_set(const std::uint8_t *data,
                                               std::size_t size) {
    if (data == nullptr || size == 0) {
        return std::nullopt;
    }

    const char *begin = reinterpret_cast<const char *>(data);
    const char *parse_end = nullptr;
    cJSON *root =
        cJSON_ParseWithLengthOpts(begin, size, &parse_end, false);
    if (root == nullptr) {
        return std::nullopt;
    }

    std::optional<bool> result{};
    const char *end = begin + size;
    bool trailing_valid = parse_end != nullptr &&
                          parse_end >= begin &&
                          parse_end <= end;
    for (const char *cursor = parse_end;
         trailing_valid && cursor < end;
         ++cursor) {
        trailing_valid = is_json_whitespace(*cursor);
    }

    if (trailing_valid && cJSON_IsObject(root)) {
        const cJSON *type =
            cJSON_GetObjectItemCaseSensitive(root, "type");
        const cJSON *auto_enabled =
            cJSON_GetObjectItemCaseSensitive(root, "auto_enabled");
        if (cJSON_IsString(type) && type->valuestring != nullptr &&
            std::strcmp(type->valuestring, "recording_config_set") == 0 &&
            cJSON_IsBool(auto_enabled)) {
            result = cJSON_IsTrue(auto_enabled);
        }
    }

    cJSON_Delete(root);
    return result;
}

bool RecordingSettingsStore::load_auto_enabled(bool fallback) const {
    nvs_handle_t handle = 0;
    esp_err_t error = nvs_open(kNvsNamespace, NVS_READONLY, &handle);
    if (error == ESP_ERR_NVS_NOT_FOUND) {
        return fallback;
    }
    if (error != ESP_OK) {
        ESP_LOGW(kTag,
                 "failed to open recording settings: %s",
                 esp_err_to_name(error));
        return fallback;
    }

    std::uint8_t stored = fallback ? 1U : 0U;
    error = nvs_get_u8(handle, kAutoRecordingKey, &stored);
    nvs_close(handle);
    if (error == ESP_ERR_NVS_NOT_FOUND) {
        return fallback;
    }
    if (error != ESP_OK) {
        ESP_LOGW(kTag,
                 "failed to read recording settings: %s",
                 esp_err_to_name(error));
        return fallback;
    }
    return stored != 0;
}

esp_err_t RecordingSettingsStore::save_auto_enabled(bool enabled) const {
    nvs_handle_t handle = 0;
    esp_err_t error = nvs_open(kNvsNamespace, NVS_READWRITE, &handle);
    if (error != ESP_OK) {
        ESP_LOGW(kTag,
                 "failed to open recording settings for write: %s",
                 esp_err_to_name(error));
        return error;
    }

    error = nvs_set_u8(handle, kAutoRecordingKey, enabled ? 1U : 0U);
    if (error == ESP_OK) {
        error = nvs_commit(handle);
    }
    nvs_close(handle);
    if (error != ESP_OK) {
        ESP_LOGW(kTag,
                 "failed to save recording settings: %s",
                 esp_err_to_name(error));
    }
    return error;
}

} // namespace ecu::telemetry_server
