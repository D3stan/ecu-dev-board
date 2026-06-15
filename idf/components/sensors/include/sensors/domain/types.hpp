#pragma once

#include <cstdint>
#include <iosfwd>

namespace ecu::sensors {

using TimestampUs = std::uint64_t;
using RevolutionId = std::uint64_t;
using SensorSequence = std::uint32_t;

enum class SensorHealthState {
    Uninitialized,
    Stabilizing,
    Valid,
    Degraded,
    Stale,
    Failed,
    Disabled,
};

enum class SensorQuality {
    Unknown,
    Good,
    Suspect,
    Bad,
};

enum class SensorFault : std::uint8_t {
    Stale = 0,
    InvalidConfiguration,
    RangeLow,
    RangeHigh,
    OpenCircuit,
    ShortToGround,
    ShortToSupply,
    Communication,
    Frozen,
    Rate,
    Noise,
    Stuck,
    StartupActive,
    Debounce,
    Duplicate,
    Plausibility,
    Overflow,
    Missing,
    Saturation,
    WindowTiming,
    DeviceFault,
};

class FaultBitset {
public:
    void add(SensorFault fault) { bits_ |= mask(fault); }
    bool has(SensorFault fault) const { return (bits_ & mask(fault)) != 0; }
    bool empty() const { return bits_ == 0; }
    std::uint64_t bits() const { return bits_; }
    void clear() { bits_ = 0; }

private:
    static constexpr std::uint64_t mask(SensorFault fault) {
        return 1ull << static_cast<std::uint8_t>(fault);
    }

    std::uint64_t bits_{0};
};

template <typename T>
struct SensorReading {
    T value{};
    TimestampUs acquired_at{0};
    SensorSequence sequence{0};
    bool valid_for_control{false};
    SensorHealthState health{SensorHealthState::Uninitialized};
    SensorQuality quality{SensorQuality::Unknown};
    FaultBitset faults{};
};

template <typename T>
struct SensorEvent {
    T event{};
    TimestampUs acquired_at{0};
    SensorSequence sequence{0};
    bool valid_for_control{false};
    SensorHealthState health{SensorHealthState::Uninitialized};
    SensorQuality quality{SensorQuality::Unknown};
    FaultBitset faults{};
};

enum class AnalogSampleStatus {
    Ok,
    Timeout,
    HardwareFault,
    CalibrationFault,
};

struct AnalogSample {
    int raw_code{0};
    int millivolts{0};
    bool millivolts_valid{false};
    TimestampUs acquired_at{0};
    AnalogSampleStatus status{AnalogSampleStatus::Ok};
};

enum class SpiSampleStatus {
    Ok,
    Timeout,
    ConverterFault,
    CommunicationFault,
};

struct Max31856Sample {
    float celsius{0.0f};
    TimestampUs acquired_at{0};
    SpiSampleStatus status{SpiSampleStatus::Ok};
    std::uint32_t diagnostic_flags{0};
};

enum class DigitalSampleStatus {
    Ok,
    HardwareFault,
    Stale,
};

struct DigitalSample {
    bool level_high{true};
    TimestampUs acquired_at{0};
    DigitalSampleStatus status{DigitalSampleStatus::Ok};
};

enum class EdgeKind {
    Rising,
    Falling,
};

struct DigitalEdge {
    bool level_high{true};
    EdgeKind edge{EdgeKind::Rising};
    TimestampUs acquired_at{0};
    DigitalSampleStatus status{DigitalSampleStatus::Ok};
};

enum class EdgePolarity {
    Rising,
    Falling,
};

enum class CaptureStatus {
    Ok,
    Overflow,
    HardwareFault,
};

struct EdgeCapture {
    TimestampUs captured_at{0};
    EdgePolarity polarity{EdgePolarity::Falling};
    CaptureStatus status{CaptureStatus::Ok};
};

enum class KnockDeviceStatus {
    Ok,
    Missing,
    Saturated,
    CommunicationFault,
    ConfigurationFault,
    TimingFault,
};

struct TpicWindowResult {
    std::uint32_t integrator_count{0};
    TimestampUs read_at{0};
    KnockDeviceStatus status{KnockDeviceStatus::Ok};
};

struct ThrottlePositionPermille {
    int permille{700};
    int fallback_permille{700};
    bool fallback_used{false};
};

enum class ThermalState {
    Cold,
    Warming,
    Normal,
    High,
    Critical,
    SensorInvalid,
};

enum class ThermalRequestLevel {
    Normal,
    Warning,
    DeratingRequested,
    CriticalProtectionRequested,
    SensorInvalid,
};

struct TemperatureReading {
    float celsius{0.0f};
    float rate_c_per_s{0.0f};
    float maximum_celsius{0.0f};
    ThermalState state{ThermalState::SensorInvalid};
    ThermalRequestLevel request{ThermalRequestLevel::SensorInvalid};
};

struct EngineSpeedState {
    float rpm{0.0f};
    float period_us{0.0f};
    float acceleration_rpm_per_s{0.0f};
    bool synchronized{false};
    bool crank_reference_trusted{false};
    RevolutionId revolution_id{0};
    TimestampUs reference_at{0};
};

struct QuickShiftRequest {
    bool active{false};
    TimestampUs activated_at{0};
    TimestampUs released_at{0};
    std::uint32_t duration_us{0};
};

struct QuickShifterState {
    bool active{false};
    bool armed{false};
};

enum class PhysicalMapRequest {
    Primary,
    Secondary,
};

struct MapSwitchState {
    PhysicalMapRequest request{PhysicalMapRequest::Primary};
};

struct PickupCaptureEvent {
    EdgeCapture capture{};
    bool valid{false};
    SensorHealthState health{SensorHealthState::Uninitialized};
    SensorQuality quality{SensorQuality::Unknown};
    FaultBitset faults{};
};

struct KnockWindowContext {
    RevolutionId revolution_id{0};
    TimestampUs pickup_edge_at{0};
    TimestampUs window_opened_at{0};
    TimestampUs window_closed_at{0};
    float rpm{0.0f};
    int tps_permille{0};
    float ignition_angle_deg{0.0f};
    std::uint32_t config_generation{0};
};

struct KnockWindowMeasurement {
    RevolutionId revolution_id{0};
    TimestampUs pickup_edge_at{0};
    TimestampUs window_opened_at{0};
    TimestampUs window_closed_at{0};
    TimestampUs read_at{0};
    std::uint32_t raw_integrator_count{0};
    float background_estimate{0.0f};
    float normalized_index{0.0f};
    bool candidate_knock{false};
    bool valid_for_control{false};
    SensorHealthState health{SensorHealthState::Uninitialized};
    SensorQuality quality{SensorQuality::Unknown};
    FaultBitset faults{};
    float rpm{0.0f};
    int tps_permille{0};
    float ignition_angle_deg{0.0f};
    std::uint32_t config_generation{0};
};

struct KnockFeatureRecord {
    RevolutionId revolution_id{0};
    float normalized_index{0.0f};
    bool candidate_knock{false};
    bool requests_ignition_authority{false};
    SensorHealthState health{SensorHealthState::Uninitialized};
    SensorQuality quality{SensorQuality::Unknown};
    FaultBitset faults{};
};

std::ostream &operator<<(std::ostream &out, SensorHealthState state);
std::ostream &operator<<(std::ostream &out, SensorQuality quality);
std::ostream &operator<<(std::ostream &out, ThermalState state);
std::ostream &operator<<(std::ostream &out, ThermalRequestLevel level);
std::ostream &operator<<(std::ostream &out, PhysicalMapRequest request);

} // namespace ecu::sensors
