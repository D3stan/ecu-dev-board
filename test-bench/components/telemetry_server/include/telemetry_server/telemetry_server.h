#pragma once

#include <stdbool.h>
#include <stdint.h>

#include "esp_err.h"
#include "telemetry/telemetry_source.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    const char *sta_ssid;
    const char *sta_password;
    uint16_t http_port;
    const char *ws_path;
    uint32_t http_task_stack_bytes;
    uint32_t http_task_priority;
    uint16_t http_max_open_sockets;
    bool http_lru_purge_enable;
    const char *static_base_path;
    const char *static_partition_label;
    uint32_t static_max_open_files;
    bool static_close_connection;
    bool diagnostics_heap_checks;
    uint32_t state_hz;
    uint32_t max_events_per_batch;
    uint32_t event_backlog_capacity;
    uint32_t max_frame_bytes;
    uint32_t task_stack_bytes;
    uint32_t task_priority;
    const char *hardware_revision;
    uint32_t auto_record_rpm_threshold;
    uint32_t auto_record_start_ms;
    uint32_t auto_record_stop_ms;
    float ambient_c;
    float egt_base_c;
    float egt_rpm_gain;
    float egt_tps_gain;
    float egt_max_c;
    float egt_heat_c_per_s;
    float egt_cool_c_per_s;
    float water_base_c;
    float water_rpm_gain;
    float water_tps_gain;
    float water_max_c;
    float water_heat_c_per_s;
    float water_cool_c_per_s;
    uint32_t quick_shift_arm_rpm;
    uint32_t quick_shift_period_ms;
    uint32_t quick_shift_active_ms;
    uint8_t secondary_map_tps_percent;
    float knock_candidate_index;
} telemetry_server_config_t;

/*
 * Copies the source descriptor and every configuration string. The source
 * callback function and the target referenced by source->context must remain
 * valid for the firmware lifetime.
 */
esp_err_t telemetry_server_start(const telemetry_source_t *source,
                                 const telemetry_server_config_t *config);

#ifdef __cplusplus
}
#endif
