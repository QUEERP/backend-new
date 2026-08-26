require('dotenv/config');
const prisma = require('./src/config/prisma');
const statutoryRegistry = require('./src/config/reports/statutoryRegistry');
const { createInvoice } = require('./src/services/sales/invoice.service');
const { createCreditNote } = require('./src/services/sales/creditNote.service');

async function testGstr1Netting() {
  const adminId = "test-admin-uuid";
  const userEmail = "test@example.com";
  const ts = Date.now();

  try {
    console.log("Setting up fresh test data...");

    // Currencies & Countries
    const inr = await prisma.currency.upsert({ where: { code: 'INR' }, update: {}, create: { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimalPrecision: 2 } });
    const india = await prisma.country.upsert({ where: { code: 'IN' }, update: {}, create: { code: 'IN', name: 'India' } });

    // Tax Framework
    let gstFramework = await prisma.taxFramework.findFirst({ where: { name: 'India GST' } });
    if (!gstFramework) {
      gstFramework = await prisma.taxFramework.create({ data: { name: 'India GST', countryId: india.id } });
    }

    // User
    const owner = await prisma.user.upsert({ where: { email: userEmail }, update: {}, create: { email: userEmail, name: 'Test User', password: 'password', role: 'ADMIN' } });

    // Brand new Business
    const newBusiness = await prisma.business.create({
      data: {
        name: `Fresh India Business ${ts}`,
        countryId: india.id,
        baseCurrencyId: inr.id,
        ownerId: owner.id,
        taxFrameworkId: gstFramework.id
      }
    });

    // Customer
    const customer = await prisma.customer.create({ data: { businessId: newBusiness.id, company: 'New India Customer', region: 'INDIA' } });

    // Product
    const product = await prisma.product.create({ data: { businessId: newBusiness.id, name: 'Test Goods', sku: `NEW-IN-${ts}`, price: 1000, costPrice: 500, type: 'GOODS' } });

    // Ensure 1:1 INR rate
    const existingRate = await prisma.exchangeRate.findFirst({
      where: { fromCurrencyId: inr.id, toCurrencyId: inr.id, rateType: 'COMMERCIAL' }
    });
    if (!existingRate) {
      await prisma.exchangeRate.create({
        data: { fromCurrencyId: inr.id, toCurrencyId: inr.id, rate: 1, effectiveDate: new Date('2026-01-01'), rateType: 'COMMERCIAL' }
      });
    }

    let rule = await prisma.exchangeRateRule.findFirst({
      where: { countryId: newBusiness.countryId, baseCurrencyId: inr.id }
    });
    if (rule) {
      await prisma.exchangeRateRule.update({ where: { id: rule.id }, data: { requiresStatutoryRate: false } });
    } else {
      await prisma.exchangeRateRule.create({
        data: {
          countryId: newBusiness.countryId,
          baseCurrencyId: inr.id,
          requiresStatutoryRate: false,
          statutoryRateSource: 'RBI'
        }
      });
    }

    // Account setup (needed for Journal Entries)
    await prisma.account.createMany({
      data: [
        { businessId: newBusiness.id, name: 'Accounts Receivable', code: 'SYSTEM_ACCOUNT_RECEIVABLE', type: 'ASSET' },
        { businessId: newBusiness.id, name: 'Sales Revenue', code: 'SYSTEM_REVENUE', type: 'INCOME' },
        { businessId: newBusiness.id, name: 'Tax Payable', code: 'SYSTEM_TAX_PAYABLE', type: 'LIABILITY' },
        { businessId: newBusiness.id, name: 'Bank', code: 'SYSTEM_BANK', type: 'ASSET' },
        { businessId: newBusiness.id, name: 'FX Gain/Loss', code: 'SYSTEM_FX_GAIN_LOSS', type: 'EXPENSE' },
      ]
    });

    // 1. Setup Tax Rule for 18% GST (CGST 9% + SGST 9%)
    const typeCgst = await prisma.taxType.create({ data: { taxFrameworkId: gstFramework.id, name: 'CGST' } });
    const typeSgst = await prisma.taxType.create({ data: { taxFrameworkId: gstFramework.id, name: 'SGST' } });

    const taxRule = await prisma.taxRule.create({
      data: {
        businessId: newBusiness.id,
        name: 'GST 18% Intra-State',
        rate: 18,
        type: 'GST',
        jurisdiction: 'INTRASTATE'
      }
    });

    // Also add an 'ANY' jurisdiction rule just in case the engine isn't picking up the states properly
    const taxRuleAny = await prisma.taxRule.create({
      data: {
        businessId: newBusiness.id,
        name: 'GST 18% General',
        rate: 18,
        type: 'GST',
        jurisdiction: 'ANY'
      }
    });

    await prisma.taxRate.create({
      data: { taxRuleId: taxRule.id, taxTypeId: typeCgst.id, name: 'CGST 9%', rate: 9, effectiveFrom: new Date('2026-01-01') }
    });
    await prisma.taxRate.create({
      data: { taxRuleId: taxRule.id, taxTypeId: typeSgst.id, name: 'SGST 9%', rate: 9, effectiveFrom: new Date('2026-01-01') }
    });

    await prisma.taxRate.create({
      data: { taxRuleId: taxRuleAny.id, taxTypeId: typeCgst.id, name: 'CGST 9%', rate: 9, effectiveFrom: new Date('2026-01-01') }
    });
    await prisma.taxRate.create({
      data: { taxRuleId: taxRuleAny.id, taxTypeId: typeSgst.id, name: 'SGST 9%', rate: 9, effectiveFrom: new Date('2026-01-01') }
    });

    console.log("Creating Invoice...");
    const invoicePayload = {
      customerId: customer.id,
      currency: 'INR',
      invoiceDate: new Date(),
      items: [{
        description: 'Test product',
        productId: product.id,
        quantity: 1,
        price: 5000,
        taxPercent: 18
      }]
    };

    // We mock req structure expected by the service
    const invoiceRes = await createInvoice(newBusiness.id, adminId, userEmail, invoicePayload);
    const invoiceId = invoiceRes.id;
    console.log(`Invoice created: ${invoiceRes.invoiceNumber} (Total: ${invoiceRes.grandTotal})`);

    // 2. Create exactly ONE Credit Note: 500 INR (CGST 45 + SGST 45)
    console.log("Creating Credit Note...");
    const cnPayload = {
      invoiceId: invoiceId,
      items: [{
        description: 'Test product',
        productId: product.id,
        quantity: 1,
        price: 500,
        taxPercent: 18
      }]
    };

    const cnRes = await createCreditNote(newBusiness.id, adminId, userEmail, cnPayload);
    console.log(`Credit Note created: ${cnRes.creditNumber} (Total: ${cnRes.amount})`);

    // 3. Call backend statutory report directly
    console.log("\n--- GENERATING GSTR1 ---");
    const filters = { startDate: '2026-01-01', endDate: '2026-12-31' };
    const reportData = await statutoryRegistry.generateReport('India GST', 'GSTR1', newBusiness.id, filters);

    console.log(JSON.stringify(reportData, null, 2));

  } catch (err) {
    console.error("TEST FAILED:", err);
  } finally {
    await prisma.$disconnect();
  }
}

testGstr1Netting();
