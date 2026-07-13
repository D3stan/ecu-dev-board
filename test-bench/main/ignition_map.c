#include <stddef.h>
#include <stdint.h>

#include "esp_attr.h"
#include "esp_err.h"

#include "ignition_map.h"

#define RPM_AXIS_SIZE 10U
#define TPS_AXIS_SIZE 6U

static DRAM_ATTR uint32_t s_rpm_axis[RPM_AXIS_SIZE] = {
    200U, 500U, 1000U, 2000U, 3000U,
    5000U, 8000U, 12000U, 16000U, 20000U,
};

static DRAM_ATTR uint8_t s_tps_axis[TPS_AXIS_SIZE] = {
    0U, 20U, 40U, 60U, 80U, 100U,
};

static DRAM_ATTR uint16_t s_advance_map[RPM_AXIS_SIZE][TPS_AXIS_SIZE] = {
    {  50U,  50U,  50U,  50U,  50U,  50U },
    {  80U,  80U,  80U,  70U,  70U,  70U },
    { 120U, 120U, 110U, 100U,  90U,  80U },
    { 200U, 190U, 170U, 150U, 130U, 120U },
    { 280U, 260U, 240U, 220U, 200U, 180U },
    { 350U, 340U, 320U, 290U, 270U, 240U },
    { 350U, 340U, 330U, 310U, 290U, 270U },
    { 340U, 330U, 320U, 300U, 290U, 280U },
    { 320U, 320U, 310U, 300U, 290U, 280U },
    { 300U, 300U, 290U, 280U, 270U, 260U },
};

static size_t IRAM_ATTR find_rpm_interval(uint32_t rpm)
{
    for (size_t index = 0; index < RPM_AXIS_SIZE - 1U; ++index) {
        if (rpm <= s_rpm_axis[index + 1U]) {
            return index;
        }
    }

    return RPM_AXIS_SIZE - 2U;
}

static size_t IRAM_ATTR find_tps_interval(uint8_t tps_percent)
{
    for (size_t index = 0; index < TPS_AXIS_SIZE - 1U; ++index) {
        if (tps_percent <= s_tps_axis[index + 1U]) {
            return index;
        }
    }

    return TPS_AXIS_SIZE - 2U;
}

esp_err_t ignition_map_validate(uint16_t pickup_angle_tenths)
{
    for (size_t index = 1; index < RPM_AXIS_SIZE; ++index) {
        if (s_rpm_axis[index] <= s_rpm_axis[index - 1U]) {
            return ESP_ERR_INVALID_STATE;
        }
    }

    for (size_t index = 1; index < TPS_AXIS_SIZE; ++index) {
        if (s_tps_axis[index] <= s_tps_axis[index - 1U]) {
            return ESP_ERR_INVALID_STATE;
        }
    }

    for (size_t rpm_index = 0; rpm_index < RPM_AXIS_SIZE; ++rpm_index) {
        for (size_t tps_index = 0; tps_index < TPS_AXIS_SIZE; ++tps_index) {
            if (s_advance_map[rpm_index][tps_index] >
                pickup_angle_tenths) {
                return ESP_ERR_INVALID_STATE;
            }
        }
    }

    return ESP_OK;
}

uint16_t IRAM_ATTR ignition_map_lookup(uint32_t rpm, uint8_t tps_percent)
{
    if (rpm < s_rpm_axis[0]) {
        rpm = s_rpm_axis[0];
    } else if (rpm > s_rpm_axis[RPM_AXIS_SIZE - 1U]) {
        rpm = s_rpm_axis[RPM_AXIS_SIZE - 1U];
    }

    if (tps_percent > s_tps_axis[TPS_AXIS_SIZE - 1U]) {
        tps_percent = s_tps_axis[TPS_AXIS_SIZE - 1U];
    }

    const size_t rpm_index = find_rpm_interval(rpm);
    const size_t tps_index = find_tps_interval(tps_percent);
    const uint32_t rpm_low = s_rpm_axis[rpm_index];
    const uint32_t rpm_high = s_rpm_axis[rpm_index + 1U];
    const uint32_t tps_low = s_tps_axis[tps_index];
    const uint32_t tps_high = s_tps_axis[tps_index + 1U];
    const uint32_t rpm_low_weight = rpm_high - rpm;
    const uint32_t rpm_high_weight = rpm - rpm_low;
    const uint32_t tps_low_weight = tps_high - tps_percent;
    const uint32_t tps_high_weight = tps_percent - tps_low;
    const uint32_t denominator =
        (rpm_high - rpm_low) * (tps_high - tps_low);

    const uint32_t numerator =
        s_advance_map[rpm_index][tps_index] *
            rpm_low_weight * tps_low_weight +
        s_advance_map[rpm_index][tps_index + 1U] *
            rpm_low_weight * tps_high_weight +
        s_advance_map[rpm_index + 1U][tps_index] *
            rpm_high_weight * tps_low_weight +
        s_advance_map[rpm_index + 1U][tps_index + 1U] *
            rpm_high_weight * tps_high_weight;

    return (uint16_t)((numerator + denominator / 2U) / denominator);
}
