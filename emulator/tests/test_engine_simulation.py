import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class EngineSimulationTests(unittest.TestCase):
    def test_egt_physical_pot_is_used_as_baseline_temperature(self):
        source = (ROOT / "main" / "main.c").read_text(encoding="utf-8")

        self.assertIn("float active_egt_baseline", source)
        self.assertIn("g_sim_state.egt.physical_val", source)
        self.assertRegex(source, r"egt_target\s*=\s*active_egt_baseline\s*;")
        self.assertRegex(
            source,
            r"egt_target\s*=\s*active_egt_baseline\s*\+\s*\(g_sim_state\.current_tps\s*\*\s*C_load\)",
        )
        self.assertNotIn("const float EGT_ambient = 20.0f;", source)


if __name__ == "__main__":
    unittest.main()
