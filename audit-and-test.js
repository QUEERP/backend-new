const prisma = require('./src/config/prisma');
const BusinessSetupService = require('./src/services/BusinessSetupService');
const statutoryRegistry = require('./src/config/reports/statutoryRegistry');
const { countriesData } = require('./src/utils/countryHelper');
const { PROVISIONING_MANIFESTS } = require('./src/services/taxProvisioning.service');

async function auditAndTest() {
  try {
    console.log("=== AUDIT: SELECTABLE VS CONFIGURED COUNTRIES ===");
    const allCountryCodes = countriesData.map(c => c.cca2);
    const configuredCodes = Object.keys(PROVISIONING_MANIFESTS);
    
    const unconfiguredCountries = allCountryCodes.filter(c => !configuredCodes.includes(c));
    console.log(`Total Selectable Countries: ${allCountryCodes.length}`);
    console.log(`Configured Countries: ${configuredCodes.length} (${configuredCodes.join(', ')})`);
    console.log(`Unconfigured Countries: ${unconfiguredCountries.length}`);
    
    // Just list the first 10 unconfigured to show the user, then mention there are more
    console.log(`Sample Unconfigured: ${unconfiguredCountries.slice(0, 10).join(', ')} ...and ${unconfiguredCountries.length - 10} more`);


    console.log("\n=== END-TO-END TEST: DE, GB, CA ===");
    
    // We need a user to own the businesses
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({ data: { name: 'Test User', email: 'test_user_audit@example.com', password: 'password123' } });
    }

    const testCountries = ['DE', 'GB', 'CA'];
    
    for (const cca2 of testCountries) {
      console.log(`\n--- Testing Business Creation for ${cca2} ---`);
      
      // 1. Create Business
      const bizName = `Test Biz ${cca2} ${Date.now()}`;
      const business = await BusinessSetupService.setupNewBusiness(bizName, cca2, 'Trading', user.id);
      console.log(`Created Business: ${business.name} (ID: ${business.id})`);
      
      // Check if TaxFramework was linked
      const bizWithFw = await prisma.business.findUnique({
        where: { id: business.id },
        include: { taxFramework: true }
      });
      const fwName = bizWithFw.taxFramework ? bizWithFw.taxFramework.name : 'NONE';
      console.log(`Linked TaxFramework: ${fwName}`);
      
      // Check TaxRules provisioned
      const rules = await prisma.taxRule.findMany({ where: { businessId: business.id } });
      console.log(`Provisioned Tax Rules count: ${rules.length}`);

      // 2. Test Statutory Reports
      const reportsList = statutoryRegistry.getAvailableReports(fwName);
      console.log(`Statutory Reports available: ${reportsList.map(r => r.name).join(', ') || 'None'}`);
      
      if (reportsList.length > 0) {
        const report = await statutoryRegistry.generateReport(fwName, reportsList[0].code, business.id, {});
        console.log(`Statutory Report (${reportsList[0].code}) generated successfully with ${report.sections.length} sections.`);
      }

      // 3. Test Tax Reports
      const taxTxns = await prisma.taxTransaction.findMany({ where: { businessId: business.id } });
      console.log(`Tax Report Data: ${taxTxns.length} transactions found.`);

      // 4. Test Currency Reports
      const invoices = await prisma.invoice.findMany({ where: { businessId: business.id }, include: { transactionCurrency: true } });
      const bills = await prisma.bill.findMany({ where: { businessId: business.id }, include: { transactionCurrency: true } });
      const currencyMap = {};
      [...invoices, ...bills].forEach(doc => {
        if (doc.transactionCurrency) {
          currencyMap[doc.transactionCurrency.code] = doc.exchangeRate || 1;
        }
      });
      console.log(`Currency Report Data: ${JSON.stringify(currencyMap)}`);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

auditAndTest();
