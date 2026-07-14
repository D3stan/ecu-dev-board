#include "telemetry_server/static_file_resolver.hpp"

#include <cstring>

namespace ecu::telemetry_server {
namespace {

bool ends_with(std::string_view value, std::string_view suffix) {
    return value.size() >= suffix.size() &&
           value.substr(value.size() - suffix.size()) == suffix;
}

template <std::size_t Capacity>
bool copy_to_array(std::string_view source,
                   std::array<char, Capacity> &destination) {
    if (source.size() >= destination.size()) {
        return false;
    }

    if (!source.empty()) {
        std::memcpy(destination.data(), source.data(), source.size());
    }
    destination[source.size()] = '\0';
    return true;
}

} // namespace

StaticFileResolver::StaticFileResolver(
    std::string_view base_path,
    const IStaticFileCatalog &catalog)
    : catalog_(catalog) {
    if (base_path.find('\0') != std::string_view::npos) {
        return;
    }

    while (base_path.size() > 1 && base_path.back() == '/') {
        base_path.remove_suffix(1);
    }

    if (!copy_to_array(base_path, base_path_)) {
        return;
    }

    base_path_size_ = base_path.size();
    valid_ = true;
}

StaticFileResolution StaticFileResolver::resolve(std::string_view uri) const {
    StaticFileResolution result{};
    if (!valid_) {
        result.status = StaticFileResolveStatus::BadRequest;
        return result;
    }

    std::string_view stripped = strip_query_and_fragment(uri);
    if (stripped.find('\0') != std::string_view::npos) {
        result.status = StaticFileResolveStatus::BadRequest;
        return result;
    }

    std::array<char, kStaticLogicalPathCapacity> logical_path{};
    if (stripped.empty() || stripped.front() != '/') {
        if (stripped.size() + 1 >= logical_path.size()) {
            result.status = StaticFileResolveStatus::BadRequest;
            return result;
        }
        logical_path[0] = '/';
        if (!stripped.empty()) {
            std::memcpy(logical_path.data() + 1,
                        stripped.data(),
                        stripped.size());
        }
        logical_path[stripped.size() + 1] = '\0';
    } else if (!copy_logical_path(stripped, logical_path)) {
        result.status = StaticFileResolveStatus::BadRequest;
        return result;
    }

    std::string_view logical_view(logical_path.data());
    if (!is_safe_path(logical_view)) {
        result.status = StaticFileResolveStatus::BadRequest;
        return result;
    }

    if (logical_view == "/") {
        if (!copy_logical_path("/index.html", logical_path)) {
            result.status = StaticFileResolveStatus::BadRequest;
            return result;
        }
        logical_view = std::string_view(logical_path.data());
    }

    if (!copy_logical_path(logical_view, result.logical_path)) {
        result.status = StaticFileResolveStatus::BadRequest;
        return result;
    }
    result.content_type = content_type_for(logical_view);

    std::array<char, kStaticFilesystemPathCapacity> filesystem_path{};
    if (!make_full_path(logical_view, filesystem_path)) {
        result.status = StaticFileResolveStatus::BadRequest;
        return result;
    }

    if (catalog_.exists(filesystem_path.data())) {
        return ok(logical_path, filesystem_path, false);
    }

    const std::size_t exact_size =
        std::char_traits<char>::length(filesystem_path.data());
    constexpr std::string_view gzip_suffix{".gz"};
    if (gzip_suffix.size() >= filesystem_path.size() - exact_size) {
        result.status = StaticFileResolveStatus::BadRequest;
        return result;
    }
    std::memcpy(filesystem_path.data() + exact_size,
                gzip_suffix.data(),
                gzip_suffix.size());
    filesystem_path[exact_size + gzip_suffix.size()] = '\0';
    if (catalog_.exists(filesystem_path.data())) {
        return ok(logical_path, filesystem_path, true);
    }

    if (!has_extension(logical_view)) {
        constexpr std::string_view index_logical{"/index.html"};
        if (!copy_logical_path(index_logical, logical_path) ||
            !make_full_path(index_logical, filesystem_path)) {
            result.status = StaticFileResolveStatus::BadRequest;
            return result;
        }
        if (catalog_.exists(filesystem_path.data())) {
            return ok(logical_path, filesystem_path, false);
        }
    }

    result.status = StaticFileResolveStatus::NotFound;
    return result;
}

std::string_view StaticFileResolver::strip_query_and_fragment(
    std::string_view uri) {
    const std::size_t end = uri.find_first_of("?#");
    return uri.substr(0,
                      end == std::string_view::npos ? uri.size() : end);
}

bool StaticFileResolver::is_safe_path(std::string_view path) {
    return path.find("..") == std::string_view::npos &&
           path.find('\\') == std::string_view::npos &&
           path.find('\0') == std::string_view::npos;
}

bool StaticFileResolver::has_extension(std::string_view path) {
    const std::size_t slash = path.find_last_of('/');
    const std::size_t dot = path.find_last_of('.');
    return dot != std::string_view::npos &&
           (slash == std::string_view::npos || dot > slash);
}

const char *StaticFileResolver::content_type_for(
    std::string_view logical_path) {
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
    if (ends_with(logical_path, ".jpg") ||
        ends_with(logical_path, ".jpeg")) {
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

bool StaticFileResolver::copy_logical_path(
    std::string_view path,
    std::array<char, kStaticLogicalPathCapacity> &out) const {
    return copy_to_array(path, out);
}

bool StaticFileResolver::make_full_path(
    std::string_view logical_path,
    std::array<char, kStaticFilesystemPathCapacity> &out) const {
    if (base_path_size_ >= out.size() ||
        logical_path.size() >= out.size() - base_path_size_) {
        return false;
    }

    if (base_path_size_ != 0) {
        std::memcpy(out.data(), base_path_.data(), base_path_size_);
    }
    if (!logical_path.empty()) {
        std::memcpy(out.data() + base_path_size_,
                    logical_path.data(),
                    logical_path.size());
    }
    out[base_path_size_ + logical_path.size()] = '\0';
    return true;
}

StaticFileResolution StaticFileResolver::ok(
    const std::array<char, kStaticLogicalPathCapacity> &logical_path,
    const std::array<char, kStaticFilesystemPathCapacity> &filesystem_path,
    bool gzip_encoded) const {
    StaticFileResolution result{};
    result.status = StaticFileResolveStatus::Ok;
    result.logical_path = logical_path;
    result.filesystem_path = filesystem_path;
    result.content_type = content_type_for(result.logical_path.data());
    result.gzip_encoded = gzip_encoded;
    result.no_store =
        std::string_view(result.logical_path.data()) == "/index.html";
    return result;
}

} // namespace ecu::telemetry_server
