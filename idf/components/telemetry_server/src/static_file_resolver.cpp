#include "telemetry_server/static_file_resolver.hpp"

#include <algorithm>
#include <utility>

namespace ecu::telemetry_server {

namespace {

bool ends_with(std::string_view value, std::string_view suffix) {
    return value.size() >= suffix.size() &&
           value.substr(value.size() - suffix.size()) == suffix;
}

} // namespace

StaticFileResolver::StaticFileResolver(std::string base_path, const IStaticFileCatalog &catalog)
    : base_path_(std::move(base_path)), catalog_(catalog) {
    while (base_path_.size() > 1 && base_path_.back() == '/') {
        base_path_.pop_back();
    }
}

StaticFileResolution StaticFileResolver::resolve(std::string_view uri) const {
    std::string logical_path = strip_query_and_fragment(uri);
    if (logical_path.empty() || logical_path.front() != '/') {
        logical_path.insert(logical_path.begin(), '/');
    }

    if (!is_safe_path(logical_path)) {
        StaticFileResolution result{};
        result.status = StaticFileResolveStatus::BadRequest;
        return result;
    }

    if (logical_path == "/") {
        logical_path = "/index.html";
    }

    const std::string exact_path = full_path(logical_path);
    if (catalog_.exists(exact_path)) {
        return ok(logical_path, exact_path, false);
    }

    const std::string gz_path = exact_path + ".gz";
    if (catalog_.exists(gz_path)) {
        return ok(logical_path, gz_path, true);
    }

    if (!has_extension(logical_path)) {
        const std::string index_logical = "/index.html";
        const std::string index_path = full_path(index_logical);
        if (catalog_.exists(index_path)) {
            return ok(index_logical, index_path, false);
        }
    }

    StaticFileResolution result{};
    result.status = StaticFileResolveStatus::NotFound;
    result.logical_path = logical_path;
    result.content_type = content_type_for(logical_path);
    return result;
}

std::string StaticFileResolver::strip_query_and_fragment(std::string_view uri) {
    const std::size_t end = uri.find_first_of("?#");
    uri = uri.substr(0, end == std::string_view::npos ? uri.size() : end);
    return std::string(uri);
}

bool StaticFileResolver::is_safe_path(std::string_view path) {
    return path.find("..") == std::string_view::npos &&
           path.find('\\') == std::string_view::npos;
}

bool StaticFileResolver::has_extension(std::string_view path) {
    const std::size_t slash = path.find_last_of('/');
    const std::size_t dot = path.find_last_of('.');
    return dot != std::string_view::npos &&
           (slash == std::string_view::npos || dot > slash);
}

std::string StaticFileResolver::content_type_for(std::string_view logical_path) {
    if (ends_with(logical_path, ".html")) {
        return "text/html";
    }
    if (ends_with(logical_path, ".js")) {
        return "application/javascript";
    }
    if (ends_with(logical_path, ".css")) {
        return "text/css";
    }
    if (ends_with(logical_path, ".png")) {
        return "image/png";
    }
    if (ends_with(logical_path, ".jpg") || ends_with(logical_path, ".jpeg")) {
        return "image/jpeg";
    }
    if (ends_with(logical_path, ".svg")) {
        return "image/svg+xml";
    }
    if (ends_with(logical_path, ".ico")) {
        return "image/x-icon";
    }
    if (ends_with(logical_path, ".json")) {
        return "application/json";
    }
    if (ends_with(logical_path, ".webp")) {
        return "image/webp";
    }
    return "text/plain";
}

std::string StaticFileResolver::full_path(std::string_view logical_path) const {
    std::string path = base_path_;
    path.append(logical_path.data(), logical_path.size());
    return path;
}

StaticFileResolution StaticFileResolver::ok(std::string logical_path,
                                            std::string filesystem_path,
                                            bool gzip_encoded) const {
    StaticFileResolution result{};
    result.status = StaticFileResolveStatus::Ok;
    result.logical_path = std::move(logical_path);
    result.filesystem_path = std::move(filesystem_path);
    result.content_type = content_type_for(result.logical_path);
    result.gzip_encoded = gzip_encoded;
    result.no_store = result.logical_path == "/index.html";
    return result;
}

} // namespace ecu::telemetry_server
