#include "telemetry_server/retransmit_buffer.hpp"

#include <algorithm>

namespace ecu::telemetry_server {

RetransmitBuffer::RetransmitBuffer(std::size_t capacity)
    : ring_(capacity), capacity_(capacity) {}

void RetransmitBuffer::push(uint32_t batch_seq, std::string frame) {
    std::lock_guard<std::mutex> lock(mutex_);
    ring_[head_] = {batch_seq, std::move(frame)};
    head_ = (head_ + 1) % capacity_;
    if (size_ < capacity_) {
        ++size_;
    }
}

std::vector<std::string> RetransmitBuffer::frames_after(uint32_t after_seq) const {
    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<std::pair<uint32_t, const std::string *>> matches;
    matches.reserve(size_);
    for (std::size_t i = 0; i < size_; ++i) {
        const std::size_t idx = (head_ + capacity_ - size_ + i) % capacity_;
        if (ring_[idx].seq > after_seq) {
            matches.emplace_back(ring_[idx].seq, &ring_[idx].frame);
        }
    }
    std::sort(matches.begin(), matches.end(),
              [](const auto &a, const auto &b) { return a.first < b.first; });
    std::vector<std::string> result;
    result.reserve(matches.size());
    for (const auto &[seq, ptr] : matches) {
        result.push_back(*ptr);
    }
    return result;
}

uint32_t RetransmitBuffer::latest_seq() const {
    std::lock_guard<std::mutex> lock(mutex_);
    if (size_ == 0) return 0;
    const std::size_t last = (head_ + capacity_ - 1) % capacity_;
    return ring_[last].seq;
}

std::size_t RetransmitBuffer::size() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return size_;
}

} // namespace ecu::telemetry_server
