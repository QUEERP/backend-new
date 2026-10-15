const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const prisma = require('../src/config/prisma');
const { createInvoice } = require('../src/services/sales/invoice.service');
const { recomputeInvoiceFinancials } = require('../src/services/tax/supplyTypeEngine');
const { validateLutDetails, isValidIcegatePortCode } = require('../src/services/tax/gstConfig');

const BUSINESS_ID = 'dc70ca38-b141-477d-a379-f02649117a78';

async function runExportInvoiceSuite() {
  console.log('======================================================================');
  console.log('            EXPORT INVOICE STATUTORY TEST SUITE (/invoices/add)        ');
  console.log('======================================================================\n');

  // 0. Setup and verify business & customer
  const business = await prisma.business.findUnique({
    where: { id: BUSINESS_ID },
    include: { baseCurrency: true }
  });
  assert.ok(business, `Business not found with ID ${BUSINESS_ID}`);

  // Ensure Gujarat seller has statutory GSTIN if missing
  if (!business.gstNumber) {
    await prisma.business.update({
      where: { id: BUSINESS_ID },
      data: { gstNumber: '24ABCDE1234F1Z5', state: 'Gujarat' }
    });
    business.gstNumber = '24ABCDE1234F1Z5';
    business.state = 'Gujarat';
    console.log('Configured business seller GSTIN: 24ABCDE1234F1Z5 (Gujarat)');
  }

  // Find or ensure foreign customer
  let foreignCustomer = await prisma.customer.findFirst({
    where: {
      businessId: BUSINESS_ID,
      country: { notIn: ['INDIA', 'IND', 'IN'] }
    }
  });

  if (!foreignCustomer) {
    foreignCustomer = await prisma.customer.create({
      data: {
        businessId: BUSINESS_ID,
        name: 'Gulf Trading LLC',
        company: 'Gulf Trading LLC',
        email: 'accounts@gulftrading.ae',
        country: 'UAE',
        billingCountry: 'UAE',
        billingAddress: 'Downtown Business Bay, Dubai',
        city: 'Dubai',
        currency: 'INR'
      }
    });
    console.log('Created foreign customer: Gulf Trading LLC (UAE)');
  } else {
    console.log(`Using foreign customer: ${foreignCustomer.name || foreignCustomer.company} (${foreignCustomer.country}) [ID: ${foreignCustomer.id}]`);
  }

  const user = await prisma.user.findFirst();
  const userId = user ? user.id : '030906b0-0f31-4744-baf4-34b076e5eafa';
  const userEmail = user ? user.email : 'test@example.com';

  // -------------------------------------------------------------------------
  // Test 1: LUT + 2.5% rejected
  // -------------------------------------------------------------------------
  console.log('\n--- Test 1: LUT + 2.5% Tax Item Rejected ---');
  let test1Rejected = false;
  let test1ErrorMsg = '';

  try {
    await createInvoice(BUSINESS_ID, userId, userEmail, {
      customerId: foreignCustomer.id,
      invoiceDate: '2026-10-15',
      currency: 'INR',
      exportType: 'LUT',
      lutNumber: 'AD2401240012345',
      lutDate: '2026-10-01',
      destinationCountry: 'United Arab Emirates',
      portCode: 'INKDL4',
      items: [
        {
          description: 'Consulting Services for Overseas Client',
          quantity: 1,
          price: 25000,
          rate: 25000,
          taxPercent: 2.5, // Non-zero tax on LUT export
          igstPercent: 2.5,
          itemType: 'SERVICE'
        }
      ]
    });
  } catch (err) {
    test1Rejected = true;
    test1ErrorMsg = err.message;
    console.log('  Caught expected error:', err.message);
  }

  assert.strictEqual(test1Rejected, true, 'Test 1 Failed: LUT invoice with 2.5% tax must be rejected by server.');
  assert.ok(
    test1ErrorMsg.includes('Statutory Error: Exports under LUT / Bond must be zero-rated (0% IGST)') ||
    test1ErrorMsg.includes('Invalid GST rate'),
    `Test 1 Failed: Expected statutory zero-rate or rate slab rejection error, got: "${test1ErrorMsg}"`
  );
  console.log('✔ PASS: LUT + 2.5% rejected successfully.\n');

  // -------------------------------------------------------------------------
  // Test 2: LUT + 0% saved with total 25,000
  // -------------------------------------------------------------------------
  console.log('--- Test 2: LUT + 0% Saved with Total 25,000 ---');
  const savedLutInvoice = await createInvoice(BUSINESS_ID, userId, userEmail, {
    customerId: foreignCustomer.id,
    invoiceDate: '2026-10-15',
    currency: 'INR',
    exportType: 'LUT',
    lutNumber: 'AD2401240012345',
    lutDate: '2026-10-01',
    destinationCountry: 'United Arab Emirates',
    portCode: 'INKDL4',
    shippingBillNumber: '7894561',
    shippingBillDate: '2026-10-14',
    notes: 'Export under LUT without payment of integrated tax',
    items: [
      {
        description: 'Industrial Precision Hardware Spares',
        quantity: 1,
        price: 25000,
        rate: 25000,
        taxPercent: 0,
        igstPercent: 0,
        cgstPercent: 0,
        sgstPercent: 0,
        itemType: 'GOODS',
        unit: 'pcs'
      }
    ]
  });

  // Verify Returned Object
  assert.strictEqual(savedLutInvoice.exportType, 'LUT', 'Invoice exportType must be LUT');
  assert.strictEqual(Number(savedLutInvoice.subtotal), 25000, 'Subtotal must be 25,000');
  assert.strictEqual(Number(savedLutInvoice.totalTax), 0, 'Total tax must be 0');
  assert.strictEqual(Number(savedLutInvoice.cgst || 0), 0, 'CGST must be 0');
  assert.strictEqual(Number(savedLutInvoice.sgst || 0), 0, 'SGST must be 0');
  assert.strictEqual(Number(savedLutInvoice.igst || 0), 0, 'IGST must be 0');
  assert.strictEqual(Number(savedLutInvoice.grandTotal), 25000, 'Grand total must be 25,000');

  // Verify Stored DB Row directly from Prisma
  const storedLutRow = await prisma.invoice.findUnique({
    where: { id: savedLutInvoice.id },
    include: {
      items: true,
      customer: {
        select: { id: true, company: true, country: true }
      }
    }
  });

  assert.ok(storedLutRow, 'Stored invoice row must exist in database');
  assert.strictEqual(storedLutRow.exportType, 'LUT');
  assert.strictEqual(Number(storedLutRow.grandTotal), 25000);
  assert.strictEqual(Number(storedLutRow.totalTax), 0);
  assert.strictEqual(storedLutRow.portCode, 'INKDL4');
  assert.strictEqual(storedLutRow.lutNumber, 'AD2401240012345');

  console.log('✔ PASS: LUT + 0% invoice saved successfully with Grand Total 25,000.');
  console.log('\n--- STORED INVOICE ROW (DATABASE PROOF) ---');
  console.log(JSON.stringify(storedLutRow, null, 2));

  // -------------------------------------------------------------------------
  // Test 3: WITH_PAYMENT_OF_IGST + 5% saved
  // -------------------------------------------------------------------------
  console.log('\n--- Test 3: WITH_PAYMENT_OF_IGST + 5% Saved ---');
  const savedIgstInvoice = await createInvoice(BUSINESS_ID, userId, userEmail, {
    customerId: foreignCustomer.id,
    invoiceDate: '2026-10-15',
    currency: 'INR',
    exportType: 'WITH_PAYMENT_OF_IGST',
    destinationCountry: 'United Arab Emirates',
    portCode: 'INMUN1',
    shippingBillNumber: '8894562',
    shippingBillDate: '2026-10-15',
    items: [
      {
        description: 'Machined Valve Components (Export)',
        quantity: 1,
        price: 20000,
        rate: 20000,
        taxPercent: 5, // 5% IGST on export with payment of tax
        igstPercent: 5,
        itemType: 'GOODS',
        unit: 'pcs'
      }
    ]
  });

  assert.strictEqual(savedIgstInvoice.exportType, 'WITH_PAYMENT_OF_IGST', 'exportType must be WITH_PAYMENT_OF_IGST');
  assert.strictEqual(Number(savedIgstInvoice.subtotal), 20000, 'Subtotal must be 20,000');
  assert.strictEqual(Number(savedIgstInvoice.igst), 1000, 'IGST must be 1,000 (5% of 20,000)');
  assert.strictEqual(Number(savedIgstInvoice.totalTax), 1000, 'Total tax must be 1,000');
  assert.strictEqual(Number(savedIgstInvoice.grandTotal), 21000, 'Grand total must be 21,000');
  console.log(`✔ PASS: WITH_PAYMENT_OF_IGST + 5% saved with Grand Total ${savedIgstInvoice.grandTotal} (IGST: ${savedIgstInvoice.igst}).\n`);

  // -------------------------------------------------------------------------
  // Test 4: LUT date after invoice date rejected
  // -------------------------------------------------------------------------
  console.log('--- Test 4: LUT Date After Invoice Date Rejected ---');
  let test4Rejected = false;
  let test4ErrorMsg = '';

  try {
    await createInvoice(BUSINESS_ID, userId, userEmail, {
      customerId: foreignCustomer.id,
      invoiceDate: '2026-10-15',
      currency: 'INR',
      exportType: 'LUT',
      lutNumber: 'AD2401240012345',
      lutDate: '2026-10-25', // 10 days after invoiceDate!
      destinationCountry: 'United Arab Emirates',
      portCode: 'INKDL4',
      items: [
        {
          description: 'Industrial Components',
          quantity: 1,
          price: 15000,
          rate: 15000,
          taxPercent: 0,
          igstPercent: 0,
          itemType: 'GOODS'
        }
      ]
    });
  } catch (err) {
    test4Rejected = true;
    test4ErrorMsg = err.message;
    console.log('  Caught expected error:', err.message);
  }

  assert.strictEqual(test4Rejected, true, 'Test 4 Failed: Invoice with LUT date after invoice date must be rejected.');
  assert.ok(
    test4ErrorMsg.includes('LUT Date (2026-10-25) cannot be after Invoice Date (2026-10-15)'),
    `Test 4 Failed: Expected error mentioning LUT date cannot be after invoice date, got: "${test4ErrorMsg}"`
  );
  console.log('✔ PASS: LUT date after invoice date rejected successfully.\n');

  console.log('======================================================================');
  console.log('            ALL 4 EXPORT INVOICE TESTS PASSED CLEANLY                 ');
  console.log('======================================================================\n');
}

runExportInvoiceSuite()
  .catch(err => {
    console.error('FATAL TEST SUITE ERROR:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
