#pragma once

#include <array>
#include <atomic>
#include <cstddef>
#include <cstdint>
#include <optional>
#include <string_view>

#include "driver/gpio.h"
#include "driver/mcpwm_cap.h"
#include "esp_attr.h"
#include "esp_err.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/task.h"
#include "sensor_drivers/capture_tick_converter.hpp"
#include "sensors/ports/hardware_ports.hpp"

namespace ecu::sensor_drivers {

inline constexpr std::size_t kMcpwmCaptureMaxQueueDepth = 32;

struct McpwmEdgeCaptureConfig {
    const char *input_name{"pickup"};
    gpio_num_t gpio{GPIO_NUM_NC};
    int group_id{0};
    int intr_priority{0};
    std::size_t queue_depth{16};
    TaskHandle_t notify_task{nullptr};
    std::uint32_t notify_value{1};
};

class McpwmEdgeCaptureSource final : public ecu::sensors::IEdgeCaptureSource {
public:
    McpwmEdgeCaptureSource(ecu::sensors::ITimeSource &time_source, McpwmEdgeCaptureConfig config);
    ~McpwmEdgeCaptureSource() override;

    McpwmEdgeCaptureSource(const McpwmEdgeCaptureSource &) = delete;
    McpwmEdgeCaptureSource &operator=(const McpwmEdgeCaptureSource &) = delete;

    esp_err_t start();
    void stop();

    std::optional<ecu::sensors::EdgeCapture> read_capture(std::string_view input) override;

    std::uint32_t overflow_count() const { return overflow_count_.load(std::memory_order_relaxed); }
    std::uint32_t lost_overflow_count() const { return lost_overflow_count_.load(std::memory_order_relaxed); }
    std::uint32_t capture_timer_resolution_hz() const { return capture_timer_resolution_hz_; }

private:
    struct RawCapture {
        std::uint32_t capture_ticks{0};
        ecu::sensors::EdgePolarity polarity{ecu::sensors::EdgePolarity::Falling};
        ecu::sensors::CaptureStatus status{ecu::sensors::CaptureStatus::Ok};
    };

    static bool IRAM_ATTR on_capture(mcpwm_cap_channel_handle_t channel,
                                     const mcpwm_capture_event_data_t *event,
                                     void *user_ctx);

    bool handle_capture_from_isr(const mcpwm_capture_event_data_t &event);

    std::size_t configured_queue_depth() const;

    ecu::sensors::ITimeSource &time_source_;
    McpwmEdgeCaptureConfig config_{};
    CaptureTickConverter tick_converter_{1};
    QueueHandle_t queue_{nullptr};
    StaticQueue_t queue_storage_control_{};
    std::array<std::uint8_t, sizeof(RawCapture) * kMcpwmCaptureMaxQueueDepth> queue_storage_{};
    mcpwm_cap_timer_handle_t capture_timer_{nullptr};
    mcpwm_cap_channel_handle_t capture_channel_{nullptr};
    std::uint32_t capture_timer_resolution_hz_{0};
    std::atomic<std::uint32_t> overflow_count_{0};
    std::atomic<std::uint32_t> lost_overflow_count_{0};
    bool started_{false};
};

} // namespace ecu::sensor_drivers
