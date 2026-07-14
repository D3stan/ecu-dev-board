#include "telemetry_bridge.h"

#include "engine_control.h"
#include "esp_timer.h"
#include "telemetry/telemetry_source.h"
#include "telemetry_server/telemetry_server.h"
#include "test-bench_config.h"
#include "tps.h"

_Static_assert((int)ENGINE_STATE_NO_SIGNAL ==
                   (int)TELEMETRY_ENGINE_NO_SIGNAL,
               "no-signal enum values must match");
_Static_assert((int)ENGINE_STATE_ACQUISITION ==
                   (int)TELEMETRY_ENGINE_ACQUISITION,
               "acquisition enum values must match");
_Static_assert((int)ENGINE_STATE_SYNCHRONIZED ==
                   (int)TELEMETRY_ENGINE_SYNCHRONIZED,
               "synchronized enum values must match");

static bool read_real_sample(void *context, telemetry_real_sample_t *sample)
{
    (void)context;
    if (sample == NULL) {
        return false;
    }

    engine_snapshot_t engine;
    tps_snapshot_t tps;
    engine_control_get_snapshot(&engine);
    tps_get_snapshot(&tps);

    *sample = (telemetry_real_sample_t) {
        .observed_at_us = (uint64_t)esp_timer_get_time(),
        .rpm_acquired_at_us = engine.reference_at_us,
        .tps_acquired_at_us = tps.acquired_at_us,
        .revolution_id = engine.revolution_id,
        .rpm = engine.rpm,
        .period_us = engine.period_us,
        .fire_delay_us = engine.delay_us,
        .rejected_edge_count = engine.rejected_edge_count,
        .late_fire_count = engine.late_fire_count,
        .schedule_error_count = engine.schedule_error_count,
        .tps_sequence = tps.sequence,
        .advance_tenths = engine.advance_tenths,
        .tps_percent = tps.percent,
        .engine_state = (telemetry_engine_state_t)engine.state,
        .tps_valid = tps.valid,
    };
    return true;
}

esp_err_t telemetry_bridge_start(void)
{
    static const telemetry_source_t source = {
        .read = read_real_sample,
        .context = NULL,
    };

    const telemetry_server_config_t config = {
        .sta_ssid = TELEMETRY_WIFI_STA_SSID,
        .sta_password = TELEMETRY_WIFI_STA_PASSWORD,
        .http_port = TELEMETRY_HTTP_PORT,
        .ws_path = TELEMETRY_WEBSOCKET_PATH,
        .http_task_stack_bytes = TELEMETRY_HTTP_TASK_STACK_SIZE,
        .http_task_priority = TELEMETRY_HTTP_TASK_PRIORITY,
        .http_max_open_sockets = TELEMETRY_HTTP_MAX_OPEN_SOCKETS,
        .http_lru_purge_enable = TELEMETRY_HTTP_LRU_PURGE_ENABLED,
        .static_base_path = TELEMETRY_SPIFFS_BASE_PATH,
        .static_partition_label = TELEMETRY_SPIFFS_PARTITION_LABEL,
        .static_max_open_files = TELEMETRY_SPIFFS_MAX_OPEN_FILES,
        .static_close_connection = TELEMETRY_STATIC_CLOSE_CONNECTION,
        .diagnostics_heap_checks = TELEMETRY_RUNTIME_HEAP_CHECKS,
        .state_hz = TELEMETRY_STATE_HZ,
        .max_events_per_batch = TELEMETRY_MAX_EVENTS_PER_BATCH,
        .event_backlog_capacity = TELEMETRY_EVENT_BACKLOG_CAPACITY,
        .max_frame_bytes = TELEMETRY_MAX_FRAME_BYTES,
        .task_stack_bytes = TELEMETRY_SERVER_TASK_STACK_SIZE,
        .task_priority = TELEMETRY_SERVER_TASK_PRIORITY,
        .hardware_revision = TELEMETRY_HARDWARE_REVISION,
        .auto_record_rpm_threshold = TELEMETRY_AUTO_RECORD_RPM_THRESHOLD,
        .auto_record_start_ms = TELEMETRY_AUTO_RECORD_START_MS,
        .auto_record_stop_ms = TELEMETRY_AUTO_RECORD_STOP_MS,
        .ambient_c = TELEMETRY_SIM_AMBIENT_C,
        .egt_base_c = TELEMETRY_SIM_EGT_BASE_C,
        .egt_rpm_gain = TELEMETRY_SIM_EGT_RPM_GAIN,
        .egt_tps_gain = TELEMETRY_SIM_EGT_TPS_GAIN,
        .egt_max_c = TELEMETRY_SIM_EGT_MAX_C,
        .egt_heat_c_per_s = TELEMETRY_SIM_EGT_HEAT_C_PER_S,
        .egt_cool_c_per_s = TELEMETRY_SIM_EGT_COOL_C_PER_S,
        .water_base_c = TELEMETRY_SIM_WATER_BASE_C,
        .water_rpm_gain = TELEMETRY_SIM_WATER_RPM_GAIN,
        .water_tps_gain = TELEMETRY_SIM_WATER_TPS_GAIN,
        .water_max_c = TELEMETRY_SIM_WATER_MAX_C,
        .water_heat_c_per_s = TELEMETRY_SIM_WATER_HEAT_C_PER_S,
        .water_cool_c_per_s = TELEMETRY_SIM_WATER_COOL_C_PER_S,
        .quick_shift_arm_rpm = TELEMETRY_SIM_QS_ARM_RPM,
        .quick_shift_period_ms = TELEMETRY_SIM_QS_PERIOD_MS,
        .quick_shift_active_ms = TELEMETRY_SIM_QS_ACTIVE_MS,
        .secondary_map_tps_percent = TELEMETRY_SIM_MAP_SECONDARY_TPS,
        .knock_candidate_index = TELEMETRY_SIM_KNOCK_CANDIDATE_INDEX,
    };

    return telemetry_server_start(&source, &config);
}
