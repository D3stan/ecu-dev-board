import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


class IoDiagnosticsTests(unittest.TestCase):
    def test_esp32s2_tps_output_moves_off_gpio18(self):
        pins_h = read("main/pins.h")
        match = re.search(
            r"#if\s+CONFIG_IDF_TARGET_ESP32S2(?P<s2>.*?)#else",
            pins_h,
            re.DOTALL,
        )

        self.assertIsNotNone(match, "ESP32-S2 pin block is missing")
        s2_block = match.group("s2")
        self.assertRegex(s2_block, r"#define\s+SIM_PIN_TPS_OUT\s+16\b")
        self.assertNotRegex(s2_block, r"#define\s+SIM_PIN_TPS_OUT\s+18\b")
        self.assertRegex(s2_block, r"#define\s+SIM_PIN_EGT_OUT\s+17\b")

    def test_websocket_debug_telemetry_is_removed(self):
        state_h = read("main/sim_state.h")
        main_c = read("main/main.c")
        outputs_c = read("main/sim_io_outputs.c")

        self.assertNotIn("sim_io_debug_t", state_h)
        self.assertNotIn("io_debug", state_h)
        self.assertNotIn("io_debug", main_c)
        self.assertNotIn("io_debug", outputs_c)
        self.assertNotIn("ws_json_buf", main_c)
        self.assertNotIn('\\"io_debug\\"', main_c)
        self.assertRegex(main_c, r"sim_net_broadcast\s*\(\s*json_buf\s*,\s*len\s*\)")

    def test_dac_outputs_use_shared_clamped_scaling_helper(self):
        source = read("main/sim_io_outputs.c")

        self.assertIn("#include <math.h>", source)
        self.assertRegex(source, r"static\s+uint8_t\s+sim_io_percent_to_dac_code\s*\(\s*float\s+percent\s*\)")
        clamp_match = re.search(
            r"static\s+float\s+sim_io_clamp_percent\s*\(\s*float\s+percent\s*\)\s*\{(?P<body>.*?)\n\}",
            source,
            re.DOTALL,
        )
        self.assertIsNotNone(clamp_match, "Percent clamp helper is missing")
        clamp_body = clamp_match.group("body")
        self.assertIn("isfinite(percent)", clamp_body)
        self.assertRegex(clamp_body, r"percent\s*<\s*0\.0f")
        self.assertRegex(clamp_body, r"percent\s*>\s*100\.0f")

        helper_match = re.search(
            r"static\s+uint8_t\s+sim_io_percent_to_dac_code\s*\(\s*float\s+percent\s*\)\s*\{(?P<body>.*?)\n\}",
            source,
            re.DOTALL,
        )
        self.assertIsNotNone(helper_match, "DAC scaling helper is missing")
        helper_body = helper_match.group("body")
        self.assertIn("sim_io_clamp_percent(percent)", helper_body)
        self.assertRegex(helper_body, r"return\s+\(uint8_t\)")

        self.assertRegex(source, r"sim_io_set_tps_voltage[\s\S]*sim_io_percent_to_dac_code\s*\(\s*percent\s*\)")
        self.assertRegex(source, r"sim_io_set_egt_voltage[\s\S]*sim_io_percent_to_dac_code\s*\(\s*percent\s*\)")

    def test_tps_pwm_uses_shared_clamped_scaling_helper(self):
        source = read("main/sim_io_outputs.c")

        self.assertRegex(source, r"static\s+float\s+sim_io_clamp_percent\s*\(\s*float\s+percent\s*\)")
        self.assertRegex(
            source,
            r"static\s+uint32_t\s+sim_io_percent_to_pwm_duty\s*\(\s*float\s+percent\s*\)",
        )
        self.assertRegex(
            source,
            r"sim_io_percent_to_pwm_duty[\s\S]*sim_io_clamp_percent\s*\(\s*percent\s*\)",
        )
        self.assertRegex(
            source,
            r"sim_io_percent_to_pwm_duty[\s\S]*SIM_TPS_PWM_MAX_DUTY\s*\+\s*0\.5f",
        )

    def test_adc_sampling_skips_overridden_channels(self):
        source = read("main/sim_io_outputs.c")

        self.assertRegex(
            source,
            r"if\s*\(\s*!g_sim_state\.tps\.is_overridden\s*\)\s*\{[\s\S]*adc_oneshot_read\s*\(\s*adc1_handle\s*,\s*SIM_TPS_ADC_CHANNEL",
        )
        self.assertRegex(
            source,
            r"if\s*\(\s*!g_sim_state\.egt\.is_overridden\s*\)\s*\{[\s\S]*adc_oneshot_read\s*\(\s*adc1_handle\s*,\s*SIM_EGT_ADC_CHANNEL",
        )


if __name__ == "__main__":
    unittest.main()
