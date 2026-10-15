const assert = require('assert');
const { roundHalfUp, getCurrencyDecimals } = require('../../src/services/currencyFxService');

console.log('Running Rounding Unit Tests...');

// 1. Half-up away from zero test cases
const test1 = roundHalfUp(1.005, 2);
assert.strictEqual(test1, 1.01, `Expected 1.005 rounded to 2 decimals to be 1.01, got ${test1}`);
console.log('✓ 1.005 (2 decimals) ->', test1);

const test2 = roundHalfUp(2.675, 2);
assert.strictEqual(test2, 2.68, `Expected 2.675 rounded to 2 decimals to be 2.68, got ${test2}`);
console.log('✓ 2.675 (2 decimals) ->', test2);

const test3 = roundHalfUp(-2.5, 0);
assert.strictEqual(test3, -3, `Expected -2.5 rounded away from zero to be -3, got ${test3}`);
console.log('✓ -2.5 (0 decimals, away from zero) ->', test3);

// 2. JPY: 0 decimals
const jpyDecimals = getCurrencyDecimals('JPY');
assert.strictEqual(jpyDecimals, 0, `Expected JPY decimals to be 0, got ${jpyDecimals}`);
const test4 = roundHalfUp(123.5, jpyDecimals);
assert.strictEqual(test4, 124, `Expected JPY 123.5 to be 124, got ${test4}`);
console.log('✓ JPY 123.5 (0 decimals) ->', test4);

// 3. KWD: 3 decimals
const kwdDecimals = getCurrencyDecimals('KWD');
assert.strictEqual(kwdDecimals, 3, `Expected KWD decimals to be 3, got ${kwdDecimals}`);
const test5 = roundHalfUp(1.0005, kwdDecimals);
assert.strictEqual(test5, 1.001, `Expected KWD 1.0005 to be 1.001, got ${test5}`);
console.log('✓ KWD 1.0005 (3 decimals) ->', test5);

const test6 = roundHalfUp(1.0025, kwdDecimals);
assert.strictEqual(test6, 1.003, `Expected KWD 1.0025 to be 1.003, got ${test6}`);
console.log('✓ KWD 1.0025 (3 decimals) ->', test6);

console.log('\nAll 6 Rounding tests PASSED successfully!\n');
