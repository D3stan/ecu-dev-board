#include "telemetry_server/telemetry_json_serializer.hpp"

#include <charconv>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <string_view>
#include <system_error>
#include <type_traits>
#include <variant>

namespace ecu::telemetry_server {
namespace {

class JsonWriter {
public:
    JsonWriter(char *buffer, std::size_t capacity)
        : buffer_(buffer), capacity_(capacity), ok_(buffer != nullptr) {}

    bool ok() const { return ok_; }
    std::size_t size() const { return size_; }

    void fail() {
        ok_ = false;
        size_ = 0;
    }

    void literal(std::string_view value) {
        append(value.data(), value.size());
    }

    void string(const char *value) {
        literal("\"");
        if (value != nullptr) {
            for (const unsigned char *it =
                     reinterpret_cast<const unsigned char *>(value);
                 *it != '\0' && ok_;
                 ++it) {
                switch (*it) {
                case '"':
                    literal("\\\"");
                    break;
                case '\\':
                    literal("\\\\");
                    break;
                case '\n':
                    literal("\\n");
                    break;
                case '\r':
                    literal("\\r");
                    break;
                case '\t':
                    literal("\\t");
                    break;
                default:
                    if (*it < 0x20U) {
                        static constexpr char hex[] = "0123456789abcdef";
                        const char escaped[] = {
                            '\\', 'u', '0', '0',
                            hex[(*it >> 4U) & 0x0fU],
                            hex[*it & 0x0fU],
                        };
                        append(escaped, sizeof(escaped));
                    } else {
                        const char byte = static_cast<char>(*it);
                        append(&byte, 1);
                    }
                    break;
                }
            }
        }
        literal("\"");
    }

    void boolean(bool value) {
        literal(value ? "true" : "false");
    }

    template <typename Integer,
              typename = std::enable_if_t<std::is_integral_v<Integer>>>
    void integer(Integer value) {
        if (!ok_) return;

        char encoded[32]{};
        const auto result =
            std::to_chars(encoded, encoded + sizeof(encoded), value);
        if (result.ec != std::errc{}) {
            fail();
            return;
        }
        append(encoded, static_cast<std::size_t>(result.ptr - encoded));
    }

    void floating(float value) {
        if (!ok_) return;
        if (!std::isfinite(value)) {
            literal("0.0");
            fail();
            return;
        }

        char encoded[48]{};
        const int count = std::snprintf(encoded,
                                        sizeof(encoded),
                                        "%.9g",
                                        static_cast<double>(value));
        if (count < 0 || static_cast<std::size_t>(count) >= sizeof(encoded)) {
            fail();
            return;
        }
        append(encoded, static_cast<std::size_t>(count));
    }

private:
    void append(const char *value, std::size_t incoming) {
        if (!ok_) return;
        if (incoming > capacity_ - size_) {
            fail();
            return;
        }
        if (incoming != 0) {
            std::memcpy(buffer_ + size_, value, incoming);
            size_ += incoming;
        }
    }

    char *buffer_{nullptr};
    std::size_t capacity_{0};
    std::size_t size_{0};
    bool ok_{false};
};

const char *health_name(ecu::telemetry::HealthState value) {
    using ecu::telemetry::HealthState;
    switch (value) {
    case HealthState::Uninitialized:
        return "Uninitialized";
    case HealthState::Stabilizing:
        return "Stabilizing";
    case HealthState::Valid:
        return "Valid";
    case HealthState::Degraded:
        return "Degraded";
    case HealthState::Stale:
        return "Stale";
    case HealthState::Failed:
        return "Failed";
    case HealthState::Disabled:
        return "Disabled";
    }
    return "Unknown";
}

const char *quality_name(ecu::telemetry::Quality value) {
    using ecu::telemetry::Quality;
    switch (value) {
    case Quality::Unknown:
        return "Unknown";
    case Quality::Good:
        return "Good";
    case Quality::Suspect:
        return "Suspect";
    case Quality::Bad:
        return "Bad";
    }
    return "Unknown";
}

const char *thermal_state_name(ecu::telemetry::ThermalState value) {
    using ecu::telemetry::ThermalState;
    switch (value) {
    case ThermalState::Cold:
        return "Cold";
    case ThermalState::Warming:
        return "Warming";
    case ThermalState::Normal:
        return "Normal";
    case ThermalState::High:
        return "High";
    case ThermalState::Critical:
        return "Critical";
    case ThermalState::SensorInvalid:
        return "SensorInvalid";
    }
    return "SensorInvalid";
}

const char *thermal_request_name(ecu::telemetry::ThermalRequest value) {
    using ecu::telemetry::ThermalRequest;
    switch (value) {
    case ThermalRequest::Normal:
        return "Normal";
    case ThermalRequest::Warning:
        return "Warning";
    case ThermalRequest::DeratingRequested:
        return "DeratingRequested";
    case ThermalRequest::CriticalProtectionRequested:
        return "CriticalProtectionRequested";
    case ThermalRequest::SensorInvalid:
        return "SensorInvalid";
    }
    return "SensorInvalid";
}

const char *map_request_name(ecu::telemetry::MapRequest value) {
    using ecu::telemetry::MapRequest;
    switch (value) {
    case MapRequest::Primary:
        return "Primary";
    case MapRequest::Secondary:
        return "Secondary";
    }
    return "Primary";
}

const char *fault_name(ecu::telemetry::FaultKind value) {
    using ecu::telemetry::FaultKind;
    switch (value) {
    case FaultKind::Noise:
        return "Noise";
    case FaultKind::WindowTiming:
        return "WindowTiming";
    case FaultKind::DeviceFault:
        return "DeviceFault";
    }
    return "DeviceFault";
}

const char *origin_name(ecu::telemetry::DataOrigin value) {
    using ecu::telemetry::DataOrigin;
    switch (value) {
    case DataOrigin::Measured:
        return "measured";
    case DataOrigin::Derived:
        return "derived";
    case DataOrigin::Simulated:
        return "simulated";
    }
    return "derived";
}

const char *engine_state_name(telemetry_engine_state_t value) {
    switch (value) {
    case TELEMETRY_ENGINE_NO_SIGNAL:
        return "no_signal";
    case TELEMETRY_ENGINE_ACQUISITION:
        return "acquisition";
    case TELEMETRY_ENGINE_SYNCHRONIZED:
        return "synchronized";
    }
    return "no_signal";
}

void write_meta(JsonWriter &out,
                const ecu::telemetry::TelemetryHealth &meta) {
    out.literal("{\"acquired_at_us\":");
    out.integer(meta.acquired_at);
    out.literal(",\"seq\":");
    out.integer(meta.sequence);
    out.literal(",\"valid\":");
    out.boolean(meta.valid_for_control);
    out.literal(",\"health\":");
    out.string(health_name(meta.health));
    out.literal(",\"quality\":");
    out.string(quality_name(meta.quality));
    out.literal(",\"fault_bits\":");
    out.integer(meta.fault_bits);
    out.literal("}");
}

void write_tps(JsonWriter &out,
               const ecu::telemetry::TpsTelemetryState &state) {
    out.literal("{\"permille\":");
    out.integer(state.permille);
    out.literal(",\"pct\":");
    out.floating(static_cast<float>(state.permille) / 10.0f);
    out.literal(",\"fallback_permille\":");
    out.integer(state.fallback_permille);
    out.literal(",\"fallback_used\":");
    out.boolean(state.fallback_used);
    out.literal(",\"origin\":");
    out.string(origin_name(state.meta.origin));
    out.literal(",\"meta\":");
    write_meta(out, state.meta);
    out.literal("}");
}

void write_engine_speed(
    JsonWriter &out,
    const ecu::telemetry::EngineSpeedTelemetryState &state) {
    out.literal("{\"rpm\":");
    out.floating(state.rpm);
    out.literal(",\"period_us\":");
    out.floating(state.period_us);
    out.literal(",\"accel_rpm_per_s\":");
    out.floating(state.acceleration_rpm_per_s);
    out.literal(",\"synchronized\":");
    out.boolean(state.synchronized);
    out.literal(",\"crank_reference_trusted\":");
    out.boolean(state.crank_reference_trusted);
    out.literal(",\"revolution_id\":");
    out.integer(state.revolution_id);
    out.literal(",\"reference_at_us\":");
    out.integer(state.reference_at);
    out.literal(",\"origin\":");
    out.string(origin_name(state.meta.origin));
    out.literal(",\"meta\":");
    write_meta(out, state.meta);
    out.literal("}");
}

void write_thermal(JsonWriter &out,
                   const ecu::telemetry::ThermalTelemetryState &state) {
    out.literal("{\"c\":");
    out.floating(state.celsius);
    out.literal(",\"rate_c_per_s\":");
    out.floating(state.rate_c_per_s);
    out.literal(",\"max_c\":");
    out.floating(state.maximum_celsius);
    out.literal(",\"state\":");
    out.string(thermal_state_name(state.state));
    out.literal(",\"request\":");
    out.string(thermal_request_name(state.request));
    out.literal(",\"origin\":");
    out.string(origin_name(state.meta.origin));
    out.literal(",\"meta\":");
    write_meta(out, state.meta);
    out.literal("}");
}

void write_quick_shifter(
    JsonWriter &out,
    const ecu::telemetry::QuickShifterTelemetryState &state) {
    out.literal("{\"active\":");
    out.boolean(state.active);
    out.literal(",\"armed\":");
    out.boolean(state.armed);
    out.literal(",\"origin\":");
    out.string(origin_name(state.meta.origin));
    out.literal(",\"meta\":");
    write_meta(out, state.meta);
    out.literal("}");
}

void write_map_switch(
    JsonWriter &out,
    const ecu::telemetry::MapSwitchTelemetryState &state) {
    out.literal("{\"request\":");
    out.string(map_request_name(state.request));
    out.literal(",\"origin\":");
    out.string(origin_name(state.meta.origin));
    out.literal(",\"meta\":");
    write_meta(out, state.meta);
    out.literal("}");
}

void write_knock(JsonWriter &out,
                 const ecu::telemetry::KnockTelemetryState &state) {
    out.literal("{\"revolution_id\":");
    out.integer(state.revolution_id);
    out.literal(",\"pickup_edge_at_us\":");
    out.integer(state.pickup_edge_at);
    out.literal(",\"window_opened_at_us\":");
    out.integer(state.window_opened_at);
    out.literal(",\"window_closed_at_us\":");
    out.integer(state.window_closed_at);
    out.literal(",\"read_at_us\":");
    out.integer(state.read_at);
    out.literal(",\"raw_integrator_count\":");
    out.integer(state.raw_integrator_count);
    out.literal(",\"background_estimate\":");
    out.floating(state.background_estimate);
    out.literal(",\"normalized_index\":");
    out.floating(state.normalized_index);
    out.literal(",\"candidate_knock\":");
    out.boolean(state.candidate_knock);
    out.literal(",\"valid\":");
    out.boolean(state.valid_for_control);
    out.literal(",\"health\":");
    out.string(health_name(state.health));
    out.literal(",\"quality\":");
    out.string(quality_name(state.quality));
    out.literal(",\"fault_bits\":");
    out.integer(state.fault_bits);
    out.literal(",\"rpm\":");
    out.floating(state.rpm);
    out.literal(",\"tps_permille\":");
    out.integer(state.tps_permille);
    out.literal(",\"ignition_angle_deg\":");
    out.floating(state.ignition_angle_deg);
    out.literal(",\"config_generation\":");
    out.integer(state.config_generation);
    out.literal(",\"origin\":");
    out.string(origin_name(state.origin));
    out.literal("}");
}

void write_test_bench(
    JsonWriter &out,
    const ecu::telemetry::TestBenchTelemetryState &state) {
    out.literal("{\"engine_state\":");
    out.string(engine_state_name(state.engine_state));
    out.literal(",\"advance_tenths\":");
    out.integer(state.advance_tenths);
    out.literal(",\"fire_delay_us\":");
    out.integer(state.fire_delay_us);
    out.literal(",\"rejected_edges\":");
    out.integer(state.rejected_edges);
    out.literal(",\"late_fires\":");
    out.integer(state.late_fires);
    out.literal(",\"schedule_errors\":");
    out.integer(state.schedule_errors);
    out.literal(",\"origin\":");
    out.string(origin_name(state.origin));
    out.literal("}");
}

void write_quick_event(
    JsonWriter &out,
    const ecu::telemetry::TelemetryEventFrame &frame,
    const ecu::telemetry::QuickShiftTelemetryEvent &event) {
    out.literal("{\"kind\":\"QuickShiftRequest\",\"at_us\":");
    out.integer(frame.occurred_at);
    out.literal(",\"active\":");
    out.boolean(event.active);
    out.literal(",\"activated_at_us\":");
    out.integer(event.activated_at);
    out.literal(",\"released_at_us\":");
    out.integer(event.released_at);
    out.literal(",\"duration_us\":");
    out.integer(event.duration_us);
    out.literal(",\"meta\":");
    write_meta(out, event.meta);
    out.literal("}");
}

void write_map_event(
    JsonWriter &out,
    const ecu::telemetry::TelemetryEventFrame &frame,
    const ecu::telemetry::MapSwitchTelemetryEvent &event) {
    out.literal("{\"kind\":\"MapSwitchChange\",\"at_us\":");
    out.integer(frame.occurred_at);
    out.literal(",\"request\":");
    out.string(map_request_name(event.request));
    out.literal(",\"meta\":");
    write_meta(out, event.meta);
    out.literal("}");
}

void write_fault_event(
    JsonWriter &out,
    const ecu::telemetry::TelemetryEventFrame &frame,
    const ecu::telemetry::FaultTelemetryEvent &event) {
    out.literal("{\"kind\":\"FaultTransition\",\"at_us\":");
    out.integer(frame.occurred_at);
    out.literal(",\"fault\":");
    out.string(fault_name(event.fault));
    out.literal(",\"health\":");
    out.string(health_name(event.health));
    out.literal(",\"first_at_us\":");
    out.integer(event.first_at);
    out.literal(",\"last_at_us\":");
    out.integer(event.last_at);
    out.literal(",\"count\":");
    out.integer(event.count);
    out.literal("}");
}

void write_event(JsonWriter &out,
                 const ecu::telemetry::TelemetryEventFrame &frame) {
    using ecu::telemetry::EventKind;
    switch (frame.kind) {
    case EventKind::QuickShiftRequest:
        if (const auto *event =
                std::get_if<ecu::telemetry::QuickShiftTelemetryEvent>(
                    &frame.payload)) {
            write_quick_event(out, frame, *event);
        } else {
            out.fail();
        }
        return;
    case EventKind::MapSwitchChange:
        if (const auto *event =
                std::get_if<ecu::telemetry::MapSwitchTelemetryEvent>(
                    &frame.payload)) {
            write_map_event(out, frame, *event);
        } else {
            out.fail();
        }
        return;
    case EventKind::FaultTransition:
        if (const auto *event =
                std::get_if<ecu::telemetry::FaultTelemetryEvent>(
                    &frame.payload)) {
            write_fault_event(out, frame, *event);
        } else {
            out.fail();
        }
        return;
    }
    out.fail();
}

void write_recording_config(
    JsonWriter &out,
    const RecordingConfigSnapshot &recording) {
    out.literal("\"auto_enabled\":");
    out.boolean(recording.auto_enabled);
    out.literal(",\"rpm_threshold\":");
    out.integer(recording.rpm_threshold);
    out.literal(",\"start_debounce_ms\":");
    out.integer(recording.start_debounce_ms);
    out.literal(",\"stop_debounce_ms\":");
    out.integer(recording.stop_debounce_ms);
}

SerializeResult result_from(const JsonWriter &writer) {
    return {writer.ok(), writer.size()};
}

} // namespace

TelemetryJsonSerializer::TelemetryJsonSerializer(SerializerConfig config)
    : config_(config) {}

SerializeResult TelemetryJsonSerializer::serialize_capabilities(
    const RecordingConfigSnapshot &recording,
    char *buffer,
    std::size_t capacity) const {
    JsonWriter out(buffer, capacity);
    out.literal("{\"type\":\"capabilities\",\"schema\":");
    out.string(config_.schema);
    out.literal(",\"schema_version\":");
    out.integer(config_.schema_version);
    out.literal(",\"paths\":[\"state\",\"event\"],\"state_hz\":");
    out.integer(config_.state_hz);
    out.literal(",\"events_per_batch\":");
    out.integer(config_.events_per_batch);
    out.literal(",\"device\":{\"hwid\":");
    out.string(config_.device.hwid);
    out.literal(",\"hardware_revision\":");
    out.string(config_.device.hardware_revision);
    out.literal(",\"chip_model\":");
    out.string(config_.device.chip_model);
    out.literal(",\"flash_size_bytes\":");
    out.integer(config_.device.flash_size_bytes);
    out.literal(",\"firmware_version\":");
    out.string(config_.device.firmware_version);
    out.literal("},\"recording\":{");
    write_recording_config(out, recording);
    out.literal("}}");
    return result_from(out);
}

SerializeResult TelemetryJsonSerializer::serialize_recording_config(
    const RecordingConfigSnapshot &recording,
    char *buffer,
    std::size_t capacity) const {
    JsonWriter out(buffer, capacity);
    out.literal("{\"type\":\"recording_config\",");
    write_recording_config(out, recording);
    out.literal("}");
    return result_from(out);
}

SerializeResult TelemetryJsonSerializer::serialize_batch(
    const ecu::telemetry::TelemetryBatch &batch,
    const TelemetryTransportCounters &transport,
    char *buffer,
    std::size_t capacity) const {
    JsonWriter out(buffer, capacity);
    out.literal("{\"type\":\"telemetry\",\"schema\":");
    out.string(config_.schema);
    out.literal(",\"t_us\":");
    out.integer(batch.collected_at);
    out.literal(",\"gen\":");
    out.integer(batch.state.snapshot_generation);
    out.literal(",\"state\":{\"tps\":");
    write_tps(out, batch.state.tps);
    out.literal(",\"rpm\":");
    write_engine_speed(out, batch.state.engine_speed);
    out.literal(",\"egt\":");
    write_thermal(out, batch.state.egt);
    out.literal(",\"water\":");
    write_thermal(out, batch.state.water_temperature);
    out.literal(",\"quick_shifter\":");
    write_quick_shifter(out, batch.state.quick_shifter);
    out.literal(",\"map_switch\":");
    write_map_switch(out, batch.state.map_switch);
    out.literal(",\"knock\":");
    write_knock(out, batch.state.latest_knock);
    out.literal(",\"test_bench\":");
    write_test_bench(out, batch.state.test_bench);
    out.literal("},\"events\":[");

    if (batch.event_count > batch.events.size()) {
        out.fail();
    } else {
        for (std::size_t index = 0; index < batch.event_count; ++index) {
            if (index != 0) {
                out.literal(",");
            }
            write_event(out, batch.events[index]);
        }
    }

    out.literal("],\"overflow\":{\"quick_shift_events\":");
    out.integer(batch.overflow.quick_shift_events);
    out.literal(",\"map_switch_events\":");
    out.integer(batch.overflow.map_switch_events);
    out.literal(",\"knock_measurements\":");
    out.integer(batch.overflow.knock_measurements);
    out.literal(",\"fault_events\":");
    out.integer(batch.overflow.fault_events);
    out.literal("},\"transport\":{\"sent_frames\":");
    out.integer(transport.sent_frames);
    out.literal(",\"dropped_frames\":");
    out.integer(transport.dropped_frames);
    out.literal(",\"send_errors\":");
    out.integer(transport.send_errors);
    out.literal("}}");
    return result_from(out);
}

} // namespace ecu::telemetry_server
