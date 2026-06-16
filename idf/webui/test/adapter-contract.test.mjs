import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { dispatchMessage } from '../src/js/core/adapter.js';
import { Store } from '../src/js/core/store.js';
import { Paths } from '../src/js/utils/paths.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

Store.reset();

dispatchMessage(JSON.stringify({
  type: 'sim_telemetry',
  data: {
    rpm: 6400,
    tps: 32.5,
    egt: 410,
    ecu_advance: 22.4,
    spark_detected: true,
    overrides: {
      tps: false,
      egt: false,
      rpm: true,
      egt_fault: false
    }
  }
}));

assert.equal(Store.get(Paths.OVERRIDES.RPM.ACTIVE), true);
assert.equal(Store.get(Paths.OVERRIDES.RPM.VALUE), 6400);

const mainSource = readFileSync(resolve(__dirname, '../../main/main.c'), 'utf8');
assert.match(mainSource, /bool rpm_overridden = g_sim_state\.rpm\.is_overridden;/);
assert.match(mainSource, /\\"rpm\\": %s/);

console.log('adapter/backend telemetry contract passed');
