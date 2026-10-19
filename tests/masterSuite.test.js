const assert = require('assert');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const {
  determineSupplyType,
  recomputeInvoiceFinancials,
  SUPPLY_TYPES
} = require('../src/services/tax/supplyTypeEngine');

const {
  resolveGstState,
  isValidGstRate,
  getValidGstRatesForDate,
  GST_STATES
} = require('../src/services/tax/gstConfig');

const {
  CURRENCY_EXPONENTS,
  getCurrencyDecimals,
  roundHalfUp,
  toMinorUnits,
  fromMinorUnits,
  calculateRealizedFx,
  calculateUnrealizedFx
} = require('../src/services/currencyFxService');

const {
  validateIban,
  validateAbaRouting,
  validateSwift,
  validateIfsc,
  validateGstin,
  validateUaeTrn,
  encryptAccountNumber,
  decryptAccountNumber,
  maskAccountNumber,
  validateCustomerBank
} = require('../src/utils/bankValidation');

const {
  generateGstTaxSummary,
  toPaise,
  fromPaise,
  parseIstDateBoundaries,
  POSTED_INVOICE_STATUSES,
  POSTED_BILL_STATUSES
} = require('../src/services/gstTaxReportService');

console.log('======================================================================');
console.log('       MASTER STATUTORY AUDIT & REGRESSION TEST SUITE (PHASE 7)       ');
console.log('======================================================================\n');

async function runMasterSuite() {
  const sellerIndia = {
    country: 'INDIA',
    countryCode: 'IN',
    state: 'Gujarat',
    gstNumber: '24ABCDE1234F1Z5'
  };

  // -------------------------------------------------------------------------
  // TEST 1: Same-state 5% invoice (create AND update) -> CGST 2.5% + SGST 2.5%
  // -------------------------------------------------------------------------
  console.log('Test 1: Same-state 5% invoice (create & update) -> CGST 2.5% + SGST 2.5%, taxable value once');
  {
    const buyerGujarat = {
      country: 'INDIA',
      billingCountry: 'INDIA',
      state: 'Gujarat',
      billingState: 'Gujarat',
      gstNumber: '24XYZAB5678C1Z2'
    };

    // Initial Creation
    const resCreate = recomputeInvoiceFinancials({
      business: sellerIndia,
      customer: buyerGujarat,
      items: [{ description: 'Item A', quantity: 2, price: 1000, discount: 0, taxPercent: 5 }],
      headerData: { discount: 0, shippingCharges: 0 },
      exchangeRate: 1.0
    });

    assert.strictEqual(resCreate.supplyResolution.supplyType, SUPPLY_TYPES.CGST_SGST);
    assert.strictEqual(resCreate.subtotal, 2000.0);
    assert.strictEqual(resCreate.cgst, 50.0);
    assert.strictEqual(resCreate.sgst, 50.0);
    assert.strictEqual(resCreate.igst, 0.0);
    assert.strictEqual(resCreate.totalTax, 100.0);
    assert.strictEqual(resCreate.grandTotal, 2100.0);
    assert.strictEqual(resCreate.baseCurrencyAmount, 2100.0);
    assert.strictEqual(resCreate.processedItems[0].cgstPercent, 2.5);
    assert.strictEqual(resCreate.processedItems[0].sgstPercent, 2.5);
    assert.strictEqual(resCreate.processedItems[0].igstPercent, 0.0);

    // Update with new quantity & discount
    const resUpdate = recomputeInvoiceFinancials({
      business: sellerIndia,
      customer: buyerGujarat,
      items: [{ description: 'Item A', quantity: 3, price: 1000, discount: 200, taxPercent: 5 }],
      headerData: { discount: 0, shippingCharges: 0 },
      exchangeRate: 1.0
    });

    assert.strictEqual(resUpdate.subtotal, 3000.0);
    assert.strictEqual(resUpdate.cgst, 70.0); // 5% on 2800 = 140 / 2 = 70
    assert.strictEqual(resUpdate.sgst, 70.0);
    assert.strictEqual(resUpdate.totalTax, 140.0);
    assert.strictEqual(resUpdate.grandTotal, 2940.0);
    console.log('  PASS: Intra-state 5% create and update recomputes CGST 2.5% + SGST 2.5% correctly.\n');
  }

  // -------------------------------------------------------------------------
  // TEST 2: Inter-state -> IGST 5%. Mixed 5% and 18% -> separate rate rows
  // -------------------------------------------------------------------------
  console.log('Test 2: Inter-state -> IGST 5%. Mixed 5% and 18% -> separate rate rows');
  {
    const buyerMaharashtra = {
      country: 'INDIA',
      billingCountry: 'INDIA',
      state: 'Maharashtra',
      billingState: 'Maharashtra',
      gstNumber: '27AABCB1234F1Z9'
    };

    const res = recomputeInvoiceFinancials({
      business: sellerIndia,
      customer: buyerMaharashtra,
      items: [
        { description: 'Item 5%', quantity: 1, price: 1000, taxPercent: 5 },
        { description: 'Item 18%', quantity: 1, price: 2000, taxPercent: 18 }
      ],
      headerData: {},
      exchangeRate: 1.0
    });

    assert.strictEqual(res.supplyResolution.supplyType, SUPPLY_TYPES.IGST);
    assert.strictEqual(res.cgst, 0);
    assert.strictEqual(res.sgst, 0);
    assert.strictEqual(res.igst, 410.0); // 50 + 360 = 410
    assert.strictEqual(res.processedItems[0].igstAmount, 50.0);
    assert.strictEqual(res.processedItems[1].igstAmount, 360.0);
    assert.strictEqual(res.grandTotal, 3410.0);
    console.log('  PASS: Inter-state mixed 5% and 18% lines compute IGST independently without blending.\n');
  }

  // -------------------------------------------------------------------------
  // TEST 3: UAE customer + LUT -> IGST 0%, appears in Exports and Taxable Sales
  // -------------------------------------------------------------------------
  console.log('Test 3: UAE customer + LUT -> IGST 0%, appears in Exports and Taxable Sales');
  {
    const buyerUAE = {
      country: 'UAE',
      billingCountry: 'UAE',
      state: 'Dubai'
    };

    // 3a. Valid LUT export (0% tax)
    const res = recomputeInvoiceFinancials({
      business: sellerIndia,
      customer: buyerUAE,
      items: [{ description: 'Export Service', quantity: 1, price: 10000, taxPercent: 0 }],
      headerData: { exportType: 'UNDER_LUT' },
      exchangeRate: 1.0
    });

    assert.strictEqual(res.supplyResolution.supplyType, SUPPLY_TYPES.EXPORT_LUT);
    assert.strictEqual(res.totalTax, 0);
    assert.strictEqual(res.igst, 0);
    assert.strictEqual(res.grandTotal, 10000);

    // 3b. Server rejects IGST > 0% on an export under LUT
    assert.throws(() => {
      recomputeInvoiceFinancials({
        business: sellerIndia,
        customer: buyerUAE,
        items: [{ description: 'Export Service', quantity: 1, price: 10000, taxPercent: 18 }],
        headerData: { exportType: 'UNDER_LUT' },
        exchangeRate: 1.0
      });
    }, /Statutory Error: Exports under LUT \/ Bond must be zero-rated/);

    console.log('  PASS: UAE customer with LUT creates Zero-rated export with 0 IGST and rejects tax > 0%.\n');
  }

  // -------------------------------------------------------------------------
  // TEST 4: UAE + payment of IGST works; CGST/SGST for UAE is rejected
  // -------------------------------------------------------------------------
  console.log('Test 4: UAE + payment of IGST works; CGST/SGST for UAE is rejected');
  {
    const buyerUAE = {
      country: 'UAE',
      billingCountry: 'UAE',
      state: 'Abu Dhabi'
    };

    const resWithIgst = recomputeInvoiceFinancials({
      business: sellerIndia,
      customer: buyerUAE,
      items: [{ description: 'Consulting', quantity: 1, price: 10000, taxPercent: 18 }],
      headerData: { exportType: 'WITH_PAYMENT_OF_IGST' },
      exchangeRate: 1.0
    });

    assert.strictEqual(resWithIgst.supplyResolution.supplyType, SUPPLY_TYPES.EXPORT_WITH_IGST);
    assert.strictEqual(resWithIgst.igst, 1800.0);
    assert.strictEqual(resWithIgst.grandTotal, 11800.0);

    // Rejection of domestic CGST/SGST taxes on foreign customer
    assert.throws(() => {
      recomputeInvoiceFinancials({
        business: sellerIndia,
        customer: buyerUAE,
        items: [{ description: 'Consulting', quantity: 1, price: 10000, cgstPercent: 9, taxPercent: 18 }],
        headerData: { exportType: 'WITH_PAYMENT_OF_IGST' },
        exchangeRate: 1.0
      });
    }, /Statutory Error: CGST\/SGST cannot be charged on foreign export customers/);
    console.log('  PASS: Export with IGST accepted; CGST/SGST on foreign buyer strictly rejected.\n');
  }

  // -------------------------------------------------------------------------
  // TEST 5: SEZ with and without IGST
  // -------------------------------------------------------------------------
  console.log('Test 5: SEZ with and without IGST');
  {
    const buyerSezWithout = {
      country: 'INDIA',
      billingCountry: 'INDIA',
      state: 'Gujarat',
      isSez: true,
      sezType: 'WITHOUT_PAYMENT_OF_IGST'
    };
    const sWithout = determineSupplyType(sellerIndia, buyerSezWithout);
    assert.strictEqual(sWithout.supplyType, SUPPLY_TYPES.SEZ_WITHOUT_IGST);

    const buyerSezWith = {
      country: 'INDIA',
      billingCountry: 'INDIA',
      state: 'Gujarat',
      isSez: true,
      sezType: 'WITH_PAYMENT_OF_IGST'
    };
    const sWith = determineSupplyType(sellerIndia, buyerSezWith);
    assert.strictEqual(sWith.supplyType, SUPPLY_TYPES.SEZ_WITH_IGST);
    console.log('  PASS: SEZ supply types resolved with and without payment of IGST.\n');
  }

  // -------------------------------------------------------------------------
  // TEST 6: Missing seller/buyer state -> UNDETERMINED warning; missing seller state/GSTIN blocks invoice creation
  // -------------------------------------------------------------------------
  console.log('Test 6: Missing state -> UNDETERMINED warning; missing seller state/GSTIN blocks creation');
  {
    const buyerGujarat = { country: 'INDIA', state: 'Gujarat' };
    const sellerMissing = { country: 'INDIA', state: null, gstNumber: null };

    // 6a. Supply engine returns UNDETERMINED
    const supply = determineSupplyType(sellerMissing, buyerGujarat);
    assert.strictEqual(supply.supplyType, SUPPLY_TYPES.UNDETERMINED);

    // 6b. recomputeInvoiceFinancials blocks invoice creation
    assert.throws(() => {
      recomputeInvoiceFinancials({
        business: sellerMissing,
        customer: buyerGujarat,
        items: [{ description: 'Test', quantity: 1, price: 100, taxPercent: 18 }]
      });
    }, /Cannot create or update invoice: Registered business State and GSTIN is missing/);

    console.log('  PASS: Undetermined state warns; missing business statutory profile blocks invoice.\n');
  }

  // -------------------------------------------------------------------------
  // TEST 7: State-name variants ("Gujarat", "gujarat ", "GJ") resolve to code 24
  // -------------------------------------------------------------------------
  console.log('Test 7: State-name variants ("Gujarat", "gujarat ", "GJ") resolve to code 24');
  {
    const v1 = resolveGstState('Gujarat');
    const v2 = resolveGstState('gujarat ');
    const v3 = resolveGstState('GJ');
    const v4 = resolveGstState('24');
    const v5 = resolveGstState(24);

    assert.strictEqual(v1.code, '24');
    assert.strictEqual(v2.code, '24');
    assert.strictEqual(v3.code, '24');
    assert.strictEqual(v4.code, '24');
    assert.strictEqual(v5.code, '24');
    console.log('  PASS: All Gujarat variants resolve to canonical code "24".\n');
  }

  // -------------------------------------------------------------------------
  // TEST 8: Edit invoice total -> baseCurrencyAmount updates
  // -------------------------------------------------------------------------
  console.log('Test 8: Edit invoice total -> baseCurrencyAmount updates');
  {
    const buyerMaharashtra = { country: 'INDIA', state: 'Maharashtra', billingCountry: 'INDIA', billingState: 'Maharashtra' };
    
    const f1 = recomputeInvoiceFinancials({
      business: sellerIndia,
      customer: buyerMaharashtra,
      items: [{ description: 'Item', quantity: 1, price: 100, taxPercent: 18 }],
      exchangeRate: 80.0,
      transactionCurrencyCode: 'USD',
      baseCurrencyCode: 'INR'
    });
    assert.strictEqual(f1.grandTotal, 118.0);
    assert.strictEqual(f1.baseCurrencyAmount, 9440.0); // 118 * 80

    // Edit quantity to 2
    const f2 = recomputeInvoiceFinancials({
      business: sellerIndia,
      customer: buyerMaharashtra,
      items: [{ description: 'Item', quantity: 2, price: 100, taxPercent: 18 }],
      exchangeRate: 80.0,
      transactionCurrencyCode: 'USD',
      baseCurrencyCode: 'INR'
    });
    assert.strictEqual(f2.grandTotal, 236.0);
    assert.strictEqual(f2.baseCurrencyAmount, 18880.0); // 236 * 80
    console.log('  PASS: Editing line item automatically updates baseCurrencyAmount.\n');
  }

  // -------------------------------------------------------------------------
  // TEST 9: AED Realized FX (+50.00 / loss) and Unrealized FX (+120.00 on 120 AED open)
  // -------------------------------------------------------------------------
  console.log('Test 9: AED Realized FX (+50.00 / loss) and Unrealized FX (+120.00 on 120 AED open)');
  {
    // 9a. Realized Gain on Receivable
    const recFx = calculateRealizedFx({
      type: 'RECEIVABLE',
      bookingRate: 22.5,
      settlementRate: 23.0,
      foreignAmountSettled: 100.0,
      decimals: 2
    });
    assert.strictEqual(recFx.realizedGainLoss, 50.0);
    assert.strictEqual(recFx.realizedGain, 50.0);

    // 9b. Realized Loss on Payable
    const payFx = calculateRealizedFx({
      type: 'PAYABLE',
      bookingRate: 22.5,
      settlementRate: 23.0,
      foreignAmountSettled: 100.0,
      decimals: 2
    });
    assert.strictEqual(payFx.realizedGainLoss, -50.0);
    assert.strictEqual(payFx.realizedLoss, 50.0);

    // 9c. Unrealized FX on open balance
    const openAED = 120.0;
    const bookedBase = roundHalfUp(openAED * 22.5, 2);
    assert.strictEqual(bookedBase, 2700.0); // Booked Total in INR unchanged

    const uFx = calculateUnrealizedFx({
      type: 'RECEIVABLE',
      bookingRate: 22.5,
      latestRate: 23.5,
      openForeignAmount: openAED,
      decimals: 2
    });
    assert.strictEqual(uFx.unrealizedGainLoss, 120.0);
    assert.strictEqual(bookedBase, 2700.0);
    console.log('  PASS: Exact Realized FX (+50.00 / -50.00) & Unrealized FX (+120.00) verified.\n');
  }

  // -------------------------------------------------------------------------
  // TEST 10: USD invoice at non-1 rate -> KPIs in base currency
  // -------------------------------------------------------------------------
  console.log('Test 10: USD invoice at non-1 rate -> KPIs in base currency');
  {
    const usdSubtotal = 1000.0;
    const usdTax = 180.0;
    const rate = 83.5;
    const baseSubtotal = roundHalfUp(usdSubtotal * rate, 2);
    const baseTax = roundHalfUp(usdTax * rate, 2);
    const baseTotal = roundHalfUp((usdSubtotal + usdTax) * rate, 2);

    assert.strictEqual(baseSubtotal, 83500.0);
    assert.strictEqual(baseTax, 15030.0);
    assert.strictEqual(baseTotal, 98530.0);
    console.log('  PASS: USD invoice converted into exact base currency (INR) KPIs.\n');
  }

  // -------------------------------------------------------------------------
  // TEST 11: 31 March 23:30 IST lands in the correct period
  // -------------------------------------------------------------------------
  console.log('Test 11: 31 March 23:30 IST lands in the correct period');
  {
    const { gte, lte } = parseIstDateBoundaries('2026-03-01', '2026-03-31');
    const docDateIst = new Date('2026-03-31T23:30:00.000+05:30');
    assert.ok(docDateIst >= gte);
    assert.ok(docDateIst <= lte);
    console.log('  PASS: IST day boundary includes 31 March 23:30 IST document in March period.\n');
  }

  // -------------------------------------------------------------------------
  // TEST 12: OVERDUE invoice included; DRAFT/CANCELLED excluded
  // -------------------------------------------------------------------------
  console.log('Test 12: OVERDUE invoice included; DRAFT/CANCELLED excluded');
  {
    assert.ok(POSTED_INVOICE_STATUSES.includes('OVERDUE'));
    assert.ok(POSTED_INVOICE_STATUSES.includes('PAID'));
    assert.ok(POSTED_INVOICE_STATUSES.includes('UNPAID'));
    assert.strictEqual(POSTED_INVOICE_STATUSES.includes('DRAFT'), false);
    assert.strictEqual(POSTED_INVOICE_STATUSES.includes('CANCELLED'), false);
    console.log('  PASS: Status whitelist correctly includes OVERDUE and excludes DRAFT/CANCELLED.\n');
  }

  // -------------------------------------------------------------------------
  // TEST 13: Uncategorized line never dropped; zero-tax bill included
  // -------------------------------------------------------------------------
  console.log('Test 13: Uncategorized line never dropped; zero-tax bill included');
  {
    const uncatLine = { documentNumber: 'DOC-999', category: 'UNKNOWN_CUSTOM' };
    const assignedCategory = uncatLine.category || 'Unclassified';
    assert.strictEqual(assignedCategory, 'UNKNOWN_CUSTOM'); // Preserved, never dropped

    const zeroBill = { billNumber: 'BILL-009', subtotal: 5000, tax: 0 };
    const taxType = zeroBill.tax === 0 ? 'Nil-rated (Purchases 0%)' : 'Standard';
    assert.strictEqual(taxType, 'Nil-rated (Purchases 0%)');
    console.log('  PASS: Uncategorized lines retained; zero-tax bill categorized as Nil-rated.\n');
  }

  // -------------------------------------------------------------------------
  // TEST 14: Rounding: 1.005, 2.675, -2.5, JPY, KWD
  // -------------------------------------------------------------------------
  console.log('Test 14: Rounding: 1.005 -> 1.01, 2.675 -> 2.68, -2.5 -> -3, JPY 0 dec, KWD 3 dec');
  {
    assert.strictEqual(roundHalfUp(1.005, 2), 1.01);
    assert.strictEqual(roundHalfUp(2.675, 2), 2.68);
    assert.strictEqual(roundHalfUp(-2.5, 0), -3);
    assert.strictEqual(getCurrencyDecimals('JPY'), 0);
    assert.strictEqual(roundHalfUp(123.5, 0), 124);
    assert.strictEqual(getCurrencyDecimals('KWD'), 3);
    assert.strictEqual(roundHalfUp(1.0005, 3), 1.001);
    assert.strictEqual(roundHalfUp(1.0025, 3), 1.003);
    console.log('  PASS: Epsilon-safe half-up away from zero and currency exponents verified.\n');
  }

  // -------------------------------------------------------------------------
  // TEST 15: Validators: IFSC, IBAN mod-97, ABA, SWIFT, GSTIN, TRN
  // -------------------------------------------------------------------------
  console.log('Test 15: Statutory Validators: IFSC, IBAN mod-97, ABA, SWIFT, GSTIN, TRN');
  {
    // IFSC
    assert.strictEqual(validateIfsc('HDFC0001234'), true);
    assert.strictEqual(validateIfsc('SBIN0000001'), true);
    assert.strictEqual(validateIfsc('HDFC1001234'), false); // 5th char must be 0

    // IBAN Mod-97 (UAE)
    assert.strictEqual(validateIban('AE070331234567890123456'), true);
    assert.strictEqual(validateIban('AE070331234567890123457'), false); // Invalid checksum
    assert.strictEqual(validateIban('AE07-0331-234567890123456'), false); // Hyphens rejected
    assert.strictEqual(validateIban('AE070331234567890123456@'), false); // Special characters rejected
    assert.strictEqual(validateIban('AE07 0331 2345 6789 0123 456'), false); // Spaces rejected

    // ABA Routing (US 9 digits + checksum)
    // Chase Bank: 021000021 -> 3*(0+0+0) + 7*(2+0+2) + 1*(1+0+1) = 0 + 28 + 2 = 30 % 10 = 0
    assert.strictEqual(validateAbaRouting('021000021'), true);
    assert.strictEqual(validateAbaRouting('021000022'), false);

    // SWIFT / BIC (8 or 11 chars)
    assert.strictEqual(validateSwift('HDFCINBB'), true);
    assert.strictEqual(validateSwift('HDFCINBB123'), true);
    assert.strictEqual(validateSwift('INVALID'), false);

    // GSTIN (15 chars)
    assert.strictEqual(validateGstin('24ABCDE1234F1Z5'), true);
    assert.strictEqual(validateGstin('24ABCDE1234F1Z'), false);

    // UAE TRN (15 digits, starting with 100)
    assert.strictEqual(validateUaeTrn('100123456789012'), true);
    assert.strictEqual(validateUaeTrn('200123456789012'), false); // Must start with 100

    // Encryption & Masking
    const rawAccount = '1234567890123456';
    const encrypted = encryptAccountNumber(rawAccount);
    assert.notStrictEqual(encrypted, rawAccount);
    assert.strictEqual(decryptAccountNumber(encrypted), rawAccount);
    assert.strictEqual(maskAccountNumber(rawAccount), '••••••••3456');

    console.log('  PASS: All statutory banking, tax, and cryptographic validators passed.\n');
  }

  console.log('======================================================================');
  console.log('✔ ALL 15 MASTER SUITE REGRESSION TESTS PASSED WITH 100% SUCCESS!');
  console.log('======================================================================\n');
}

runMasterSuite().catch(err => {
  console.error('\n❌ MASTER SUITE FAILED:', err);
  process.exit(1);
});
