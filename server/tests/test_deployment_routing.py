from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class DeploymentRoutingTest(unittest.TestCase):
    def test_dokploy_is_the_only_public_router(self) -> None:
        compose = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")

        self.assertNotIn("traefik.", compose)

    def test_internal_backend_name_is_stack_specific(self) -> None:
        compose = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")
        nginx = (ROOT / "frontend" / "nginx.conf").read_text(encoding="utf-8")

        self.assertIn("\n  ecu-dt-backend:\n", compose)
        self.assertIn("- ecu-dt-backend", compose)
        self.assertNotIn("http://backend:8000", nginx)
        self.assertEqual(nginx.count("http://ecu-dt-backend:8000"), 3)

    def test_dashboard_accepts_backend_ok_health_status(self) -> None:
        app = (ROOT / "frontend" / "src" / "app" / "App.vue").read_text(
            encoding="utf-8"
        )

        self.assertIn("data.status === 'ok'", app)
        self.assertIn("data.status === 'healthy'", app)


if __name__ == "__main__":
    unittest.main()
