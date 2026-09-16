const prisma = require('./src/config/prisma');
const { provisionTaxRules } = require('./src/services/taxProvisioning.service');
const InvoiceService = require('./src/services/sales/invoice.service');
const { generateReport } = require('./src/config/reports/statutoryRegistry');
const TaxEngine = require('./src/services/taxEngine');
const { CurrencyService } = require('./src/services/currencyService');

async function testBatch1() {
  try {
    console.log("=== BATCH 1 E2E VERIFICATION ===\n");

    const owner = await prisma.user.findFirst();
    if (!owner) throw new Error("No user found.");

    async function testCountry(countryCode, stateCode, expectedTaxPercent, taxRuleJurisdiction, expectFailure) {
      console.log(`\n--- Testing ${countryCode} (State: ${stateCode || 'N/A'}) ---`);
      
      const country = await prisma.country.findUnique({ where: { code: countryCode } });
      const currency = await prisma.currency.findFirst({ where: { code: (countryCode === 'US' ? 'USD' : countryCode === 'BR' ? 'BRL' : countryCode === 'JP' ? 'JPY' : 'EUR') } });
      const framework = await prisma.taxFramework.findUnique({ where: { countryId: country.id } });

      let biz = await prisma.business.findFirst({ where: { name: `Test Biz ${countryCode} ${stateCode || ''}` } });
      if (!biz) {
        biz = await prisma.business.create({
          data: {
            name: `Test Biz ${countryCode} ${stateCode || ''}`,
            ownerId: owner.id,
            countryId: country.id,
            countryCode: countryCode,
            currencyCode: currency.code,
            baseCurrencyId: currency.id,
            taxFrameworkId: framework.id,
            state: stateCode
          }
        });
      }

      await provisionTaxRules(biz.id, countryCode);
      let customer = await prisma.customer.findFirst({ where: { businessId: biz.id } });
      if (!customer) {
        customer = await prisma.customer.create({
          data: { businessId: biz.id, company: `Test Cust ${countryCode}`, state: stateCode, region: 'INDIA' }
        });
      } else {
        await prisma.customer.update({ where: { id: customer.id }, data: { state: stateCode, region: 'INDIA' } });
      }

      console.log(`Creating invoice for ${biz.name} with ${expectedTaxPercent}% tax...`);
      try {
        const invoice = await InvoiceService.createInvoice(biz.id, owner.id, owner.email, {
          customerId: customer.id,
          invoiceDate: new Date(),
          dueDate: new Date(),
          currency: currency.code,
          items: [
            { description: 'Service', quantity: 1, price: 1000, taxPercent: expectedTaxPercent }
          ]
        });

        if (expectFailure) {
          console.error(`❌ Expected failure for ${biz.name} but succeeded!`);
          return;
        }

        console.log(`✅ Invoice ${invoice.invoiceNumber} created successfully.`);
        console.log(`   Subtotal: ${invoice.subtotal}`);
        console.log(`   Total Tax: ${invoice.totalTax}`);
        console.log(`   Grand Total: ${invoice.grandTotal}`);
        
        console.log(`Pulling Statutory Report for ${framework.name}...`);
        const reportCode = `${framework.name.toUpperCase().replace(/\s+/g, '_')}_GENERIC_RETURN`;
        const report = await generateReport(framework.name, reportCode, biz.id, {});
        
        console.log(`Statutory Report Output:`);
        console.log(JSON.stringify(report, null, 2));
      } catch (err) {
        if (expectFailure) {
           console.log(`✅ Expected failure occurred: ${err.message}`);
        } else {
           console.error(`❌ Unexpected failure: ${err.message}`);
        }
      }
    }

    // 1. US - Unconfigured State (TX)
    await testCountry('US', 'TX', 7.25, null, true);

    // 2. US - Configured State (CA)
    await testCountry('US', 'CA', 7.25, 'CA', false);

    // 3. Brazil - ICMS Warning Test
    await testCountry('BR', 'SP', 18, null, false);

    // 4. Japan
    await testCountry('JP', null, 10, null, false);

    // 5. France
    await testCountry('FR', null, 20, null, false);

  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

testBatch1();
