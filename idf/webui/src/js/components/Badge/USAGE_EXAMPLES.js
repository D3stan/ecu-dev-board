/**
 * BADGE COMPONENT - USAGE EXAMPLES
 * =================================
 * 
 * This file shows how to use the Badge component in different scenarios.
 */

import { Badge } from './Badge.js';
import { mapSocketStateToBadge, mapPumpStateToBadge } from './BadgeFunctions.js';

// ============================================
// EXAMPLE 1: Connection Badge
// ============================================

const connectionBadge = new Badge({
  storePath: 'socket.state',
  mapFunction: mapSocketStateToBadge,
  defaultState: { 
    label: 'ui.disconnected', 
    class: 'error' 
  }
});

// Mount to container
const container1 = document.querySelector('#connection-badge-container');
connectionBadge.mount(container1);
connectionBadge.activate();

// ============================================
// EXAMPLE 2: Pump Badge (with icon)
// ============================================

const pumpBadge = new Badge({
  storePath: 'outputs.pumpState',
  mapFunction: mapPumpStateToBadge,
  icon: 'assets/icons/icon-pump.png',
  defaultState: { 
    label: 'ui.pumpOff', 
    class: 'off' 
  }
});

// Mount to container
const container2 = document.querySelector('#pump-badge-container');
pumpBadge.mount(container2);
pumpBadge.activate();

// ============================================
// EXAMPLE 3: Custom Badge (custom mapping)
// ============================================

// Custom mapping function for a different state
function mapCustomStateToBadge(value) {
  if (value === 0) {
    return { label: 'ui.inactive', class: 'off' };
  } else if (value === 1) {
    return { label: 'ui.active', class: 'on' };
  } else {
    return { label: 'ui.unknown', class: 'error' };
  }
}

const customBadge = new Badge({
  storePath: 'custom.state',
  mapFunction: mapCustomStateToBadge,
  defaultState: { 
    label: 'ui.inactive', 
    class: 'off' 
  }
});

// Mount to container
const container3 = document.querySelector('#custom-badge-container');
customBadge.mount(container3);
customBadge.activate();

// ============================================
// CLEANUP (when removing badges)
// ============================================

// When page/component is destroyed
connectionBadge.destroy();
pumpBadge.destroy();
customBadge.destroy();
