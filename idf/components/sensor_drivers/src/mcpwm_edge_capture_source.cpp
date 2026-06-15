#include "sensor_drivers/mcpwm_edge_capture_source.hpp"

namespace ecu::sensor_drivers {

namespace {

bool input_matches(const char *configured, std::string_view requested) {
    return configured != nullptr && requested == std::string_view(configured);
}

ecu::sensors::EdgePolarity polarity_from_edge(mcpwm_capture_edge_t edge) {
    return edge == MCPWM_CAP_EDGE_POS ? ecu::sensors::EdgePolarity::Rising
                                      : ecu::sensors::EdgePolarity::Falling;
}

} // namespace

McpwmEdgeCaptureSource::McpwmEdgeCaptureSource(ecu::sensors::ITimeSource &time_source,
                                               McpwmEdgeCaptureConfig config)
    : time_source_(time_source), config_(config) {
    const std::size_t depth = configured_queue_depth();
    queue_ = xQueueCreateStatic(static_cast<UBaseType_t>(depth),
                                sizeof(RawCapture),
                                queue_storage_.data(),
                                &queue_storage_control_);
}

McpwmEdgeCaptureSource::~McpwmEdgeCaptureSource() {
    stop();
}

std::size_t McpwmEdgeCaptureSource::configured_queue_depth() const {
    if (config_.queue_depth == 0) {
        return 1;
    }
    if (config_.queue_depth > kMcpwmCaptureMaxQueueDepth) {
        return kMcpwmCaptureMaxQueueDepth;
    }
    return config_.queue_depth;
}

esp_err_t McpwmEdgeCaptureSource::start() {
    if (started_) {
        return ESP_OK;
    }
    if (queue_ == nullptr || config_.gpio == GPIO_NUM_NC || config_.input_name == nullptr) {
        return ESP_ERR_INVALID_ARG;
    }

    mcpwm_capture_timer_config_t timer_config{};
    timer_config.group_id = config_.group_id;
    timer_config.clk_src = MCPWM_CAPTURE_CLK_SRC_DEFAULT;

    esp_err_t err = mcpwm_new_capture_timer(&timer_config, &capture_timer_);
    if (err != ESP_OK) {
        stop();
        return err;
    }

    err = mcpwm_capture_timer_get_resolution(capture_timer_, &capture_timer_resolution_hz_);
    if (err != ESP_OK || capture_timer_resolution_hz_ == 0) {
        stop();
        return err == ESP_OK ? ESP_ERR_INVALID_STATE : err;
    }

    mcpwm_capture_channel_config_t channel_config{};
    channel_config.gpio_num = config_.gpio;
    channel_config.intr_priority = config_.intr_priority;
    channel_config.prescale = 1;
    channel_config.flags.neg_edge = true;
    channel_config.flags.pos_edge = false;
    channel_config.flags.pull_up = false;
    channel_config.flags.pull_down = false;
    channel_config.flags.invert_cap_signal = false;
    channel_config.flags.io_loop_back = false;

    err = mcpwm_new_capture_channel(capture_timer_, &channel_config, &capture_channel_);
    if (err != ESP_OK) {
        stop();
        return err;
    }

    mcpwm_capture_event_callbacks_t callbacks{};
    callbacks.on_cap = &McpwmEdgeCaptureSource::on_capture;
    err = mcpwm_capture_channel_register_event_callbacks(capture_channel_, &callbacks, this);
    if (err != ESP_OK) {
        stop();
        return err;
    }

    err = mcpwm_capture_channel_enable(capture_channel_);
    if (err != ESP_OK) {
        stop();
        return err;
    }

    err = mcpwm_capture_timer_enable(capture_timer_);
    if (err != ESP_OK) {
        stop();
        return err;
    }

    tick_converter_ = CaptureTickConverter(capture_timer_resolution_hz_, time_source_.now());
    err = mcpwm_capture_timer_start(capture_timer_);
    if (err != ESP_OK) {
        stop();
        return err;
    }

    xQueueReset(queue_);
    overflow_count_.store(0, std::memory_order_relaxed);
    lost_overflow_count_.store(0, std::memory_order_relaxed);
    started_ = true;
    return ESP_OK;
}

void McpwmEdgeCaptureSource::stop() {
    if (capture_channel_ != nullptr) {
        (void)mcpwm_capture_channel_disable(capture_channel_);
    }
    if (capture_timer_ != nullptr) {
        (void)mcpwm_capture_timer_stop(capture_timer_);
        (void)mcpwm_capture_timer_disable(capture_timer_);
    }
    if (capture_channel_ != nullptr) {
        (void)mcpwm_del_capture_channel(capture_channel_);
        capture_channel_ = nullptr;
    }
    if (capture_timer_ != nullptr) {
        (void)mcpwm_del_capture_timer(capture_timer_);
        capture_timer_ = nullptr;
    }
    started_ = false;
}

std::optional<ecu::sensors::EdgeCapture> McpwmEdgeCaptureSource::read_capture(std::string_view input) {
    if (!input_matches(config_.input_name, input) || queue_ == nullptr) {
        return std::nullopt;
    }

    RawCapture raw{};
    if (xQueueReceive(queue_, &raw, 0) != pdTRUE) {
        return std::nullopt;
    }

    ecu::sensors::EdgeCapture capture{};
    capture.captured_at = tick_converter_.to_timestamp_us(raw.capture_ticks);
    capture.polarity = raw.polarity;
    capture.status = raw.status;
    return capture;
}

bool IRAM_ATTR McpwmEdgeCaptureSource::on_capture(mcpwm_cap_channel_handle_t,
                                                  const mcpwm_capture_event_data_t *event,
                                                  void *user_ctx) {
    auto *source = static_cast<McpwmEdgeCaptureSource *>(user_ctx);
    if (source == nullptr || event == nullptr) {
        return false;
    }
    return source->handle_capture_from_isr(*event);
}

bool IRAM_ATTR McpwmEdgeCaptureSource::handle_capture_from_isr(const mcpwm_capture_event_data_t &event) {
    if (queue_ == nullptr) {
        return false;
    }

    BaseType_t high_priority_task_woken = pdFALSE;
    RawCapture raw{};
    raw.capture_ticks = event.cap_value;
    raw.polarity = polarity_from_edge(event.cap_edge);
    raw.status = event.cap_edge == MCPWM_CAP_EDGE_NEG ? ecu::sensors::CaptureStatus::Ok
                                                      : ecu::sensors::CaptureStatus::HardwareFault;

    if (xQueueSendFromISR(queue_, &raw, &high_priority_task_woken) != pdTRUE) {
        RawCapture dropped{};
        (void)xQueueReceiveFromISR(queue_, &dropped, &high_priority_task_woken);

        raw.status = ecu::sensors::CaptureStatus::Overflow;
        if (xQueueSendFromISR(queue_, &raw, &high_priority_task_woken) == pdTRUE) {
            overflow_count_.fetch_add(1, std::memory_order_relaxed);
        } else {
            lost_overflow_count_.fetch_add(1, std::memory_order_relaxed);
        }
    }

    if (config_.notify_task != nullptr) {
        (void)xTaskNotifyFromISR(config_.notify_task,
                                 config_.notify_value,
                                 eSetBits,
                                 &high_priority_task_woken);
    }

    return high_priority_task_woken == pdTRUE;
}

} // namespace ecu::sensor_drivers
