#pragma once

#include <stdbool.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef enum {
    TELEMETRY_ENGINE_NO_SIGNAL = 0,
    TELEMETRY_ENGINE_ACQUISITION,
    TELEMETRY_ENGINE_SYNCHRONIZED,
} telemetry_engine_state_t;

typedef struct {
    uint64_t observed_at_us;
    uint64_t rpm_acquired_at_us;
    uint64_t tps_acquired_at_us;
    uint64_t revolution_id;
    uint32_t rpm;
    uint32_t period_us;
    uint32_t fire_delay_us;
    uint32_t rejected_edge_count;
    uint32_t late_fire_count;
    uint32_t schedule_error_count;
    uint32_t tps_sequence;
    uint16_t advance_tenths;
    uint8_t tps_percent;
    telemetry_engine_state_t engine_state;
    bool tps_valid;
} telemetry_real_sample_t;

typedef bool (*telemetry_source_read_fn)(void *context,
                                         telemetry_real_sample_t *sample);

typedef struct {
    telemetry_source_read_fn read;
    void *context;
} telemetry_source_t;

#ifdef __cplusplus
}
#endif
