#include "telemetry_server/telemetry_server.hpp"

#include <cstring>
#include <mutex>
#include <new>
#include <string>
#include <vector>

#include "esp_check.h"
#include "esp_event.h"
#include "esp_http_server.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_timer.h"
#include "esp_wifi.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "nvs_flash.h"
#include "sdkconfig.h"
#include "telemetry_server/telemetry_json_serializer.hpp"
#include "telemetry_server/telemetry_pump.hpp"

#ifndef PRO_CPU_NUM
#define PRO_CPU_NUM 0
#endif

namespace ecu::telemetry_server {

namespace {

constexpr char kTag[] = "telemetry_server";

template <std::size_t N>
void copy_wifi_field(std::uint8_t (&destination)[N], const char *source) {
    std::memset(destination, 0, N);
    if (source == nullptr) {
        return;
    }
    std::strncpy(reinterpret_cast<char *>(destination), source, N - 1);
}

class WifiStation {
public:
    esp_err_t start(const TelemetryServerConfig &config) {
        if (config.sta_ssid == nullptr || config.sta_ssid[0] == '\0') {
            ESP_LOGE(kTag, "WiFi SSID is empty");
            return ESP_ERR_INVALID_ARG;
        }

        esp_err_t err = nvs_flash_init();
        if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
            ESP_RETURN_ON_ERROR(nvs_flash_erase(), kTag, "failed to erase NVS");
            err = nvs_flash_init();
        }
        ESP_RETURN_ON_ERROR(err, kTag, "failed to init NVS");

        ESP_RETURN_ON_ERROR(esp_netif_init(), kTag, "failed to init netif");

        err = esp_event_loop_create_default();
        if (err != ESP_OK && err != ESP_ERR_INVALID_STATE) {
            ESP_LOGE(kTag, "failed to create default event loop: %s", esp_err_to_name(err));
            return err;
        }

        if (sta_netif_ == nullptr) {
            sta_netif_ = esp_netif_create_default_wifi_sta();
            if (sta_netif_ == nullptr) {
                ESP_LOGE(kTag, "failed to create WiFi STA netif");
                return ESP_FAIL;
            }
        }

        wifi_init_config_t init_config = WIFI_INIT_CONFIG_DEFAULT();
        ESP_RETURN_ON_ERROR(esp_wifi_init(&init_config), kTag, "failed to init WiFi");
        ESP_RETURN_ON_ERROR(esp_wifi_set_storage(WIFI_STORAGE_RAM), kTag, "failed to set WiFi storage");

        ESP_RETURN_ON_ERROR(esp_event_handler_instance_register(WIFI_EVENT,
                                                               ESP_EVENT_ANY_ID,
                                                               &WifiStation::event_handler,
                                                               this,
                                                               &wifi_event_handler_),
                            kTag,
                            "failed to register WiFi event handler");
        ESP_RETURN_ON_ERROR(esp_event_handler_instance_register(IP_EVENT,
                                                               IP_EVENT_STA_GOT_IP,
                                                               &WifiStation::event_handler,
                                                               this,
                                                               &ip_event_handler_),
                            kTag,
                            "failed to register IP event handler");

        wifi_config_t wifi_config{};
        copy_wifi_field(wifi_config.sta.ssid, config.sta_ssid);
        copy_wifi_field(wifi_config.sta.password, config.sta_password);
        wifi_config.sta.threshold.authmode = config.sta_password != nullptr && config.sta_password[0] != '\0'
                                                 ? WIFI_AUTH_WPA2_PSK
                                                 : WIFI_AUTH_OPEN;

        ESP_RETURN_ON_ERROR(esp_wifi_set_mode(WIFI_MODE_STA), kTag, "failed to set WiFi mode");
        ESP_RETURN_ON_ERROR(esp_wifi_set_config(WIFI_IF_STA, &wifi_config), kTag, "failed to set WiFi config");
        ESP_RETURN_ON_ERROR(esp_wifi_start(), kTag, "failed to start WiFi");
        return ESP_OK;
    }

private:
    static void event_handler(void *arg, esp_event_base_t event_base, std::int32_t event_id, void *event_data) {
        auto *self = static_cast<WifiStation *>(arg);
        self->handle_event(event_base, event_id, event_data);
    }

    void handle_event(esp_event_base_t event_base, std::int32_t event_id, void *event_data) {
        if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START) {
            (void)esp_wifi_connect();
            return;
        }

        if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED) {
            ESP_LOGW(kTag, "WiFi disconnected, reconnecting");
            (void)esp_wifi_connect();
            return;
        }

        if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
            const auto *event = static_cast<const ip_event_got_ip_t *>(event_data);
            ESP_LOGI(kTag, "WiFi connected, IP=" IPSTR, IP2STR(&event->ip_info.ip));
        }
    }

    esp_netif_t *sta_netif_{nullptr};
    esp_event_handler_instance_t wifi_event_handler_{nullptr};
    esp_event_handler_instance_t ip_event_handler_{nullptr};
};

class EspWebSocketTransport final : public ITelemetryTransport {
public:
    bool connected() const override {
        std::lock_guard<std::mutex> lock(mutex_);
        return active_;
    }

    bool ready() const override {
        std::lock_guard<std::mutex> lock(mutex_);
        return active_ && !send_in_flight_;
    }

    bool send_text(std::string_view payload) override {
        PendingSend *pending = nullptr;
        {
            std::lock_guard<std::mutex> lock(mutex_);
            if (!active_ || send_in_flight_) {
                ++counters_.dropped_frames;
                return false;
            }

            pending = new (std::nothrow) PendingSend{this, handle_, socket_, std::string(payload)};
            if (pending == nullptr) {
                ++counters_.send_errors;
                return false;
            }

            send_in_flight_ = true;
        }

        httpd_ws_frame_t frame{};
        frame.type = HTTPD_WS_TYPE_TEXT;
        frame.payload = reinterpret_cast<std::uint8_t *>(pending->payload.data());
        frame.len = pending->payload.size();

        const esp_err_t err = httpd_ws_send_data_async(pending->handle,
                                                       pending->socket,
                                                       &frame,
                                                       &EspWebSocketTransport::send_complete,
                                                       pending);
        if (err != ESP_OK) {
            finish_send(pending->socket, err);
            delete pending;
            return false;
        }

        return true;
    }

    void note_dropped_frame() override {
        std::lock_guard<std::mutex> lock(mutex_);
        ++counters_.dropped_frames;
    }

    TelemetryTransportCounters counters() const override {
        std::lock_guard<std::mutex> lock(mutex_);
        return counters_;
    }

    void accept(httpd_handle_t handle, int socket) {
        std::lock_guard<std::mutex> lock(mutex_);
        if (active_ && handle_ != nullptr && socket_ != socket) {
            (void)httpd_sess_trigger_close(handle_, socket_);
        }
        handle_ = handle;
        socket_ = socket;
        active_ = true;
        send_in_flight_ = false;
        ESP_LOGI(kTag, "WebSocket client connected fd=%d", socket_);
    }

    void close(int socket) {
        std::lock_guard<std::mutex> lock(mutex_);
        if (active_ && socket_ == socket) {
            active_ = false;
            send_in_flight_ = false;
            ESP_LOGI(kTag, "WebSocket client closed fd=%d", socket);
        }
    }

private:
    struct PendingSend {
        EspWebSocketTransport *owner;
        httpd_handle_t handle;
        int socket;
        std::string payload;
    };

    static void send_complete(esp_err_t err, int socket, void *arg) {
        auto *pending = static_cast<PendingSend *>(arg);
        pending->owner->finish_send(socket, err);
        delete pending;
    }

    void finish_send(int socket, esp_err_t err) {
        std::lock_guard<std::mutex> lock(mutex_);
        if (err == ESP_OK) {
            ++counters_.sent_frames;
        } else {
            ++counters_.send_errors;
            if (active_ && socket_ == socket) {
                active_ = false;
            }
        }

        if (socket_ == socket) {
            send_in_flight_ = false;
        }
    }

    mutable std::mutex mutex_{};
    httpd_handle_t handle_{nullptr};
    int socket_{-1};
    bool active_{false};
    bool send_in_flight_{false};
    TelemetryTransportCounters counters_{};
};

class TelemetryServerApplication {
public:
    TelemetryServerApplication(ecu::sensors::SensorDataStore &store, TelemetryServerConfig config)
        : config_(config),
          source_(store, make_collector_config(config)),
          serializer_(make_serializer_config(config)),
          pump_(source_, serializer_, transport_) {}

    esp_err_t start() {
        ESP_RETURN_ON_ERROR(wifi_.start(config_), kTag, "failed to start WiFi station");
        ESP_RETURN_ON_ERROR(start_http_server(), kTag, "failed to start HTTP server");
        ESP_RETURN_ON_ERROR(start_pump_task(), kTag, "failed to start telemetry pump task");
        return ESP_OK;
    }

private:
    static ecu::telemetry::SensorTelemetryCollectorConfig make_collector_config(const TelemetryServerConfig &config) {
        ecu::telemetry::SensorTelemetryCollectorConfig collector_config{};
        collector_config.max_events_per_batch = config.max_events_per_batch;
        return collector_config;
    }

    static TelemetryJsonSerializerConfig make_serializer_config(const TelemetryServerConfig &config) {
        TelemetryJsonSerializerConfig serializer_config{};
        serializer_config.state_hz = config.state_hz;
        serializer_config.events_per_batch = config.max_events_per_batch;
        return serializer_config;
    }

    esp_err_t start_http_server() {
        httpd_config_t http_config = HTTPD_DEFAULT_CONFIG();
        http_config.server_port = config_.http_port;

        ESP_RETURN_ON_ERROR(httpd_start(&server_, &http_config), kTag, "failed to start HTTP server");

        httpd_uri_t ws_uri{};
        ws_uri.uri = config_.ws_path;
        ws_uri.method = HTTP_GET;
        ws_uri.handler = &TelemetryServerApplication::websocket_handler;
        ws_uri.user_ctx = this;
        ws_uri.is_websocket = true;
        ws_uri.handle_ws_control_frames = true;

        return httpd_register_uri_handler(server_, &ws_uri);
    }

    esp_err_t start_pump_task() {
        const BaseType_t created = xTaskCreatePinnedToCore(&TelemetryServerApplication::pump_task,
                                                           "telemetry_server",
                                                           config_.task_stack_bytes,
                                                           this,
                                                           tskIDLE_PRIORITY + config_.task_priority_offset,
                                                           &task_,
                                                           PRO_CPU_NUM);
        return created == pdPASS ? ESP_OK : ESP_ERR_NO_MEM;
    }

    static esp_err_t websocket_handler(httpd_req_t *req) {
        auto *self = static_cast<TelemetryServerApplication *>(req->user_ctx);
        const int socket = httpd_req_to_sockfd(req);

        if (req->method == HTTP_GET) {
            self->transport_.accept(req->handle, socket);
            const auto capabilities = self->serializer_.serialize_capabilities();
            (void)self->transport_.send_text(capabilities);
            return ESP_OK;
        }

        httpd_ws_frame_t frame{};
        esp_err_t err = httpd_ws_recv_frame(req, &frame, 0);
        if (err != ESP_OK) {
            self->transport_.close(socket);
            return err;
        }

        std::vector<std::uint8_t> payload(frame.len);
        if (!payload.empty()) {
            frame.payload = payload.data();
            err = httpd_ws_recv_frame(req, &frame, frame.len);
            if (err != ESP_OK) {
                self->transport_.close(socket);
                return err;
            }
        }

        if (frame.type == HTTPD_WS_TYPE_PING) {
            frame.type = HTTPD_WS_TYPE_PONG;
            return httpd_ws_send_frame(req, &frame);
        }

        if (frame.type == HTTPD_WS_TYPE_CLOSE) {
            self->transport_.close(socket);
            frame.len = 0;
            frame.payload = nullptr;
            return httpd_ws_send_frame(req, &frame);
        }
        return ESP_OK;
    }

    static void pump_task(void *arg) {
        auto *self = static_cast<TelemetryServerApplication *>(arg);
        const TickType_t period_ticks = pdMS_TO_TICKS(1000u / self->config_.state_hz);
        TickType_t last_wake = xTaskGetTickCount();

        while (true) {
            vTaskDelayUntil(&last_wake, period_ticks);
            const auto now = static_cast<ecu::sensors::TimestampUs>(esp_timer_get_time());
            (void)self->pump_.tick(now);
        }
    }

    TelemetryServerConfig config_{};
    WifiStation wifi_{};
    SensorTelemetryBatchSource source_;
    TelemetryJsonSerializer serializer_;
    EspWebSocketTransport transport_{};
    TelemetryPump pump_;
    httpd_handle_t server_{nullptr};
    TaskHandle_t task_{nullptr};
};

TelemetryServerConfig with_kconfig_defaults(TelemetryServerConfig config) {
    if (config.sta_ssid == nullptr || config.sta_ssid[0] == '\0') {
        config.sta_ssid = CONFIG_TELEMETRY_SERVER_STA_SSID;
    }
    if (config.sta_password == nullptr || config.sta_password[0] == '\0') {
        config.sta_password = CONFIG_TELEMETRY_SERVER_STA_PASSWORD;
    }
    if (config.http_port == 0) {
        config.http_port = CONFIG_TELEMETRY_SERVER_HTTP_PORT;
    }
    if (config.state_hz == 0) {
        config.state_hz = CONFIG_TELEMETRY_SERVER_STATE_HZ;
    }
    if (config.task_stack_bytes == 0) {
        config.task_stack_bytes = CONFIG_TELEMETRY_SERVER_TASK_STACK_BYTES;
    }
    if (config.task_priority_offset == 0) {
        config.task_priority_offset = CONFIG_TELEMETRY_SERVER_TASK_PRIORITY;
    }
    return config;
}

} // namespace

esp_err_t start(ecu::sensors::SensorDataStore &store, const TelemetryServerConfig &config) {
    static TelemetryServerApplication *application = nullptr;
    if (application != nullptr) {
        return ESP_ERR_INVALID_STATE;
    }

    auto *created = new (std::nothrow) TelemetryServerApplication(store, with_kconfig_defaults(config));
    if (created == nullptr) {
        return ESP_ERR_NO_MEM;
    }

    const esp_err_t err = created->start();
    if (err != ESP_OK) {
        delete created;
        return err;
    }

    application = created;
    return ESP_OK;
}

} // namespace ecu::telemetry_server
