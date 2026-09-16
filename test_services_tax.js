const prisma = require('./src/config/prisma');
const billService = require('./src/services/purchase/bill.service');


async function testServicesTax() {
  let business = null;
  try {
    const uniqueSuffix = Date.now();
    
    const firstCurrency = await prisma.currency.findFirst();
    if (!firstCurrency) throw new Error("No currency found in DB. DB must be seeded.");

    business = await prisma.business.create({
      data: { 
        name: 'Test SVC E2E ' + Date.now(), 
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
    console.log("Created isolated Business:", business.id);

    const vendor = await prisma.vendor.create({
      data: {
        businessId: business.id,
        countryCode: 'AE',
        state: 'UAE',
        name: 'Test Vendor SVC',
        companyName: "Test Vendor SVC",
        taxNumber: "VAT-VEN-12345"
      }
    });

    const taxFramework = await prisma.taxFramework.findFirst();
    if (!taxFramework) throw new Error("No tax framework found.");

    await prisma.business.update({
      where: { id: business.id },
      data: { taxFrameworkId: taxFramework.id }
    });
    
    const taxType = await prisma.taxType.create({ data: { name: 'VAT', taxFrameworkId: taxFramework.id } });

    const taxRule = await prisma.taxRule.create({
      data: { businessId: business.id, name: "Standard VAT 5%", rate: 5, type: "PURCHASE", isRecoverable: true }
    });
    await prisma.taxRate.create({
      data: { taxTypeId: taxType.id, taxRuleId: taxRule.id, name: "VAT 5%", rate: 5, effectiveFrom: new Date('2020-01-01') }
    });

    // Create a SERVICES Product
    const product = await prisma.product.create({
      data: {
        businessId: business.id,
        name: "Consulting Services",
      type: "SERVICE",
      sku: "SVC-" + Date.now(),
      description: "Hourly consulting", // This maps to ItemType.SERVICE
        price: 100,
        costPrice: 100
      }
    });

    console.log("Created Product of type:", product.type);

    const TaxResolver = require('./src/services/TaxResolver');
    const originalResolveTaxRule = TaxResolver.resolveTaxRule;
    TaxResolver.resolveTaxRule = async function(args) {
       console.log("TaxResolver called with supplyCategory:", args.supplyCategory);
       const result = await originalResolveTaxRule.apply(this, arguments);
       console.log("TaxResolver returned:", result);
       return result;
    };

    // Create Bill
    const bill = await billService.createBill(business.id, null, "test@test.com", {
      vendorId: vendor.id,
      billNumber: 'BILL-SVC-' + Date.now(),
      billDate: new Date(),
      dueDate: new Date(Date.now() + 86400000),
      currency: firstCurrency.code,
      transactionCurrencyId: firstCurrency.id,
      items: [
        {
          productId: product.id,
          quantity: 1,
          price: 100
        }
      ]
    });

    console.log("\nBill created:", bill.id);

    const billTaxTransactions = await prisma.taxTransaction.findMany({
      where: { transactionId: bill.id, transactionType: 'BILL' }
    });
    console.log("\nTax Transactions:");
    console.dir(billTaxTransactions, { depth: null });

  } catch (error) {
    console.error("Test setup failed:", error);
  } finally { await prisma.$disconnect(); }
}

testServicesTax();
