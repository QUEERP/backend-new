const prisma = require('./src/config/prisma');
const { createBill } = require('./src/services/purchase/bill.service');
const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();

async function runTest() {
  try {
    // 1. Create a dummy currency and business
    const currency = await prisma.currency.upsert({
      where: { code: "MYR" },
      update: {},
      create: {
        id: uuidv4(),
        code: "MYR",
        name: "Malaysian Ringgit",
        symbol: "RM"
      }
    });
    const currencyId = currency.id;
    
    const aed = await prisma.currency.upsert({
      where: { code: "AED" },
      update: {},
      create: { id: uuidv4(), code: "AED", name: "AED", symbol: "AED" }
    });

    try {
      await prisma.exchangeRate.create({
        data: {
          id: uuidv4(),
          fromCurrencyId: aed.id,
          toCurrencyId: currencyId,
          rate: 0.8,
          effectiveDate: new Date("2020-01-01"),
          rateType: "COMMERCIAL"
        }
      });
    } catch (e) {
      // Ignore if it already exists
    }

    const businessId = uuidv4();
    await prisma.business.create({
      data: {
        id: businessId,
        name: "Malaysia Test Business",
        countryCode: "MY",
        baseCurrency: { connect: { id: currencyId } },
        owner: {
          create: { name: "Test Owner", email: `owner_${businessId}@test.com`, password: "pwd" }
        }
      }
    });
    
    // Create Dummy TaxFramework and TaxType to satisfy FK
    const taxFrameworkId = uuidv4();
    const taxTypeId = uuidv4();
    await prisma.taxFramework.create({
      data: {
        id: taxFrameworkId,
        countryId: businessId, // use businessId as dummy country id
        name: "MY_FRAMEWORK",
        taxTypes: {
          create: {
            id: taxTypeId,
            name: "SST",
          }
        }
      }
    });

    // 2. Setup tax rule with isRecoverable = false (SST)
    const taxRuleId = uuidv4();
    await prisma.taxRule.create({
      data: {
        id: taxRuleId,
        businessId: businessId,
        name: "Malaysia SST 10%",
        rate: 10,
        type: "STANDARD",
        isRecoverable: false,
        countryCode: "MY",
        supplyCategory: "GOODS"
      }
    });

    const taxRateId = uuidv4();
    await prisma.taxRate.create({
      data: {
        id: taxRateId,
        taxRuleId: taxRuleId,
        taxTypeId: taxTypeId, 
        name: "SST 10%",
        rate: 10,
        effectiveFrom: new Date("2020-01-01"),
      }
    });
    
    await prisma.business.update({
      where: { id: businessId },
      data: { taxFrameworkId: taxFrameworkId }
    });

    // 3. Create a Vendor and Product
    const vendorId = uuidv4();
    await prisma.vendor.create({
      data: {
        id: vendorId,
        businessId: businessId,
        name: "Test Vendor Name"
      }
    });
    
    const productId = uuidv4();
    await prisma.product.create({
      data: {
        id: productId,
        businessId: businessId,
        name: "Test Inventory Goods",
        sku: "TEST-GOODS-001",
        price: 600,
        costPrice: 600,
        type: "GOODS"
      }
    });

    // 4. Run createBill with goods and services to see proportional splitting
    console.log("Running createBill...");
    const billData = {
      vendorId: vendorId,
      billNumber: "MY-BILL-001",
      billDate: new Date(),
      dueDate: new Date(),
      currency: "MYR",
      subtotal: 1000,
      discount: 0,
      totalTax: 100, // 10% of 1000
      grandTotal: 1100,
      taxRuleId: taxRuleId, // using our non-recoverable rule
      items: [
        {
          description: "Inventory Goods",
          amount: 600,
          quantity: 1,
          price: 600,
          itemType: "GOODS",
          productId: productId
        },
        {
          description: "Consulting Services",
          amount: 400,
          quantity: 1,
          price: 400,
          itemType: "SERVICE"
        }
      ]
    };

    const bill = await createBill(businessId, "testUser", "test@test.com", billData);

    // 5. Fetch and print the generated Journal Entries
    const entries = await prisma.journalEntry.findMany({
      where: { businessId, description: { contains: 'MY-BILL-001' } },
      include: { account: true }
    });

    console.log("\n--- RESULTING JOURNAL ENTRIES (isRecoverable = false) ---");
    entries.forEach(e => {
      console.log(`Account: ${e.account.name.padEnd(20)} | Debit: ${e.debit.toString().padStart(6)} | Credit: ${e.credit.toString().padStart(6)}`);
    });

  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
