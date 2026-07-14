#pragma once

#include <array>
#include <cstddef>
#include <string_view>

namespace ecu::telemetry_server {

inline constexpr std::size_t kStaticBasePathCapacity = 64;
inline constexpr std::size_t kStaticLogicalPathCapacity = 512;
inline constexpr std::size_t kStaticFilesystemPathCapacity = 576;

enum class StaticFileResolveStatus {
    Ok,
    BadRequest,
    NotFound,
};

struct StaticFileResolution {
    StaticFileResolveStatus status{StaticFileResolveStatus::NotFound};
    std::array<char, kStaticLogicalPathCapacity> logical_path{};
    std::array<char, kStaticFilesystemPathCapacity> filesystem_path{};
    const char *content_type{"text/plain"};
    bool gzip_encoded{false};
    bool no_store{false};
};

class IStaticFileCatalog {
public:
    virtual ~IStaticFileCatalog() = default;

    virtual bool exists(const char *path) const = 0;
};

class StaticFileResolver {
public:
    StaticFileResolver(std::string_view base_path,
                       const IStaticFileCatalog &catalog);

    bool valid() const { return valid_; }
    StaticFileResolution resolve(std::string_view uri) const;

private:
    static std::string_view strip_query_and_fragment(std::string_view uri);
    static bool is_safe_path(std::string_view path);
    static bool has_extension(std::string_view path);
    static const char *content_type_for(std::string_view logical_path);

    bool copy_logical_path(std::string_view path,
                           std::array<char, kStaticLogicalPathCapacity> &out) const;
    bool make_full_path(
        std::string_view logical_path,
        std::array<char, kStaticFilesystemPathCapacity> &out) const;
    StaticFileResolution ok(
        const std::array<char, kStaticLogicalPathCapacity> &logical_path,
        const std::array<char, kStaticFilesystemPathCapacity> &filesystem_path,
        bool gzip_encoded) const;

    std::array<char, kStaticBasePathCapacity> base_path_{};
    std::size_t base_path_size_{0};
    const IStaticFileCatalog &catalog_;
    bool valid_{false};
};

} // namespace ecu::telemetry_server
