const prisma = require('./src/config/prisma');
const billService = require('./src/services/purchase/bill.service');

async function run() {
  let businessId;
  try {
    const taxFramework = await prisma.taxFramework.findFirst();
    if (!taxFramework) throw new Error("No tax framework found.");

    const aed = await prisma.currency.upsert({
      where: { code: 'AED' },
      update: {},
      create: { code: 'AED', name: 'UAE Dirham', symbol: 'AED' }
    });

    const inr = await prisma.currency.upsert({
      where: { code: 'INR' },
      update: {},
      create: { code: 'INR', name: 'Indian Rupee', symbol: 'INR', decimals: 2 }
    });

    // Create isolated UAE business with AED as base currency
    const business = await prisma.business.create({
      data: {
        name: 'UAE CCY Test ' + Date.now(),
        taxFramework: { connect: { id: taxFramework.id } },
        countryCode: 'AE',
        state: 'DXB',
        baseCurrency: { connect: { id: aed.id } },
        owner: {
          create: {
            name: 'CCY Test User',
            email: 'ccy_' + Date.now() + '@test.com',
            password: 'hash123'
          }
        }
      }
    });
    businessId = business.id;
    console.log('Business created:', businessId, '| baseCurrencyId:', business.baseCurrencyId);

    // Tax rules
    const taxType = await prisma.taxType.create({ data: { name: 'VAT_CCY_' + Date.now(), taxFrameworkId: taxFramework.id } });
    const domesticRule = await prisma.taxRule.create({
      data: { businessId, name: 'Domestic Goods 5%', rate: 5, type: 'STANDARD', isRecoverable: true, priority: 20, countryCode: 'AE', placeOfSupply: 'INTRASTATE', supplyCategory: 'GOODS' }
    });
    await prisma.taxRate.create({ data: { taxTypeId: taxType.id, taxRuleId: domesticRule.id, name: 'DOM Rate', rate: 5, effectiveFrom: new Date('2020-01-01') } });

    // Domestic vendor (same state = INTRASTATE)
    const vendor = await prisma.vendor.create({
      data: { businessId, name: 'AE Vendor', country: 'AE', state: 'DXB', taxNumber: 'VAT-AE-001' }
    });

    // Product
    const product = await prisma.product.create({
      data: { businessId, name: 'Widget', type: 'GOODS', price: 1000, sku: 'WDG-' + Date.now(), costPrice: 500 }
    });

    // Seed INR -> AED exchange rate: 1 INR = 0.045 AED (only if not already exists)
    const existingRate = await prisma.exchangeRate.findFirst({
      where: { fromCurrencyId: inr.id, toCurrencyId: aed.id, effectiveDate: new Date('2020-01-01'), rateType: 'COMMERCIAL' }
    });
    if (!existingRate) {
      await prisma.exchangeRate.create({
        data: { fromCurrencyId: inr.id, toCurrencyId: aed.id, rate: 0.045, effectiveDate: new Date('2020-01-01') }
      });
    }

    // ===== SUCCESS CASE: Bill in INR, business base is AED =====
    // Price: 1000 INR. Tax 5% = 50 INR.
    // In AED: 50 * 0.045 = 2.25 AED
    console.log('\n=== CASE A: Cross-currency bill (INR bill, AED base) ===');
    const bill = await billService.createBill(businessId, null, 'test@test.com', {
      vendorId: vendor.id,
      billNumber: 'CCY-INR-' + Date.now(),
      billDate: new Date(),
      currency: 'INR',
      items: [{ productId: product.id, quantity: 1, price: 1000 }]
    });

    const taxes = await prisma.taxTransaction.findMany({ where: { transactionId: bill.id } });
    if (taxes.length === 0) {
      console.log('NO TAX TRANSACTIONS RECORDED — tax rule not matched');
    } else {
      taxes.forEach(t => {
        console.log(`  taxAmountTxnCcy (INR): ${t.taxAmountTxnCcy}`);
        console.log(`  taxAmountBaseCcy (AED): ${t.taxAmountBaseCcy}`);
        if (t.taxAmountTxnCcy === t.taxAmountBaseCcy) {
          console.log('  FAIL: txnCcy === baseCcy — no conversion happened (bug: defaulting to 1.0)');
        } else {
          const effectiveRate = t.taxAmountBaseCcy / t.taxAmountTxnCcy;
          console.log(`  Effective rate: ${effectiveRate.toFixed(4)} (expected 0.0450)`);
          if (Math.abs(effectiveRate - 0.045) < 0.001) {
            console.log('  PASS: Conversion correct (50 INR → 2.25 AED)');
          } else {
            console.log('  FAIL: Wrong conversion rate');
          }
        }
      });
    }

    // ===== MISSING EXCHANGE RATE CASE =====
    console.log('\n=== CASE B: Bill in unknown currency (no exchange rate) ===');
    const xyz = await prisma.currency.upsert({
      where: { code: 'XYZ' },
      update: {},
      create: { code: 'XYZ', name: 'Unknown Ccy', symbol: 'XYZ', decimals: 2 }
    });
    try {
      await billService.createBill(businessId, null, 'test@test.com', {
        vendorId: vendor.id,
        billNumber: 'CCY-XYZ-' + Date.now(),
        billDate: new Date(),
        currency: 'XYZ',
        items: [{ productId: product.id, quantity: 1, price: 100 }]
      });
      console.log('  FAIL: Did NOT throw on missing exchange rate');
    } catch (err) {
      console.log('  PASS: Threw error on missing exchange rate ->', err.message);
    }

  } catch (e) {
    console.error('Test failed:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}
run();
