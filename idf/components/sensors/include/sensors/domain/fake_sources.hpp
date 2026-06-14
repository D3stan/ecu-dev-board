#pragma once

#include <deque>
#include <optional>
#include <string>
#include <string_view>
#include <unordered_map>

#include "sensors/ports/hardware_ports.hpp"

namespace ecu::sensors {

class FakeTimeSource final : public ITimeSource {
public:
    TimestampUs now() const override { return now_; }
    void set(TimestampUs value) { now_ = value; }
    void advance(TimestampUs delta) { now_ += delta; }

private:
    TimestampUs now_{0};
};

template <typename T>
class NamedQueue {
public:
    void push(std::string_view name, const T &value) {
        queues_[std::string(name)].push_back(value);
    }

    std::optional<T> pop(std::string_view name) {
        auto it = queues_.find(std::string(name));
        if (it == queues_.end() || it->second.empty()) {
            return std::nullopt;
        }
        auto value = it->second.front();
        it->second.pop_front();
        return value;
    }

private:
    std::unordered_map<std::string, std::deque<T>> queues_{};
};

class FakeAnalogSampleSource final : public IAnalogSampleSource {
public:
    void push(std::string_view channel, const AnalogSample &sample) { samples_.push(channel, sample); }
    std::optional<AnalogSample> read(std::string_view channel) override { return samples_.pop(channel); }

private:
    NamedQueue<AnalogSample> samples_{};
};

class FakeSpiMeasurementSource final : public ISpiMeasurementSource {
public:
    void push(std::string_view device, const Max31856Sample &sample) { samples_.push(device, sample); }
    std::optional<Max31856Sample> read(std::string_view device) override { return samples_.pop(device); }

private:
    NamedQueue<Max31856Sample> samples_{};
};

class FakeDigitalInputSource final : public IDigitalInputSource {
public:
    void push_state(std::string_view input, const DigitalSample &sample) { states_.push(input, sample); }
    void push_edge(std::string_view input, const DigitalEdge &edge) { edges_.push(input, edge); }

    std::optional<DigitalSample> read_state(std::string_view input) override { return states_.pop(input); }
    std::optional<DigitalEdge> read_edge(std::string_view input) override { return edges_.pop(input); }

private:
    NamedQueue<DigitalSample> states_{};
    NamedQueue<DigitalEdge> edges_{};
};

class FakeEdgeCaptureSource final : public IEdgeCaptureSource {
public:
    void push(std::string_view input, const EdgeCapture &capture) { captures_.push(input, capture); }
    std::optional<EdgeCapture> read_capture(std::string_view input) override { return captures_.pop(input); }

private:
    NamedQueue<EdgeCapture> captures_{};
};

class FakeKnockWindowDevice final : public IKnockWindowDevice {
public:
    bool configure(std::uint32_t config_generation) override {
        configured_generation = config_generation;
        return configure_ok;
    }

    bool open_window(TimestampUs at) override {
        last_opened_at = at;
        return open_ok;
    }

    bool close_window(TimestampUs at) override {
        last_closed_at = at;
        return close_ok;
    }

    std::optional<TpicWindowResult> read_result() override {
        if (results_.empty()) {
            return std::nullopt;
        }
        auto result = results_.front();
        results_.pop_front();
        return result;
    }

    void push_result(const TpicWindowResult &result) { results_.push_back(result); }

    bool configure_ok{true};
    bool open_ok{true};
    bool close_ok{true};
    std::uint32_t configured_generation{0};
    TimestampUs last_opened_at{0};
    TimestampUs last_closed_at{0};

private:
    std::deque<TpicWindowResult> results_{};
};

} // namespace ecu::sensors
