#include "sensor_harness/sensor_harness.hpp"

#include <iomanip>
#include <sstream>

namespace ecu::sensor_harness {

namespace {

int bool_to_int(bool value) {
    return value ? 1 : 0;
}

int map_secondary(const ecu::sensors::EngineInputSnapshot &snapshot) {
    return bool_to_int(snapshot.map_switch.value.request == ecu::sensors::PhysicalMapRequest::Secondary);
}

} // namespace

void FakeSensorStimulus::push_next(ecu::sensors::FakeAnalogSampleSource &analog,
                                   ecu::sensors::FakeSpiMeasurementSource &spi,
                                   ecu::sensors::FakeDigitalInputSource &digital,
                                   ecu::sensors::FakeEdgeCaptureSource &pickup,
                                   ecu::sensors::FakeKnockWindowDevice &knock) {
    ++step_;
    now_us_ += 100000;

    const int tps_raw = 300 + static_cast<int>((step_ * 173) % 3300);
    const int water_raw = 1800 + static_cast<int>((step_ % 9) * 40);
    const float egt_celsius = 35.0f + static_cast<float>((step_ * 5) % 120);
    const std::uint32_t knock_count = 1000u + ((step_ * 37u) % 900u);

    analog.push(kTpsChannel, ecu::sensors::AnalogSample{tps_raw, tps_raw, now_us_, ecu::sensors::AnalogSampleStatus::Ok});
    analog.push(kWaterChannel, ecu::sensors::AnalogSample{water_raw, water_raw, now_us_, ecu::sensors::AnalogSampleStatus::Ok});
    spi.push(kEgtDevice, ecu::sensors::Max31856Sample{egt_celsius, now_us_, ecu::sensors::SpiSampleStatus::Ok, 0});
    pickup.push(kPickupInput, ecu::sensors::EdgeCapture{now_us_, ecu::sensors::EdgePolarity::Falling, ecu::sensors::CaptureStatus::Ok});
    knock.push_result(ecu::sensors::TpicWindowResult{knock_count, now_us_ + 500, ecu::sensors::KnockDeviceStatus::Ok});

    if (step_ == 1 || step_ % 20 == 7) {
        digital.push_edge(kQuickInput, ecu::sensors::DigitalEdge{true, ecu::sensors::EdgeKind::Rising, now_us_, ecu::sensors::DigitalSampleStatus::Ok});
    } else if (step_ % 20 == 5) {
        digital.push_edge(kQuickInput, ecu::sensors::DigitalEdge{false, ecu::sensors::EdgeKind::Falling, now_us_, ecu::sensors::DigitalSampleStatus::Ok});
    }

    if (step_ == 1 || step_ % 30 == 0) {
        const bool previous = map_level_high_;
        if (step_ % 30 == 0) {
            map_level_high_ = !map_level_high_;
        }
        digital.push_edge(kMapInput,
                          ecu::sensors::DigitalEdge{map_level_high_,
                                                    previous && !map_level_high_ ? ecu::sensors::EdgeKind::Falling
                                                                                : ecu::sensors::EdgeKind::Rising,
                                                    now_us_,
                                                    ecu::sensors::DigitalSampleStatus::Ok});
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
