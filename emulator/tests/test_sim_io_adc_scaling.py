import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class SimIoAdcScalingTests(unittest.TestCase):
    def test_potentiometer_scaling_uses_configured_voltage_span(self):
        source = (ROOT / "main" / "sim_io_outputs.c").read_text(encoding="utf-8")

        self.assertRegex(source, r"#define\s+SIM_ADC_BITWIDTH\s+ADC_BITWIDTH_DEFAULT\b")
        self.assertRegex(source, r"#define\s+SIM_ADC_RAW_MAX\s+8191\.0f\b")
        self.assertRegex(source, r"#define\s+SIM_POT_FULL_SCALE_MV\s+2500\b")
        self.assertRegex(source, r"sim_io_adc_raw_to_pot_fraction\s*\(")
        self.assertIn("SIM_POT_FULL_SCALE_MV", source)
        self.assertIn(".bitwidth = SIM_ADC_BITWIDTH", source)
        self.assertNotRegex(source, r"avg_tps\s*/\s*4095\.0f\)\s*\*\s*100\.0f")
        self.assertNotRegex(source, r"avg_egt\s*/\s*4095\.0f\)\s*\*\s*980\.0f")


if __name__ == "__main__":
    unittest.main()
