import base64
import tempfile
import unittest
from pathlib import Path

from web_builder import add_inline_favicon, inline_asset_urls


class WebBuilderAssetTests(unittest.TestCase):
    def test_inline_asset_urls_replaces_local_png_with_data_uri(self):
        with tempfile.TemporaryDirectory() as tmp:
            dist = Path(tmp)
            icon = dist / "assets" / "icons" / "icon-sun.png"
            icon.parent.mkdir(parents=True)
            icon.write_bytes(b"\x89PNG\r\n\x1a\n")

            source = 'const sun = "./assets/icons/icon-sun.png";'
            result = inline_asset_urls(source, dist)

            expected = base64.b64encode(icon.read_bytes()).decode("ascii")
            self.assertNotIn("./assets/icons/icon-sun.png", result)
            self.assertIn(f"data:image/png;base64,{expected}", result)

    def test_inline_asset_urls_leaves_missing_assets_unchanged(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = 'const missing = "./assets/icons/missing.png";'
            self.assertEqual(source, inline_asset_urls(source, Path(tmp)))

    def test_add_inline_favicon_prevents_browser_favicon_request(self):
        html = "<html><head><title>ECU</title></head><body></body></html>"
        result = add_inline_favicon(html)

        self.assertIn('<link rel="icon" href="data:,">', result)
        self.assertLess(result.index('<link rel="icon" href="data:,">'), result.index("</head>"))


if __name__ == "__main__":
    unittest.main()
