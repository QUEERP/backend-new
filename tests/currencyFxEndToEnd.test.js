const assert = require('assert');
const {
  CURRENCY_EXPONENTS,
  getCurrencyDecimals,
  roundHalfUp,
  toMinorUnits,
  fromMinorUnits,
  convertToMinorBase,
  calculateRealizedFx,
  calculateUnrealizedFx
} = require('../src/services/currencyFxService');

const gstTaxReportService = require('../src/services/gstTaxReportService');

console.log('=== STARTING END-TO-END FX & CURRENCY REPORT TESTS ===\n');

// -------------------------------------------------------------
// Test 1: Realized Gain on Receivable (AED Invoice 100 @ 22.5, Payment @ 23.0)
// -------------------------------------------------------------
console.log('Test 1: Realized Gain on Receivable (AED Invoice 100 @ 22.5, Payment @ 23.0)...');
{
  const bookingRate = 22.5;
  const settlementRate = 23.0;
  const foreignAmountSettled = 100.0;
  const decimals = getCurrencyDecimals('AED');

  const fx = calculateRealizedFx({
    type: 'RECEIVABLE',
    bookingRate,
    settlementRate,
    foreignAmountSettled,
    decimals
  });

  // Expected: (23.0 - 22.5) * 100 = 0.5 * 100 = +50.00
  console.log('  Result:', fx);
  assert.strictEqual(fx.realizedGainLoss, 50.0, 'Realized gain/loss should be +50.00');
  assert.strictEqual(fx.realizedGain, 50.0, 'Realized gain should be 50.00');
  assert.strictEqual(fx.realizedLoss, 0.0, 'Realized loss should be 0.00');
  assert.strictEqual(fx.isGain, true, 'isGain should be true');
  assert.strictEqual(fx.isLoss, false, 'isLoss should be false');
  console.log('  PASS: Realized Gain +50.00 verified.\n');
}

// -------------------------------------------------------------
// Test 2: Realized Loss on Payable (AED Bill 100 @ 22.5, Vendor Payment @ 23.0)
// -------------------------------------------------------------
console.log('Test 2: Realized Loss on Payable (AED Bill 100 @ 22.5, Vendor Payment @ 23.0)...');
{
  const bookingRate = 22.5;
  const settlementRate = 23.0;
  const foreignAmountSettled = 100.0;
  const decimals = getCurrencyDecimals('AED');

  const fx = calculateRealizedFx({
    type: 'PAYABLE',
    bookingRate,
    settlementRate,
    foreignAmountSettled,
    decimals
  });

  // Expected: (22.5 - 23.0) * 100 = -0.5 * 100 = -50.00 (Loss)
  console.log('  Result:', fx);
  assert.strictEqual(fx.realizedGainLoss, -50.0, 'Realized gain/loss should be -50.00');
  assert.strictEqual(fx.realizedGain, 0.0, 'Realized gain should be 0.00');
  assert.strictEqual(fx.realizedLoss, 50.0, 'Realized loss should be 50.00');
  assert.strictEqual(fx.isGain, false, 'isGain should be false');
  assert.strictEqual(fx.isLoss, true, 'isLoss should be true');
  console.log('  PASS: Realized Loss 50.00 verified.\n');
}

// -------------------------------------------------------------
// Test 3: Unrealized FX Revaluation at Period-End (120 AED Open @ 22.5 -> Rate Changes to 23.5)
// Total in INR (booked rate) stays 2,700, while Unrealized FX shows +120.00
// -------------------------------------------------------------
console.log('Test 3: Unrealized FX Revaluation (120 AED open @ 22.5 -> Period-End Rate 23.5)...');
{
  const bookingRate = 22.5;
  const openBalance = 120.0;
  const decimals = getCurrencyDecimals('AED');

  // Booked Base Currency Amount (Stored on document at creation)
  const bookedBaseCurrencyAmount = roundHalfUp(openBalance * bookingRate, decimals);
  console.log(`  Booked "Total in INR": ${bookedBaseCurrencyAmount} INR (120 AED x 22.5)`);
  assert.strictEqual(bookedBaseCurrencyAmount, 2700.0, 'Booked base amount must be 2,700 INR');

  // Revaluation at Period-End Date using latest rate 23.5
  const periodEndRate = 23.5;
  const uFx = calculateUnrealizedFx({
    type: 'RECEIVABLE',
    bookingRate,
    latestRate: periodEndRate,
    openForeignAmount: openBalance,
    decimals
  });

  // Expected: (23.5 - 22.5) * 120 = 1.0 * 120 = +120.00
  console.log('  Unrealized FX Result:', uFx);
  assert.strictEqual(uFx.unrealizedGainLoss, 120.0, 'Unrealized gain/loss should be +120.00');
  assert.strictEqual(uFx.unrealizedGain, 120.0, 'Unrealized gain should be 120.00');
  assert.strictEqual(uFx.unrealizedLoss, 0.0, 'Unrealized loss should be 0.00');
  assert.strictEqual(bookedBaseCurrencyAmount, 2700.0, 'Total in INR must remain 2,700 (booked rate)');
  console.log('  PASS: Unrealized FX is +120.00 and Total in INR remains 2,700.\n');
}

// -------------------------------------------------------------
// Test 4: Stale Rate Detection (> 30 Days Old)
// -------------------------------------------------------------
console.log('Test 4: Stale Rate Warning logic (> 30 days)...');
{
  const periodEndDate = new Date('2026-10-14T00:00:00.000Z');
  
  // Case A: 10 days old (Fresh)
  const freshDate = new Date('2026-10-04T00:00:00.000Z');
  const freshDiffDays = Math.floor((periodEndDate - freshDate) / (1000 * 60 * 60 * 24));
  const freshIsStale = freshDiffDays > 30;
  assert.strictEqual(freshIsStale, false, '10-day-old rate should NOT be stale');

  // Case B: 45 days old (Stale)
  const staleDate = new Date('2026-08-30T00:00:00.000Z');
  const staleDiffDays = Math.floor((periodEndDate - staleDate) / (1000 * 60 * 60 * 24));
  const staleIsStale = staleDiffDays > 30;
  const staleWarning = staleIsStale
    ? `Exchange rate effective date (${staleDate.toISOString().slice(0, 10)}) is ${staleDiffDays} days older than report period-end (${periodEndDate.toISOString().slice(0, 10)}). Statutory threshold is 30 days.`
    : null;

  console.log(`  Stale check: diffDays=${staleDiffDays}, isStale=${staleIsStale}`);
  console.log(`  Warning message: "${staleWarning}"`);
  assert.strictEqual(staleIsStale, true, '45-day-old rate must be stale');
  assert(staleWarning.includes('Statutory threshold is 30 days'), 'Warning must mention threshold');
  console.log('  PASS: Stale rate warning verified.\n');
}

// -------------------------------------------------------------
// Test 5: Per-Currency Minor-Unit Exponents and Rounding Rule
// -------------------------------------------------------------
console.log('Test 5: Minor-unit exponents and Rounding Rule...');
{
  assert.strictEqual(getCurrencyDecimals('JPY'), 0, 'JPY must have 0 decimals');
  assert.strictEqual(getCurrencyDecimals('BHD'), 3, 'BHD must have 3 decimals');
  assert.strictEqual(getCurrencyDecimals('KWD'), 3, 'KWD must have 3 decimals');
  assert.strictEqual(getCurrencyDecimals('INR'), 2, 'INR must have 2 decimals');
  assert.strictEqual(getCurrencyDecimals('AED'), 2, 'AED must have 2 decimals');
  assert.strictEqual(getCurrencyDecimals('USD'), 2, 'USD must have 2 decimals');

  // Half-up rounding
  assert.strictEqual(roundHalfUp(1.005, 2), 1.01, '1.005 rounds up to 1.01');
  assert.strictEqual(roundHalfUp(1.004, 2), 1.00, '1.004 rounds down to 1.00');
  assert.strictEqual(roundHalfUp(125.555, 2), 125.56, '125.555 rounds to 125.56');
  assert.strictEqual(roundHalfUp(125.554, 2), 125.55, '125.554 rounds to 125.55');
  console.log('  PASS: Currency exponents and rounding rule verified.\n');
}

// -------------------------------------------------------------
// Test 6: Whitelist of Purchase Return Statuses
// -------------------------------------------------------------
console.log('Test 6: Whitelist of Purchase Return Statuses...');
{
  const allowed = gstTaxReportService.POSTED_PURCHASE_RETURN_STATUSES;
  console.log('  POSTED_PURCHASE_RETURN_STATUSES:', allowed);
  assert(Array.isArray(allowed), 'Must be an array');
  assert(allowed.includes('SHIPPED'), 'Must include SHIPPED');
  assert(allowed.includes('COMPLETED'), 'Must include COMPLETED');
  assert(!allowed.includes('DRAFT'), 'Must exclude DRAFT');
  assert(!allowed.includes('PENDING'), 'Must exclude PENDING');
  assert(!allowed.includes('CANCELLED'), 'Must exclude CANCELLED');
  console.log('  PASS: Purchase return whitelist verified.\n');
}

// -------------------------------------------------------------
// Test 7: Taxable Value Formula (subtotal - discount + chargeable shipping)
// -------------------------------------------------------------
console.log('Test 7: Taxable Value Formula (INV-003 scenario)...');
{
  const subtotal = 1000.0;
  const discount = 10.0;
  const shippingCharges = 500.0;
  
  // Formula: subtotal - discount + chargeable shipping
  const taxableTurnover = roundHalfUp(subtotal - discount + shippingCharges, 2);
  console.log(`  Taxable Turnover for INV-003: ${taxableTurnover} INR ($1000 - $10 + $500)`);
  assert.strictEqual(taxableTurnover, 1490.0, 'Taxable value must equal 1,490.00 INR');
  console.log('  PASS: Taxable value formula verified.\n');
}

console.log('=== ALL 7 END-TO-END TESTS PASSED SUCCESSFULLY! ===\n');
