import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceIndexUrl = new URL("../src/index.html", import.meta.url);
const mainUrl = new URL("../src/js/main.js", import.meta.url);

test("production build hardcodes the digital-twin URL without an environment lookup", async () => {
  const [sourceIndex, main] = await Promise.all([
    readFile(sourceIndexUrl, "utf8"),
    readFile(mainUrl, "utf8"),
  ]);

  assert.doesNotMatch(sourceIndex, /VITE_DIGITAL_TWIN_SERVER_URL/);
  assert.match(main, /const DIGITAL_TWIN_SERVER_URL = "https:\/\/ecu\.0xpuddu\.com";/);
  assert.match(main, /digitalTwinServerUrl:\s*DIGITAL_TWIN_SERVER_URL/);
  assert.doesNotMatch(main, /import\.meta\.env/);
});
