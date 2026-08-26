require('dotenv').config();
const { getTaxSummary, getCurrencyUsage, getCurrencyGainLoss } = require('./src/controllers/reportController');
const { listAvailableReports, generateStatutoryReport } = require('./src/controllers/statutoryController');
const prisma = require('./src/config/prisma');

async function runTests() {
  console.log("=== Testing Reports ===");

  // Find the India business and UAE business
  const indiaBusiness = await prisma.business.findFirst({
    where: { taxFramework: { name: 'India GST' } },
    orderBy: { createdAt: 'desc' }
  });
  
  const uaeBusiness = await prisma.business.findFirst({
    where: { taxFramework: { name: 'UAE VAT' } },
    orderBy: { createdAt: 'desc' }
  });

  // Helper to mock req/res
  const createMockRes = (name) => {
    let _resolve;
    const p = new Promise(r => _resolve = r);
    return {
      status: (code) => ({
        json: (data) => {
          console.log(`\n[${name}] Response (${code}):\n`, JSON.stringify(data, null, 2));
          _resolve(data);
        }
      }),
      json: (data) => {
        console.log(`\n[${name}] Response:\n`, JSON.stringify(data, null, 2));
        _resolve(data);
      },
      promise: p
    };
  };

  if (indiaBusiness) {
    console.log("\n--- GET /api/reports/tax/summary (India) ---");
    const req1 = { business: { id: indiaBusiness.id }, query: {} };
    const res1 = createMockRes('Tax Summary - India');
    await getTaxSummary(req1, res1);
    await res1.promise;

    console.log("\n--- GET /api/reports/statutory/list (India) ---");
    const req3 = { business: { id: indiaBusiness.id }, query: {} };
    const res3 = createMockRes('Statutory List - India');
    await listAvailableReports(req3, res3);
    await res3.promise;
  } else {
    console.log("India Business not found!");
  }

  if (uaeBusiness) {
    console.log("\n--- GET /api/reports/statutory/list (UAE) ---");
    const req4 = { business: { id: uaeBusiness.id }, query: {} };
    const res4 = createMockRes('Statutory List - UAE');
    await listAvailableReports(req4, res4);
    await res4.promise;
  } else {
    console.log("UAE Business not found!");
  }

  const businessId = indiaBusiness ? indiaBusiness.id : (uaeBusiness ? uaeBusiness.id : null);
  if (businessId && indiaBusiness) {
    const jpy = await prisma.currency.upsert({ where: { code: 'JPY' }, update: {}, create: { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimalPrecision: 0 } });
    const cust = await prisma.customer.findFirst({ where: { businessId: indiaBusiness.id } });
    if (cust) {
      await prisma.payment.create({
        data: {
          businessId: indiaBusiness.id,
          customerId: cust.id,
          amount: 5000,
          paymentDate: new Date(),
          paymentMode: 'CASH',
          paymentMode: 'CASH',
          transactionCurrencyId: jpy.id,
          baseCurrencyAmount: 3000,
          exchangeRate: 0.6,
          createdBy: "test-admin-uuid",
          paymentNumber: "TEST-PAY-001"
        }
      });
      console.log('\n--- Seeded Payment-only currency (JPY) for India Business ---');
    }

    console.log("\n--- GET /api/reports/currency/usage ---");
    const req2 = { business: { id: businessId }, query: {} };
    const res2 = createMockRes('Currency Usage');
    await getCurrencyUsage(req2, res2);
    await res2.promise;

    console.log("\n--- GET /api/reports/currency/gain-loss ---");
    const req5 = { business: { id: businessId }, query: {} };
    const res5 = createMockRes('Currency Gain/Loss');
    await getCurrencyGainLoss(req5, res5);
    await res5.promise;

    console.log("\n--- GET /api/reports/statutory/generate/GSTR1 (India) ---");
    const gstr1Req = { business: { id: indiaBusiness.id }, params: { reportCode: 'GSTR1' }, query: {} };
    const gstr1Res = createMockRes('GSTR1');
    await generateStatutoryReport(gstr1Req, gstr1Res);
    await gstr1Res.promise;
  }

  console.log("\n=== Done ===");
  process.exit(0);
}

runTests().catch(e => { console.error(e); process.exit(1); });
