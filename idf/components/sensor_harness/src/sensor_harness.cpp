#include "sensor_harness/sensor_harness.hpp"

#include <iomanip>
#include <optional>
#include <sstream>

namespace ecu::sensor_harness {

namespace {

int bool_to_int(bool value) {
    return value ? 1 : 0;
}

int map_secondary(const ecu::sensors::EngineInputSnapshot &snapshot) {
    return bool_to_int(snapshot.map_switch.value.request == ecu::sensors::PhysicalMapRequest::Secondary);
}

ecu::sensors::IAnalogSampleSource &select_source(HarnessInputSource route,
                                                 ecu::sensors::IAnalogSampleSource &fake_source,
                                                 ecu::sensors::IAnalogSampleSource &real_source) {
    return route == HarnessInputSource::Real ? real_source : fake_source;
}

ecu::sensors::ISpiMeasurementSource &select_source(HarnessInputSource route,
                                                   ecu::sensors::ISpiMeasurementSource &fake_source,
                                                   ecu::sensors::ISpiMeasurementSource &real_source) {
    return route == HarnessInputSource::Real ? real_source : fake_source;
}

ecu::sensors::IDigitalInputSource &select_source(HarnessInputSource route,
                                                 ecu::sensors::IDigitalInputSource &fake_source,
                                                 ecu::sensors::IDigitalInputSource &real_source) {
    return route == HarnessInputSource::Real ? real_source : fake_source;
}

ecu::sensors::IEdgeCaptureSource &select_source(HarnessInputSource route,
                                                ecu::sensors::IEdgeCaptureSource &fake_source,
                                                ecu::sensors::IEdgeCaptureSource &real_source) {
    return route == HarnessInputSource::Real ? real_source : fake_source;
}

ecu::sensors::IKnockWindowDevice &select_source(HarnessInputSource route,
                                                ecu::sensors::IKnockWindowDevice &fake_device,
                                                ecu::sensors::IKnockWindowDevice &real_device) {
    return route == HarnessInputSource::Real ? real_device : fake_device;
}

std::optional<HarnessInputSource> analog_route(std::string_view channel, const HarnessInputRoutes &routes) {
    if (channel == kTpsChannel) {
        return routes.tps;
    }
    if (channel == kWaterChannel) {
        return routes.water;
    }
    return std::nullopt;
}

std::optional<HarnessInputSource> digital_route(std::string_view input, const HarnessInputRoutes &routes) {
    if (input == kQuickInput) {
        return routes.quick;
    }
    if (input == kMapInput) {
        return routes.map;
    }
    return std::nullopt;
}

} // namespace

FakeStimulusMask fake_stimulus_mask_from_routes(const HarnessInputRoutes &routes) {
    FakeStimulusMask mask{};
    mask.tps = routes.tps == HarnessInputSource::Fake;
    mask.water = routes.water == HarnessInputSource::Fake;
    mask.egt = routes.egt == HarnessInputSource::Fake;
    mask.quick = routes.quick == HarnessInputSource::Fake;
    mask.map = routes.map == HarnessInputSource::Fake;
    mask.pickup = routes.pickup == HarnessInputSource::Fake;
    mask.knock = routes.knock == HarnessInputSource::Fake;
    return mask;
}

MuxAnalogSampleSource::MuxAnalogSampleSource(ecu::sensors::IAnalogSampleSource &fake_source,
                                             ecu::sensors::IAnalogSampleSource &real_source,
                                             HarnessInputRoutes routes)
    : fake_source_(fake_source), real_source_(real_source), routes_(routes) {}

std::optional<ecu::sensors::AnalogSample> MuxAnalogSampleSource::read(std::string_view channel) {
    auto route = analog_route(channel, routes_);
    if (!route.has_value()) {
        return std::nullopt;
    }
    return select_source(*route, fake_source_, real_source_).read(channel);
}

MuxSpiMeasurementSource::MuxSpiMeasurementSource(ecu::sensors::ISpiMeasurementSource &fake_source,
                                                 ecu::sensors::ISpiMeasurementSource &real_source,
                                                 HarnessInputRoutes routes)
    : fake_source_(fake_source), real_source_(real_source), routes_(routes) {}

std::optional<ecu::sensors::Max31856Sample> MuxSpiMeasurementSource::read(std::string_view device) {
    if (device != kEgtDevice) {
        return std::nullopt;
    }
    return select_source(routes_.egt, fake_source_, real_source_).read(device);
}

MuxDigitalInputSource::MuxDigitalInputSource(ecu::sensors::IDigitalInputSource &fake_source,
                                             ecu::sensors::IDigitalInputSource &real_source,
                                             HarnessInputRoutes routes)
    : fake_source_(fake_source), real_source_(real_source), routes_(routes) {}

std::optional<ecu::sensors::DigitalSample> MuxDigitalInputSource::read_state(std::string_view input) {
    auto route = digital_route(input, routes_);
    if (!route.has_value()) {
        return std::nullopt;
    }
    return select_source(*route, fake_source_, real_source_).read_state(input);
}

std::optional<ecu::sensors::DigitalEdge> MuxDigitalInputSource::read_edge(std::string_view input) {
    auto route = digital_route(input, routes_);
    if (!route.has_value()) {
        return std::nullopt;
    }
    return select_source(*route, fake_source_, real_source_).read_edge(input);
}

MuxEdgeCaptureSource::MuxEdgeCaptureSource(ecu::sensors::IEdgeCaptureSource &fake_source,
                                           ecu::sensors::IEdgeCaptureSource &real_source,
                                           HarnessInputRoutes routes)
    : fake_source_(fake_source), real_source_(real_source), routes_(routes) {}

std::optional<ecu::sensors::EdgeCapture> MuxEdgeCaptureSource::read_capture(std::string_view input) {
    if (input != kPickupInput) {
        return std::nullopt;
    }
    return select_source(routes_.pickup, fake_source_, real_source_).read_capture(input);
}

MuxKnockWindowDevice::MuxKnockWindowDevice(ecu::sensors::IKnockWindowDevice &fake_device,
                                           ecu::sensors::IKnockWindowDevice &real_device,
                                           HarnessInputRoutes routes)
    : fake_device_(fake_device), real_device_(real_device), routes_(routes) {}

bool MuxKnockWindowDevice::configure(std::uint32_t config_generation) {
    return select_source(routes_.knock, fake_device_, real_device_).configure(config_generation);
}

bool MuxKnockWindowDevice::open_window(ecu::sensors::TimestampUs at) {
    return select_source(routes_.knock, fake_device_, real_device_).open_window(at);
}

bool MuxKnockWindowDevice::close_window(ecu::sensors::TimestampUs at) {
    return select_source(routes_.knock, fake_device_, real_device_).close_window(at);
}

std::optional<ecu::sensors::TpicWindowResult> MuxKnockWindowDevice::read_result() {
    return select_source(routes_.knock, fake_device_, real_device_).read_result();
}

void FakeSensorStimulus::push_next(ecu::sensors::FakeAnalogSampleSource &analog,
                                   ecu::sensors::FakeSpiMeasurementSource &spi,
                                   ecu::sensors::FakeDigitalInputSource &digital,
                                   ecu::sensors::FakeEdgeCaptureSource &pickup,
                                   ecu::sensors::FakeKnockWindowDevice &knock) {
    push_next(analog, spi, digital, pickup, knock, FakeStimulusMask{});
}

void FakeSensorStimulus::push_next(ecu::sensors::FakeAnalogSampleSource &analog,
                                   ecu::sensors::FakeSpiMeasurementSource &spi,
                                   ecu::sensors::FakeDigitalInputSource &digital,
                                   ecu::sensors::FakeEdgeCaptureSource &pickup,
                                   ecu::sensors::FakeKnockWindowDevice &knock,
                                   const FakeStimulusMask &mask) {
    ++step_;
    now_us_ += 100000;

    const int tps_raw = 300 + static_cast<int>((step_ * 173) % 3300);
    const int water_raw = 1800 + static_cast<int>((step_ % 9) * 40);
    const float egt_celsius = 35.0f + static_cast<float>((step_ * 5) % 120);
    const std::uint32_t knock_count = 1000u + ((step_ * 37u) % 900u);

    if (mask.tps) {
        analog.push(kTpsChannel, ecu::sensors::AnalogSample{tps_raw, tps_raw, now_us_, ecu::sensors::AnalogSampleStatus::Ok});
    }
    if (mask.water) {
        analog.push(kWaterChannel, ecu::sensors::AnalogSample{water_raw, water_raw, now_us_, ecu::sensors::AnalogSampleStatus::Ok});
    }
    if (mask.egt) {
        spi.push(kEgtDevice, ecu::sensors::Max31856Sample{egt_celsius, now_us_, ecu::sensors::SpiSampleStatus::Ok, 0});
    }
    if (mask.pickup) {
        pickup.push(kPickupInput, ecu::sensors::EdgeCapture{now_us_, ecu::sensors::EdgePolarity::Falling, ecu::sensors::CaptureStatus::Ok});
    }
    if (mask.knock) {
        knock.push_result(ecu::sensors::TpicWindowResult{knock_count, now_us_ + 500, ecu::sensors::KnockDeviceStatus::Ok});
    }

    if (mask.quick && (step_ == 1 || step_ % 20 == 7)) {
        digital.push_edge(kQuickInput, ecu::sensors::DigitalEdge{true, ecu::sensors::EdgeKind::Rising, now_us_, ecu::sensors::DigitalSampleStatus::Ok});
    } else if (mask.quick && step_ % 20 == 5) {
        digital.push_edge(kQuickInput, ecu::sensors::DigitalEdge{false, ecu::sensors::EdgeKind::Falling, now_us_, ecu::sensors::DigitalSampleStatus::Ok});
    }

    if (step_ == 1 || step_ % 30 == 0) {
        const bool previous = map_level_high_;
        if (step_ % 30 == 0) {
            map_level_high_ = !map_level_high_;
        }
        if (mask.map) {
            digital.push_edge(kMapInput,
                              ecu::sensors::DigitalEdge{map_level_high_,
                                                        previous && !map_level_high_ ? ecu::sensors::EdgeKind::Falling
                                                                                    : ecu::sensors::EdgeKind::Rising,
                                                        now_us_,
                                                        ecu::sensors::DigitalSampleStatus::Ok});
        }
    }
}

const char *csv_header() {
    return "# t_us,tps_permille,tps_valid,rpm,rpm_valid,egt_c,water_c,qs_active,map_secondary,knock_raw,knock_valid";
}

std::string format_snapshot_csv(const ecu::sensors::EngineInputSnapshot &snapshot,
                                ecu::sensors::TimestampUs now,
                                const ecu::sensors::KnockWindowMeasurement &latest_knock) {
    std::ostringstream out;
    out << std::fixed << std::setprecision(1);
    out << now << ','
        << snapshot.tps.value.permille << ','
        << bool_to_int(snapshot.tps.valid_for_control) << ','
        << snapshot.engine_speed.value.rpm << ','
        << bool_to_int(snapshot.engine_speed.valid_for_control) << ','
        << snapshot.egt.value.celsius << ','
        << snapshot.water_temperature.value.celsius << ','
        << bool_to_int(snapshot.quick_shifter_state.value.active) << ','
        << map_secondary(snapshot) << ','
        << latest_knock.raw_integrator_count << ','
        << bool_to_int(latest_knock.valid_for_control);
    return out.str();
}

std::vector<std::string> drain_event_lines(ecu::sensors::SensorDataStore &store) {
    std::vector<std::string> lines;

    while (auto request = store.pop_quick_shift_request()) {
        std::ostringstream out;
        out << "# event,quick_shift,"
            << bool_to_int(request->event.active) << ','
            << request->event.activated_at << ','
            << request->event.released_at << ','
            << request->event.duration_us;
        lines.push_back(out.str());
    }

    while (auto event = store.pop_map_switch_event()) {
        std::ostringstream out;
        out << "# event,map_switch,"
            << bool_to_int(event->event.request == ecu::sensors::PhysicalMapRequest::Secondary) << ','
            << event->acquired_at;
        lines.push_back(out.str());
    }

    while (auto fault = store.pop_fault()) {
        std::ostringstream out;
        out << "# event,fault,"
            << static_cast<unsigned>(fault->fault) << ','
            << static_cast<unsigned>(fault->health) << ','
            << fault->first_at << ','
            << fault->last_at << ','
            << fault->count;
        lines.push_back(out.str());
    }

    return lines;
}

} // namespace ecu::sensor_harness
