#include "runtime_internal.hpp"

#include <cerrno>
#include <cstring>
#include <new>
#include <sys/socket.h>

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
    : max_payload_bytes_(max_payload_bytes) {
    close_work_.owner = this;
}

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
    int failed_socket = -1;
    bool close_required = false;
    esp_err_t prepare_error = ESP_OK;
    {
        std::lock_guard<std::mutex> lock(mutex_);
        if (!active_ || send_in_flight_) {
            ++counters_.dropped_frames;
            return false;
        }
        if (max_payload_bytes_ == 0 || payload.size() > max_payload_bytes_) {
            prepare_error = ESP_ERR_INVALID_SIZE;
        } else {
            pending = new (std::nothrow) PendingSend{};
            if (pending == nullptr) {
                prepare_error = ESP_ERR_NO_MEM;
            } else {
                pending->payload.reset(
                    new (std::nothrow) std::uint8_t[payload.size()]);
                if (pending->payload == nullptr) {
                    prepare_error = ESP_ERR_NO_MEM;
                    delete pending;
                    pending = nullptr;
                }
            }
        }

        if (prepare_error != ESP_OK) {
            ++counters_.send_errors;
            failed_socket = socket_;
            active_ = false;
            send_in_flight_ = false;
            close_required =
                require_close_locked(server_, socket_, session_id_);
        } else {
            pending->owner = this;
            pending->server = server_;
            pending->socket = socket_;
            pending->session_id = session_id_;
            pending->byte_count = payload.size();
            if (!payload.empty()) {
                std::memcpy(pending->payload.get(),
                            payload.data(),
                            payload.size());
            }
            send_in_flight_ = true;
        }
    }

    if (prepare_error != ESP_OK) {
        ESP_LOGW(kTag,
                 "WebSocket send preparation failed fd=%d bytes=%u: %s",
                 failed_socket,
                 static_cast<unsigned>(payload.size()),
                 esp_err_to_name(prepare_error));
        if (close_required) {
            service_pending_close();
        }
        return false;
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
        finish_send(pending->socket,
                    pending->session_id,
                    error,
                    true);
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

    bool reject = false;
    {
        std::lock_guard<std::mutex> lock(mutex_);
        if (close_required_) {
            reject = true;
        } else if (active_) {
            active_ = false;
            send_in_flight_ = false;
            (void)require_close_locked(server_, socket_, session_id_);
            reject = true;
        } else {
            server_ = server;
            socket_ = socket;
            ++session_id_;
            session_marker_.session_id = session_id_;
            active_ = true;
            send_in_flight_ = true;
            pending->owner = this;
            pending->server = server_;
            pending->socket = socket_;
            pending->session_id = session_id_;
            pending->byte_count = payload.size();
        }
    }
    if (reject) {
        delete pending;
        ESP_LOGW(kTag,
                 "WebSocket client rejected while prior session closes fd=%d",
                 socket);
        return false;
    }

    httpd_sess_set_ctx(server,
                       socket,
                       &session_marker_,
                       &EspWebSocketTransport::release_session_marker);
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
        finish_send(pending->socket,
                    pending->session_id,
                    error,
                    false);
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
    pending->owner->finish_send(socket,
                                pending->session_id,
                                error,
                                true);
    delete pending;
}

void EspWebSocketTransport::close_session_work(void *context) {
    auto *work = static_cast<CloseWork *>(context);
    work->owner->run_close_session_work();
}

void EspWebSocketTransport::release_session_marker(void *) {
    // The marker is embedded in this transport and must not be freed by HTTPD.
}

bool EspWebSocketTransport::require_close_locked(
    httpd_handle_t server,
    int socket,
    std::uint64_t session_id) {
    if (server == nullptr || socket < 0 || close_required_) {
        return false;
    }
    close_work_.server = server;
    close_work_.socket = socket;
    close_work_.session_id = session_id;
    close_required_ = true;
    close_queued_ = false;
    return true;
}

void EspWebSocketTransport::service_pending_close() {
    httpd_handle_t server = nullptr;
    int socket = -1;
    std::uint64_t session_id = 0;
    {
        std::lock_guard<std::mutex> lock(mutex_);
        if (!close_required_ || close_queued_) {
            return;
        }
        close_queued_ = true;
        server = close_work_.server;
        socket = close_work_.socket;
        session_id = close_work_.session_id;
    }

    const esp_err_t error =
        httpd_queue_work(server,
                         &EspWebSocketTransport::close_session_work,
                         &close_work_);
    if (error == ESP_OK) {
        return;
    }

    {
        std::lock_guard<std::mutex> lock(mutex_);
        if (close_required_ && close_work_.server == server &&
            close_work_.socket == socket &&
            close_work_.session_id == session_id) {
            close_queued_ = false;
        }
    }
    ESP_LOGW(kTag,
             "WebSocket close work queue failed fd=%d: %s",
             socket,
             esp_err_to_name(error));
}

void EspWebSocketTransport::run_close_session_work() {
    httpd_handle_t server = nullptr;
    int socket = -1;
    std::uint64_t session_id = 0;
    {
        std::lock_guard<std::mutex> lock(mutex_);
        if (!close_required_ || !close_queued_) {
            return;
        }
        server = close_work_.server;
        socket = close_work_.socket;
        session_id = close_work_.session_id;
    }

    // This runs in the HTTPD task, so the marker check and shutdown cannot be
    // interleaved with HTTPD session-slot deletion or reuse.
    bool matches =
        httpd_sess_get_ctx(server, socket) == &session_marker_;
    {
        std::lock_guard<std::mutex> lock(mutex_);
        matches = matches && close_required_ && close_queued_ &&
                  close_work_.server == server &&
                  close_work_.socket == socket &&
                  close_work_.session_id == session_id &&
                  session_marker_.session_id == session_id;
    }

    bool retry = false;
    if (matches && shutdown(socket, SHUT_RDWR) != 0) {
        retry = true;
        ESP_LOGW(kTag,
                 "WebSocket shutdown failed fd=%d errno=%d",
                 socket,
                 errno);
    }

    {
        std::lock_guard<std::mutex> lock(mutex_);
        if (close_required_ && close_queued_ &&
            close_work_.server == server &&
            close_work_.socket == socket &&
            close_work_.session_id == session_id) {
            close_queued_ = false;
            if (!retry) {
                close_required_ = false;
            }
        }
    }
}

void EspWebSocketTransport::finish_send(int socket,
                                        std::uint64_t session_id,
                                        esp_err_t error,
                                        bool require_physical_close) {
    bool close_required = false;
    {
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
                if (require_physical_close) {
                    close_required = require_close_locked(
                        server_, socket_, session_id_);
                }
            }
        }
    }
    if (close_required) {
        service_pending_close();
    }
}

} // namespace ecu::telemetry_server
