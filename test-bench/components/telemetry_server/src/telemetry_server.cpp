#include "runtime_internal.hpp"

#include <atomic>
#include <cmath>
#include <cstdlib>
#include <cstring>
#include <new>

#include "esp_check.h"
#include "esp_heap_caps.h"
#include "esp_log.h"
#include "esp_timer.h"

namespace ecu::telemetry_server {
namespace {

constexpr char kTag[] = "telemetry_server";

enum class ServerStartState : std::uint8_t {
    NotStarted,
    Starting,
    Started,
};

std::atomic<ServerStartState> g_start_state{ServerStartState::NotStarted};
TelemetryServerApplication *g_application = nullptr;

template <std::size_t Capacity>
void copy_config_string(std::array<char, Capacity> &destination,
                        const char *source) {
    const std::size_t size = std::strlen(source);
    std::memcpy(destination.data(), source, size + 1);
}

bool string_length_in_range(const char *value,
                            std::size_t minimum,
                            std::size_t maximum) {
    if (value == nullptr) {
        return false;
    }
    std::size_t size = 0;
    while (size <= maximum && value[size] != '\0') {
        ++size;
    }
    return size >= minimum && size <= maximum;
}

bool valid_server_inputs(const telemetry_source_t *source,
                         const telemetry_server_config_t *config) {
    if (source == nullptr || config == nullptr || source->read == nullptr) {
        return false;
    }
    if (!string_length_in_range(config->sta_ssid, 1, 31) ||
        !string_length_in_range(config->sta_password, 0, 63) ||
        !string_length_in_range(config->ws_path, 1, 31) ||
        config->ws_path[0] != '/' ||
        !string_length_in_range(config->static_base_path, 1, 63) ||
        config->static_base_path[0] != '/' ||
        !string_length_in_range(config->static_partition_label, 1, 15) ||
        !string_length_in_range(config->hardware_revision, 1, 63)) {
        return false;
    }

    const std::size_t password_size = std::strlen(config->sta_password);
    if (password_size != 0 && password_size < 8) {
        return false;
    }

    if (config->http_port == 0 ||
        config->http_task_stack_bytes < 8192 ||
        config->http_task_priority >= configMAX_PRIORITIES ||
        config->http_max_open_sockets == 0 ||
        config->static_max_open_files == 0 ||
        config->state_hz == 0 || config->state_hz > 50 ||
        config->max_events_per_batch == 0 ||
        config->max_events_per_batch >
            ecu::telemetry::kTelemetryEventBatchCapacity ||
        config->event_backlog_capacity == 0 ||
        config->event_backlog_capacity >
            ecu::telemetry::kTelemetryEventBacklogCapacity ||
        config->max_events_per_batch > config->event_backlog_capacity ||
        config->max_frame_bytes < 4096 ||
        config->task_stack_bytes < 4096 ||
        config->task_priority >= configMAX_PRIORITIES) {
        return false;
    }

    const float simulation_coefficients[] = {
        config->ambient_c,
        config->egt_base_c,
        config->egt_rpm_gain,
        config->egt_tps_gain,
        config->egt_max_c,
        config->egt_heat_c_per_s,
        config->egt_cool_c_per_s,
        config->water_base_c,
        config->water_rpm_gain,
        config->water_tps_gain,
        config->water_max_c,
        config->water_heat_c_per_s,
        config->water_cool_c_per_s,
        config->knock_candidate_index,
    };
    for (float coefficient : simulation_coefficients) {
        if (!std::isfinite(coefficient)) {
            return false;
        }
    }

    if (config->egt_heat_c_per_s <= 0.0f ||
        config->egt_cool_c_per_s <= 0.0f ||
        config->water_heat_c_per_s <= 0.0f ||
        config->water_cool_c_per_s <= 0.0f ||
        config->egt_max_c < config->ambient_c ||
        config->water_max_c < config->ambient_c ||
        config->quick_shift_arm_rpm == 0 ||
        config->quick_shift_period_ms == 0 ||
        config->quick_shift_active_ms >= config->quick_shift_period_ms ||
        config->secondary_map_tps_percent > 100 ||
        config->knock_candidate_index <= 0.0f) {
        return false;
    }
    return true;
}

RecordingConfigSnapshot make_recording_config(
    const telemetry_server_config_t &config) {
    RecordingConfigSnapshot recording{};
    recording.rpm_threshold = config.auto_record_rpm_threshold;
    recording.start_debounce_ms = config.auto_record_start_ms;
    recording.stop_debounce_ms = config.auto_record_stop_ms;
    return recording;
}

ecu::telemetry::TelemetryCollectorConfig make_collector_config(
    const telemetry_server_config_t &config) {
    ecu::telemetry::TelemetryCollectorConfig collector{};
    collector.max_events_per_batch = config.max_events_per_batch;
    collector.event_backlog_capacity = config.event_backlog_capacity;
    collector.ambient_c = config.ambient_c;
    collector.egt_base_c = config.egt_base_c;
    collector.egt_rpm_gain = config.egt_rpm_gain;
    collector.egt_tps_gain = config.egt_tps_gain;
    collector.egt_max_c = config.egt_max_c;
    collector.egt_heat_c_per_s = config.egt_heat_c_per_s;
    collector.egt_cool_c_per_s = config.egt_cool_c_per_s;
    collector.water_base_c = config.water_base_c;
    collector.water_rpm_gain = config.water_rpm_gain;
    collector.water_tps_gain = config.water_tps_gain;
    collector.water_max_c = config.water_max_c;
    collector.water_heat_c_per_s = config.water_heat_c_per_s;
    collector.water_cool_c_per_s = config.water_cool_c_per_s;
    collector.quick_shift_arm_rpm = config.quick_shift_arm_rpm;
    collector.quick_shift_period_ms = config.quick_shift_period_ms;
    collector.quick_shift_active_ms = config.quick_shift_active_ms;
    collector.secondary_map_tps_percent =
        config.secondary_map_tps_percent;
    collector.knock_candidate_index = config.knock_candidate_index;
    return collector;
}

SerializerConfig make_serializer_config(
    const telemetry_server_config_t &config,
    const RuntimeDeviceIdentity &identity) {
    SerializerConfig serializer{};
    serializer.state_hz = config.state_hz;
    serializer.events_per_batch = config.max_events_per_batch;
    serializer.device.hwid = identity.hwid.data();
    serializer.device.hardware_revision = identity.hardware_revision.data();
    serializer.device.chip_model = identity.chip_model.data();
    serializer.device.flash_size_bytes = identity.flash_size_bytes;
    serializer.device.firmware_version = identity.firmware_version.data();
    return serializer;
}

} // namespace

OwnedServerConfig::OwnedServerConfig(
    const telemetry_server_config_t &source)
    : values(source) {
    copy_config_string(ssid, source.sta_ssid);
    copy_config_string(password, source.sta_password);
    copy_config_string(ws_path, source.ws_path);
    copy_config_string(static_base_path, source.static_base_path);
    copy_config_string(static_partition_label, source.static_partition_label);
    copy_config_string(hardware_revision, source.hardware_revision);

    values.sta_ssid = ssid.data();
    values.sta_password = password.data();
    values.ws_path = ws_path.data();
    values.static_base_path = static_base_path.data();
    values.static_partition_label = static_partition_label.data();
    values.hardware_revision = hardware_revision.data();
}

RuntimeDiagnostics::RuntimeDiagnostics(bool heap_checks)
    : heap_checks_(heap_checks) {}

unsigned RuntimeDiagnostics::stack_free_bytes() {
    return static_cast<unsigned>(uxTaskGetStackHighWaterMark2(nullptr));
}

void RuntimeDiagnostics::check_heap(const char *location) const {
    if (heap_checks_ && !heap_caps_check_integrity_all(true)) {
        ESP_LOGE(kTag, "heap corruption detected near %s", location);
        std::abort();
    }
}

TelemetryServerApplication::TelemetryServerApplication(
    telemetry_source_t source,
    const telemetry_server_config_t &config)
    : config_(config),
      source_(source),
      device_identity_(read_device_identity(config_.values)),
      recording_(make_recording_config(config_.values)),
      collector_(source_, make_collector_config(config_.values)),
      serializer_(make_serializer_config(config_.values, device_identity_)),
      transport_(config_.values.max_frame_bytes),
      pump_(collector_,
            serializer_,
            transport_,
            config_.values.max_frame_bytes),
      diagnostics_(config_.values.diagnostics_heap_checks),
      static_handler_(config_.values.static_base_path,
                      static_catalog_,
                      diagnostics_,
                      config_.values.static_close_connection),
      control_buffer_(config_.values.max_frame_bytes == 0
                          ? nullptr
                          : new (std::nothrow)
                                char[config_.values.max_frame_bytes]) {}

TelemetryServerApplication::~TelemetryServerApplication() {
    if (task_ != nullptr) {
        vTaskDelete(task_);
        task_ = nullptr;
    }
    if (server_ != nullptr) {
        (void)httpd_stop(server_);
        server_ = nullptr;
    }
}

bool TelemetryServerApplication::valid() const {
    return source_.read != nullptr &&
           config_.values.max_frame_bytes != 0 &&
           pump_.valid() && control_buffer_ != nullptr &&
           static_handler_.valid();
}

esp_err_t TelemetryServerApplication::start() {
    if (!valid()) {
        return ESP_ERR_NO_MEM;
    }

    ESP_RETURN_ON_ERROR(wifi_.start(config_.values),
                        kTag,
                        "failed to start Wi-Fi station");
    const bool enabled =
        recording_store_.load_auto_enabled(recording_.auto_enabled);
    {
        std::lock_guard<std::mutex> lock(recording_mutex_);
        recording_.auto_enabled = enabled;
    }
    ESP_RETURN_ON_ERROR(static_filesystem_.mount(config_.values),
                        kTag,
                        "failed to mount static files");
    ESP_RETURN_ON_ERROR(start_http_server(),
                        kTag,
                        "failed to start HTTP server");
    ESP_RETURN_ON_ERROR(start_pump_task(),
                        kTag,
                        "failed to start telemetry pump task");
    return ESP_OK;
}

esp_err_t TelemetryServerApplication::start_http_server() {
    httpd_config_t http = HTTPD_DEFAULT_CONFIG();
    http.server_port = config_.values.http_port;
    http.stack_size = config_.values.http_task_stack_bytes;
    http.task_priority = config_.values.http_task_priority;
    http.max_open_sockets = config_.values.http_max_open_sockets;
    http.lru_purge_enable = config_.values.http_lru_purge_enable;
    http.uri_match_fn = httpd_uri_match_wildcard;

    ESP_RETURN_ON_ERROR(httpd_start(&server_, &http),
                        kTag,
                        "failed to create HTTP server");

    httpd_uri_t websocket{};
    websocket.uri = config_.values.ws_path;
    websocket.method = HTTP_GET;
    websocket.handler = &TelemetryServerApplication::websocket_handler;
    websocket.user_ctx = this;
    websocket.is_websocket = true;
    websocket.handle_ws_control_frames = true;
    ESP_RETURN_ON_ERROR(httpd_register_uri_handler(server_, &websocket),
                        kTag,
                        "failed to register WebSocket handler");
    return static_handler_.register_handlers(server_);
}

esp_err_t TelemetryServerApplication::start_pump_task() {
    const BaseType_t result =
        xTaskCreate(&TelemetryServerApplication::pump_task,
                    "telemetry_server",
                    config_.values.task_stack_bytes,
                    this,
                    config_.values.task_priority,
                    &task_);
    return result == pdPASS ? ESP_OK : ESP_ERR_NO_MEM;
}

esp_err_t TelemetryServerApplication::websocket_handler(
    httpd_req_t *request) {
    if (request == nullptr || request->user_ctx == nullptr) {
        return ESP_ERR_INVALID_ARG;
    }
    auto *self =
        static_cast<TelemetryServerApplication *>(request->user_ctx);
    const int socket = httpd_req_to_sockfd(request);
    self->diagnostics_.check_heap("before WebSocket request");

    if (request->method == HTTP_GET) {
        const SerializeResult result = self->serialize_capabilities();
        if (!result.ok) {
            self->transport_.note_send_error();
            return ESP_ERR_INVALID_SIZE;
        }
        if (!self->transport_.accept_and_send_initial(
                request->handle,
                socket,
                std::string_view(self->control_buffer_.get(), result.size))) {
            self->transport_.close(socket);
            return ESP_FAIL;
        }
        self->diagnostics_.check_heap("after WebSocket accept");
        return ESP_OK;
    }

    httpd_ws_frame_t frame{};
    esp_err_t error = httpd_ws_recv_frame(request, &frame, 0);
    if (error != ESP_OK) {
        self->transport_.close(socket);
        return error;
    }
    if (frame.len > self->config_.values.max_frame_bytes) {
        self->transport_.close(socket);
        return ESP_ERR_INVALID_SIZE;
    }

    std::unique_ptr<std::uint8_t[]> payload{};
    if (frame.len != 0) {
        payload.reset(new (std::nothrow) std::uint8_t[frame.len]);
        if (payload == nullptr) {
            return ESP_ERR_NO_MEM;
        }
        frame.payload = payload.get();
        error = httpd_ws_recv_frame(request, &frame, frame.len);
        if (error != ESP_OK) {
            self->transport_.close(socket);
            return error;
        }
    }

    if (frame.type == HTTPD_WS_TYPE_PING) {
        frame.type = HTTPD_WS_TYPE_PONG;
        error = httpd_ws_send_frame(request, &frame);
        if (error != ESP_OK) {
            self->transport_.note_send_error();
        }
        return error;
    }
    if (frame.type == HTTPD_WS_TYPE_CLOSE) {
        self->transport_.close(socket);
        frame.payload = nullptr;
        frame.len = 0;
        error = httpd_ws_send_frame(request, &frame);
        if (error != ESP_OK) {
            self->transport_.note_send_error();
        }
        return error;
    }
    if (frame.type == HTTPD_WS_TYPE_TEXT) {
        const auto enabled =
            parse_recording_config_set(payload.get(), frame.len);
        if (enabled.has_value()) {
            return self->handle_recording_config_set(*request, *enabled);
        }
    }

    self->diagnostics_.check_heap("after WebSocket request");
    return ESP_OK;
}

void TelemetryServerApplication::pump_task(void *context) {
    auto *self = static_cast<TelemetryServerApplication *>(context);
    const TickType_t period =
        pdMS_TO_TICKS(1000U / self->config_.values.state_hz);
    TickType_t last_wake = xTaskGetTickCount();
    while (true) {
        vTaskDelayUntil(&last_wake, period);
        const auto now = static_cast<ecu::telemetry::TimestampUs>(
            esp_timer_get_time());
        self->diagnostics_.check_heap("before telemetry pump tick");
        (void)self->pump_.tick(now);
        self->diagnostics_.check_heap("after telemetry pump tick");
    }
}

RecordingConfigSnapshot TelemetryServerApplication::recording_snapshot() const {
    std::lock_guard<std::mutex> lock(recording_mutex_);
    return recording_;
}

SerializeResult TelemetryServerApplication::serialize_capabilities() {
    const RecordingConfigSnapshot snapshot = recording_snapshot();
    return serializer_.serialize_capabilities(snapshot,
                                              control_buffer_.get(),
                                              config_.values.max_frame_bytes);
}

SerializeResult TelemetryServerApplication::serialize_recording_config() {
    const RecordingConfigSnapshot snapshot = recording_snapshot();
    return serializer_.serialize_recording_config(
        snapshot,
        control_buffer_.get(),
        config_.values.max_frame_bytes);
}

esp_err_t TelemetryServerApplication::send_recording_config(
    httpd_req_t &request) {
    const SerializeResult result = serialize_recording_config();
    if (!result.ok) {
        transport_.note_send_error();
        return ESP_ERR_INVALID_SIZE;
    }

    httpd_ws_frame_t response{};
    response.type = HTTPD_WS_TYPE_TEXT;
    response.payload =
        reinterpret_cast<std::uint8_t *>(control_buffer_.get());
    response.len = result.size;
    const esp_err_t error = httpd_ws_send_frame(&request, &response);
    if (error != ESP_OK) {
        transport_.note_send_error();
    }
    return error;
}

esp_err_t TelemetryServerApplication::handle_recording_config_set(
    httpd_req_t &request,
    bool enabled) {
    const esp_err_t error = recording_store_.save_auto_enabled(enabled);
    if (error != ESP_OK) {
        return error;
    }
    {
        std::lock_guard<std::mutex> lock(recording_mutex_);
        recording_.auto_enabled = enabled;
    }
    return send_recording_config(request);
}

} // namespace ecu::telemetry_server

extern "C" esp_err_t telemetry_server_start(
    const telemetry_source_t *source,
    const telemetry_server_config_t *config) {
    using ecu::telemetry_server::TelemetryServerApplication;
    using ecu::telemetry_server::ServerStartState;
    ServerStartState expected = ServerStartState::NotStarted;
    if (!ecu::telemetry_server::g_start_state.compare_exchange_strong(
            expected,
            ServerStartState::Starting,
            std::memory_order_acq_rel,
            std::memory_order_acquire)) {
        return ESP_ERR_INVALID_STATE;
    }
    if (!ecu::telemetry_server::valid_server_inputs(source, config)) {
        ecu::telemetry_server::g_start_state.store(
            ServerStartState::NotStarted, std::memory_order_release);
        return ESP_ERR_INVALID_ARG;
    }

    auto *created = new (std::nothrow)
        TelemetryServerApplication(*source, *config);
    if (created == nullptr || !created->valid()) {
        delete created;
        ecu::telemetry_server::g_start_state.store(
            ServerStartState::NotStarted, std::memory_order_release);
        return ESP_ERR_NO_MEM;
    }

    const esp_err_t error = created->start();
    if (error != ESP_OK) {
        delete created;
        ecu::telemetry_server::g_start_state.store(
            ServerStartState::NotStarted, std::memory_order_release);
        return error;
    }
    ecu::telemetry_server::g_application = created;
    ecu::telemetry_server::g_start_state.store(
        ServerStartState::Started, std::memory_order_release);
    return ESP_OK;
}
