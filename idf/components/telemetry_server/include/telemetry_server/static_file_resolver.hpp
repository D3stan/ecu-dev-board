#pragma once

#include <string>
#include <string_view>

namespace ecu::telemetry_server {

enum class StaticFileResolveStatus {
    Ok,
    BadRequest,
    NotFound,
};

struct StaticFileResolution {
    StaticFileResolveStatus status{StaticFileResolveStatus::NotFound};
    std::string logical_path{};
    std::string filesystem_path{};
    std::string content_type{"text/plain"};
    bool gzip_encoded{false};
    bool no_store{false};
};

class IStaticFileCatalog {
public:
    virtual ~IStaticFileCatalog() = default;

    virtual bool exists(std::string_view path) const = 0;
};

class StaticFileResolver {
public:
    StaticFileResolver(std::string base_path, const IStaticFileCatalog &catalog);

    StaticFileResolution resolve(std::string_view uri) const;

private:
    static std::string strip_query_and_fragment(std::string_view uri);
    static bool is_safe_path(std::string_view path);
    static bool has_extension(std::string_view path);
    static std::string content_type_for(std::string_view logical_path);

    std::string full_path(std::string_view logical_path) const;
    StaticFileResolution ok(std::string logical_path, std::string filesystem_path, bool gzip_encoded) const;

    std::string base_path_;
    const IStaticFileCatalog &catalog_;
};

} // namespace ecu::telemetry_server
