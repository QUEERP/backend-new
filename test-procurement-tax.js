require('dotenv/config');
const prisma = require('./src/config/prisma');
const { createBill } = require('./src/services/purchase/bill.service');
const { createPurchaseReturn } = require('./src/services/purchase/purchaseReturn.service');
const { getTaxSummary } = require('./src/controllers/reportController.js'); // Not strictly needed but ok
async function testProcurementTax() {
  const adminId = "test-admin-uuid";
  const userEmail = "test@example.com";
  const ts = Date.now();

  try {
    console.log("Setting up fresh test data for procurement...");

    const inr = await prisma.currency.upsert({ where: { code: 'INR' }, update: {}, create: { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimalPrecision: 2 } });
    const india = await prisma.country.upsert({ where: { code: 'IN' }, update: {}, create: { code: 'IN', name: 'India' } });

    let gstFramework = await prisma.taxFramework.findFirst({ where: { name: 'India GST' } });
    if (!gstFramework) {
      gstFramework = await prisma.taxFramework.create({ data: { name: 'India GST', countryId: india.id } });
    }

    const owner = await prisma.user.upsert({ where: { email: userEmail }, update: {}, create: { email: userEmail, name: 'Test User', password: 'password', role: 'ADMIN' } });

    const newBusiness = await prisma.business.create({
      data: {
        name: `Procurement India Business ${ts}`,
        countryId: india.id,
        baseCurrencyId: inr.id,
        ownerId: owner.id,
        taxFrameworkId: gstFramework.id
      }
    });

    const vendor = await prisma.vendor.create({ data: { businessId: newBusiness.id, name: 'Test Vendor' } });

    const product = await prisma.product.create({ data: { businessId: newBusiness.id, name: 'Test Goods', sku: `PROC-IN-${ts}`, price: 1000, costPrice: 500, type: 'GOODS' } });

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

    await prisma.account.createMany({
      data: [
        { businessId: newBusiness.id, name: 'AP', code: 'SYSTEM_AP', type: 'LIABILITY' },
        { businessId: newBusiness.id, name: 'Inventory', code: 'SYSTEM_INVENTORY', type: 'ASSET' },
        { businessId: newBusiness.id, name: 'Tax Payable', code: 'SYSTEM_TAX_PAYABLE', type: 'LIABILITY' },
        { businessId: newBusiness.id, name: 'Tax Receivable', code: 'SYSTEM_TAX_RECEIVABLE', type: 'ASSET' },
        { businessId: newBusiness.id, name: 'Bank', code: 'SYSTEM_BANK', type: 'ASSET' },
        { businessId: newBusiness.id, name: 'Expense', code: 'SYSTEM_EXPENSE', type: 'EXPENSE' },
      ]
    });

    const typeCgst = await prisma.taxType.create({ data: { taxFrameworkId: gstFramework.id, name: 'CGST' } });
    const typeSgst = await prisma.taxType.create({ data: { taxFrameworkId: gstFramework.id, name: 'SGST' } });

    const taxRule = await prisma.taxRule.create({
      data: { businessId: newBusiness.id, name: 'GST 18%', rate: 18, type: 'GST', jurisdiction: 'ANY', isRecoverable: true }
    });

    await prisma.taxRate.create({ data: { taxRuleId: taxRule.id, taxTypeId: typeCgst.id, name: 'CGST 9%', rate: 9, effectiveFrom: new Date('2026-01-01') } });
    await prisma.taxRate.create({ data: { taxRuleId: taxRule.id, taxTypeId: typeSgst.id, name: 'SGST 9%', rate: 9, effectiveFrom: new Date('2026-01-01') } });

    console.log("Creating Bill...");
    const billPayload = {
      vendorId: vendor.id,
      billNumber: "BILL-001",
      currency: 'INR',
      date: new Date(),
      taxRuleId: taxRule.id,
      items: [{
        description: 'Test product',
        productId: product.id,
        quantity: 1,
        price: 5000,
        taxPercent: 18
      }]
    };

    const billRes = await createBill(newBusiness.id, adminId, userEmail, billPayload);
    console.log(`Bill created: ${billRes.billNumber} (Total: ${billRes.totalAmount})`);

    console.log("Creating Purchase Return...");
    const prPayload = {
      vendorId: vendor.id,
      billId: billRes.id,
      currency: 'INR',
      date: new Date(),
      taxRuleId: taxRule.id,
      items: [{
        description: 'Test product',
        productId: product.id,
        quantity: 1,
        price: 500,
        taxPercent: 18
      }]
    };

    const prRes = await createPurchaseReturn(newBusiness.id, adminId, userEmail, prPayload);
    console.log(`Purchase Return created: ${prRes.returnNumber} (Total: ${prRes.totalAmount})`);

    console.log("\n--- GENERATING TAX SUMMARY (Direct DB Query as in Controller) ---");
    const summary = await prisma.taxTransaction.groupBy({
      by: ['transactionType', 'taxRateId', 'transactionCurrencyId'],
      where: { businessId: newBusiness.id },
      _sum: { taxAmountBaseCcy: true, taxAmountTxnCcy: true }
    });

    const rateIds = summary.map(s => s.taxRateId);
    const rates = await prisma.taxRate.findMany({
      where: { id: { in: rateIds } },
      include: { taxType: true }
    });
    const rateMap = {}; rates.forEach(r => { rateMap[r.id] = r; });

    const ccyIds = summary.map(s => s.transactionCurrencyId).filter(Boolean);
    const currencies = await prisma.currency.findMany({ where: { id: { in: ccyIds } } });
    const ccyMap = {}; currencies.forEach(c => { ccyMap[c.id] = c.code; });

    const enhanced = summary.map(s => {
      const r = rateMap[s.taxRateId];
      return {
        transactionType: s.transactionType,
        transactionCurrency: s.transactionCurrencyId ? ccyMap[s.transactionCurrencyId] : 'BASE',
        taxType: r ? r.taxType.name : 'Unknown',
        taxRate: r ? r.rate : 0,
        totalTaxBaseCcy: s._sum.taxAmountBaseCcy,
        totalTaxTxnCcy: s._sum.taxAmountTxnCcy
      };
    });

    console.log(JSON.stringify(enhanced, null, 2));

    console.log("\n--- GENERATING GSTR3B (Statutory Report) ---");
    const statutoryRegistry = require('./src/config/reports/statutoryRegistry');
    const filters = { startDate: '2026-01-01', endDate: '2026-12-31' };
    const reportData = await statutoryRegistry.generateReport('India GST', 'GSTR3B', newBusiness.id, filters);
    console.log(JSON.stringify(reportData, null, 2));

  } catch (err) {
    console.error("TEST FAILED:", err);
  } finally {
    await prisma.$disconnect();
  }
}

testProcurementTax();
