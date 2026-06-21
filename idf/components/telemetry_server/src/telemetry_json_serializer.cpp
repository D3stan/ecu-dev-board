#include "telemetry_server/telemetry_json_serializer.hpp"

#include <sstream>
#include <variant>

namespace ecu::telemetry_server {

namespace {

const char *health_name(ecu::sensors::SensorHealthState value) {
    using ecu::sensors::SensorHealthState;
    switch (value) {
    case SensorHealthState::Uninitialized:
        return "Uninitialized";
    case SensorHealthState::Stabilizing:
        return "Stabilizing";
    case SensorHealthState::Valid:
        return "Valid";
    case SensorHealthState::Degraded:
        return "Degraded";
    case SensorHealthState::Stale:
        return "Stale";
    case SensorHealthState::Failed:
        return "Failed";
    case SensorHealthState::Disabled:
        return "Disabled";
    }
    return "Unknown";
}

const char *quality_name(ecu::sensors::SensorQuality value) {
    using ecu::sensors::SensorQuality;
    switch (value) {
    case SensorQuality::Unknown:
        return "Unknown";
    case SensorQuality::Good:
        return "Good";
    case SensorQuality::Suspect:
        return "Suspect";
    case SensorQuality::Bad:
        return "Bad";
    }
    return "Unknown";
}

const char *thermal_state_name(ecu::sensors::ThermalState value) {
    using ecu::sensors::ThermalState;
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

const char *thermal_request_name(ecu::sensors::ThermalRequestLevel value) {
    using ecu::sensors::ThermalRequestLevel;
    switch (value) {
    case ThermalRequestLevel::Normal:
        return "Normal";
    case ThermalRequestLevel::Warning:
        return "Warning";
    case ThermalRequestLevel::DeratingRequested:
        return "DeratingRequested";
    case ThermalRequestLevel::CriticalProtectionRequested:
        return "CriticalProtectionRequested";
    case ThermalRequestLevel::SensorInvalid:
        return "SensorInvalid";
    }
    return "SensorInvalid";
}

const char *map_request_name(ecu::sensors::PhysicalMapRequest value) {
    using ecu::sensors::PhysicalMapRequest;
    switch (value) {
    case PhysicalMapRequest::Primary:
        return "Primary";
    case PhysicalMapRequest::Secondary:
        return "Secondary";
    }
    return "Primary";
}

const char *fault_name(ecu::sensors::SensorFault value) {
    using ecu::sensors::SensorFault;
    switch (value) {
    case SensorFault::Stale:
        return "Stale";
    case SensorFault::InvalidConfiguration:
        return "InvalidConfiguration";
    case SensorFault::RangeLow:
        return "RangeLow";
    case SensorFault::RangeHigh:
        return "RangeHigh";
    case SensorFault::OpenCircuit:
        return "OpenCircuit";
    case SensorFault::ShortToGround:
        return "ShortToGround";
    case SensorFault::ShortToSupply:
        return "ShortToSupply";
    case SensorFault::Communication:
        return "Communication";
    case SensorFault::Frozen:
        return "Frozen";
    case SensorFault::Rate:
        return "Rate";
    case SensorFault::Noise:
        return "Noise";
    case SensorFault::Stuck:
        return "Stuck";
    case SensorFault::StartupActive:
        return "StartupActive";
    case SensorFault::Debounce:
        return "Debounce";
    case SensorFault::Duplicate:
        return "Duplicate";
    case SensorFault::Plausibility:
        return "Plausibility";
    case SensorFault::Overflow:
        return "Overflow";
    case SensorFault::Missing:
        return "Missing";
    case SensorFault::Saturation:
        return "Saturation";
    case SensorFault::WindowTiming:
        return "WindowTiming";
    case SensorFault::DeviceFault:
        return "DeviceFault";
    }
    return "DeviceFault";
}

void write_string(std::ostream &out, const char *value) {
    out << '"';
    for (const char *it = value; it != nullptr && *it != '\0'; ++it) {
        switch (*it) {
        case '"':
            out << "\\\"";
            break;
        case '\\':
            out << "\\\\";
            break;
        case '\n':
            out << "\\n";
            break;
        case '\r':
            out << "\\r";
            break;
        case '\t':
            out << "\\t";
            break;
        default:
            out << *it;
            break;
        }
    }
    out << '"';
}

void write_bool(std::ostream &out, bool value) {
    out << (value ? "true" : "false");
}

void write_meta(std::ostream &out, const ecu::telemetry::TelemetryHealth &meta) {
    out << "{\"acquired_at_us\":" << meta.acquired_at
        << ",\"seq\":" << meta.sequence
        << ",\"valid\":";
    write_bool(out, meta.valid_for_control);
    out << ",\"health\":";
    write_string(out, health_name(meta.health));
    out << ",\"quality\":";
    write_string(out, quality_name(meta.quality));
    out << ",\"fault_bits\":" << meta.fault_bits << '}';
}

void write_tps(std::ostream &out, const ecu::telemetry::TpsTelemetryState &state) {
    out << "{\"permille\":" << state.permille
        << ",\"pct\":" << (static_cast<float>(state.permille) / 10.0f)
        << ",\"fallback_permille\":" << state.fallback_permille
        << ",\"fallback_used\":";
    write_bool(out, state.fallback_used);
    out << ",\"meta\":";
    write_meta(out, state.meta);
    out << '}';
}

void write_engine_speed(std::ostream &out, const ecu::telemetry::EngineSpeedTelemetryState &state) {
    out << "{\"rpm\":" << state.rpm
        << ",\"period_us\":" << state.period_us
        << ",\"accel_rpm_per_s\":" << state.acceleration_rpm_per_s
        << ",\"synchronized\":";
    write_bool(out, state.synchronized);
    out << ",\"crank_reference_trusted\":";
    write_bool(out, state.crank_reference_trusted);
    out << ",\"revolution_id\":" << state.revolution_id
        << ",\"reference_at_us\":" << state.reference_at
        << ",\"meta\":";
    write_meta(out, state.meta);
    out << '}';
}

void write_thermal(std::ostream &out, const ecu::telemetry::ThermalTelemetryState &state) {
    out << "{\"c\":" << state.celsius
        << ",\"rate_c_per_s\":" << state.rate_c_per_s
        << ",\"max_c\":" << state.maximum_celsius
        << ",\"state\":";
    write_string(out, thermal_state_name(state.state));
    out << ",\"request\":";
    write_string(out, thermal_request_name(state.request));
    out << ",\"meta\":";
    write_meta(out, state.meta);
    out << '}';
}

void write_quick_shifter(std::ostream &out, const ecu::telemetry::QuickShifterTelemetryState &state) {
    out << "{\"active\":";
    write_bool(out, state.active);
    out << ",\"armed\":";
    write_bool(out, state.armed);
    out << ",\"meta\":";
    write_meta(out, state.meta);
    out << '}';
}

void write_map_switch(std::ostream &out, const ecu::telemetry::MapSwitchTelemetryState &state) {
    out << "{\"request\":";
    write_string(out, map_request_name(state.request));
    out << ",\"meta\":";
    write_meta(out, state.meta);
    out << '}';
}

void write_knock(std::ostream &out, const std::optional<ecu::telemetry::KnockTelemetryState> &state) {
    if (!state.has_value()) {
        out << "null";
        return;
    }

    out << "{\"revolution_id\":" << state->revolution_id
        << ",\"pickup_edge_at_us\":" << state->pickup_edge_at
        << ",\"window_opened_at_us\":" << state->window_opened_at
        << ",\"window_closed_at_us\":" << state->window_closed_at
        << ",\"read_at_us\":" << state->read_at
        << ",\"raw_integrator_count\":" << state->raw_integrator_count
        << ",\"background_estimate\":" << state->background_estimate
        << ",\"normalized_index\":" << state->normalized_index
        << ",\"candidate_knock\":";
    write_bool(out, state->candidate_knock);
    out << ",\"valid\":";
    write_bool(out, state->valid_for_control);
    out << ",\"health\":";
    write_string(out, health_name(state->health));
    out << ",\"quality\":";
    write_string(out, quality_name(state->quality));
    out << ",\"fault_bits\":" << state->fault_bits
        << ",\"rpm\":" << state->rpm
        << ",\"tps_permille\":" << state->tps_permille
        << ",\"ignition_angle_deg\":" << state->ignition_angle_deg
        << ",\"config_generation\":" << state->config_generation
        << '}';
}

void write_quick_event(std::ostream &out, const ecu::telemetry::TelemetryEventFrame &frame,
                       const ecu::telemetry::QuickShiftTelemetryEvent &event) {
    out << "{\"kind\":\"QuickShiftRequest\",\"at_us\":" << frame.occurred_at
        << ",\"active\":";
    write_bool(out, event.active);
    out << ",\"activated_at_us\":" << event.activated_at
        << ",\"released_at_us\":" << event.released_at
        << ",\"duration_us\":" << event.duration_us
        << ",\"meta\":";
    write_meta(out, event.meta);
    out << '}';
}

void write_map_event(std::ostream &out, const ecu::telemetry::TelemetryEventFrame &frame,
                     const ecu::telemetry::MapSwitchTelemetryEvent &event) {
    out << "{\"kind\":\"MapSwitchChange\",\"at_us\":" << frame.occurred_at
        << ",\"request\":";
    write_string(out, map_request_name(event.request));
    out << ",\"meta\":";
    write_meta(out, event.meta);
    out << '}';
}

void write_fault_event(std::ostream &out, const ecu::telemetry::TelemetryEventFrame &frame,
                       const ecu::telemetry::FaultTelemetryEvent &event) {
    out << "{\"kind\":\"FaultTransition\",\"at_us\":" << frame.occurred_at
        << ",\"fault\":";
    write_string(out, fault_name(event.fault));
    out << ",\"health\":";
    write_string(out, health_name(event.health));
    out << ",\"first_at_us\":" << event.first_at
        << ",\"last_at_us\":" << event.last_at
        << ",\"count\":" << event.count
        << '}';
}

void write_event(std::ostream &out, const ecu::telemetry::TelemetryEventFrame &frame) {
    if (const auto *event = std::get_if<ecu::telemetry::QuickShiftTelemetryEvent>(&frame.payload)) {
        write_quick_event(out, frame, *event);
    } else if (const auto *event = std::get_if<ecu::telemetry::MapSwitchTelemetryEvent>(&frame.payload)) {
        write_map_event(out, frame, *event);
    } else {
        write_fault_event(out, frame, std::get<ecu::telemetry::FaultTelemetryEvent>(frame.payload));
    }
}

void write_recording_config(std::ostream &out, const RecordingConfigSnapshot &recording) {
    out << "\"auto_enabled\":";
    write_bool(out, recording.auto_enabled);
    out << ",\"rpm_threshold\":" << recording.rpm_threshold
        << ",\"start_debounce_ms\":" << recording.start_debounce_ms
        << ",\"stop_debounce_ms\":" << recording.stop_debounce_ms;
}

} // namespace

TelemetryJsonSerializer::TelemetryJsonSerializer(TelemetryJsonSerializerConfig config) : config_(config) {}

std::string TelemetryJsonSerializer::serialize_capabilities() const {
    std::ostringstream out;
    out << "{\"type\":\"capabilities\",\"schema\":";
    write_string(out, config_.schema);
    out << ",\"schema_version\":" << config_.schema_version
        << ",\"paths\":[\"state\",\"event\"]"
        << ",\"state_hz\":" << config_.state_hz
        << ",\"events_per_batch\":" << config_.events_per_batch
        << ",\"device\":{\"hwid\":";
    write_string(out, config_.device.hwid);
    out << ",\"hardware_revision\":";
    write_string(out, config_.device.hardware_revision);
    out << ",\"chip_model\":";
    write_string(out, config_.device.chip_model);
    out << ",\"flash_size_bytes\":" << config_.device.flash_size_bytes
        << ",\"firmware_version\":";
    write_string(out, config_.device.firmware_version);
    out << "},\"recording\":{";
    write_recording_config(out, config_.recording);
    out << '}'
        << '}';
    return out.str();
}

std::string TelemetryJsonSerializer::serialize_recording_config() const {
    std::ostringstream out;
    out << "{\"type\":\"recording_config\",";
    write_recording_config(out, config_.recording);
    out << '}';
    return out.str();
}

std::string TelemetryJsonSerializer::serialize_batch(const ecu::telemetry::TelemetryBatch &batch,
                                                     const TelemetryTransportCounters &transport) const {
    std::ostringstream out;
    out << "{\"type\":\"telemetry\",\"schema\":";
    write_string(out, config_.schema);
    out << ",\"t_us\":" << batch.collected_at
        << ",\"gen\":" << batch.state.snapshot_generation
        << ",\"state\":{\"tps\":";
    write_tps(out, batch.state.tps);
    out << ",\"rpm\":";
    write_engine_speed(out, batch.state.engine_speed);
    out << ",\"egt\":";
    write_thermal(out, batch.state.egt);
    out << ",\"water\":";
    write_thermal(out, batch.state.water_temperature);
    out << ",\"quick_shifter\":";
    write_quick_shifter(out, batch.state.quick_shifter);
    out << ",\"map_switch\":";
    write_map_switch(out, batch.state.map_switch);
    out << ",\"knock\":";
    write_knock(out, batch.state.latest_knock);
    out << "},\"events\":[";
    for (std::size_t index = 0; index < batch.events.size(); ++index) {
        if (index != 0) {
            out << ',';
        }
        write_event(out, batch.events[index]);
    }
    out << "],\"overflow\":{\"quick_shift_events\":" << batch.overflow.quick_shift_events
        << ",\"map_switch_events\":" << batch.overflow.map_switch_events
        << ",\"knock_measurements\":" << batch.overflow.knock_measurements
        << ",\"fault_events\":" << batch.overflow.fault_events
        << "},\"transport\":{\"sent_frames\":" << transport.sent_frames
        << ",\"dropped_frames\":" << transport.dropped_frames
        << ",\"send_errors\":" << transport.send_errors
        << "}}";
    return out.str();
}

} // namespace ecu::telemetry_server
