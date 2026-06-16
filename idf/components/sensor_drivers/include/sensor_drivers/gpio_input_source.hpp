#pragma once

#include <array>
#include <cstddef>
#include <optional>
#include <string_view>

#include "driver/gpio.h"
#include "sensor_drivers/fixed_raw_queue.hpp"
#include "sensors/ports/hardware_ports.hpp"

namespace ecu::sensor_drivers {

struct GpioInputBinding {
    const char *name;
    gpio_num_t gpio;
};

class EspGpioInputSource final : public ecu::sensors::IDigitalInputSource {
public:
    EspGpioInputSource(const GpioInputBinding *bindings,
                       std::size_t binding_count,
                       ecu::sensors::ITimeSource &time_source);

    std::optional<ecu::sensors::DigitalSample> read_state(std::string_view input) override;
    std::optional<ecu::sensors::DigitalEdge> read_edge(std::string_view input) override;

    bool record_edge(std::string_view input,
                     bool level_high,
                     ecu::sensors::EdgeKind edge,
                     ecu::sensors::TimestampUs acquired_at);
    std::uint32_t overflow_count(std::string_view input) const;

private:
    struct EdgeQueue {
        const char *name{nullptr};
        FixedRawQueue<ecu::sensors::DigitalEdge, 16> queue{};
    };

    const GpioInputBinding *bindings_{nullptr};
    std::size_t binding_count_{0};
    ecu::sensors::ITimeSource &time_source_;
    std::array<EdgeQueue, 8> edge_queues_{};
};

class EspEdgeCaptureSource final : public ecu::sensors::IEdgeCaptureSource {
public:
    explicit EspEdgeCaptureSource(ecu::sensors::ITimeSource &time_source);
    std::optional<ecu::sensors::EdgeCapture> read_capture(std::string_view input) override;

    bool record_capture(std::string_view input,
                        ecu::sensors::EdgePolarity polarity,
                        ecu::sensors::CaptureStatus status,
                        ecu::sensors::TimestampUs captured_at);
    std::uint32_t overflow_count() const { return queue_.overflow_count(); }

private:
    struct NamedCapture {
        const char *name{nullptr};
        ecu::sensors::EdgeCapture capture{};
    };

    ecu::sensors::ITimeSource &time_source_;
    FixedRawQueue<NamedCapture, 16> queue_{};
};

} // namespace ecu::sensor_drivers
