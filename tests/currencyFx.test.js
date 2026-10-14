const assert = require('assert');
const {
  toMinorUnits,
  fromMinorUnits,
  convertToMinorBase,
  calculateRealizedFx,
  calculateUnrealizedFx
} = require('../src/services/currencyFxService');

console.log('====================================================');
console.log('      RUNNING CURRENCY FX CALCULATION UNIT TESTS    ');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function test(description, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${description}`);
    console.error(err);
  }
}

// ---------------------------------------------------------------------
// TEST 1: Invoice paid at higher rate (Gain)
// Booking: 100 AED @ 22.50 INR = 2,250.00 INR
// Settlement: 100 AED @ 23.00 INR = 2,300.00 INR
// Formula: (23.00 - 22.50) * 100 = +50.00 INR (Realized Gain)
// ---------------------------------------------------------------------
test('Test 1: Receivable paid at higher rate yields Realized FX Gain', () => {
  const result = calculateRealizedFx({
    type: 'RECEIVABLE',
    bookingRate: 22.50,
    settlementRate: 23.00,
    foreignAmountSettled: 100.00,
    decimals: 2
  });

  assert.strictEqual(result.realizedGainLoss, 50.00, 'Net FX Gain/Loss must be +50.00');
  assert.strictEqual(result.realizedGain, 50.00, 'Realized Gain must be 50.00');
  assert.strictEqual(result.realizedLoss, 0.00, 'Realized Loss must be 0.00');
  assert.strictEqual(result.isGain, true);
  assert.strictEqual(result.isLoss, false);
});

// ---------------------------------------------------------------------
// TEST 2: Invoice paid at lower rate (Loss)
// Booking: 100 AED @ 22.50 INR = 2,250.00 INR
// Settlement: 100 AED @ 22.00 INR = 2,200.00 INR
// Formula: (22.00 - 22.50) * 100 = -50.00 INR (Realized Loss)
// ---------------------------------------------------------------------
test('Test 2: Receivable paid at lower rate yields Realized FX Loss', () => {
  const result = calculateRealizedFx({
    type: 'RECEIVABLE',
    bookingRate: 22.50,
    settlementRate: 22.00,
    foreignAmountSettled: 100.00,
    decimals: 2
  });

  assert.strictEqual(result.realizedGainLoss, -50.00, 'Net FX Gain/Loss must be -50.00');
  assert.strictEqual(result.realizedGain, 0.00, 'Realized Gain must be 0.00');
  assert.strictEqual(result.realizedLoss, 50.00, 'Realized Loss must be 50.00');
  assert.strictEqual(result.isGain, false);
  assert.strictEqual(result.isLoss, true);
});

// ---------------------------------------------------------------------
// TEST 3: Partial payment
// Booking: 100 AED @ 22.50 INR
// Partial settlement: 40 AED @ 23.00 INR
// Formula: (23.00 - 22.50) * 40 = +20.00 INR (Realized Gain on settled portion)
// ---------------------------------------------------------------------
test('Test 3: Partial payment applies formula strictly to settled foreign amount', () => {
  const result = calculateRealizedFx({
    type: 'RECEIVABLE',
    bookingRate: 22.50,
    settlementRate: 23.00,
    foreignAmountSettled: 40.00,
    decimals: 2
  });

  assert.strictEqual(result.realizedGainLoss, 20.00, 'Net FX Gain/Loss must be +20.00');
  assert.strictEqual(result.realizedGain, 20.00);
  assert.strictEqual(result.realizedLoss, 0.00);
});

// ---------------------------------------------------------------------
// TEST 4: Unpaid invoice (amount settled = 0)
// Booking: 120 AED @ 22.50 INR (like INV-001)
// Settlement amount: 0 AED
// Formula: (settlementRate - 22.50) * 0 = 0.00 INR
// ---------------------------------------------------------------------
test('Test 4: Unpaid invoice has 0 Realized FX', () => {
  const result = calculateRealizedFx({
    type: 'RECEIVABLE',
    bookingRate: 22.50,
    settlementRate: 23.50,
    foreignAmountSettled: 0,
    decimals: 2
  });

  assert.strictEqual(result.realizedGainLoss, 0.00);
  assert.strictEqual(result.realizedGain, 0.00);
  assert.strictEqual(result.realizedLoss, 0.00);
  assert.strictEqual(result.isGain, false);
  assert.strictEqual(result.isLoss, false);
});

// ---------------------------------------------------------------------
// TEST 5: Bill paid at different rate (Payable: reverse sign)
// Booking: 100 AED @ 22.50 INR = 2,250.00 INR liability
// Case 5a: Settled at 23.00 INR (paid 2,300.00 INR) -> we paid MORE base ccy -> LOSS
// Formula: (22.50 - 23.00) * 100 = -50.00 INR
// Case 5b: Settled at 22.00 INR (paid 2,200.00 INR) -> we paid LESS base ccy -> GAIN
// Formula: (22.50 - 22.00) * 100 = +50.00 INR
// ---------------------------------------------------------------------
test('Test 5a: Payable paid at higher rate yields Realized FX Loss (Reverse sign)', () => {
  const result = calculateRealizedFx({
    type: 'PAYABLE',
    bookingRate: 22.50,
    settlementRate: 23.00,
    foreignAmountSettled: 100.00,
    decimals: 2
  });

  assert.strictEqual(result.realizedGainLoss, -50.00, 'Payable at higher settlement rate must be a loss of -50.00');
  assert.strictEqual(result.realizedLoss, 50.00);
  assert.strictEqual(result.realizedGain, 0.00);
  assert.strictEqual(result.isLoss, true);
});

test('Test 5b: Payable paid at lower rate yields Realized FX Gain (Reverse sign)', () => {
  const result = calculateRealizedFx({
    type: 'PAYABLE',
    bookingRate: 22.50,
    settlementRate: 22.00,
    foreignAmountSettled: 100.00,
    decimals: 2
  });

  assert.strictEqual(result.realizedGainLoss, 50.00, 'Payable at lower settlement rate must be a gain of +50.00');
  assert.strictEqual(result.realizedGain, 50.00);
  assert.strictEqual(result.realizedLoss, 0.00);
  assert.strictEqual(result.isGain, true);
});

// ---------------------------------------------------------------------
// TEST 6: Unrealized FX on open balances
// Open Receivable: 120 AED booked at 22.50, revalued at latest 23.50
// Formula: (23.50 - 22.50) * 120 = +120.00 INR unrealized gain
// Open Payable: 50 AED booked at 22.50, revalued at latest 23.50
// Formula: (22.50 - 23.50) * 50 = -50.00 INR unrealized loss
// ---------------------------------------------------------------------
test('Test 6: Unrealized FX correctly revalues open balances against latest rate', () => {
  const openReceivable = calculateUnrealizedFx({
    type: 'RECEIVABLE',
    bookingRate: 22.50,
    latestRate: 23.50,
    openForeignAmount: 120.00,
    decimals: 2
  });
  assert.strictEqual(openReceivable.unrealizedGainLoss, 120.00);
  assert.strictEqual(openReceivable.unrealizedGain, 120.00);

  const openPayable = calculateUnrealizedFx({
    type: 'PAYABLE',
    bookingRate: 22.50,
    latestRate: 23.50,
    openForeignAmount: 50.00,
    decimals: 2
  });
  assert.strictEqual(openPayable.unrealizedGainLoss, -50.00);
  assert.strictEqual(openPayable.unrealizedLoss, 50.00);
});

// ---------------------------------------------------------------------
// TEST 7: Integer minor units precision (No IEEE-754 rounding artifacts)
// ---------------------------------------------------------------------
test('Test 7: Integer minor units avoid floating point inaccuracies', () => {
  const minor = toMinorUnits(0.1 + 0.2); // Usually 0.30000000000000004 in floats
  assert.strictEqual(minor, 30);
  assert.strictEqual(fromMinorUnits(minor), 0.30);
});

console.log(`\n====================================================`);
console.log(` SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
console.log(`====================================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
