#include "runtime_internal.hpp"

#include <cstring>
#include <new>

#include "esp_log.h"

namespace ecu::telemetry_server {
namespace {

constexpr char kTag[] = "telemetry_server";

} // namespace

struct EspWebSocketTransport::PendingSend {
    EspWebSocketTransport *owner{nullptr};
    httpd_handle_t server{nullptr};
    int socket{-1};
    std::uint64_t session_id{0};
    std::size_t byte_count{0};
    std::unique_ptr<std::uint8_t[]> payload{};
};

EspWebSocketTransport::EspWebSocketTransport(std::size_t max_payload_bytes)
    : max_payload_bytes_(max_payload_bytes) {}

bool EspWebSocketTransport::connected() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return active_;
}

bool EspWebSocketTransport::ready() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return active_ && !send_in_flight_;
}

bool EspWebSocketTransport::send_text(std::string_view payload) {
    PendingSend *pending = nullptr;
    {
        std::lock_guard<std::mutex> lock(mutex_);
        if (!active_ || send_in_flight_) {
            ++counters_.dropped_frames;
            return false;
        }
        if (max_payload_bytes_ == 0 || payload.size() > max_payload_bytes_) {
            ++counters_.send_errors;
            return false;
        }

        pending = new (std::nothrow) PendingSend{};
        if (pending == nullptr) {
            ++counters_.send_errors;
            return false;
        }
        pending->payload.reset(
            new (std::nothrow) std::uint8_t[payload.size()]);
        if (pending->payload == nullptr) {
            ++counters_.send_errors;
            delete pending;
            return false;
        }

        pending->owner = this;
        pending->server = server_;
        pending->socket = socket_;
        pending->session_id = session_id_;
        pending->byte_count = payload.size();
        if (!payload.empty()) {
            std::memcpy(pending->payload.get(), payload.data(), payload.size());
        }
        send_in_flight_ = true;
    }

    httpd_ws_frame_t frame{};
    frame.type = HTTPD_WS_TYPE_TEXT;
    frame.payload = pending->payload.get();
    frame.len = pending->byte_count;

    const esp_err_t error =
        httpd_ws_send_data_async(pending->server,
                                 pending->socket,
                                 &frame,
                                 &EspWebSocketTransport::send_complete,
                                 pending);
    if (error != ESP_OK) {
        ESP_LOGW(kTag,
                 "WebSocket send queue failed fd=%d bytes=%u: %s",
                 pending->socket,
                 static_cast<unsigned>(pending->byte_count),
                 esp_err_to_name(error));
        finish_send(pending->socket, pending->session_id, error);
        delete pending;
        return false;
    }
    return true;
}

void EspWebSocketTransport::note_dropped_frame() {
    std::lock_guard<std::mutex> lock(mutex_);
    ++counters_.dropped_frames;
}

void EspWebSocketTransport::note_send_error() {
    std::lock_guard<std::mutex> lock(mutex_);
    ++counters_.send_errors;
}

TelemetryTransportCounters EspWebSocketTransport::counters() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return counters_;
}

bool EspWebSocketTransport::accept_and_send_initial(
    httpd_handle_t server,
    int socket,
    std::string_view payload) {
    if (max_payload_bytes_ == 0 || payload.size() > max_payload_bytes_) {
        note_send_error();
        return false;
    }

    auto *pending = new (std::nothrow) PendingSend{};
    if (pending == nullptr) {
        note_send_error();
        return false;
    }
    pending->payload.reset(
        new (std::nothrow) std::uint8_t[payload.size()]);
    if (pending->payload == nullptr) {
        note_send_error();
        delete pending;
        return false;
    }
    if (!payload.empty()) {
        std::memcpy(pending->payload.get(), payload.data(), payload.size());
    }

    httpd_handle_t replaced_server = nullptr;
    int replaced_socket = -1;
    {
        std::lock_guard<std::mutex> lock(mutex_);
        if (active_ && server_ != nullptr && socket_ != socket) {
            replaced_server = server_;
            replaced_socket = socket_;
        }
        server_ = server;
        socket_ = socket;
        ++session_id_;
        active_ = true;
        send_in_flight_ = true;
        pending->owner = this;
        pending->server = server_;
        pending->socket = socket_;
        pending->session_id = session_id_;
        pending->byte_count = payload.size();
    }
    if (replaced_server != nullptr) {
        (void)httpd_sess_trigger_close(replaced_server, replaced_socket);
    }
    ESP_LOGI(kTag, "WebSocket client connected fd=%d", socket);

    httpd_ws_frame_t frame{};
    frame.type = HTTPD_WS_TYPE_TEXT;
    frame.payload = pending->payload.get();
    frame.len = pending->byte_count;
    const esp_err_t error =
        httpd_ws_send_data_async(pending->server,
                                 pending->socket,
                                 &frame,
                                 &EspWebSocketTransport::send_complete,
                                 pending);
    if (error != ESP_OK) {
        ESP_LOGW(kTag,
                 "initial WebSocket send queue failed fd=%d bytes=%u: %s",
                 pending->socket,
                 static_cast<unsigned>(pending->byte_count),
                 esp_err_to_name(error));
        finish_send(pending->socket, pending->session_id, error);
        delete pending;
        return false;
    }
    return true;
}

void EspWebSocketTransport::close(int socket) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (active_ && socket_ == socket) {
        active_ = false;
        send_in_flight_ = false;
        ESP_LOGI(kTag, "WebSocket client closed fd=%d", socket);
    }
}

void EspWebSocketTransport::send_complete(esp_err_t error,
                                          int socket,
                                          void *context) {
    auto *pending = static_cast<PendingSend *>(context);
    pending->owner->finish_send(socket, pending->session_id, error);
    delete pending;
}

void EspWebSocketTransport::finish_send(int socket,
                                        std::uint64_t session_id,
                                        esp_err_t error) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (error == ESP_OK) {
        ++counters_.sent_frames;
    } else {
        ++counters_.send_errors;
        ESP_LOGW(kTag,
                 "WebSocket send failed fd=%d: %s",
                 socket,
                 esp_err_to_name(error));
    }

    if (active_ && socket_ == socket && session_id_ == session_id) {
        send_in_flight_ = false;
        if (error != ESP_OK) {
            active_ = false;
        }
    }
}

} // namespace ecu::telemetry_server
