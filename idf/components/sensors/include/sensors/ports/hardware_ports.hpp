#pragma once

#include <optional>
#include <string_view>

#include "sensors/domain/types.hpp"

namespace ecu::sensors {

class ITimeSource {
public:
    virtual ~ITimeSource() = default;
    virtual TimestampUs now() const = 0;
};

class IAnalogSampleSource {
public:
    virtual ~IAnalogSampleSource() = default;
    virtual std::optional<AnalogSample> read(std::string_view channel) = 0;
};

class ISpiMeasurementSource {
public:
    virtual ~ISpiMeasurementSource() = default;
    virtual std::optional<Max31856Sample> read(std::string_view device) = 0;
};

class IDigitalInputSource {
public:
    virtual ~IDigitalInputSource() = default;
    virtual std::optional<DigitalSample> read_state(std::string_view input) = 0;
    virtual std::optional<DigitalEdge> read_edge(std::string_view input) = 0;
};

class IEdgeCaptureSource {
public:
    virtual ~IEdgeCaptureSource() = default;
    virtual std::optional<EdgeCapture> read_capture(std::string_view input) = 0;
};

class IKnockWindowDevice {
public:
    virtual ~IKnockWindowDevice() = default;
    virtual bool configure(std::uint32_t config_generation) = 0;
    virtual bool open_window(TimestampUs at) = 0;
    virtual bool close_window(TimestampUs at) = 0;
    virtual std::optional<TpicWindowResult> read_result() = 0;
};

} // namespace ecu::sensors
