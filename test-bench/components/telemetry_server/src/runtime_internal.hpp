#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <memory>
#include <mutex>
#include <optional>
#include <string_view>

#include "esp_err.h"
#include "esp_event.h"
#include "esp_http_server.h"
#include "esp_netif.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "telemetry/telemetry_collector.hpp"
#include "telemetry_server/static_file_resolver.hpp"
#include "telemetry_server/telemetry_json_serializer.hpp"
#include "telemetry_server/telemetry_pump.hpp"
#include "telemetry_server/telemetry_server.h"
#include "telemetry_server/telemetry_transport.hpp"

namespace ecu::telemetry_server {

struct OwnedServerConfig {
    explicit OwnedServerConfig(const telemetry_server_config_t &source);
    OwnedServerConfig(const OwnedServerConfig &) = delete;
    OwnedServerConfig &operator=(const OwnedServerConfig &) = delete;

    telemetry_server_config_t values{};
    std::array<char, 32> ssid{};
    std::array<char, 64> password{};
    std::array<char, 32> ws_path{};
    std::array<char, 64> static_base_path{};
    std::array<char, 16> static_partition_label{};
    std::array<char, 64> hardware_revision{};
};

struct RuntimeDeviceIdentity {
    std::array<char, 32> hwid{};
    std::array<char, 64> hardware_revision{};
    std::array<char, 16> chip_model{};
    std::uint32_t flash_size_bytes{0};
    std::array<char, 33> firmware_version{};
};

class RuntimeDiagnostics final {
public:
    explicit RuntimeDiagnostics(bool heap_checks);
    static unsigned stack_free_bytes();
    void check_heap(const char *location) const;

private:
    bool heap_checks_{false};
};

class WifiStation final {
public:
    WifiStation() = default;
    ~WifiStation();
    esp_err_t start(const telemetry_server_config_t &config);

private:
    static void event_handler(void *arg, esp_event_base_t base,
                              std::int32_t id, void *data);
    void handle_event(esp_event_base_t base, std::int32_t id, void *data);
    esp_netif_t *sta_netif_{nullptr};
    esp_event_handler_instance_t wifi_handler_{nullptr};
    esp_event_handler_instance_t ip_handler_{nullptr};
    bool wifi_initialized_{false};
    bool wifi_started_{false};
};

class StaticFileSystemMount final {
public:
    ~StaticFileSystemMount();
    esp_err_t mount(const telemetry_server_config_t &config);

private:
    std::array<char, 16> partition_label_{};
    bool mounted_{false};
};

class PosixStaticFileCatalog final : public IStaticFileCatalog {
public:
    bool exists(const char *path) const override;
};

class StaticFileHandler final {
public:
    StaticFileHandler(const char *base_path,
                      const IStaticFileCatalog &catalog,
                      const RuntimeDiagnostics &diagnostics,
                      bool close_connection);
    bool valid() const;
    esp_err_t register_handlers(httpd_handle_t server);

private:
    static esp_err_t handle_request(httpd_req_t *request);
    esp_err_t serve(httpd_req_t &request);
    void set_connection_close(httpd_req_t &request) const;
    StaticFileResolver resolver_;
    const RuntimeDiagnostics &diagnostics_;
    bool close_connection_{true};
    std::array<char, 2048> scratch_{};
};

class EspWebSocketTransport final : public ITelemetryTransport {
public:
    explicit EspWebSocketTransport(std::size_t max_payload_bytes);
    bool connected() const override;
    bool ready() const override;
    bool send_text(std::string_view payload) override;
    void note_dropped_frame() override;
    void note_send_error() override;
    TelemetryTransportCounters counters() const override;
    bool accept_and_send_initial(httpd_handle_t server,
                                 int socket,
                                 std::string_view payload);
    void close(int socket);
    void service_pending_close();

private:
    struct PendingSend;
    struct SessionMarker {
        std::uint64_t session_id{0};
    };
    struct CloseWork {
        EspWebSocketTransport *owner{nullptr};
        httpd_handle_t server{nullptr};
        int socket{-1};
        std::uint64_t session_id{0};
    };
    static void send_complete(esp_err_t error, int socket, void *context);
    static void close_session_work(void *context);
    static void release_session_marker(void *context);
    bool require_close_locked(httpd_handle_t server,
                              int socket,
                              std::uint64_t session_id);
    void run_close_session_work();
    void finish_send(int socket,
                     std::uint64_t session_id,
                     esp_err_t error,
                     bool require_physical_close);
    std::size_t max_payload_bytes_{0};
    mutable std::mutex mutex_{};
    httpd_handle_t server_{nullptr};
    int socket_{-1};
    std::uint64_t session_id_{0};
    bool active_{false};
    bool send_in_flight_{false};
    bool close_required_{false};
    bool close_queued_{false};
    SessionMarker session_marker_{};
    CloseWork close_work_{};
    TelemetryTransportCounters counters_{};
};

class RecordingSettingsStore final {
public:
    bool load_auto_enabled(bool fallback) const;
    esp_err_t save_auto_enabled(bool enabled) const;
};

class TelemetryServerApplication final {
public:
    TelemetryServerApplication(telemetry_source_t source,
                               const telemetry_server_config_t &config);
    ~TelemetryServerApplication();
    bool valid() const;
    esp_err_t start();

private:
    esp_err_t start_http_server();
    esp_err_t start_pump_task();
    static esp_err_t websocket_handler(httpd_req_t *request);
    static void pump_task(void *context);
    RecordingConfigSnapshot recording_snapshot() const;
    SerializeResult serialize_capabilities();
    SerializeResult serialize_recording_config();
    esp_err_t send_recording_config(httpd_req_t &request);
    esp_err_t handle_recording_config_set(httpd_req_t &request, bool enabled);

    OwnedServerConfig config_;
    telemetry_source_t source_{};
    RuntimeDeviceIdentity device_identity_{};
    mutable std::mutex recording_mutex_{};
    RecordingConfigSnapshot recording_{};
    RecordingSettingsStore recording_store_{};
    ecu::telemetry::TelemetryCollector collector_;
    TelemetryJsonSerializer serializer_;
    EspWebSocketTransport transport_;
    TelemetryPump pump_;
    WifiStation wifi_{};
    StaticFileSystemMount static_filesystem_{};
    PosixStaticFileCatalog static_catalog_{};
    RuntimeDiagnostics diagnostics_;
    StaticFileHandler static_handler_;
    std::unique_ptr<char[]> control_buffer_{};
    httpd_handle_t server_{nullptr};
    TaskHandle_t task_{nullptr};
};

RuntimeDeviceIdentity read_device_identity(
    const telemetry_server_config_t &config);
std::optional<bool> parse_recording_config_set(const std::uint8_t *data,
                                               std::size_t size);

} // namespace ecu::telemetry_server
