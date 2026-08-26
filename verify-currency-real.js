const prisma = require('./src/config/prisma');
const { createInvoice } = require('./src/services/sales/invoice.service');
const { exportCurrencyTransactions } = require('./src/controllers/currencyExportController');

async function testCurrencyReal() {
  try {
    const cadCurrency = await prisma.currency.findUnique({ where: { code: 'CAD' } });
    const usdCurrency = await prisma.currency.findUnique({ where: { code: 'USD' } });

    if (!cadCurrency || !usdCurrency) {
      console.error("Missing currencies");
      return;
    }

    const canada = await prisma.country.findUnique({ where: { code: 'CA' } }) || await prisma.country.findFirst();

    const user = await prisma.user.findFirst();
    const business = await prisma.business.create({
      data: {
        name: "Canada Real Pipeline Test",
        baseCurrencyId: cadCurrency.id,
        countryId: canada.id,
        ownerId: user.id
      }
    });

    console.log(`Created business ${business.id} with base currency CAD`);

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
    
    // Create customer
    const customer = await prisma.customer.create({
      data: {
        businessId: business.id,
        company: 'US Customer Co',
        region: 'CANADA'
      }
    });

    // Create Invoice through pipeline
    const invoiceData = {
      customerId: customer.id,
      invoiceNumber: 'INV-REAL-001',
      invoiceDate: new Date().toISOString(),
      dueDate: new Date().toISOString(),
      currency: 'USD',
      items: [
        {
          description: 'Consulting',
          quantity: 1,
          rate: 100, // 100 USD
          taxPercent: 0
        }
      ]
    };

    const inv = await createInvoice(business.id, user.id, user.email, invoiceData);
    console.log(`Created real invoice: ${inv.id} via pipeline`);

    // Now export JSON
    let jsonOutput = null;
    const jsonRes = {
      setHeader: () => {},
      send: (data) => {
        jsonOutput = JSON.parse(data);
      },
      status: (s) => ({ json: (d) => console.log('Error', s, d) })
    };
    
    await exportCurrencyTransactions({ 
      business: { id: business.id }, 
      query: {}, 
      params: { format: 'json' } 
    }, jsonRes);
    
    console.log('\n--- CURRENCY EXPORT OUTPUT ---');
    console.log(JSON.stringify(jsonOutput, null, 2));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}
testCurrencyReal();
