const prisma = require('./src/config/prisma');
const salesReturnService = require('./src/services/sales/salesReturn.service');
const invoiceService = require('./src/services/sales/invoice.service');

async function testSalesReturnTax() {
  let businessId;
  try {
    const firstCurrency = await prisma.currency.findFirst();
    if (!firstCurrency) throw new Error("No currency found in DB. DB must be seeded.");

    // Setup isolated test data
    const business = await prisma.business.create({
      data: { 
        name: 'Test SR E2E ' + Date.now(), 
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

    const customer = await prisma.customer.create({
      data: {
        businessId: business.id,
        country: 'AE',
        region: 'UAE',
        company: "Test SR Company",
        vatNumber: "VAT-12345"
      }
    });

    const product = await prisma.product.create({
      data: {
        businessId: business.id,
        name: "Test SR Goods",
        sku: "TEST-SR-" + Date.now(),
        type: "GOODS",
        price: 100,
        costPrice: 50
      }
    });

    const warehouse = await prisma.warehouse.create({
      data: {
        businessId: business.id,
        name: "Main WH SR"
      }
    });

    const taxFramework = await prisma.taxFramework.create({
      data: { businessId: business.id, name: 'VAT Framework', countryId: 'ae_id_placeholder' }
    }).catch(async () => {
      // Find an existing one if countryId is strictly checked or something, but usually businessId is enough if country isn't required.
      // Wait, let's just fetch the first framework
      const fw = await prisma.taxFramework.findFirst();
      if (!fw) throw new Error("No tax framework found");
      return fw;
    });

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

    // Create Invoice
    const invoice = await invoiceService.createInvoice(business.id, "test_user", "test@test.com", {
      customerId: customer.id,
      invoiceNumber: 'INV-TEST-SR-' + Date.now(),
      invoiceDate: new Date(),
      dueDate: new Date(),
      currencyId: firstCurrency.id,
      currency: firstCurrency.code,
      items: [
        {
          description: "Test description",
          productId: product.id,
          warehouseId: warehouse.id,
          quantity: 2,
          rate: 100,
          taxPercent: 5
        }
      ]
    });
    
    console.log("Invoice created:", invoice.id);

    // Create Sales Return
    const srData = await salesReturnService.createSalesReturn(business.id, "test_user", "test@test.com", {
      customerId: customer.id,
      invoiceId: invoice.id,
      date: new Date(),
      currency: firstCurrency.code,
      items: [
        {
          description: "Test description",
          productId: product.id,
          warehouseId: warehouse.id,
          quantity: 1, // Return 1
          price: 100,
          taxPercent: 5
        }
      ]
    });

    console.log("Sales Return created:", srData.salesReturn.id);
    console.log("Credit Note created:", srData.creditNote.id);

    // Query TaxTransactions
    const taxTransactions = await prisma.taxTransaction.findMany({
      where: { transactionId: srData.creditNote.id },
      select: {
        id: true,
        transactionType: true,
        transactionId: true,
        taxAmountTxnCcy: true,
        taxAmountBaseCcy: true,
        taxRateId: true,
        itemReference: true
      }
    });

    console.log("\nTax Transactions for Credit Note:");
    console.dir(taxTransactions, { depth: null });
    
    const srTaxTransactions = await prisma.taxTransaction.findMany({
      where: { transactionId: srData.salesReturn.id }
    });
    console.log("\nTax Transactions for Sales Return (should be empty):", srTaxTransactions.length);

  } catch (error) {
    console.error("Test failed:", error);
  } finally { await prisma.$disconnect(); }
}

testSalesReturnTax();
