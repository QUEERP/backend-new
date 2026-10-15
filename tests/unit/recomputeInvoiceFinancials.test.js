const assert = require('assert');
const { determineSupplyType, recomputeInvoiceFinancials } = require('../../src/services/tax/supplyTypeEngine');

console.log('Running recomputeInvoiceFinancials & determineSupplyType Unit Tests...\n');

const sellerIndia = {
  country: 'INDIA',
  countryCode: 'IN',
  state: 'GUJARAT',
  gstNumber: '24ABCDE1234F1Z5'
};

const buyerSameState = {
  name: 'Ahmedabad Traders',
  country: 'INDIA',
  billingCountry: 'INDIA',
  state: 'GUJARAT',
  billingState: 'GUJARAT'
};

const buyerDiffState = {
  name: 'Mumbai Corp',
  country: 'INDIA',
  billingCountry: 'INDIA',
  state: 'MAHARASHTRA',
  billingState: 'MAHARASHTRA'
};

const buyerUAE = {
  name: 'Dubai Global LLC',
  country: 'UAE',
  billingCountry: 'UAE',
  state: 'DUBAI',
  billingState: 'DUBAI'
};

// Test 1: Same-state 5% invoice -> CGST 2.5% + SGST 2.5%
{
  const res = recomputeInvoiceFinancials({
    business: sellerIndia,
    customer: buyerSameState,
    items: [{ description: 'Item 1', quantity: 2, price: 500, taxPercent: 5 }],
    headerData: {}
  });
  assert.strictEqual(res.supplyResolution.supplyType, 'CGST_SGST');
  assert.strictEqual(res.subtotal, 1000);
  assert.strictEqual(res.cgst, 25);
  assert.strictEqual(res.sgst, 25);
  assert.strictEqual(res.igst, 0);
  assert.strictEqual(res.totalTax, 50);
  assert.strictEqual(res.grandTotal, 1050);
  assert.strictEqual(res.processedItems[0].cgstPercent, 2.5);
  assert.strictEqual(res.processedItems[0].sgstPercent, 2.5);
  assert.strictEqual(res.processedItems[0].igstPercent, 0);
  console.log('✓ Test 1 Passed: Same-state 5% invoice -> CGST 2.5% + SGST 2.5%');
}

// Test 2: Inter-state invoice -> IGST 5%
{
  const res = recomputeInvoiceFinancials({
    business: sellerIndia,
    customer: buyerDiffState,
    items: [{ description: 'Item 1', quantity: 2, price: 500, taxPercent: 5 }],
    headerData: {}
  });
  assert.strictEqual(res.supplyResolution.supplyType, 'IGST');
  assert.strictEqual(res.subtotal, 1000);
  assert.strictEqual(res.cgst, 0);
  assert.strictEqual(res.sgst, 0);
  assert.strictEqual(res.igst, 50);
  assert.strictEqual(res.totalTax, 50);
  assert.strictEqual(res.grandTotal, 1050);
  assert.strictEqual(res.processedItems[0].igstPercent, 5);
  console.log('✓ Test 2 Passed: Inter-state invoice -> IGST 5%');
}

// Test 3: Mixed 5% and 18% invoice -> separate lines, no blended rate
{
  const res = recomputeInvoiceFinancials({
    business: sellerIndia,
    customer: buyerDiffState,
    items: [
      { description: 'Item A (5%)', quantity: 1, price: 1000, taxPercent: 5 },
      { description: 'Item B (18%)', quantity: 1, price: 1000, taxPercent: 18 }
    ],
    headerData: {}
  });
  assert.strictEqual(res.subtotal, 2000);
  assert.strictEqual(res.processedItems[0].igstPercent, 5);
  assert.strictEqual(res.processedItems[0].totalTax, 50);
  assert.strictEqual(res.processedItems[1].igstPercent, 18);
  assert.strictEqual(res.processedItems[1].totalTax, 180);
  assert.strictEqual(res.igst, 230);
  assert.strictEqual(res.totalTax, 230);
  assert.strictEqual(res.grandTotal, 2230);
  console.log('✓ Test 3 Passed: Mixed 5% and 18% invoice -> separate lines with discrete rates');
}

// Test 4: UAE Customer + LUT -> IGST 0%
{
  const res = recomputeInvoiceFinancials({
    business: sellerIndia,
    customer: buyerUAE,
    items: [{ description: 'Software Service', quantity: 1, price: 5000, taxPercent: 0 }],
    headerData: { exportType: 'LUT' }
  });
  assert.strictEqual(res.supplyResolution.supplyType, 'EXPORT_LUT');
  assert.strictEqual(res.subtotal, 5000);
  assert.strictEqual(res.cgst, 0);
  assert.strictEqual(res.sgst, 0);
  assert.strictEqual(res.igst, 0);
  assert.strictEqual(res.totalTax, 0);
  assert.strictEqual(res.grandTotal, 5000);
  console.log('✓ Test 4 Passed: UAE customer + LUT -> IGST 0% (Zero-rated export)');
}

// Test 5: UAE Customer + payment of IGST
{
  const res = recomputeInvoiceFinancials({
    business: sellerIndia,
    customer: buyerUAE,
    items: [{ description: 'Engineering Service', quantity: 1, price: 5000, taxPercent: 18 }],
    headerData: { exportType: 'WITH_PAYMENT_OF_IGST' }
  });
  assert.strictEqual(res.supplyResolution.supplyType, 'EXPORT_WITH_IGST');
  assert.strictEqual(res.subtotal, 5000);
  assert.strictEqual(res.cgst, 0);
  assert.strictEqual(res.sgst, 0);
  assert.strictEqual(res.igst, 900);
  assert.strictEqual(res.totalTax, 900);
  assert.strictEqual(res.grandTotal, 5900);
  console.log('✓ Test 5 Passed: UAE customer + payment of IGST -> IGST 18% valid');
}

// Test 6: Server rejects CGST/SGST on a foreign customer
{
  let errorCaught = false;
  try {
    recomputeInvoiceFinancials({
      business: sellerIndia,
      customer: buyerUAE,
      items: [{ description: 'Service', quantity: 1, price: 1000, cgstPercent: 9, sgstPercent: 9 }],
      headerData: { exportType: 'LUT' }
    });
  } catch (err) {
    errorCaught = true;
    assert(err.message.includes('CGST/SGST cannot be charged on foreign export customers'), err.message);
  }
  assert(errorCaught, 'Expected error when applying CGST/SGST on foreign customer');
  console.log('✓ Test 6 Passed: Server strictly rejects CGST/SGST on foreign customer');
}

// Test 7: Server rejects IGST > 0% on export under LUT
{
  let errorCaught = false;
  try {
    recomputeInvoiceFinancials({
      business: sellerIndia,
      customer: buyerUAE,
      items: [{ description: 'Service', quantity: 1, price: 1000, taxPercent: 18, igstPercent: 18 }],
      headerData: { exportType: 'LUT' }
    });
  } catch (err) {
    errorCaught = true;
    assert(err.message.includes('Exports under LUT') && err.message.includes('zero-rated'), err.message);
  }
  assert(errorCaught, 'Expected error when applying IGST on LUT export');
  console.log('✓ Test 7 Passed: Server rejects IGST > 0% on export under LUT');
}

// Test 8: Missing seller state/GSTIN blocks invoice creation with settings link
{
  let errorCaught = false;
  try {
    recomputeInvoiceFinancials({
      business: { country: 'INDIA', state: '', gstNumber: '' },
      customer: buyerSameState,
      items: [{ description: 'Item', quantity: 1, price: 100 }],
      headerData: {}
    });
  } catch (err) {
    errorCaught = true;
    assert(err.message.includes('/settings/company'), err.message);
    assert(err.message.includes('seller State and GSTIN are required'), err.message);
  }
  assert(errorCaught, 'Expected error when seller state or GSTIN is missing');
  console.log('✓ Test 8 Passed: Missing seller state/GSTIN blocked with /settings/company link');
}

// Test 9: Missing customer state/country -> UNDETERMINED
{
  let errorCaught = false;
  try {
    recomputeInvoiceFinancials({
      business: sellerIndia,
      customer: { name: 'Mystery Customer', country: 'INDIA', state: '' },
      items: [{ description: 'Item', quantity: 1, price: 100 }],
      headerData: {}
    });
  } catch (err) {
    errorCaught = true;
    assert(err.message.includes('UNDETERMINED'), err.message);
  }
  assert(errorCaught, 'Expected error when customer state is undetermined');
  console.log('✓ Test 9 Passed: Missing customer state raises UNDETERMINED error (never guessed)');
}

console.log('\nAll 9 Supply-Type & Tax Engine tests PASSED successfully!\n');
