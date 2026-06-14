#include "sensor_drivers/gpio_input_source.hpp"

#include <cstring>

namespace ecu::sensor_drivers {

namespace {

bool name_matches(const char *name, std::string_view requested) {
    return name != nullptr && requested == std::string_view(name);
}

} // namespace

EspGpioInputSource::EspGpioInputSource(const GpioInputBinding *bindings,
                                       std::size_t binding_count,
                                       ecu::sensors::ITimeSource &time_source)
    : bindings_(bindings),
      binding_count_(binding_count),
      time_source_(time_source) {
    const std::size_t count = binding_count_ < edge_queues_.size() ? binding_count_ : edge_queues_.size();
    for (std::size_t i = 0; i < count; ++i) {
        edge_queues_[i].name = bindings_[i].name;
    }
}

std::optional<ecu::sensors::DigitalSample> EspGpioInputSource::read_state(std::string_view input) {
    if (bindings_ == nullptr) {
        return std::nullopt;
    }

    for (std::size_t i = 0; i < binding_count_; ++i) {
        if (name_matches(bindings_[i].name, input)) {
            ecu::sensors::DigitalSample sample{};
            sample.acquired_at = time_source_.now();
            sample.level_high = gpio_get_level(bindings_[i].gpio) != 0;
            sample.status = ecu::sensors::DigitalSampleStatus::Ok;
            return sample;
        }
    }
    return std::nullopt;
}

std::optional<ecu::sensors::DigitalEdge> EspGpioInputSource::read_edge(std::string_view input) {
    for (auto &queue : edge_queues_) {
        if (name_matches(queue.name, input)) {
            return queue.queue.pop();
        }
    }
    return std::nullopt;
}

bool EspGpioInputSource::record_edge(std::string_view input,
                                     bool level_high,
                                     ecu::sensors::EdgeKind edge,
                                     ecu::sensors::TimestampUs acquired_at) {
    for (auto &queue : edge_queues_) {
        if (name_matches(queue.name, input)) {
            ecu::sensors::DigitalEdge record{};
            record.level_high = level_high;
            record.edge = edge;
            record.acquired_at = acquired_at;
            record.status = ecu::sensors::DigitalSampleStatus::Ok;
            return queue.queue.push(record);
        }
    }
    return false;
}

std::uint32_t EspGpioInputSource::overflow_count(std::string_view input) const {
    for (const auto &queue : edge_queues_) {
        if (name_matches(queue.name, input)) {
            return queue.queue.overflow_count();
        }
    }
    return 0;
}

EspEdgeCaptureSource::EspEdgeCaptureSource(ecu::sensors::ITimeSource &time_source)
    : time_source_(time_source) {}

std::optional<ecu::sensors::EdgeCapture> EspEdgeCaptureSource::read_capture(std::string_view input) {
    while (auto named = queue_.pop()) {
        if (name_matches(named->name, input)) {
            return named->capture;
        }
    }
    return std::nullopt;
}

bool EspEdgeCaptureSource::record_capture(std::string_view input,
                                          ecu::sensors::EdgePolarity polarity,
                                          ecu::sensors::CaptureStatus status,
                                          ecu::sensors::TimestampUs captured_at) {
    (void)time_source_;
    NamedCapture named{};
    named.name = input.data();
    named.capture.captured_at = captured_at;
    named.capture.polarity = polarity;
    named.capture.status = status;
    return queue_.push(named);
}

} // namespace ecu::sensor_drivers
