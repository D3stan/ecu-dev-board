import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class SocketStatusTests(unittest.TestCase):
    def test_inbound_websocket_message_forces_connected_status(self):
        source = (ROOT / "webui" / "src" / "js" / "core" / "socket.js").read_text(encoding="utf-8")

        self.assertIn("if (state !== SocketState.CONNECTED)", source)
        self.assertIn("setState(SocketState.CONNECTED);", source)
        self.assertLess(
            source.index("if (state !== SocketState.CONNECTED)"),
            source.index("messageSubscribers.forEach"),
        )


if __name__ == "__main__":
    unittest.main()
