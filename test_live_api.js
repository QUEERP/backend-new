const prisma = require('./src/config/prisma.js');
const businessSetupService = require('./src/services/BusinessSetupService.js');
const statutoryRegistry = require('./src/config/reports/statutoryRegistry.js');

async function testLiveApi() {
  const testUserId = 'ec2efe98-7674-4ec6-802d-43b493295a93'; // Some user id
  
  const testCountries = [
    { name: 'Live Test Canada Biz', input: 'Canada' },
    { name: 'Live Test India Biz', input: 'India' },
    { name: 'Live Test Germany Biz', input: 'Germany' }
  ];

  for (const tc of testCountries) {
    console.log(`\n--- Creating business: ${tc.name} with input: ${tc.input} ---`);
    const biz = await businessSetupService.setupNewBusiness(tc.name, tc.input, 'Services', testUserId);
    
    // Check tax rules
    const b = await prisma.business.findUnique({
      where: { id: biz.id },
      include: { taxRules: true, taxFramework: true }
    });
    console.log(`TaxRule rows count: ${b.taxRules.length}`);
    
    // Check statutory reports
    let reports = [];
    if (b.taxFramework) {
      reports = statutoryRegistry.getAvailableReports(b.taxFramework.name);
    }
    console.log(`Statutory Reports available: ${reports.length}`);
    if (reports.length > 0) {
      console.log(`  -> ${reports.map(r => r.name).join(', ')}`);
    } else {
      console.log(`  -> EMPTY`);
    }
  }
}

testLiveApi().finally(() => process.exit(0));
