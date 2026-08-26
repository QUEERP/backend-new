const prisma = require('./src/config/prisma');
const reportController = require('./src/controllers/reportController');

async function testCurrency() {
  try {
    const cadCurrency = await prisma.currency.findUnique({ where: { code: 'CAD' } });
    const usdCurrency = await prisma.currency.findUnique({ where: { code: 'USD' } });

    if (!cadCurrency || !usdCurrency) {
      console.error("Missing currencies");
      return;
    }

    const user = await prisma.user.findFirst();
    // Create a new business with CAD base currency
    const business = await prisma.business.create({
      data: {
        name: "Canada Test Business",
        baseCurrencyId: cadCurrency.id,
        ownerId: user.id
      }
    });

    console.log(`Created business ${business.id} with base currency CAD`);

    // Create a customer
    const customer = await prisma.customer.create({
      data: {
        businessId: business.id,
        company: 'US Customer Co',
        region: 'INDIA'
      }
    });

    // Create an exchange rate
    await prisma.exchangeRate.create({
      data: {
        fromCurrencyId: usdCurrency.id,
        toCurrencyId: cadCurrency.id,
        rate: 1.35,
        effectiveDate: new Date(),
        rateType: "COMMERCIAL"
      }
    });

    // Create an Invoice with USD transaction currency, but CAD base
    // 100 USD = 135 CAD
    await prisma.invoice.create({
      data: {
        businessId: business.id,
        customerId: customer.id,
        invoiceNumber: "INV-001",
        invoiceDate: new Date(),
        transactionCurrencyId: usdCurrency.id,
        baseCurrencyAmount: 135.0, // CAD
        subtotal: 100.0,
        totalTax: 0,
        discount: 0,
        grandTotal: 100.0, // USD
        amountPaid: 0,
        status: "APPROVED"
      }
    });

    // Create a mock req/res for getCurrencyUsage
    const req = {
      business: { id: business.id },
      query: {}
    };

    const res = {
      status: (code) => res,
      json: (data) => {
        console.log("\n--- getCurrencyUsage Output ---");
        console.log(JSON.stringify(data, null, 2));
      }
    };

    await reportController.getCurrencyUsage(req, res);

  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

testCurrency();
