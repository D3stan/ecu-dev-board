#pragma once

#include <cstddef>
#include <cstdint>
#include <mutex>
#include <string>
#include <vector>

namespace ecu::telemetry_server {

/**
 * Ring buffer that keeps the last `capacity` serialized telemetry frames.
 * Each frame is stored alongside its batch_seq number.
 * Thread-safe via internal mutex.
 */
class RetransmitBuffer {
public:
    explicit RetransmitBuffer(std::size_t capacity);

    /// Push a new frame. Overwrites the oldest entry when the buffer is full.
    void push(uint32_t batch_seq, std::string frame);

    /// Returns all frames whose batch_seq > after_seq, in ascending order.
    std::vector<std::string> frames_after(uint32_t after_seq) const;

    /// Highest batch_seq currently in the buffer (0 if empty).
    uint32_t latest_seq() const;

    std::size_t capacity() const { return capacity_; }
    std::size_t size() const;

private:
    struct Entry {
        uint32_t    seq{0};
        std::string frame;
    };

    mutable std::mutex   mutex_;
    std::vector<Entry>   ring_;
    std::size_t          head_{0};
    std::size_t          size_{0};
    const std::size_t    capacity_;
};

} // namespace ecu::telemetry_server
