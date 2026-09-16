const prisma = require('./src/config/prisma');
const { provisionTaxRules } = require('./src/services/taxProvisioning.service');
const InvoiceService = require('./src/services/sales/invoice.service');
const { generateReport } = require('./src/config/reports/statutoryRegistry');

async function testGroup1() {
  try {
    console.log("=== GROUP 1 (OM, BH, NZ, IE, FR) E2E VERIFICATION ===\n");

    const owner = await prisma.user.findFirst();
    if (!owner) throw new Error("No user found.");

    // Helper to run a specific scenario
    async function runScenario(biz, customer, scenarioName, items) {
      console.log(`\n--- Scenario: ${scenarioName} ---`);
      try {
        const invoice = await InvoiceService.createInvoice(biz.id, owner.id, owner.email, {
          customerId: customer.id,
          invoiceDate: new Date(),
          dueDate: new Date(),
          currency: biz.currencyCode,
          items: items // items array contains description, quantity, price
        });
        
        console.log(`✅ Invoice ${invoice.invoiceNumber} created successfully.`);
        console.log(`   Subtotal: ${invoice.subtotal}`);
        console.log(`   Total Tax: ${invoice.totalTax}`);
        console.log(`   Grand Total: ${invoice.grandTotal}`);
        
        // Print the lines for detailed verification
        const invoiceLines = await prisma.invoiceItem.findMany({ where: { invoiceId: invoice.id } });
        for (const line of invoiceLines) {
           console.log(`   Line: ${line.description} | Tax Amt: ${line.taxAmountBaseCcy}`);
        }
      } catch (err) {
        console.error(`❌ Unexpected failure: ${err.message}`);
      }
    }

    async function testCountry(countryCode, expectedStandardRate, expectedReducedRate, hasReducedRate) {
      console.log(`\n\n======================================================`);
      console.log(`TESTING COUNTRY: ${countryCode}`);
      console.log(`======================================================`);
      
      const country = await prisma.country.findUnique({ where: { code: countryCode } });
      const currencyCode = countryCode === 'OM' ? 'OMR' : countryCode === 'BH' ? 'BHD' : countryCode === 'NZ' ? 'NZD' : 'EUR';
      let currency = await prisma.currency.findFirst({ where: { code: currencyCode } });
      if (!currency) {
         currency = await prisma.currency.create({ data: { code: currencyCode, symbol: currencyCode, name: currencyCode, decimals: 2 } });
      }
      
      const framework = await prisma.taxFramework.findUnique({ where: { countryId: country.id } });

      let biz = await prisma.business.findFirst({ where: { name: `Test Biz ${countryCode}` } });
      if (!biz) {
        biz = await prisma.business.create({
          data: {
            name: `Test Biz ${countryCode}`,
            ownerId: owner.id,
            countryId: country.id,
            countryCode: countryCode,
            currencyCode: currency.code,
            baseCurrencyId: currency.id,
            taxFrameworkId: framework.id
          }
        });
      }

      // Provision rules (this automatically removes manual overrides)
      await provisionTaxRules(biz.id, countryCode);
      
      let domesticCustomer = await prisma.customer.findFirst({ where: { businessId: biz.id, company: `Domestic Cust ${countryCode}` } });
      if (!domesticCustomer) {
        domesticCustomer = await prisma.customer.create({
          data: { businessId: biz.id, company: `Domestic Cust ${countryCode}`, country: countryCode, region: 'INDIA' }
        });
      }

      let foreignCustomer = await prisma.customer.findFirst({ where: { businessId: biz.id, company: `Foreign Cust ${countryCode}` } });
      if (!foreignCustomer) {
        foreignCustomer = await prisma.customer.create({
          data: { businessId: biz.id, company: `Foreign Cust ${countryCode}`, country: 'US', region: 'INDIA' } // Foreign country
        });
      }

      // 1. Priority/Routing cascade test
      if (hasReducedRate) {
        await runScenario(biz, domesticCustomer, 'Priority/Routing Cascade (Standard vs Reduced)', [
          { description: 'Standard Item', quantity: 1, price: 1000, taxPercent: expectedStandardRate },
          { description: 'Reduced Item', quantity: 1, price: 1000, taxPercent: expectedReducedRate }
        ]);
      } else {
        await runScenario(biz, domesticCustomer, 'Standard Domestic Sale', [
          { description: 'Standard Item', quantity: 1, price: 1000, taxPercent: expectedStandardRate }
        ]);
      }

      // 2. Cross-border case
      await runScenario(biz, foreignCustomer, 'Cross-border (Zero Rated)', [
         { description: 'Exported Goods', quantity: 1, price: 1000, taxPercent: 0 }
      ]);
      
      // 3. Statutory Report Generation
      console.log(`\nPulling Statutory Report for ${framework.name}...`);
      const reportCode = `${framework.name.toUpperCase().replace(/\s+/g, '_')}_GENERIC_RETURN`;
      const report = await generateReport(framework.name, reportCode, biz.id, {});
      
      console.log(`\n--- Statutory Report Output (${countryCode}) ---`);
      console.log(JSON.stringify(report, null, 2));
    }

    // 1. Oman (OM) - 5% Standard, no reduced
    await testCountry('OM', 5, null, false);
    
    // 2. Bahrain (BH) - 10% Standard, no reduced
    await testCountry('BH', 10, null, false);
    
    // 3. New Zealand (NZ) - 15% Standard, no reduced
    await testCountry('NZ', 15, null, false);
    
    // 4. Ireland (IE) - 23% Standard, 13.5% Reduced
    await testCountry('IE', 23, 13.5, true);
    
    // 5. France (FR) - 20% Standard, 10% Intermediate
    await testCountry('FR', 20, 10, true);

  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

testGroup1();
