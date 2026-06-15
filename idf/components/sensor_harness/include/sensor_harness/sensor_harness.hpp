#pragma once

#include <cstdint>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include "sensors/domain/fake_sources.hpp"
#include "sensors/domain/sensor_data_store.hpp"
#include "sensors/ports/hardware_ports.hpp"

namespace ecu::sensor_harness {

inline constexpr char kTpsChannel[] = "tps";
inline constexpr char kWaterChannel[] = "water";
inline constexpr char kEgtDevice[] = "egt";
inline constexpr char kQuickInput[] = "quick";
inline constexpr char kMapInput[] = "map";
inline constexpr char kPickupInput[] = "pickup";

enum class HarnessInputSource {
    Fake,
    Real,
};

struct HarnessInputRoutes {
    HarnessInputSource tps{HarnessInputSource::Fake};
    HarnessInputSource water{HarnessInputSource::Fake};
    HarnessInputSource egt{HarnessInputSource::Fake};
    HarnessInputSource quick{HarnessInputSource::Fake};
    HarnessInputSource map{HarnessInputSource::Fake};
    HarnessInputSource pickup{HarnessInputSource::Fake};
    HarnessInputSource knock{HarnessInputSource::Fake};
};

struct FakeStimulusMask {
    bool tps{true};
    bool water{true};
    bool egt{true};
    bool quick{true};
    bool map{true};
    bool pickup{true};
    bool knock{true};
};

FakeStimulusMask fake_stimulus_mask_from_routes(const HarnessInputRoutes &routes);

class MuxAnalogSampleSource final : public ecu::sensors::IAnalogSampleSource {
public:
    MuxAnalogSampleSource(ecu::sensors::IAnalogSampleSource &fake_source,
                          ecu::sensors::IAnalogSampleSource &real_source,
                          HarnessInputRoutes routes);

    std::optional<ecu::sensors::AnalogSample> read(std::string_view channel) override;

private:
    ecu::sensors::IAnalogSampleSource &fake_source_;
    ecu::sensors::IAnalogSampleSource &real_source_;
    HarnessInputRoutes routes_{};
};

class MuxSpiMeasurementSource final : public ecu::sensors::ISpiMeasurementSource {
public:
    MuxSpiMeasurementSource(ecu::sensors::ISpiMeasurementSource &fake_source,
                            ecu::sensors::ISpiMeasurementSource &real_source,
                            HarnessInputRoutes routes);

    std::optional<ecu::sensors::Max31856Sample> read(std::string_view device) override;

private:
    ecu::sensors::ISpiMeasurementSource &fake_source_;
    ecu::sensors::ISpiMeasurementSource &real_source_;
    HarnessInputRoutes routes_{};
};

class MuxDigitalInputSource final : public ecu::sensors::IDigitalInputSource {
public:
    MuxDigitalInputSource(ecu::sensors::IDigitalInputSource &fake_source,
                          ecu::sensors::IDigitalInputSource &real_source,
                          HarnessInputRoutes routes);

    std::optional<ecu::sensors::DigitalSample> read_state(std::string_view input) override;
    std::optional<ecu::sensors::DigitalEdge> read_edge(std::string_view input) override;

private:
    ecu::sensors::IDigitalInputSource &fake_source_;
    ecu::sensors::IDigitalInputSource &real_source_;
    HarnessInputRoutes routes_{};
};

class MuxEdgeCaptureSource final : public ecu::sensors::IEdgeCaptureSource {
public:
    MuxEdgeCaptureSource(ecu::sensors::IEdgeCaptureSource &fake_source,
                         ecu::sensors::IEdgeCaptureSource &real_source,
                         HarnessInputRoutes routes);

    std::optional<ecu::sensors::EdgeCapture> read_capture(std::string_view input) override;

private:
    ecu::sensors::IEdgeCaptureSource &fake_source_;
    ecu::sensors::IEdgeCaptureSource &real_source_;
    HarnessInputRoutes routes_{};
};

class MuxKnockWindowDevice final : public ecu::sensors::IKnockWindowDevice {
public:
    MuxKnockWindowDevice(ecu::sensors::IKnockWindowDevice &fake_device,
                         ecu::sensors::IKnockWindowDevice &real_device,
                         HarnessInputRoutes routes);

    bool configure(std::uint32_t config_generation) override;
    bool open_window(ecu::sensors::TimestampUs at) override;
    bool close_window(ecu::sensors::TimestampUs at) override;
    std::optional<ecu::sensors::TpicWindowResult> read_result() override;

private:
    ecu::sensors::IKnockWindowDevice &fake_device_;
    ecu::sensors::IKnockWindowDevice &real_device_;
    HarnessInputRoutes routes_{};
};

class FakeSensorStimulus {
public:
    void push_next(ecu::sensors::FakeAnalogSampleSource &analog,
                   ecu::sensors::FakeSpiMeasurementSource &spi,
                   ecu::sensors::FakeDigitalInputSource &digital,
                   ecu::sensors::FakeEdgeCaptureSource &pickup,
                   ecu::sensors::FakeKnockWindowDevice &knock);

    void push_next(ecu::sensors::FakeAnalogSampleSource &analog,
                   ecu::sensors::FakeSpiMeasurementSource &spi,
                   ecu::sensors::FakeDigitalInputSource &digital,
                   ecu::sensors::FakeEdgeCaptureSource &pickup,
                   ecu::sensors::FakeKnockWindowDevice &knock,
                   const FakeStimulusMask &mask);

private:
    ecu::sensors::TimestampUs now_us_{0};
    std::uint32_t step_{0};
    bool map_level_high_{true};
};

const char *csv_header();

std::string format_snapshot_csv(const ecu::sensors::EngineInputSnapshot &snapshot,
                                ecu::sensors::TimestampUs now,
                                const ecu::sensors::KnockWindowMeasurement &latest_knock);

std::vector<std::string> drain_event_lines(ecu::sensors::SensorDataStore &store);

} // namespace ecu::sensor_harness
