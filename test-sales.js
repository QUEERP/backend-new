const prisma = require('./src/config/prisma');
const { createInvoice } = require('./src/services/sales/invoice.service');
const { createPayment } = require('./src/services/sales/payment.service');
const { createCreditNote } = require('./src/services/sales/creditNote.service');

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
  
  // Create Countries
  const india = await prisma.country.upsert({ where: { code: 'IN' }, update: {}, create: { code: 'IN', name: 'India' } });
  const uae = await prisma.country.upsert({ where: { code: 'AE' }, update: {}, create: { code: 'AE', name: 'UAE' } });

  // Create Tax Frameworks
  let gstFramework = await prisma.taxFramework.findFirst({ where: { name: 'India GST' } });
  if (!gstFramework) gstFramework = await prisma.taxFramework.create({ data: { name: 'India GST', countryId: india.id } });
  let vatFramework = await prisma.taxFramework.findFirst({ where: { name: 'UAE VAT' } });
  if (!vatFramework) vatFramework = await prisma.taxFramework.create({ data: { name: 'UAE VAT', countryId: uae.id } });

  // Create User
  const owner = await prisma.user.upsert({ where: { email: userEmail }, update: {}, create: { email: userEmail, name: 'Test User', password: 'password', role: 'ADMIN' } });

  // Create Businesses
  const busIndia = await prisma.business.create({ data: { name: 'Test India', countryId: india.id, baseCurrencyId: inr.id, ownerId: owner.id, taxFrameworkId: gstFramework.id } });
  const busUae = await prisma.business.create({ data: { name: 'Test UAE', countryId: uae.id, baseCurrencyId: aed.id, ownerId: owner.id, taxFrameworkId: vatFramework.id } });

  // Create Customers
  const custIndiaIntra = await prisma.customer.create({ data: { businessId: busIndia.id, company: 'India Intra', region: 'INDIA' } });
  const custUae = await prisma.customer.create({ data: { businessId: busUae.id, company: 'UAE Customer', region: 'UAE' } });

  // Create Product
  const ts = Date.now();
  const prodIndia = await prisma.product.create({ data: { businessId: busIndia.id, name: 'India Product', sku: `IN-01-${ts}`, price: 1000, costPrice: 500, type: 'GOODS' } });
  const prodUae = await prisma.product.create({ data: { businessId: busUae.id, name: 'UAE Product', sku: `AE-01-${ts}`, price: 1000, costPrice: 500, type: 'GOODS' } });

  // Set up rates
  try {
    await prisma.exchangeRate.createMany({
      data: [
        { fromCurrencyId: inr.id, toCurrencyId: inr.id, rate: 1, effectiveDate: new Date('2026-01-01') },
        { fromCurrencyId: usd.id, toCurrencyId: inr.id, rate: 83.5, effectiveDate: new Date('2026-01-01') },
        { fromCurrencyId: usd.id, toCurrencyId: inr.id, rate: 83.0, rateType: 'STATUTORY', effectiveDate: new Date('2026-01-01') },
        { fromCurrencyId: aed.id, toCurrencyId: aed.id, rate: 1, effectiveDate: new Date('2026-01-01') },
        { fromCurrencyId: eur.id, toCurrencyId: aed.id, rate: 4.0, effectiveDate: new Date('2026-01-01') },
        { fromCurrencyId: eur.id, toCurrencyId: aed.id, rate: 4.1, rateType: 'STATUTORY', effectiveDate: new Date('2026-01-01') }
      ]
    });
  } catch (e) {
    console.log('Rates might already exist, ignoring...');
  }

  try {
    await prisma.exchangeRateRule.createMany({
      data: [
        { countryId: india.id, baseCurrencyId: usd.id, requiresStatutoryRate: true, statutoryRateSource: 'CBEC' },
        { countryId: uae.id, baseCurrencyId: eur.id, requiresStatutoryRate: true, statutoryRateSource: 'CBUAE' }
      ]
    });
  } catch (e) {
    console.log('Rules might already exist, ignoring...');
  }
  
  // Add Tax Rates and Rules
  await prisma.business.update({ where: { id: busIndia.id }, data: { taxFrameworkId: gstFramework.id } });
  await prisma.business.update({ where: { id: busUae.id }, data: { taxFrameworkId: vatFramework.id } });

  const cgstType = await prisma.taxType.create({ data: { taxFrameworkId: gstFramework.id, name: 'CGST' }});
  const sgstType = await prisma.taxType.create({ data: { taxFrameworkId: gstFramework.id, name: 'SGST' }});
  const vatType = await prisma.taxType.create({ data: { taxFrameworkId: vatFramework.id, name: 'VAT' }});

  // India Intra Rule (18% split into 9% CGST and 9% SGST)
  const ruleIntra = await prisma.taxRule.create({ data: { businessId: busIndia.id, name: 'India Intra 18%', rate: 18, type: 'GST', jurisdiction: 'INTRASTATE' }});
  
  // UAE VAT Rule (5%)
  const ruleUae = await prisma.taxRule.create({ data: { businessId: busUae.id, name: 'UAE Standard 5%', rate: 5, type: 'VAT' }});

  const d1 = new Date('2020-01-01');
  await prisma.taxRate.createMany({
    data: [
      { taxRuleId: ruleIntra.id, taxTypeId: cgstType.id, rate: 9, name: 'CGST 9%', effectiveFrom: d1 },
      { taxRuleId: ruleIntra.id, taxTypeId: sgstType.id, rate: 9, name: 'SGST 9%', effectiveFrom: d1 },
      { taxRuleId: ruleUae.id, taxTypeId: vatType.id, rate: 5, name: 'VAT 5%', effectiveFrom: d1 }
    ]
  });

  return { busIndia, busUae, custIndiaIntra, custUae, prodIndia, prodUae, adminId, userEmail, inr, usd, aed, eur };
}

function buildInvoiceMock(businessId, adminId, userEmail, overrides) {
  if (overrides.items) {
    overrides.items = overrides.items.map(item => ({
      description: 'Test product',
      ...item
    }));
  }
  return {
    businessId,
    invoiceNumber: 'INV-' + Date.now() + Math.floor(Math.random() * 1000),
    status: 'DRAFT',
    invoiceDate: new Date(),
    ...overrides
  };
}

async function cleanUpTestData() {
  try {
    await prisma.taxTransaction.deleteMany({});
    await prisma.journalEntry.deleteMany({});
    await prisma.paymentAllocation.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.invoiceItem.deleteMany({});
    await prisma.invoice.deleteMany({});
    await prisma.deal.deleteMany({});
    await prisma.quotationItem.deleteMany({});
    await prisma.quotation.deleteMany({});
    await prisma.exchangeRate.deleteMany({});
    await prisma.exchangeRateRule.deleteMany({});
    await prisma.stock.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.customer.deleteMany({});
    await prisma.taxRate.deleteMany({});
    await prisma.taxRule.deleteMany({});
    // await prisma.business.deleteMany({ where: { name: { startsWith: 'Test ' } } });
  } catch(e) {
      console.log('Cleanup error (ignoring):', e.message);
  }
}

async function runTests() {
  console.log('Starting Sales Domain Verification...');
  console.log('Cleaning up previous test data...');
  await cleanUpTestData();
  
  let data;
  try {
    data = await setupTestData();
  } catch (error) {
    console.error('Failed to setup test data:', error);
    await cleanUpTestData();
    return;
  }
  
  const reportController = require('./src/controllers/reportController');
  
  const printInvoice = async (name, invoicePromise) => {
    try {
      const inv = await invoicePromise;
      const taxes = await prisma.taxTransaction.findMany({ where: { transactionId: inv.id }});
      const journals = await prisma.journalEntry.findMany({ where: { description: { contains: inv.invoiceNumber } }});
      
      console.log(`\n=== CASE: ${name} ===`);
      console.log(`Invoice ID: ${inv.id}`);
      console.log(`Totals: Sub=${inv.subtotal}, Tax=${inv.totalTax}, Grand=${inv.grandTotal}, Ccy=${inv.currency}`);
      console.log(`Base: BaseAmt=${inv.baseCurrencyAmount}, StatAmt=${inv.statutoryBaseAmount}, ExRate=${inv.exchangeRate}, StatRate=${inv.statutoryExchangeRate}`);
      console.log(`Legacy Taxes: CGST=${inv.cgst}, SGST=${inv.sgst}, IGST=${inv.igst}, VAT=${inv.vatAmount}`);
      
      console.log('Taxes:');
      for (const t of taxes) {
        const rate = await prisma.taxRate.findUnique({where:{id:t.taxRateId}});
        const type = await prisma.taxType.findUnique({where:{id:rate.taxTypeId}});
        console.log(`  - Type: ${type.name}, Rate: ${rate.rate}%, BaseCcyTax: ${t.taxAmountBaseCcy}`);
      }
      
      console.log('Journal Entries:');
      for (const j of journals) {
          const acc = await prisma.account.findUnique({where: {id: j.accountId}});
          console.log(`  - [${acc.name}] ${j.description}: DR ${j.debit} / CR ${j.credit} (Base: DR ${j.baseDebit} / CR ${j.baseCredit}) Rate: ${j.exchangeRate}`);
      }
      return inv;
    } catch (e) {
      console.log(`\n=== CASE: ${name} ===`);
      console.error("ERROR:", e.message);
      return null;
    }
  };

  // Case 1: India + INR
  await printInvoice('1. India + INR (Intra-state)', createInvoice(data.busIndia.id, data.adminId, data.userEmail, buildInvoiceMock(data.busIndia.id, data.adminId, data.userEmail, {
    customerId: data.custIndiaIntra.id,
    currency: 'INR',
    items: [{
        description: 'Test product',
        quantity: 1,
        rate: 1000,
        taxPercent: 18
    }]
  })));

  // Case 2: India + USD
  const invUSD = await printInvoice('2. India + USD (Cross-currency)', createInvoice(data.busIndia.id, data.adminId, data.userEmail, buildInvoiceMock(data.busIndia.id, data.adminId, data.userEmail, {
    customerId: data.custIndiaIntra.id,
    currency: 'USD',
    items: [{ productId: data.prodIndia.id, quantity: 1, price: 100, taxPercent: 18 }]
  })));

  // Case 3: UAE + AED
  await printInvoice('3. UAE + AED', createInvoice(data.busUae.id, data.adminId, data.userEmail, buildInvoiceMock(data.busUae.id, data.adminId, data.userEmail, {
    customerId: data.custUae.id,
    currency: 'AED',
    items: [{ productId: data.prodUae.id, quantity: 1, rate: 1000, taxPercent: 5 }]
  })));

  // Case 4: UAE + EUR
  await printInvoice('4. UAE + EUR', createInvoice(data.busUae.id, data.adminId, data.userEmail, buildInvoiceMock(data.busUae.id, data.adminId, data.userEmail, {
    customerId: data.custUae.id,
    currency: 'EUR',
    items: [{ productId: data.prodUae.id, quantity: 1, rate: 500, taxPercent: 5 }]
  })));

  // Case 5: Reject commercial rate missing
  await printInvoice('5. Reject Missing Commercial (GBP)', createInvoice(data.busIndia.id, data.adminId, data.userEmail, buildInvoiceMock(data.busIndia.id, data.adminId, data.userEmail, {
    customerId: data.custIndiaIntra.id,
    currency: 'GBP',
    items: [{ productId: data.prodIndia.id, quantity: 1, price: 100, taxPercent: 18 }]
  })));

  // Case 6: Reject statutory rate missing (CAD)
  let cad = await prisma.currency.findUnique({ where: { code: 'CAD' } });
  if (!cad) {
    cad = await prisma.currency.create({ data: { code: 'CAD', name: 'CAD', symbol: 'C$', decimalPrecision: 2 } });
  }
  
  // Ensure commercial rate exists
  const existingCadRate = await prisma.exchangeRate.findFirst({
    where: { fromCurrencyId: cad.id, toCurrencyId: data.inr.id, rateType: 'COMMERCIAL' }
  });
  if (!existingCadRate) {
    await prisma.exchangeRate.create({ 
      data: { fromCurrencyId: cad.id, toCurrencyId: data.inr.id, rate: 60, effectiveDate: new Date('2026-01-01'), rateType: 'COMMERCIAL' } 
    });
  }
  
  // Ensure NO statutory rate exists
  await prisma.exchangeRate.deleteMany({
    where: { fromCurrencyId: cad.id, toCurrencyId: data.inr.id, rateType: 'STATUTORY' }
  });

  // Ensure India has requiresStatutoryRate = true
  let rule = await prisma.exchangeRateRule.findFirst({
    where: { countryId: data.busIndia.countryId, baseCurrencyId: data.inr.id }
  });
  if (rule) {
    await prisma.exchangeRateRule.update({ where: { id: rule.id }, data: { requiresStatutoryRate: true } });
  } else {
    await prisma.exchangeRateRule.create({
      data: {
        countryId: data.busIndia.countryId,
        baseCurrencyId: data.inr.id,
        requiresStatutoryRate: true,
        statutoryRateSource: 'RBI'
      }
    });
  }
  
  await printInvoice('6. Reject Missing Statutory (CAD)', createInvoice(data.busIndia.id, data.adminId, data.userEmail, buildInvoiceMock(data.busIndia.id, data.adminId, data.userEmail, {
    customerId: data.custIndiaIntra.id,
    currency: 'CAD',
    items: [{ productId: data.prodIndia.id, quantity: 1, price: 100, taxPercent: 18 }]
  })));

  // Case 7: Full Invoice then Payment (FX Gain/Loss)
  await prisma.exchangeRateRule.updateMany({
    where: { countryId: data.busIndia.countryId, baseCurrencyId: data.inr.id },
    data: { requiresStatutoryRate: false }
  });

  if (invUSD) {
    // Add a new exchange rate to simulate a rate change on payment day
    try {
        await prisma.exchangeRate.create({ 
            data: { fromCurrencyId: data.usd.id, toCurrencyId: data.inr.id, rate: 85.0, effectiveDate: new Date('2026-02-01') } 
        });
    } catch(e) {}
    
    console.log(`\n=== CASE 7: Payment for Invoice ${invUSD.invoiceNumber} with changed FX rate ===`);
    try {
      const payRes = await createPayment(data.busIndia.id, data.adminId, data.userEmail, invUSD.id, {
        amount: invUSD.grandTotal, // Pay full amount in USD
        currency: 'USD',
        paymentDate: new Date('2026-02-02') // Uses new rate (85.0 vs historical 83.5)
      });
      console.log(`Payment created: ${payRes.payment.paymentNumber}, Amount: ${payRes.payment.amount}`);
      
      const journals = await prisma.journalEntry.findMany({ where: { description: { contains: payRes.payment.paymentNumber } }, include: { account: true }});
      console.log('Payment Journal Entries:');
      journals.forEach(j => {
          console.log(`  - [${j.account.name}] ${j.description}: DR ${j.debit} / CR ${j.credit} (Base: DR ${j.baseDebit} / CR ${j.baseCredit}) Rate: ${j.exchangeRate}`);
      });
      
      // Calculate Sums for balancing
      const allJournals = await prisma.journalEntry.findMany({ 
          where: { 
             OR: [
                 { description: { contains: invUSD.invoiceNumber } },
                 { description: { contains: payRes.payment.paymentNumber } }
             ]
          }
      });
      const sumBaseDebit = allJournals.reduce((sum, j) => sum + j.baseDebit, 0);
      const sumBaseCredit = allJournals.reduce((sum, j) => sum + j.baseCredit, 0);
      console.log(`\nGL Check (Invoice + Payment): Total Base Debit = ${sumBaseDebit}, Total Base Credit = ${sumBaseCredit}`);
      console.log(`Difference: ${sumBaseDebit - sumBaseCredit}`);
    } catch (e) {
      console.error("Payment Error:", e.message);
    }

    // Case 8: Credit Note for Invoice INV-002 (Reversal)
    console.log(`\n=== CASE 8: Credit Note for Invoice ${invUSD.invoiceNumber} (Reversal) ===`);
    try {
      const cnRes = await createCreditNote(data.busIndia.id, data.adminId, data.userEmail, {
        invoiceId: invUSD.id,
        items: [{ productId: data.prodIndia.id, quantity: 1, price: 50, taxPercent: 18 }] // partial reversal
      });
      console.log(`Credit Note created: ${cnRes.creditNumber}, Amount: ${cnRes.amount}`);
      
      const cnJournals = await prisma.journalEntry.findMany({ where: { description: { contains: cnRes.creditNumber } }, include: { account: true }});
      console.log('Credit Note Journal Entries:');
      cnJournals.forEach(j => {
          console.log(`  - [${j.account.name}] ${j.description}: DR ${j.debit} / CR ${j.credit} (Base: DR ${j.baseDebit} / CR ${j.baseCredit}) Rate: ${j.exchangeRate}`);
      });
    } catch (e) {
      console.error("Credit Note Error:", e.message);
    }
  }

  process.exit(0);
}

runTests();
