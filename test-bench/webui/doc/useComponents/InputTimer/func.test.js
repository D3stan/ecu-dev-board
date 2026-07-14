/**
 * func.test.js
 * ============
 * Unit tests per le funzioni di utilità InputTimer
 * 
 * Run con: node func.test.js (o framework di testing)
 */

import { 
  secondsToHMS, 
  hmsToSeconds, 
  getMaxValues, 
  validateTotal,
  getValidatedValue 
} from './func.js';

// ============================================
// TEST SUITE
// ============================================

console.log('🧪 Testing InputTimer func.js\n');

let passed = 0;
let failed = 0;

function test(description, callback) {
  try {
    callback();
    console.log(`✅ ${description}`);
    passed++;
  } catch (error) {
    console.error(`❌ ${description}`);
    console.error(`   ${error.message}`);
    failed++;
  }
}

function assertEquals(actual, expected, message = '') {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  
  if (actualStr !== expectedStr) {
    throw new Error(`Expected ${expectedStr}, got ${actualStr}. ${message}`);
  }
}

// ============================================
// secondsToHMS Tests
// ============================================

console.log('📦 secondsToHMS Tests:');

test('converts 0 seconds', () => {
  assertEquals(secondsToHMS(0), { hours: 0, minutes: 0, seconds: 0 });
});

test('converts 30 seconds', () => {
  assertEquals(secondsToHMS(30), { hours: 0, minutes: 0, seconds: 30 });
});

test('converts 60 seconds (1 minute)', () => {
  assertEquals(secondsToHMS(60), { hours: 0, minutes: 1, seconds: 0 });
});

test('converts 90 seconds (1m 30s)', () => {
  assertEquals(secondsToHMS(90), { hours: 0, minutes: 1, seconds: 30 });
});

test('converts 3600 seconds (1 hour)', () => {
  assertEquals(secondsToHMS(3600), { hours: 1, minutes: 0, seconds: 0 });
});

test('converts 3661 seconds (1h 1m 1s)', () => {
  assertEquals(secondsToHMS(3661), { hours: 1, minutes: 1, seconds: 1 });
});

test('converts 1870 seconds (31m 10s)', () => {
  assertEquals(secondsToHMS(1870), { hours: 0, minutes: 31, seconds: 10 });
});

// ============================================
// hmsToSeconds Tests
// ============================================

console.log('\n📦 hmsToSeconds Tests:');

test('converts 0:0:0 to 0', () => {
  assertEquals(hmsToSeconds(0, 0, 0), 0);
});

test('converts 0:0:30 to 30', () => {
  assertEquals(hmsToSeconds(0, 0, 30), 30);
});

test('converts 0:1:0 to 60', () => {
  assertEquals(hmsToSeconds(0, 1, 0), 60);
});

test('converts 0:1:30 to 90', () => {
  assertEquals(hmsToSeconds(0, 1, 30), 90);
});

test('converts 1:0:0 to 3600', () => {
  assertEquals(hmsToSeconds(1, 0, 0), 3600);
});

test('converts 1:1:1 to 3661', () => {
  assertEquals(hmsToSeconds(1, 1, 1), 3661);
});

test('converts 0:31:10 to 1870', () => {
  assertEquals(hmsToSeconds(0, 31, 10), 1870);
});

// ============================================
// getMaxValues Tests
// ============================================

console.log('\n📦 getMaxValues Tests:');

test('max=59s → hours=0, minutes=0, seconds=59', () => {
  const result = getMaxValues(59, 0, 0);
  assertEquals(result, { hours: 0, minutes: 0, seconds: 59 });
});

test('max=3599s → hours=0, minutes=59, seconds=59', () => {
  const result = getMaxValues(3599, 0, 0);
  assertEquals(result, { hours: 0, minutes: 59, seconds: 59 });
});

test('max=3600s → hours=1, minutes=0, seconds=0', () => {
  const result = getMaxValues(3600, 0, 0);
  assertEquals(result, { hours: 1, minutes: 0, seconds: 0 });
});

test('max=1870s, hours=0, minutes=30 → seconds=59', () => {
  const result = getMaxValues(1870, 0, 30);
  assertEquals(result, { hours: 0, minutes: 31, seconds: 59 });
});

test('max=1870s, hours=0, minutes=31 → seconds=10', () => {
  const result = getMaxValues(1870, 0, 31);
  assertEquals(result, { hours: 0, minutes: 31, seconds: 10 });
});

test('max=7265s (2h 1m 5s), hours=2, minutes=1 → seconds=5', () => {
  const result = getMaxValues(7265, 2, 1);
  assertEquals(result, { hours: 2, minutes: 1, seconds: 5 });
});

test('max=7265s, hours=1 → minutes=59', () => {
  const result = getMaxValues(7265, 1, 0);
  assertEquals(result, { hours: 2, minutes: 59, seconds: 59 });
});

// ============================================
// validateTotal Tests
// ============================================

console.log('\n📦 validateTotal Tests:');

test('validates within range (max=1800)', () => {
  const state = { hours: 0, minutes: 30, seconds: 0 };
  const result = validateTotal(state, 1800);
  assertEquals(result, { hours: 0, minutes: 30, seconds: 0 });
});

test('clamps to max when exceeding (max=1870)', () => {
  const state = { hours: 0, minutes: 31, seconds: 25 }; // 1885s > 1870s
  const result = validateTotal(state, 1870);
  assertEquals(result, { hours: 0, minutes: 31, seconds: 10 });
});

test('clamps to max when way over (max=60)', () => {
  const state = { hours: 1, minutes: 30, seconds: 45 }; // 5445s > 60s
  const result = validateTotal(state, 60);
  assertEquals(result, { hours: 0, minutes: 1, seconds: 0 });
});

// ============================================
// getValidatedValue Tests
// ============================================

console.log('\n📦 getValidatedValue Tests:');

test('returns valid integer input', () => {
  assertEquals(getValidatedValue(25, 20, 0, 50), 25);
});

test('truncates decimal input (21.4 → 21)', () => {
  assertEquals(getValidatedValue("21.4", 20, 0, 50), 21);
});

test('clamps to max when exceeding', () => {
  assertEquals(getValidatedValue(70, 48, 0, 50), 50);
});

test('clamps to min when below', () => {
  assertEquals(getValidatedValue(5, 20, 10, 50), 10);
});

test('returns previous value on NaN', () => {
  assertEquals(getValidatedValue("abc", 25, 0, 50), 25);
});

test('returns previous value on empty string', () => {
  assertEquals(getValidatedValue("", 30, 0, 50), 30);
});

test('handles min=0 correctly', () => {
  assertEquals(getValidatedValue(0, 10, 0, 50), 0);
});

// ============================================
// INTEGRATION Tests (conversioni bidirezionali)
// ============================================

console.log('\n📦 Integration Tests:');

test('secondsToHMS → hmsToSeconds roundtrip', () => {
  const testValues = [0, 30, 90, 1800, 3600, 3661, 1870, 7265];
  
  testValues.forEach(seconds => {
    const hms = secondsToHMS(seconds);
    const back = hmsToSeconds(hms.hours, hms.minutes, hms.seconds);
    assertEquals(back, seconds, `Failed for ${seconds}s`);
  });
});

test('edge case: max exactly at boundary (3600s)', () => {
  const hms = secondsToHMS(3600);
  assertEquals(hms, { hours: 1, minutes: 0, seconds: 0 });
  
  const maxVals = getMaxValues(3600, 1, 0);
  assertEquals(maxVals.hours, 1);
  assertEquals(maxVals.minutes, 0);
  assertEquals(maxVals.seconds, 0);
});

test('edge case: 1 second before hour boundary', () => {
  const hms = secondsToHMS(3599);
  assertEquals(hms, { hours: 0, minutes: 59, seconds: 59 });
  
  const maxVals = getMaxValues(3599, 0, 59);
  assertEquals(maxVals.minutes, 59);
  assertEquals(maxVals.seconds, 59);
});

// ============================================
// SUMMARY
// ============================================

console.log('\n' + '='.repeat(50));
console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log('✅ All tests passed!');
} else {
  console.error(`❌ ${failed} test(s) failed`);
  process.exit(1);
}
