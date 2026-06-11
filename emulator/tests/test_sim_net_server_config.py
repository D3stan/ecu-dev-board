import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class SimNetServerConfigTests(unittest.TestCase):
    def test_http_server_does_not_lru_purge_websocket_clients(self):
        source = (ROOT / "main" / "sim_net.c").read_text(encoding="utf-8")

        self.assertIn("config.lru_purge_enable = false;", source)

    def test_favicon_request_has_explicit_handler(self):
        source = (ROOT / "main" / "sim_net.c").read_text(encoding="utf-8")

        self.assertIn('favicon_get_handler', source)
        self.assertIn('.uri = "/favicon.ico"', source)
        self.assertIn('HTTPD_204', source)


if __name__ == "__main__":
    unittest.main()
