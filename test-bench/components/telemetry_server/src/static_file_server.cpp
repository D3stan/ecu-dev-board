#include "runtime_internal.hpp"

#include <cstdio>
#include <cstring>

#include <sys/stat.h>

#include "esp_log.h"
#include "esp_spiffs.h"

namespace ecu::telemetry_server {
namespace {

constexpr char kTag[] = "telemetry_server";

} // namespace

StaticFileSystemMount::~StaticFileSystemMount() {
    if (mounted_) {
        (void)esp_vfs_spiffs_unregister(partition_label_.data());
        mounted_ = false;
    }
}

esp_err_t StaticFileSystemMount::mount(
    const telemetry_server_config_t &config) {
    esp_vfs_spiffs_conf_t mount_config{};
    mount_config.base_path = config.static_base_path;
    mount_config.partition_label = config.static_partition_label;
    mount_config.max_files = config.static_max_open_files;
    mount_config.format_if_mount_failed = false;

    const esp_err_t error = esp_vfs_spiffs_register(&mount_config);
    if (error != ESP_OK) {
        ESP_LOGE(kTag, "failed to mount SPIFFS: %s", esp_err_to_name(error));
        return error;
    }

    const std::size_t label_size = std::strlen(config.static_partition_label);
    std::memcpy(partition_label_.data(),
                config.static_partition_label,
                label_size + 1);
    mounted_ = true;

    std::size_t total = 0;
    std::size_t used = 0;
    const esp_err_t info_error =
        esp_spiffs_info(partition_label_.data(), &total, &used);
    if (info_error == ESP_OK) {
        ESP_LOGI(kTag,
                 "SPIFFS mounted, used=%u total=%u",
                 static_cast<unsigned>(used),
                 static_cast<unsigned>(total));
    } else {
        ESP_LOGW(kTag,
                 "SPIFFS mounted, size query failed: %s",
                 esp_err_to_name(info_error));
    }
    return ESP_OK;
}

bool PosixStaticFileCatalog::exists(const char *path) const {
    if (path == nullptr) {
        return false;
    }
    struct stat status {};
    return stat(path, &status) == 0 && S_ISREG(status.st_mode);
}

StaticFileHandler::StaticFileHandler(
    const char *base_path,
    const IStaticFileCatalog &catalog,
    const RuntimeDiagnostics &diagnostics,
    bool close_connection)
    : resolver_(base_path != nullptr ? base_path : "", catalog),
      diagnostics_(diagnostics),
      close_connection_(close_connection) {}

bool StaticFileHandler::valid() const {
    return resolver_.valid();
}

esp_err_t StaticFileHandler::register_handlers(httpd_handle_t server) {
    if (server == nullptr || !valid()) {
        return ESP_ERR_INVALID_ARG;
    }

    httpd_uri_t static_uri{};
    static_uri.uri = "/*";
    static_uri.method = HTTP_GET;
    static_uri.handler = &StaticFileHandler::handle_request;
    static_uri.user_ctx = this;
    return httpd_register_uri_handler(server, &static_uri);
}

esp_err_t StaticFileHandler::handle_request(httpd_req_t *request) {
    if (request == nullptr || request->user_ctx == nullptr) {
        return ESP_ERR_INVALID_ARG;
    }
    return static_cast<StaticFileHandler *>(request->user_ctx)->serve(*request);
}

esp_err_t StaticFileHandler::serve(httpd_req_t &request) {
    diagnostics_.check_heap("before static request");
    const auto resolved = resolver_.resolve(request.uri);
    if (resolved.status == StaticFileResolveStatus::BadRequest) {
        set_connection_close(request);
        return httpd_resp_send_err(&request,
                                   HTTPD_400_BAD_REQUEST,
                                   "Bad static file path");
    }
    if (resolved.status == StaticFileResolveStatus::NotFound) {
        set_connection_close(request);
        return httpd_resp_send_err(&request,
                                   HTTPD_404_NOT_FOUND,
                                   "Static file not found");
    }

    FILE *file = std::fopen(resolved.filesystem_path.data(), "rb");
    if (file == nullptr) {
        set_connection_close(request);
        return httpd_resp_send_err(&request,
                                   HTTPD_500_INTERNAL_SERVER_ERROR,
                                   "Static file open failed");
    }

    while (true) {
        const std::size_t bytes_read =
            std::fread(scratch_.data(), 1, scratch_.size(), file);
        if (bytes_read < scratch_.size()) {
            if (std::ferror(file) != 0) {
                std::fclose(file);
                set_connection_close(request);
                return httpd_resp_send_err(&request,
                                           HTTPD_500_INTERNAL_SERVER_ERROR,
                                           "Static file read failed");
            }
            break;
        }
    }
    if (std::fseek(file, 0, SEEK_SET) != 0) {
        std::fclose(file);
        set_connection_close(request);
        return httpd_resp_send_err(&request,
                                   HTTPD_500_INTERNAL_SERVER_ERROR,
                                   "Static file rewind failed");
    }

    (void)httpd_resp_set_type(&request, resolved.content_type);
    if (resolved.gzip_encoded) {
        (void)httpd_resp_set_hdr(&request, "Content-Encoding", "gzip");
    }
    (void)httpd_resp_set_hdr(
        &request,
        "Cache-Control",
        resolved.no_store ? "no-store, max-age=0"
                          : "public, max-age=31536000, immutable");
    set_connection_close(request);

    while (true) {
        const std::size_t bytes_read =
            std::fread(scratch_.data(), 1, scratch_.size(), file);
        if (bytes_read != 0) {
            const esp_err_t send_error = httpd_resp_send_chunk(
                &request, scratch_.data(), bytes_read);
            if (send_error != ESP_OK) {
                std::fclose(file);
                return send_error;
            }
        }

        if (bytes_read < scratch_.size()) {
            if (std::ferror(file) != 0) {
                std::fclose(file);
                return ESP_FAIL;
            }
            break;
        }
    }

    std::fclose(file);
    const esp_err_t result = httpd_resp_send_chunk(&request, nullptr, 0);
    diagnostics_.check_heap("after static request");
    return result;
}

void StaticFileHandler::set_connection_close(httpd_req_t &request) const {
    if (close_connection_) {
        (void)httpd_resp_set_hdr(&request, "Connection", "close");
    }
}

} // namespace ecu::telemetry_server
