const prisma = require('./src/config/prisma');
const TaxResolver = require('./src/services/TaxResolver');
const invoiceService = require('./src/services/sales/invoice.service');
const { RateResolutionError } = require('./src/services/currencyService');

async function run() {
  try {
    console.log("--- 1. Checking Existing DB Transaction (Dev Priya) ---");
    const existingTx = await prisma.taxTransaction.findFirst({
      where: { business: { name: { contains: 'Dev Priya' } } }
    });
    if (existingTx) {
      console.log(`Existing Dev Priya transaction found: ID=${existingTx.id}`);
      console.log(`taxAmountBaseCcy=${existingTx.taxAmountBaseCcy}, taxAmountTxnCcy=${existingTx.taxAmountTxnCcy}`);
    } else {
      console.log("Could not find Dev Priya transaction - checking any tax transaction:");
      const anyTx = await prisma.taxTransaction.findFirst();
      if (anyTx) {
         console.log(`Any Tx: ID=${anyTx.id}, taxAmountBaseCcy=${anyTx.taxAmountBaseCcy}`);
      } else {
         console.log("No existing tax transactions found.");
      }
    }

    console.log("\n--- 2. Setup Test Data ---");
    // Ensure we have a CA business, a CA customer, and a Goods product
    const business = await prisma.business.findFirst();
    if (!business) throw new Error("No business found");

    // Let's create a specific test business and rules if needed, or use existing
    const firstCurrency = await prisma.currency.findFirst();
    await prisma.business.update({
      where: { id: business.id },
      data: { 
        countryCode: 'CA', 
        state: 'BC',
        baseCurrencyId: firstCurrency.id 
      }
    });

    const customer = await prisma.customer.create({
      data: {
        businessId: business.id,
        country: 'CA',
        state: 'BC',
        vatNumber: 'REGISTERED-123',
        company: "Test CA Company",
        region: "UAE"
      }
    });

    const product = await prisma.product.create({
      data: {
        businessId: business.id,
        name: "Test Goods",
        sku: "TEST-GOODS-" + Date.now(),
        type: "GOODS",
        supplyCategory: "GOODS",
        price: 100,
        costPrice: 50
      }
    });

    // Clear existing rules to prevent wildcard matches
    await prisma.taxRule.deleteMany({ where: { businessId: business.id } });

    // Create a specific rule for CA BC GOODS
    const rule1 = await prisma.taxRule.create({
      data: {
        businessId: business.id,
        name: "CA PST 7%",
        rate: 7.0,
        type: "PST",
        countryCode: "CA",
        regionCode: "BC",
        placeOfSupply: "INTRASTATE",
        supplyCategory: "GOODS",
        priority: 10,
        rates: {
          create: {
            taxTypeId: (await prisma.taxType.findFirst()).id || undefined, // We might need a valid taxTypeId
            name: "CA PST 7%",
            rate: 7.0,
            effectiveFrom: new Date("2020-01-01")
          }
        }
      }
    });

    console.log("\n--- 3. E2E Success Test ---");
    try {
      const invoiceData = {
        customerId: customer.id,
        invoiceDate: new Date(),
        currencyId: (await prisma.currency.findFirst()).id,
        currency: (await prisma.currency.findFirst()).code,
        items: [
          {
            productId: product.id,
            quantity: 1,
            price: 100,
            description: "Test Goods",
            itemName: "Test Goods"
          }
        ]
      };
      
      const result = await invoiceService.createInvoice(business.id, null, null, invoiceData);
      console.log(`Success! Invoice created: ${result.id}`);
      
      const taxTxs = await prisma.taxTransaction.findMany({ where: { transactionId: result.id } });
      console.log(`Tax Transactions created: ${taxTxs.length}`);
      for (const t of taxTxs) {
        console.log(`- ID: ${t.id}, RateID: ${t.taxRateId}, TxnAmt: ${t.taxAmountTxnCcy}, BaseAmt: ${t.taxAmountBaseCcy}`);
      }
    } catch (e) {
      console.error("Success test failed:", e);
    }

    console.log("\n--- 4. E2E Failure Test (No Rule) ---");
    try {
      // Create a customer in a region with no rules (e.g. 'AB')
      const outOfProvinceCustomer = await prisma.customer.create({
        data: {
          businessId: business.id,
          country: 'ZZ',
          state: 'XX',
          company: 'Test Out of Province',
          region: "UAE"
        }
      });
      
      const invoiceData2 = {
        customerId: outOfProvinceCustomer.id,
        invoiceDate: new Date(),
        currencyId: (await prisma.currency.findFirst()).id,
        currency: (await prisma.currency.findFirst()).code,
        items: [
          {
            productId: product.id,
            quantity: 1,
            price: 100,
            description: "Test Goods",
            itemName: "Test Goods"
          }
        ]
      };
      
      await invoiceService.createInvoice(business.id, null, null, invoiceData2);
      console.log("FAIL: Invoice creation succeeded but should have failed due to no tax rule.");
    } catch (e) {
      console.log("PASS: Caught expected error for missing tax rule:");
      console.log("Error Message:", e.message);
    }

  } catch (err) {
    console.error("Test script failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
