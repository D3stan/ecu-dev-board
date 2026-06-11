import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


class IoDiagnosticsTests(unittest.TestCase):
    def test_io_debug_state_is_defined_for_websocket_telemetry(self):
        state_h = read("main/sim_state.h")

        self.assertIn("typedef struct", state_h)
        self.assertIn("sim_io_debug_t", state_h)
        for field in (
            "tps_raw",
            "tps_mv",
            "tps_fraction",
            "tps_physical",
            "active_tps",
            "tps_dac_code",
            "egt_raw",
            "egt_mv",
            "egt_fraction",
            "egt_physical",
            "current_egt",
            "egt_dac_code",
            "tps_dac_ok",
            "egt_dac_ok",
        ):
            self.assertRegex(state_h, rf"\b{field}\b")
        self.assertRegex(state_h, r"sim_io_debug_t\s+io_debug\s*;")

    def test_io_debug_is_websocket_only_not_uart_printed(self):
        main_c = read("main/main.c")

        self.assertIn('\\"io_debug\\"', main_c)
        self.assertRegex(main_c, r"snprintf\s*\(\s*ws_json_buf[\s\S]*\\\"io_debug\\\"")
        self.assertRegex(main_c, r"sim_net_broadcast\s*\(\s*ws_json_buf\s*,\s*ws_len\s*\)")
        self.assertNotRegex(main_c, r"printf\s*\(\s*\"%s\\n\"\s*,\s*ws_json_buf\s*\)")

    def test_dac_outputs_use_shared_clamped_scaling_helper(self):
        source = read("main/sim_io_outputs.c")

        self.assertIn("#include <math.h>", source)
        self.assertRegex(source, r"static\s+uint8_t\s+sim_io_percent_to_dac_code\s*\(\s*float\s+percent\s*\)")
        helper_match = re.search(
            r"static\s+uint8_t\s+sim_io_percent_to_dac_code\s*\(\s*float\s+percent\s*\)\s*\{(?P<body>.*?)\n\}",
            source,
            re.DOTALL,
        )
        self.assertIsNotNone(helper_match, "DAC scaling helper is missing")
        helper_body = helper_match.group("body")
        self.assertIn("isfinite(percent)", helper_body)
        self.assertRegex(helper_body, r"percent\s*<\s*0\.0f")
        self.assertRegex(helper_body, r"percent\s*>\s*100\.0f")
        self.assertRegex(helper_body, r"return\s+\(uint8_t\)")

        self.assertRegex(source, r"sim_io_set_tps_voltage[\s\S]*sim_io_percent_to_dac_code\s*\(\s*percent\s*\)")
        self.assertRegex(source, r"sim_io_set_egt_voltage[\s\S]*sim_io_percent_to_dac_code\s*\(\s*percent\s*\)")
        self.assertRegex(source, r"g_sim_state\.io_debug\.tps_dac_ok\s*=")
        self.assertRegex(source, r"g_sim_state\.io_debug\.egt_dac_ok\s*=")

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

    def test_io_debug_does_not_add_serial_logging(self):
        source = read("main/sim_io_outputs.c") + "\n" + read("main/main.c")
        main_c = read("main/main.c")

        for match in re.finditer(r"io_debug", source):
            window = source[max(0, match.start() - 120): match.end() + 120]
            self.assertNotIn("ESP_LOG", window)
        self.assertNotRegex(main_c, r"printf\s*\(\s*\"%s\\n\"\s*,\s*ws_json_buf\s*\)")


if __name__ == "__main__":
    unittest.main()
