const prisma = require('./src/config/prisma');
const billService = require('./src/services/purchase/bill.service');
const debitNoteService = require('./src/services/purchase/debitNote.service');

async function testDebitNoteTax() {
  let businessId;
  try {
    const firstCurrency = await prisma.currency.findFirst();
    if (!firstCurrency) throw new Error("No currency found in DB. DB must be seeded.");

    // Setup isolated test data
    const business = await prisma.business.create({
      data: { 
        name: 'Test DN E2E ' + Date.now(), 
        baseCurrency: { connect: { id: firstCurrency.id } },
        owner: {
            create: {
                name: "Test User",
                email: 'owner' + Date.now() + '@test.com',
                password: "hash123",
                role: "ADMIN"
            }
        }
      }
    });
    businessId = business.id;
    console.log("Created isolated Business:", business.id);

    const vendor = await prisma.vendor.create({
      data: {
        businessId: business.id,
        countryCode: 'AE',
        state: 'UAE',
        name: 'Test Vendor DN',
        companyName: "Test Vendor DN",
        taxNumber: "VAT-VEN-12345"
      }
    });

    const product = await prisma.product.create({
      data: {
        businessId: business.id,
        name: "Test DN Goods",
        sku: "TEST-DN-" + Date.now(),
        type: "GOODS",
        price: 100,
        costPrice: 50
      }
    });

    const warehouse = await prisma.warehouse.create({
      data: {
        businessId: business.id,
        name: "Main WH DN"
      }
    });

    const taxFramework = await prisma.taxFramework.findFirst();
    if (!taxFramework) throw new Error("No tax framework found");

    await prisma.business.update({
      where: { id: business.id },
      data: { taxFrameworkId: taxFramework.id }
    });

    const taxType = await prisma.taxType.create({
      data: { name: 'VAT', taxFrameworkId: taxFramework.id }
    });

    const taxRule = await prisma.taxRule.create({
      data: {
        businessId: business.id,
        name: 'Standard VAT',
        isRecoverable: true,
        rate: 5,
        type: 'STANDARD'
      }
    });

    await prisma.taxRate.create({
      data: { taxTypeId: taxType.id, taxRuleId: taxRule.id, name: "VAT 5%", rate: 5, effectiveFrom: new Date('2020-01-01') }
    });

    const bill = await billService.createBill(business.id, null, "test@test.com", {
      vendorId: vendor.id,
      billNumber: 'BILL-TEST-DN-' + Date.now(),
      billDate: new Date(),
      currency: firstCurrency.code,
      items: [
        {
          description: "Test description",
          productId: product.id,
          quantity: 2,
          price: 100,
          // Tax Overrides!
          isManualOverride: true,
          manualOverrideRate: 0,
          overrideReason: "Exempt status test",
          overrideTaxTypeId: taxType.id
        }
      ]
    });
    
    console.log("Bill created:", bill.id);
    
    const billTaxTransactions = await prisma.taxTransaction.findMany({
      where: { transactionId: bill.id },
      select: {
        id: true,
        transactionType: true,
        transactionId: true,
        taxAmountTxnCcy: true,
        taxAmountBaseCcy: true,
        taxRateId: true,
        itemReference: true,
        overrideRate: true,
        overrideReason: true,
        overrideTaxTypeId: true
      }
    });
    console.log("\nTax Transactions for Bill:");
    console.dir(billTaxTransactions, { depth: null });

    // Create Debit Note
    const dnData = await debitNoteService.createDebitNote(business.id, {
      vendorId: vendor.id,
      billId: bill.id,
      debitNumber: 'DN-TEST-' + Date.now(),
      date: new Date(),
      currency: firstCurrency.code,
      items: [
        {
          description: "Test description", // Same description/product to match itemReference
          productId: product.id,
          quantity: 1, // Return 1
          rate: 100,
          taxPercent: 0
        }
      ]
    }, null);

    console.log("\nDebit Note created:", dnData.id);

    // Query TaxTransactions for Debit Note
    const dnTaxTransactions = await prisma.taxTransaction.findMany({
      where: { transactionId: dnData.id },
      select: {
        id: true,
        transactionType: true,
        transactionId: true,
        taxAmountTxnCcy: true,
        taxAmountBaseCcy: true,
        taxRateId: true,
        itemReference: true,
        overrideRate: true,
        overrideReason: true,
        overrideTaxTypeId: true
      }
    });

    console.log("\nTax Transactions for Debit Note:");
    console.dir(dnTaxTransactions, { depth: null });
    
  } catch (error) {
    console.error("Test failed:", error);
  } finally { await prisma.$disconnect(); }
}

testDebitNoteTax();
