#include "runtime_internal.hpp"

#include <cstring>

#include "esp_check.h"
#include "esp_log.h"
#include "esp_wifi.h"
#include "nvs_flash.h"

namespace ecu::telemetry_server {
namespace {

constexpr char kTag[] = "telemetry_server";

template <std::size_t N>
void copy_wifi_field(std::uint8_t (&destination)[N], const char *source) {
    std::memset(destination, 0, N);
    if (source != nullptr) {
        std::strncpy(reinterpret_cast<char *>(destination), source, N - 1);
    }
}

} // namespace

WifiStation::~WifiStation() {
    if (ip_handler_ != nullptr) {
        (void)esp_event_handler_instance_unregister(IP_EVENT,
                                                    IP_EVENT_STA_GOT_IP,
                                                    ip_handler_);
        ip_handler_ = nullptr;
    }
    if (wifi_handler_ != nullptr) {
        (void)esp_event_handler_instance_unregister(WIFI_EVENT,
                                                    ESP_EVENT_ANY_ID,
                                                    wifi_handler_);
        wifi_handler_ = nullptr;
    }
    if (wifi_started_) {
        (void)esp_wifi_stop();
        wifi_started_ = false;
    }
    if (wifi_initialized_) {
        (void)esp_wifi_deinit();
        wifi_initialized_ = false;
    }
    if (sta_netif_ != nullptr) {
        esp_netif_destroy_default_wifi(sta_netif_);
        sta_netif_ = nullptr;
    }
}

esp_err_t WifiStation::start(const telemetry_server_config_t &config) {
    if (config.sta_ssid == nullptr || config.sta_ssid[0] == '\0') {
        ESP_LOGE(kTag, "Wi-Fi SSID is empty");
        return ESP_ERR_INVALID_ARG;
    }

    esp_err_t error = nvs_flash_init();
    if (error == ESP_ERR_NVS_NO_FREE_PAGES ||
        error == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_RETURN_ON_ERROR(nvs_flash_erase(), kTag, "failed to erase NVS");
        error = nvs_flash_init();
    }
    ESP_RETURN_ON_ERROR(error, kTag, "failed to initialize NVS");
    ESP_RETURN_ON_ERROR(esp_netif_init(), kTag, "failed to initialize netif");

    error = esp_event_loop_create_default();
    if (error != ESP_OK && error != ESP_ERR_INVALID_STATE) {
        ESP_LOGE(kTag,
                 "failed to create default event loop: %s",
                 esp_err_to_name(error));
        return error;
    }

    sta_netif_ = esp_netif_create_default_wifi_sta();
    if (sta_netif_ == nullptr) {
        ESP_LOGE(kTag, "failed to create Wi-Fi STA netif");
        return ESP_FAIL;
    }

    wifi_init_config_t initialization = WIFI_INIT_CONFIG_DEFAULT();
    error = esp_wifi_init(&initialization);
    if (error != ESP_OK) {
        ESP_LOGE(kTag, "failed to initialize Wi-Fi: %s", esp_err_to_name(error));
        return error;
    }
    wifi_initialized_ = true;

    ESP_RETURN_ON_ERROR(esp_wifi_set_storage(WIFI_STORAGE_RAM),
                        kTag,
                        "failed to set Wi-Fi storage");
    ESP_RETURN_ON_ERROR(
        esp_event_handler_instance_register(WIFI_EVENT,
                                            ESP_EVENT_ANY_ID,
                                            &WifiStation::event_handler,
                                            this,
                                            &wifi_handler_),
        kTag,
        "failed to register Wi-Fi event handler");
    ESP_RETURN_ON_ERROR(
        esp_event_handler_instance_register(IP_EVENT,
                                            IP_EVENT_STA_GOT_IP,
                                            &WifiStation::event_handler,
                                            this,
                                            &ip_handler_),
        kTag,
        "failed to register IP event handler");

    wifi_config_t station{};
    copy_wifi_field(station.sta.ssid, config.sta_ssid);
    copy_wifi_field(station.sta.password, config.sta_password);
    station.sta.threshold.authmode =
        config.sta_password != nullptr && config.sta_password[0] != '\0'
            ? WIFI_AUTH_WPA2_PSK
            : WIFI_AUTH_OPEN;

    ESP_RETURN_ON_ERROR(esp_wifi_set_mode(WIFI_MODE_STA),
                        kTag,
                        "failed to set Wi-Fi mode");
    ESP_RETURN_ON_ERROR(esp_wifi_set_config(WIFI_IF_STA, &station),
                        kTag,
                        "failed to set Wi-Fi station configuration");

    error = esp_wifi_start();
    if (error != ESP_OK) {
        ESP_LOGE(kTag, "failed to start Wi-Fi: %s", esp_err_to_name(error));
        return error;
    }
    wifi_started_ = true;
    ESP_LOGI(kTag, "Wi-Fi station started");
    return ESP_OK;
}

void WifiStation::event_handler(void *arg,
                                esp_event_base_t base,
                                std::int32_t id,
                                void *data) {
    static_cast<WifiStation *>(arg)->handle_event(base, id, data);
}

void WifiStation::handle_event(esp_event_base_t base,
                               std::int32_t id,
                               void *data) {
    if (base == WIFI_EVENT && id == WIFI_EVENT_STA_START) {
        ESP_LOGI(kTag, "Wi-Fi station connecting");
        (void)esp_wifi_connect();
        return;
    }
    if (base == WIFI_EVENT && id == WIFI_EVENT_STA_DISCONNECTED) {
        ESP_LOGW(kTag, "Wi-Fi station disconnected; reconnecting");
        (void)esp_wifi_connect();
        return;
    }
    if (base == IP_EVENT && id == IP_EVENT_STA_GOT_IP) {
        const auto *event = static_cast<const ip_event_got_ip_t *>(data);
        ESP_LOGI(kTag,
                 "Wi-Fi station connected, IP=" IPSTR,
                 IP2STR(&event->ip_info.ip));
    }
}

} // namespace ecu::telemetry_server
