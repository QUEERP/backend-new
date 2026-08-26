const prisma = require('./src/config/prisma');
const { createBill } = require('./src/services/purchase/bill.service');
const { recordVendorPayment } = require('./src/services/purchase/payment.service');
const { createPurchaseReturn } = require('./src/services/purchase/purchaseReturn.service');
const { getLedgerBalances } = require('./src/services/ledgerService');

async function setupTestData() {
  const adminId = "test-admin-uuid";
  const userEmail = "test@example.com";

  // Clean up
  await prisma.journalEntry.deleteMany({ where: { description: { contains: "Test" } } });

  // Create Currencies
  const inr = await prisma.currency.upsert({ where: { code: 'INR' }, update: {}, create: { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimalPrecision: 2 } });
  const usd = await prisma.currency.upsert({ where: { code: 'USD' }, update: {}, create: { code: 'USD', name: 'US Dollar', symbol: '$', decimalPrecision: 2 } });
  const aed = await prisma.currency.upsert({ where: { code: 'AED' }, update: {}, create: { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', decimalPrecision: 2 } });
  const eur = await prisma.currency.upsert({ where: { code: 'EUR' }, update: {}, create: { code: 'EUR', name: 'Euro', symbol: '€', decimalPrecision: 2 } });
  const CAD = await prisma.currency.upsert({ where: { code: 'CAD' }, update: {}, create: { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$', decimalPrecision: 2 } });
  const GBP = await prisma.currency.upsert({ where: { code: 'GBP' }, update: {}, create: { code: 'GBP', name: 'British Pound', symbol: '£', decimalPrecision: 2 } });
  const JPY = await prisma.currency.upsert({ where: { code: 'JPY' }, update: {}, create: { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimalPrecision: 0 } });
  const AUD = await prisma.currency.upsert({ where: { code: 'AUD' }, update: {}, create: { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimalPrecision: 2 } });
  const CHF = await prisma.currency.upsert({ where: { code: 'CHF' }, update: {}, create: { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr', decimalPrecision: 2 } });
  const HKD = await prisma.currency.upsert({ where: { code: 'HKD' }, update: {}, create: { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', decimalPrecision: 2 } });
  const SGD = await prisma.currency.upsert({ where: { code: 'SGD' }, update: {}, create: { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', decimalPrecision: 2 } });
  // Create Countries
  const india = await prisma.country.upsert({ where: { code: 'IN' }, update: {}, create: { code: 'IN', name: 'India' } });
  const uae = await prisma.country.upsert({ where: { code: 'AE' }, update: {}, create: { code: 'AE', name: 'UAE' } });
  const cad = await prisma.country.upsert({ where: { code: 'CA' }, update: {}, create: { code: 'CA', name: 'Canada' } });
  const uk = await prisma.country.upsert({ where: { code: 'GB' }, update: {}, create: { code: 'GB', name: 'United Kingdom' } });
  const au = await prisma.country.upsert({ where: { code: 'AU' }, update: {}, create: { code: 'AU', name: 'Australia' } });
  const ch = await prisma.country.upsert({ where: { code: 'CH' }, update: {}, create: { code: 'CH', name: 'Switzerland' } });
  const hk = await prisma.country.upsert({ where: { code: 'HK' }, update: {}, create: { code: 'HK', name: 'Hong Kong' } });
  const sg = await prisma.country.upsert({ where: { code: 'SG' }, update: {}, create: { code: 'SG', name: 'Singapore' } });
  // Create Tax Frameworks
  let gstFramework = await prisma.taxFramework.findFirst({ where: { name: 'India GST' } });
  if (!gstFramework) gstFramework = await prisma.taxFramework.create({ data: { name: 'India GST', countryId: india.id } });
  let vatFramework = await prisma.taxFramework.findFirst({ where: { name: 'UAE VAT' } });
  if (!vatFramework) vatFramework = await prisma.taxFramework.create({ data: { name: 'UAE VAT', countryId: uae.id } });

  // Create User
  const owner = await prisma.user.upsert({ where: { email: userEmail }, update: {}, create: { email: userEmail, name: 'Test User', password: 'password', role: 'ADMIN' } });

  // Create Businesses
  const busIndia = await prisma.business.create({ data: { name: 'Test India', countryId: india.id, baseCurrencyId: inr.id, ownerId: owner.id } });
  const busUAE = await prisma.business.create({ data: { name: 'Test UAE', countryId: uae.id, baseCurrencyId: aed.id, ownerId: owner.id } });

  // Create Vendors
  const vendorIndia = await prisma.vendor.create({ data: { businessId: busIndia.id, name: 'India Vendor' } });
  const vendorUAE = await prisma.vendor.create({ data: { businessId: busUAE.id, name: 'UAE Vendor' } });

  // Create Product
  const ts = Date.now();
  const prodIndia = await prisma.product.create({ data: { businessId: busIndia.id, name: 'India Product', sku: `IN-01-${ts}`, price: 1000, costPrice: 500, type: 'GOODS' } });
  const prodUAE = await prisma.product.create({ data: { businessId: busUAE.id, name: 'UAE Product', sku: `AE-01-${ts}`, price: 1000, costPrice: 500, type: 'GOODS' } });

  // Set up rates
  try {
    await prisma.exchangeRate.createMany({
      data: [
        { fromCurrencyId: inr.id, toCurrencyId: inr.id, rate: 1, effectiveDate: new Date('2026-01-01') },
        { fromCurrencyId: usd.id, toCurrencyId: inr.id, rate: 83.5, effectiveDate: new Date('2026-01-01') },
        { fromCurrencyId: usd.id, toCurrencyId: inr.id, rate: 83.0, rateType: 'STATUTORY', source: 'CBEC', effectiveDate: new Date('2026-01-01') },
        { fromCurrencyId: aed.id, toCurrencyId: aed.id, rate: 1, effectiveDate: new Date('2026-01-01') },
        { fromCurrencyId: eur.id, toCurrencyId: aed.id, rate: 4.0, effectiveDate: new Date('2026-01-01') },
        { fromCurrencyId: eur.id, toCurrencyId: aed.id, rate: 4.1, rateType: 'STATUTORY', source: 'CBUAE', effectiveDate: new Date('2026-01-01') }
      ]
    });
  } catch (e) {
    console.log('Rates might already exist, ignoring...');
  }

  try {
    await prisma.exchangeRateRule.createMany({
      data: [
        { countryId: india.id, baseCurrencyId: inr.id, requiresStatutoryRate: true, statutoryRateSource: 'CBEC' },
        { countryId: uae.id, baseCurrencyId: aed.id, requiresStatutoryRate: true, statutoryRateSource: 'CBUAE' }
      ]
    });
  } catch (e) {
    console.log('Rules might already exist, ignoring...');
  }

  // Add Tax Rates and Rules
  await prisma.business.update({ where: { id: busIndia.id }, data: { taxFrameworkId: gstFramework.id } });
  await prisma.business.update({ where: { id: busUAE.id }, data: { taxFrameworkId: vatFramework.id } });

  const cgstType = await prisma.taxType.create({ data: { taxFrameworkId: gstFramework.id, name: 'CGST' } });
  const sgstType = await prisma.taxType.create({ data: { taxFrameworkId: gstFramework.id, name: 'SGST' } });
  const vatType = await prisma.taxType.create({ data: { taxFrameworkId: vatFramework.id, name: 'VAT' } });

  // India Intra Rule (18% split into 9% CGST and 9% SGST)
  const ruleIntra = await prisma.taxRule.create({ data: { businessId: busIndia.id, name: 'India Intra 18%', rate: 18, type: 'GST', jurisdiction: 'INTRASTATE' } });

  // UAE VAT Rule (5%)
  const ruleUae = await prisma.taxRule.create({ data: { businessId: busUAE.id, name: 'UAE Standard 5%', rate: 5, type: 'VAT' } });

  const d1 = new Date('2020-01-01');
  await prisma.taxRate.createMany({
    data: [
      { taxRuleId: ruleIntra.id, taxTypeId: cgstType.id, rate: 9, name: 'CGST 9%', effectiveFrom: d1 },
      { taxRuleId: ruleIntra.id, taxTypeId: sgstType.id, rate: 9, name: 'SGST 9%', effectiveFrom: d1 },
      { taxRuleId: ruleUae.id, taxTypeId: vatType.id, rate: 5, name: 'VAT 5%', effectiveFrom: d1 }
    ]
  });

  return { adminId, userEmail, busIndia, busUAE, vendorIndia, vendorUAE, prodIndia, prodUAE, currINR: inr, currUSD: usd, currAED: aed, currEUR: eur, ctryIndia: india, ctryUAE: uae };
}

async function cleanUpTestData() {
  try {
    await prisma.journalEntry.deleteMany({});
    await prisma.taxTransaction.deleteMany({});
    await prisma.exchangeRate.deleteMany({});
    await prisma.exchangeRateRule.deleteMany({});
    await prisma.purchaseReturn.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.billItem.deleteMany({});
    await prisma.bill.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.vendor.deleteMany({});
    // await prisma.business.deleteMany({});
  } catch (e) {
    console.log('Cleanup error (ignoring):', e.message);
  }
}

async function printBill(label, id) {
  const inv = await prisma.bill.findUnique({
    where: { id },
    include: {
      items: true
    }
  });
  console.log(`\n=== CASE: ${label} ===`);
  console.log(`Bill ID: ${inv.id}`);
  console.log(`Totals: Sub=${inv.subtotal}, Tax=${inv.tax}, Grand=${inv.totalAmount}, Ccy=${inv.currency}`);
  console.log(`Base: BaseAmt=${inv.baseCurrencyAmount}, StatAmt=${inv.statutoryBaseAmount}, ExRate=${inv.exchangeRate}, StatRate=${inv.statutoryExchangeRate}`);

  console.log('Taxes:');
  const taxes = await prisma.taxTransaction.findMany({ where: { transactionId: inv.id } });
  for (const t of taxes) {
    const rate = await prisma.taxRate.findUnique({ where: { id: t.taxRateId } });
    const type = await prisma.taxType.findUnique({ where: { id: rate.taxTypeId } });
    console.log(`  - Type: ${type.name}, Rate: ${rate.rate}%, BaseCcyTax: ${t.taxAmountBaseCcy}`);
  }
}

async function runTests() {
  console.log('Starting Procurement Domain Verification...');
  console.log('Cleaning up previous test data...');
  await cleanUpTestData();

  const data = await setupTestData();

  let billUSD;

  try {
    // 1. India + INR
    const inv1 = await createBill(data.busIndia.id, data.adminId, data.userEmail, {
      billNumber: 'BILL-001',
      vendorId: data.vendorIndia.id,
      currency: 'INR',
      items: [{ productId: data.prodIndia.id, quantity: 1, price: 1000, taxPercent: 18 }]
    });
    await printBill('1. India + INR (Intra-state)', inv1.id);

    // 2. India + USD (Cross-currency)
    billUSD = await createBill(data.busIndia.id, data.adminId, data.userEmail, {
      billNumber: 'BILL-002',
      vendorId: data.vendorIndia.id,
      currency: 'USD',
      items: [{ productId: data.prodIndia.id, quantity: 1, price: 100, taxPercent: 18 }]
    });
    await printBill('2. India + USD (Cross-currency)', billUSD.id);

    // 3. UAE + AED
    const inv3 = await createBill(data.busUAE.id, data.adminId, data.userEmail, {
      billNumber: 'BILL-001',
      vendorId: data.vendorUAE.id,
      currency: 'AED',
      items: [{ productId: data.prodUAE.id, quantity: 1, price: 1000, taxPercent: 5 }]
    });
    await printBill('3. UAE + AED', inv3.id);

    // 4. UAE + EUR
    const inv4 = await createBill(data.busUAE.id, data.adminId, data.userEmail, {
      billNumber: 'BILL-004',
      vendorId: data.vendorUAE.id,
      currency: 'EUR',
      items: [{ productId: data.prodUAE.id, quantity: 1, price: 500, taxPercent: 5 }]
    });
    await printBill('4. UAE + EUR', inv4.id);

    // 5. Reject missing commercial (GBP)
    try {
      await createBill(data.busIndia.id, data.adminId, data.userEmail, {
        billNumber: 'BILL-003',
        vendorId: data.vendorIndia.id,
        currency: 'GBP',
        items: [{ productId: data.prodIndia.id, quantity: 1, price: 100 }]
      });
      console.log('FAIL: Should have rejected GBP missing rate');
    } catch (e) {
      console.log(`\n=== CASE: 5. Reject Missing Commercial (GBP) ===`);
      console.log(`ERROR: ${e.message}`);
    }

    // 6. Reject missing statutory (CAD)
    await prisma.exchangeRateRule.update({
      where: { countryId_baseCurrencyId: { countryId: data.ctryIndia.id, baseCurrencyId: data.currINR.id } },
      data: { requiresStatutoryRate: true }
    });

    // Seed a commercial rate for CAD so it passes the commercial check but fails the statutory check
    const currCAD = await prisma.currency.findUnique({ where: { code: 'CAD' } });
    await prisma.exchangeRate.create({
      data: {
        fromCurrencyId: currCAD.id,
        toCurrencyId: data.currINR.id,
        rateType: 'COMMERCIAL',
        rate: 60.5,
        effectiveDate: new Date()
      }
    });

    try {
      await createBill(data.busIndia.id, data.adminId, data.userEmail, {
        billNumber: 'BILL-006',
        vendorId: data.vendorIndia.id,
        currency: 'CAD',
        items: [{ productId: data.prodIndia.id, quantity: 1, price: 100 }]
      });
      console.log('FAIL: Should have rejected CAD missing statutory rate');
    } catch (e) {
      console.log(`\n=== CASE: 6. Reject Missing Statutory (CAD) ===`);
      console.log(`ERROR: ${e.message}`);
    }

    // 7. Payment for billUSD (simulate different payment date with different rate)
    // Insert new commercial rate for USD -> INR
    await prisma.exchangeRate.create({
      data: {
        fromCurrencyId: data.currUSD.id,
        toCurrencyId: data.currINR.id,
        rateType: 'COMMERCIAL',
        rate: 85.0, // Bill was at 83.5, this should generate FX Loss (we paid more INR)
        effectiveDate: new Date(Date.now() + 1000)
      }
    });

    await prisma.exchangeRate.create({
      data: {
        fromCurrencyId: data.currUSD.id,
        toCurrencyId: data.currINR.id,
        rateType: 'STATUTORY',
        source: 'CBEC',
        rate: 84.5,
        effectiveDate: new Date(Date.now() + 1000)
      }
    });

    console.log(`\n=== CASE 7: Payment for Bill BILL-002 with changed FX rate ===`);
    const pay = await recordVendorPayment(data.busIndia.id, data.adminId, data.userEmail, billUSD.id, {
      amount: 118,
      paymentDate: new Date(Date.now() + 2000)
    });
    console.log(`Payment created: ${pay.paymentNumber}, Amount: ${pay.amount}`);
    const payJe = await prisma.journalEntry.findMany({ where: { description: { contains: pay.paymentNumber } }, include: { account: true } });
    console.log(`Payment Journal Entries:`);
    let payDrBase = 0;
    let payCrBase = 0;
    payJe.forEach(je => {
      console.log(`  - [${je.account.name}] ${je.description}: DR ${je.debit} / CR ${je.credit} (Base: DR ${je.baseDebit} / CR ${je.baseCredit}) Rate: ${je.exchangeRate}`);
      payDrBase += Number(je.baseDebit) || 0;
      payCrBase += Number(je.baseCredit) || 0;
    });

    const billJe = (await prisma.journalEntry.findMany({ where: { description: { contains: 'Bill BILL-002' } } }))
      .filter(je => !je.description.includes('Payment'));
    let invDrBase = 0;
    let invCrBase = 0;
    billJe.forEach(je => {
      invDrBase += Number(je.baseDebit) || 0;
      invCrBase += Number(je.baseCredit) || 0;
    });

    console.log(`\nGL Check (Bill + Payment): Total Base Debit = ${payDrBase + invDrBase}, Total Base Credit = ${payCrBase + invCrBase}`);
    console.log(`Difference: ${(payDrBase + invDrBase) - (payCrBase + invCrBase)}`);

    // 8. Purchase Return for billUSD (Reversal at historical rate)
    console.log(`\n=== CASE 8: Purchase Return for Bill BILL-002 (Reversal) ===`);
    try {
      const cnRes = await createPurchaseReturn(data.busIndia.id, data.adminId, data.userEmail, {
        billId: billUSD.id,
        vendorId: data.vendorIndia.id,
        items: [{ productId: data.prodIndia.id, quantity: 1, price: 50, taxPercent: 18, isStockReturned: false }] // partial reversal of services
      });
      console.log(`Purchase Return created: ${cnRes.returnNumber}, Amount: ${cnRes.totalAmount}`);
      const cnJe = await prisma.journalEntry.findMany({ where: { description: { contains: cnRes.returnNumber } }, include: { account: true } });
      console.log(`Purchase Return Journal Entries:`);
      cnJe.forEach(je => {
        console.log(`  - [${je.account.name}] ${je.description}: DR ${je.debit} / CR ${je.credit} (Base: DR ${je.baseDebit} / CR ${je.baseCredit}) Rate: ${je.exchangeRate}`);
      });
    } catch (e) {
      console.log(`Purchase Return Error: \n${e.message}`);
    }

  } catch (err) {
    console.error("TEST FAILED WITH ERROR:", err);
  }

  process.exit(0);
}

runTests();
