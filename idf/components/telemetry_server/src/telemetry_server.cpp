#include "telemetry_server/telemetry_server.hpp"

#include <cstring>
#include <cstdio>
#include <array>
#include <cstdlib>
#include <mutex>
#include <new>
#include <string>
#include <string_view>
#include <vector>

#include "cJSON.h"
#include "esp_check.h"
#include "esp_event.h"
#include "esp_heap_caps.h"
#include "esp_http_server.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_random.h"
#include "esp_spiffs.h"
#include "esp_timer.h"
#include "esp_wifi.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/task.h"
#include "nvs_flash.h"
#include "nvs.h"
#include "sdkconfig.h"
#include "telemetry_server/device_identity.hpp"
#include "telemetry_server/recording_state.hpp"
#include "telemetry_server/retransmit_buffer.hpp"
#include "telemetry_server/static_file_resolver.hpp"
#include "telemetry_server/telemetry_json_serializer.hpp"
#include "telemetry_server/telemetry_pump.hpp"

#include <sys/stat.h>

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

class RuntimeDiagnostics {
public:
    explicit RuntimeDiagnostics(bool heap_checks) : heap_checks_(heap_checks) {}

    static unsigned stack_free_bytes() {
        return static_cast<unsigned>(uxTaskGetStackHighWaterMark2(nullptr));
    }

    void check_heap(const char *location) const {
        if (!heap_checks_) {
            return;
        }

        if (!heap_caps_check_integrity_all(true)) {
            ESP_LOGE(kTag, "heap corruption detected near %s", location);
            std::abort();
        }
    }

private:
    bool heap_checks_{false};
};

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

class StaticFileSystemMount {
public:
    esp_err_t mount(const TelemetryServerConfig &config) {
        esp_vfs_spiffs_conf_t spiffs_config{};
        spiffs_config.base_path = config.static_base_path;
        spiffs_config.partition_label = config.static_partition_label;
        spiffs_config.max_files = config.static_max_open_files;
        spiffs_config.format_if_mount_failed = false;

        const esp_err_t err = esp_vfs_spiffs_register(&spiffs_config);
        if (err != ESP_OK) {
            if (err == ESP_ERR_NOT_FOUND) {
                ESP_LOGE(kTag, "SPIFFS partition '%s' not found", config.static_partition_label);
            } else if (err == ESP_FAIL) {
                ESP_LOGE(kTag, "failed to mount SPIFFS partition '%s'", config.static_partition_label);
            } else {
                ESP_LOGE(kTag, "failed to initialize SPIFFS '%s': %s",
                         config.static_partition_label,
                         esp_err_to_name(err));
            }
            return err;
        }

        mounted_ = true;
        size_t total = 0;
        size_t used = 0;
        const esp_err_t info_err = esp_spiffs_info(config.static_partition_label, &total, &used);
        if (info_err == ESP_OK) {
            ESP_LOGI(kTag, "SPIFFS '%s' mounted at %s, used=%u total=%u",
                     config.static_partition_label,
                     config.static_base_path,
                     static_cast<unsigned>(used),
                     static_cast<unsigned>(total));
        } else {
            ESP_LOGW(kTag, "SPIFFS '%s' mounted, info failed: %s",
                     config.static_partition_label,
                     esp_err_to_name(info_err));
        }
        return ESP_OK;
    }

    bool mounted() const { return mounted_; }

private:
    bool mounted_{false};
};

class PosixStaticFileCatalog final : public IStaticFileCatalog {
public:
    bool exists(std::string_view path) const override {
        std::string path_string(path);
        struct stat file_stat {};
        return stat(path_string.c_str(), &file_stat) == 0 && S_ISREG(file_stat.st_mode);
    }
};

class StaticFileHandler {
public:
    StaticFileHandler(const char *base_path,
                      const IStaticFileCatalog &catalog,
                      const RuntimeDiagnostics &diagnostics,
                      bool close_connection)
        : resolver_(base_path != nullptr ? base_path : "/www", catalog),
          diagnostics_(diagnostics),
          close_connection_(close_connection) {}

    esp_err_t register_handlers(httpd_handle_t server) {
        httpd_uri_t static_uri{};
        static_uri.uri = "/*";
        static_uri.method = HTTP_GET;
        static_uri.handler = &StaticFileHandler::handle_request;
        static_uri.user_ctx = this;
        return httpd_register_uri_handler(server, &static_uri);
    }

private:
    static esp_err_t handle_request(httpd_req_t *req) {
        auto *self = static_cast<StaticFileHandler *>(req->user_ctx);
        return self->serve(*req);
    }

    esp_err_t serve(httpd_req_t &req) {
        diagnostics_.check_heap("before static request");
        ESP_LOGI(kTag, "static request uri=%s stack_free=%u", req.uri, RuntimeDiagnostics::stack_free_bytes());

        const auto resolved = resolver_.resolve(req.uri);
        if (resolved.status == StaticFileResolveStatus::BadRequest) {
            set_connection_close(req);
            ESP_LOGW(kTag, "static bad request uri=%s", req.uri);
            return httpd_resp_send_err(&req, HTTPD_400_BAD_REQUEST, "Bad static file path");
        }
        if (resolved.status == StaticFileResolveStatus::NotFound) {
            set_connection_close(req);
            ESP_LOGW(kTag, "static not found uri=%s", req.uri);
            return httpd_resp_send_err(&req, HTTPD_404_NOT_FOUND, "Static file not found");
        }

        FILE *file = std::fopen(resolved.filesystem_path.c_str(), "rb");
        if (file == nullptr) {
            set_connection_close(req);
            ESP_LOGE(kTag, "failed to open static file %s", resolved.filesystem_path.c_str());
            return httpd_resp_send_err(&req, HTTPD_404_NOT_FOUND, "Static file not found");
        }

        (void)httpd_resp_set_type(&req, resolved.content_type.c_str());
        if (resolved.gzip_encoded) {
            (void)httpd_resp_set_hdr(&req, "Content-Encoding", "gzip");
        }
        (void)httpd_resp_set_hdr(&req,
                                 "Cache-Control",
                                 resolved.no_store ? "no-store, max-age=0"
                                                   : "public, max-age=31536000, immutable");
        set_connection_close(req);

        ESP_LOGI(kTag, "static serving uri=%s file=%s gzip=%d stack_free=%u",
                 req.uri,
                 resolved.filesystem_path.c_str(),
                 resolved.gzip_encoded ? 1 : 0,
                 RuntimeDiagnostics::stack_free_bytes());

        while (true) {
            const std::size_t read = std::fread(scratch_.data(), 1, scratch_.size(), file);
            if (read > 0) {
                const esp_err_t send_err = httpd_resp_send_chunk(&req, scratch_.data(), read);
                if (send_err != ESP_OK) {
                    std::fclose(file);
                    ESP_LOGE(kTag, "failed to send static file %s: %s",
                             resolved.filesystem_path.c_str(),
                             esp_err_to_name(send_err));
                    (void)httpd_resp_send_chunk(&req, nullptr, 0);
                    return send_err;
                }
            }

            if (read < scratch_.size()) {
                if (std::ferror(file) != 0) {
                    std::fclose(file);
                    ESP_LOGE(kTag, "failed to read static file %s", resolved.filesystem_path.c_str());
                    return httpd_resp_send_err(&req, HTTPD_500_INTERNAL_SERVER_ERROR, "Static file read failed");
                }
                break;
            }
        }

        std::fclose(file);
        const esp_err_t final_err = httpd_resp_send_chunk(&req, nullptr, 0);
        diagnostics_.check_heap("after static request");
        ESP_LOGI(kTag, "static done uri=%s err=%s stack_free=%u",
                 req.uri,
                 esp_err_to_name(final_err),
                 RuntimeDiagnostics::stack_free_bytes());
        return final_err;
    }

    void set_connection_close(httpd_req_t &req) const {
        if (close_connection_) {
            (void)httpd_resp_set_hdr(&req, "Connection", "close");
        }
    }

    StaticFileResolver resolver_;
    const RuntimeDiagnostics &diagnostics_;
    bool close_connection_{true};
    std::array<char, 2048> scratch_{};
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
            ESP_LOGW(kTag,
                     "WebSocket async send queue failed fd=%d bytes=%u err=%s",
                     pending->socket,
                     static_cast<unsigned>(pending->payload.size()),
                     esp_err_to_name(err));
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
            ESP_LOGW(kTag, "WebSocket send failed fd=%d err=%s", socket, esp_err_to_name(err));
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
          store_ref_(store),
          source_(store, make_collector_config(config)),
          serializer_(make_serializer_config(config)),
          pump_(source_, serializer_, transport_) {}

    esp_err_t start() {
        load_recording_config_from_nvs();
        cmd_queue_ = xQueueCreate(8, sizeof(RecordingCommand));
        if (cmd_queue_ == nullptr) {
            ESP_LOGE(kTag, "failed to create recording command queue");
            return ESP_ERR_NO_MEM;
        }
        ESP_RETURN_ON_ERROR(wifi_.start(config_), kTag, "failed to start WiFi station");
        ESP_RETURN_ON_ERROR(static_filesystem_.mount(config_), kTag, "failed to mount static file system");
        ESP_RETURN_ON_ERROR(start_http_server(), kTag, "failed to start HTTP server");
        ESP_RETURN_ON_ERROR(start_pump_task(), kTag, "failed to start telemetry pump task");
        ESP_RETURN_ON_ERROR(start_recording_task(), kTag, "failed to start recording task");
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
        serializer_config.state_hz         = config.state_hz;
        serializer_config.events_per_batch  = config.max_events_per_batch;
        serializer_config.device            = get_device_identity();
        // recording thresholds come from Kconfig defaults; auto_enabled is
        // updated from NVS after construction via load_recording_config_from_nvs()
        serializer_config.recording.rpm_threshold      = CONFIG_DIGITAL_TWIN_AUTO_RPM_THRESHOLD;
        serializer_config.recording.start_debounce_ms  = CONFIG_DIGITAL_TWIN_AUTO_START_MS;
        serializer_config.recording.stop_debounce_ms   = CONFIG_DIGITAL_TWIN_AUTO_STOP_MS;
        return serializer_config;
    }

    esp_err_t start_http_server() {
        httpd_config_t http_config = HTTPD_DEFAULT_CONFIG();
        http_config.server_port = config_.http_port;
        http_config.stack_size = config_.http_task_stack_bytes;
        http_config.max_open_sockets = config_.http_max_open_sockets;
        http_config.lru_purge_enable = config_.http_lru_purge_enable;
        http_config.uri_match_fn = httpd_uri_match_wildcard;

        ESP_LOGI(kTag,
                 "starting HTTP server port=%u stack=%u sockets=%u lru=%d static_close=%d heap_checks=%d",
                 static_cast<unsigned>(http_config.server_port),
                 static_cast<unsigned>(http_config.stack_size),
                 static_cast<unsigned>(http_config.max_open_sockets),
                 http_config.lru_purge_enable ? 1 : 0,
                 config_.static_close_connection ? 1 : 0,
                 config_.diagnostics_heap_checks ? 1 : 0);

        ESP_RETURN_ON_ERROR(httpd_start(&server_, &http_config), kTag, "failed to start HTTP server");

        httpd_uri_t ws_uri{};
        ws_uri.uri = config_.ws_path;
        ws_uri.method = HTTP_GET;
        ws_uri.handler = &TelemetryServerApplication::websocket_handler;
        ws_uri.user_ctx = this;
        ws_uri.is_websocket = true;
        ws_uri.handle_ws_control_frames = true;

        ESP_RETURN_ON_ERROR(httpd_register_uri_handler(server_, &ws_uri),
                            kTag,
                            "failed to register WebSocket handler");
        return static_handler_.register_handlers(server_);
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

    esp_err_t start_recording_task() {
        const BaseType_t created = xTaskCreatePinnedToCore(
            &TelemetryServerApplication::recording_task,
            "recording_eval",
            4096,
            this,
            tskIDLE_PRIORITY + 1,
            &recording_task_,
            PRO_CPU_NUM);
        return created == pdPASS ? ESP_OK : ESP_ERR_NO_MEM;
    }

    static esp_err_t websocket_handler(httpd_req_t *req) {
        auto *self = static_cast<TelemetryServerApplication *>(req->user_ctx);
        const int socket = httpd_req_to_sockfd(req);
        self->diagnostics_.check_heap("before websocket request");

        ESP_LOGI(kTag,
                 "ws request method=%d fd=%d stack_free=%u",
                 static_cast<int>(req->method),
                 socket,
                 RuntimeDiagnostics::stack_free_bytes());

        if (req->method == HTTP_GET) {
            self->transport_.accept(req->handle, socket);
            const auto capabilities = self->serializer_.serialize_capabilities();
            (void)self->transport_.send_text(capabilities);
            self->diagnostics_.check_heap("after websocket accept");
            return ESP_OK;
        }

        httpd_ws_frame_t frame{};
        esp_err_t err = httpd_ws_recv_frame(req, &frame, 0);
        if (err != ESP_OK) {
            self->transport_.close(socket);
            self->diagnostics_.check_heap("after websocket recv header failed");
            return err;
        }

        std::vector<std::uint8_t> payload(frame.len);
        if (!payload.empty()) {
            frame.payload = payload.data();
            err = httpd_ws_recv_frame(req, &frame, frame.len);
            if (err != ESP_OK) {
                self->transport_.close(socket);
                self->diagnostics_.check_heap("after websocket recv payload failed");
                return err;
            }
        }

        if (frame.type == HTTPD_WS_TYPE_PING) {
            frame.type = HTTPD_WS_TYPE_PONG;
            err = httpd_ws_send_frame(req, &frame);
            self->diagnostics_.check_heap("after websocket pong");
            return err;
        }

        if (frame.type == HTTPD_WS_TYPE_CLOSE) {
            self->transport_.close(socket);
            frame.len = 0;
            frame.payload = nullptr;
            err = httpd_ws_send_frame(req, &frame);
            self->diagnostics_.check_heap("after websocket close");
            return err;
        }

        // Handle incoming text frames (control messages from bridge client)
        if (frame.type == HTTPD_WS_TYPE_TEXT && frame.len > 0) {
            cJSON *root = cJSON_ParseWithLength(
                reinterpret_cast<const char *>(frame.payload), frame.len);
            if (root) {
                const cJSON *type_j = cJSON_GetObjectItemCaseSensitive(root, "type");
                if (cJSON_IsString(type_j) &&
                    std::string_view(type_j->valuestring) == "recording_config_set") {
                    const cJSON *ae_j = cJSON_GetObjectItemCaseSensitive(root, "auto_enabled");
                    if (cJSON_IsBool(ae_j)) {
                        const RecordingCommand cmd{RecordingCommandType::SetAutoEnabled,
                                                   cJSON_IsTrue(ae_j) != 0};
                        if (self->cmd_queue_ != nullptr) {
                            xQueueSend(self->cmd_queue_, &cmd, 0);
                        }
                    } else {
                        ESP_LOGW(kTag, "recording_config_set: auto_enabled missing or not bool");
                    }
                }
                cJSON_Delete(root);
            }
        }

        self->diagnostics_.check_heap("after websocket request");
        return ESP_OK;
    }

    static void pump_task(void *arg) {
        auto *self = static_cast<TelemetryServerApplication *>(arg);
        const TickType_t period_ticks = pdMS_TO_TICKS(1000u / self->config_.state_hz);
        TickType_t last_wake = xTaskGetTickCount();

        while (true) {
            vTaskDelayUntil(&last_wake, period_ticks);
            const auto now = static_cast<ecu::sensors::TimestampUs>(esp_timer_get_time());
            self->diagnostics_.check_heap("before telemetry pump tick");
            (void)self->pump_.tick(now);
            self->diagnostics_.check_heap("after telemetry pump tick");
        }
    }

    // ---- NVS helpers -----------------------------------------------------------

    void load_recording_config_from_nvs() {
        nvs_handle_t handle;
        if (nvs_open("dt_config", NVS_READONLY, &handle) != ESP_OK) return;
        uint8_t auto_en = 0;
        nvs_get_u8(handle, "auto_en", &auto_en);
        nvs_close(handle);
        std::lock_guard<std::mutex> lock(recording_mutex_);
        recording_config_.auto_enabled = (auto_en != 0);
    }

    void save_auto_enabled_to_nvs(bool v) {
        nvs_handle_t handle;
        if (nvs_open("dt_config", NVS_READWRITE, &handle) != ESP_OK) return;
        nvs_set_u8(handle, "auto_en", v ? 1 : 0);
        nvs_commit(handle);
        nvs_close(handle);
    }

    uint32_t load_and_increment_run_seq() {
        nvs_handle_t handle;
        uint32_t seq = static_cast<uint32_t>(esp_random());
        if (nvs_open("dt_config", NVS_READWRITE, &handle) == ESP_OK) {
            nvs_get_u32(handle, "run_seq", &seq);
            ++seq;
            nvs_set_u32(handle, "run_seq", seq);
            nvs_commit(handle);
            nvs_close(handle);
        }
        return seq;
    }

    // ---- Recording evaluation task --------------------------------------------

    static void recording_task(void *arg) {
        auto *self = static_cast<TelemetryServerApplication *>(arg);
        constexpr TickType_t kPeriodTicks = pdMS_TO_TICKS(100);
        TickType_t last_wake = xTaskGetTickCount();

        // Debounce state
        bool above_threshold      = false;  // is engine currently above RPM threshold?
        TickType_t condition_since = 0;     // tick when condition last flipped
        bool run_active            = false;  // is a recording run currently open?
        uint32_t current_run_id    = 0;

        while (true) {
            vTaskDelayUntil(&last_wake, kPeriodTicks);

            // ---- Drain command queue (non-blocking) --------------------------
            RecordingCommand cmd{};
            while (xQueueReceive(self->cmd_queue_, &cmd, 0) == pdTRUE) {
                if (cmd.type == RecordingCommandType::SetAutoEnabled) {
                    {
                        std::lock_guard<std::mutex> lock(self->recording_mutex_);
                        self->recording_config_.auto_enabled = cmd.auto_enabled;
                    }
                    self->save_auto_enabled_to_nvs(cmd.auto_enabled);
                    const auto cfg_frame = self->serializer_.serialize_recording_config(
                        [&]() {
                            std::lock_guard<std::mutex> lock(self->recording_mutex_);
                            return self->recording_config_;
                        }());
                    (void)self->transport_.send_text(cfg_frame);
                    ESP_LOGI(kTag, "recording: auto_enabled=%d saved to NVS",
                             cmd.auto_enabled ? 1 : 0);
                }
            }

            // ---- Auto-record evaluation -------------------------------------
            bool auto_enabled;
            uint32_t rpm_threshold;
            uint32_t start_debounce_ms;
            uint32_t stop_debounce_ms;
            {
                std::lock_guard<std::mutex> lock(self->recording_mutex_);
                auto_enabled       = self->recording_config_.auto_enabled;
                rpm_threshold      = self->recording_config_.rpm_threshold;
                start_debounce_ms  = self->recording_config_.start_debounce_ms;
                stop_debounce_ms   = self->recording_config_.stop_debounce_ms;
            }

            if (!auto_enabled) {
                // Auto mode off: if a run is open, close it
                if (run_active) {
                    const uint64_t now_us = static_cast<uint64_t>(esp_timer_get_time());
                    const auto frame = self->serializer_.serialize_run_ended(current_run_id, now_us);
                    (void)self->transport_.send_text(frame);
                    ESP_LOGI(kTag, "recording: run_ended id=%08lx (auto disabled)",
                             static_cast<unsigned long>(current_run_id));
                    run_active = false;
                }
                above_threshold = false;
                continue;
            }

            // Sample current engine state
            const ecu::sensors::EngineInputSnapshot snap = self->store_ref_.snapshot();
            const float current_rpm   = snap.engine_speed.value.rpm;
            const bool  synchronized  = snap.engine_speed.value.synchronized;
            const bool  cond_met      = synchronized && (current_rpm >= static_cast<float>(rpm_threshold));

            const TickType_t now_ticks = xTaskGetTickCount();

            if (cond_met != above_threshold) {
                // Condition flipped — reset debounce timer
                above_threshold = cond_met;
                condition_since = now_ticks;
            }

            const uint32_t held_ms =
                static_cast<uint32_t>((now_ticks - condition_since) * portTICK_PERIOD_MS);

            if (!run_active && above_threshold && held_ms >= start_debounce_ms) {
                // Start a new run
                current_run_id = self->load_and_increment_run_seq();
                run_active = true;
                const uint64_t now_us = static_cast<uint64_t>(esp_timer_get_time());
                const auto frame = self->serializer_.serialize_run_started(current_run_id, now_us);
                (void)self->transport_.send_text(frame);
                ESP_LOGI(kTag, "recording: run_started id=%08lx rpm=%.1f",
                         static_cast<unsigned long>(current_run_id), static_cast<double>(current_rpm));
            } else if (run_active && !above_threshold && held_ms >= stop_debounce_ms) {
                // End the current run
                const uint64_t now_us = static_cast<uint64_t>(esp_timer_get_time());
                const auto frame = self->serializer_.serialize_run_ended(current_run_id, now_us);
                (void)self->transport_.send_text(frame);
                ESP_LOGI(kTag, "recording: run_ended id=%08lx",
                         static_cast<unsigned long>(current_run_id));
                run_active = false;
            }
        }
    }

    TelemetryServerConfig config_{};
    ecu::sensors::SensorDataStore &store_ref_;
    WifiStation wifi_{};
    StaticFileSystemMount static_filesystem_{};
    PosixStaticFileCatalog static_catalog_{};
    RuntimeDiagnostics diagnostics_{config_.diagnostics_heap_checks};
    StaticFileHandler static_handler_{config_.static_base_path,
                                      static_catalog_,
                                      diagnostics_,
                                      config_.static_close_connection};
    SensorTelemetryBatchSource source_;
    TelemetryJsonSerializer serializer_;
    EspWebSocketTransport transport_{};
    TelemetryPump pump_;
    httpd_handle_t server_{nullptr};
    TaskHandle_t task_{nullptr};

    // Digital-twin recording members
    RetransmitBuffer retransmit_buffer_{CONFIG_DIGITAL_TWIN_RETRANSMIT_FRAMES};
    QueueHandle_t    cmd_queue_{nullptr};
    mutable std::mutex recording_mutex_{};
    RecordingConfig  recording_config_{
        false,
        CONFIG_DIGITAL_TWIN_AUTO_RPM_THRESHOLD,
        CONFIG_DIGITAL_TWIN_AUTO_START_MS,
        CONFIG_DIGITAL_TWIN_AUTO_STOP_MS
    };
    TaskHandle_t recording_task_{nullptr};
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
