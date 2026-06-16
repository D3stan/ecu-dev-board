#include <cstdlib>
#include <iostream>
#include <optional>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

#include "telemetry/sensor_telemetry_collector.hpp"
#include "telemetry_server/telemetry_json_serializer.hpp"
#include "telemetry_server/telemetry_pump.hpp"
#include "telemetry_server/telemetry_transport.hpp"

namespace {

int failures = 0;

#define EXPECT_TRUE(expr) do { if (!(expr)) fail(__FILE__, __LINE__, #expr); } while (false)
#define EXPECT_FALSE(expr) EXPECT_TRUE(!(expr))
#define EXPECT_EQ(expected, actual) do { auto e = (expected); auto a = (actual); if (!(e == a)) fail_eq(__FILE__, __LINE__, #expected, #actual, e, a); } while (false)
#define EXPECT_CONTAINS(text, needle) do { if ((text).find(needle) == std::string::npos) fail_contains(__FILE__, __LINE__, #text, needle, text); } while (false)
#define EXPECT_NOT_CONTAINS(text, needle) do { if ((text).find(needle) != std::string::npos) fail_not_contains(__FILE__, __LINE__, #text, needle, text); } while (false)

void fail(const char *file, int line, const char *expr) {
    std::cerr << file << ":" << line << ": expected true: " << expr << "\n";
    ++failures;
}

template <typename E, typename A>
void fail_eq(const char *file, int line, const char *expected_expr, const char *actual_expr, E expected, A actual) {
    std::cerr << file << ":" << line << ": expected " << expected_expr << " == " << actual_expr
              << " (" << expected << " vs " << actual << ")\n";
    ++failures;
}

void fail_contains(const char *file, int line, const char *text_expr, const std::string &needle, const std::string &text) {
    std::cerr << file << ":" << line << ": expected " << text_expr << " to contain '" << needle
              << "'\nactual: " << text << "\n";
    ++failures;
}

void fail_not_contains(const char *file, int line, const char *text_expr, const std::string &needle, const std::string &text) {
    std::cerr << file << ":" << line << ": expected " << text_expr << " not to contain '" << needle
              << "'\nactual: " << text << "\n";
    ++failures;
}

using namespace ecu::sensors;
using namespace ecu::telemetry;
using namespace ecu::telemetry_server;

TelemetryHealth valid_meta(TimestampUs at, SensorSequence sequence) {
    TelemetryHealth meta{};
    meta.acquired_at = at;
    meta.sequence = sequence;
    meta.valid_for_control = true;
    meta.health = SensorHealthState::Valid;
    meta.quality = SensorQuality::Good;
    return meta;
}

TelemetryBatch make_batch_with_events_and_knock() {
    TelemetryBatch batch{};
    batch.collected_at = 123456789;
    batch.state.snapshot_generation = 42;

    batch.state.tps.permille = 531;
    batch.state.tps.fallback_permille = 700;
    batch.state.tps.fallback_used = false;
    batch.state.tps.meta = valid_meta(123450000, 17);

    batch.state.engine_speed.rpm = 4200.0f;
    batch.state.engine_speed.period_us = 14285.7f;
    batch.state.engine_speed.acceleration_rpm_per_s = 120.5f;
    batch.state.engine_speed.synchronized = true;
    batch.state.engine_speed.crank_reference_trusted = true;
    batch.state.engine_speed.revolution_id = 1001;
    batch.state.engine_speed.reference_at = 123449000;
    batch.state.engine_speed.meta = valid_meta(123450100, 18);

    batch.state.egt.celsius = 520.3f;
    batch.state.egt.rate_c_per_s = 1.2f;
    batch.state.egt.maximum_celsius = 620.0f;
    batch.state.egt.state = ThermalState::Normal;
    batch.state.egt.request = ThermalRequestLevel::Normal;
    batch.state.egt.meta = valid_meta(123450200, 10);

    batch.state.water_temperature.celsius = 85.1f;
    batch.state.water_temperature.rate_c_per_s = 0.1f;
    batch.state.water_temperature.maximum_celsius = 92.0f;
    batch.state.water_temperature.state = ThermalState::High;
    batch.state.water_temperature.request = ThermalRequestLevel::Warning;
    batch.state.water_temperature.meta = valid_meta(123450300, 11);

    batch.state.quick_shifter.active = true;
    batch.state.quick_shifter.armed = false;
    batch.state.quick_shifter.meta = valid_meta(123450400, 12);

    batch.state.map_switch.request = PhysicalMapRequest::Secondary;
    batch.state.map_switch.meta = valid_meta(123450500, 13);

    KnockTelemetryState knock{};
    knock.revolution_id = 1002;
    knock.pickup_edge_at = 123440000;
    knock.window_opened_at = 123440100;
    knock.window_closed_at = 123440600;
    knock.read_at = 123440700;
    knock.raw_integrator_count = 1234;
    knock.background_estimate = 100.0f;
    knock.normalized_index = 12.34f;
    knock.candidate_knock = true;
    knock.valid_for_control = true;
    knock.health = SensorHealthState::Valid;
    knock.quality = SensorQuality::Good;
    knock.rpm = 6250.0f;
    knock.tps_permille = 512;
    knock.ignition_angle_deg = 14.5f;
    knock.config_generation = 7;
    batch.state.latest_knock = knock;

    QuickShiftTelemetryEvent quick{};
    quick.active = true;
    quick.activated_at = 123400000;
    quick.released_at = 123400650;
    quick.duration_us = 650;
    quick.meta = valid_meta(123400000, 4);
    TelemetryEventFrame quick_frame{};
    quick_frame.kind = TelemetryEventKind::QuickShiftRequest;
    quick_frame.occurred_at = 123400000;
    quick_frame.payload = quick;
    batch.events.push_back(quick_frame);

    MapSwitchTelemetryEvent map{};
    map.request = PhysicalMapRequest::Secondary;
    map.meta = valid_meta(123410000, 5);
    TelemetryEventFrame map_frame{};
    map_frame.kind = TelemetryEventKind::MapSwitchChange;
    map_frame.occurred_at = 123410000;
    map_frame.payload = map;
    batch.events.push_back(map_frame);

    FaultTelemetryEvent fault{};
    fault.fault = SensorFault::RangeHigh;
    fault.health = SensorHealthState::Degraded;
    fault.first_at = 123420000;
    fault.last_at = 123450000;
    fault.count = 2;
    TelemetryEventFrame fault_frame{};
    fault_frame.kind = TelemetryEventKind::FaultTransition;
    fault_frame.occurred_at = 123420000;
    fault_frame.payload = fault;
    batch.events.push_back(fault_frame);

    batch.overflow.quick_shift_events = 1;
    batch.overflow.map_switch_events = 2;
    batch.overflow.knock_measurements = 3;
    batch.overflow.fault_events = 4;

    return batch;
}

class FakeBatchSource final : public ITelemetryBatchSource {
public:
    explicit FakeBatchSource(TelemetryBatch batch) : batch_(std::move(batch)) {}

    std::optional<TelemetryBatch> collect(TimestampUs now) override {
        ++collect_count;
        batch_.collected_at = now;
        return batch_;
    }

    int collect_count{0};

private:
    TelemetryBatch batch_{};
};

class FakeTransport final : public ITelemetryTransport {
public:
    bool connected() const override { return connected_; }
    bool ready() const override { return ready_; }

    bool send_text(std::string_view payload) override {
        ++send_attempts;
        last_payload = std::string(payload);
        if (!send_result) {
            ++counters_.send_errors;
            return false;
        }
        ++counters_.sent_frames;
        return true;
    }

    void note_dropped_frame() override { ++counters_.dropped_frames; }

    TelemetryTransportCounters counters() const override { return counters_; }

    bool connected_{true};
    bool ready_{true};
    bool send_result{true};
    int send_attempts{0};
    std::string last_payload{};

private:
    TelemetryTransportCounters counters_{};
};

void test_capabilities_frame_declares_contract() {
    TelemetryJsonSerializerConfig config{};
    config.state_hz = 20;
    config.events_per_batch = 3;
    TelemetryJsonSerializer serializer(config);

    const std::string json = serializer.serialize_capabilities();

    EXPECT_CONTAINS(json, R"("type":"capabilities")");
    EXPECT_CONTAINS(json, R"("schema":"ecu.telemetry.v1")");
    EXPECT_CONTAINS(json, R"("schema_version":1)");
    EXPECT_CONTAINS(json, R"("paths":["state","event"])");
    EXPECT_CONTAINS(json, R"("state_hz":20)");
    EXPECT_CONTAINS(json, R"("events_per_batch":3)");
}

void test_telemetry_frame_serializes_state_events_and_counters() {
    TelemetryJsonSerializer serializer;
    TelemetryTransportCounters counters{};
    counters.sent_frames = 9;
    counters.dropped_frames = 2;
    counters.send_errors = 1;

    const std::string json = serializer.serialize_batch(make_batch_with_events_and_knock(), counters);

    EXPECT_CONTAINS(json, R"("type":"telemetry")");
    EXPECT_CONTAINS(json, R"("t_us":123456789)");
    EXPECT_CONTAINS(json, R"("gen":42)");
    EXPECT_CONTAINS(json, R"("permille":531)");
    EXPECT_CONTAINS(json, R"("pct":53.1)");
    EXPECT_CONTAINS(json, R"("fallback_used":false)");
    EXPECT_CONTAINS(json, R"("health":"Valid")");
    EXPECT_CONTAINS(json, R"("quality":"Good")");
    EXPECT_CONTAINS(json, R"("rpm":4200)");
    EXPECT_CONTAINS(json, R"("synchronized":true)");
    EXPECT_CONTAINS(json, R"("state":"High")");
    EXPECT_CONTAINS(json, R"("request":"Warning")");
    EXPECT_CONTAINS(json, R"("quick_shifter":{"active":true)");
    EXPECT_CONTAINS(json, R"("map_switch":{"request":"Secondary")");
    EXPECT_CONTAINS(json, R"("knock":{"revolution_id":1002)");
    EXPECT_CONTAINS(json, R"("normalized_index":12.34)");
    EXPECT_CONTAINS(json, R"("kind":"QuickShiftRequest")");
    EXPECT_CONTAINS(json, R"("kind":"MapSwitchChange")");
    EXPECT_CONTAINS(json, R"("kind":"FaultTransition")");
    EXPECT_CONTAINS(json, R"("fault":"RangeHigh")");
    EXPECT_CONTAINS(json, R"("overflow":{"quick_shift_events":1,"map_switch_events":2,"knock_measurements":3,"fault_events":4})");
    EXPECT_CONTAINS(json, R"("transport":{"sent_frames":9,"dropped_frames":2,"send_errors":1})");
}

void test_telemetry_frame_serializes_null_knock() {
    TelemetryJsonSerializer serializer;
    TelemetryBatch batch = make_batch_with_events_and_knock();
    batch.state.latest_knock = std::nullopt;

    const std::string json = serializer.serialize_batch(batch, {});

    EXPECT_CONTAINS(json, R"("knock":null)");
    EXPECT_NOT_CONTAINS(json, R"("raw_integrator_count":1234)");
}

void test_pump_does_not_collect_when_disconnected_or_backpressured() {
    FakeBatchSource source(make_batch_with_events_and_knock());
    TelemetryJsonSerializer serializer;
    FakeTransport transport;
    TelemetryPump pump(source, serializer, transport);

    transport.connected_ = false;
    EXPECT_FALSE(pump.tick(1000));
    EXPECT_EQ(0, source.collect_count);
    EXPECT_EQ(0, transport.send_attempts);
    EXPECT_EQ(0ull, transport.counters().dropped_frames);

    transport.connected_ = true;
    transport.ready_ = false;
    EXPECT_FALSE(pump.tick(2000));
    EXPECT_EQ(0, source.collect_count);
    EXPECT_EQ(0, transport.send_attempts);
    EXPECT_EQ(1ull, transport.counters().dropped_frames);
}

void test_pump_collects_and_sends_when_transport_is_ready() {
    FakeBatchSource source(make_batch_with_events_and_knock());
    TelemetryJsonSerializer serializer;
    FakeTransport transport;
    TelemetryPump pump(source, serializer, transport);

    EXPECT_TRUE(pump.tick(5555));

    EXPECT_EQ(1, source.collect_count);
    EXPECT_EQ(1, transport.send_attempts);
    EXPECT_EQ(1ull, transport.counters().sent_frames);
    EXPECT_CONTAINS(transport.last_payload, R"("type":"telemetry")");
    EXPECT_CONTAINS(transport.last_payload, R"("t_us":5555)");
}

} // namespace

int main() {
    test_capabilities_frame_declares_contract();
    test_telemetry_frame_serializes_state_events_and_counters();
    test_telemetry_frame_serializes_null_knock();
    test_pump_does_not_collect_when_disconnected_or_backpressured();
    test_pump_collects_and_sends_when_transport_is_ready();

    if (failures != 0) {
        std::cerr << failures << " telemetry server test failure(s)\n";
        return EXIT_FAILURE;
    }

    std::cout << "telemetry server tests passed\n";
    return EXIT_SUCCESS;
}
