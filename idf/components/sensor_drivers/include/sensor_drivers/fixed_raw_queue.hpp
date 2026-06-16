#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <optional>

namespace ecu::sensor_drivers {

template <typename T, std::size_t Capacity>
class FixedRawQueue {
public:
    bool push(const T &value) {
        if (count_ == Capacity) {
            overflow_count_++;
            return false;
        }
        values_[(head_ + count_) % Capacity] = value;
        count_++;
        return true;
    }

    std::optional<T> pop() {
        if (count_ == 0) {
            return std::nullopt;
        }
        auto value = values_[head_];
        head_ = (head_ + 1) % Capacity;
        count_--;
        return value;
    }

    std::uint32_t overflow_count() const { return overflow_count_; }

private:
    std::array<T, Capacity> values_{};
    std::size_t head_{0};
    std::size_t count_{0};
    std::uint32_t overflow_count_{0};
};

} // namespace ecu::sensor_drivers

