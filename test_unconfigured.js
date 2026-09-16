const businessSetupService = require('./src/services/BusinessSetupService.js');
const prisma = require('./src/config/prisma.js');
const statutoryRegistry = require('./src/config/reports/statutoryRegistry.js');

async function testUnconfigured() {
  const testUserId = 'ec2efe98-7674-4ec6-802d-43b493295a93'; 
  
  console.log(`\n--- Creating business: Live Test Brazil Biz with input: Brazil ---`);
  const biz = await businessSetupService.setupNewBusiness('Live Test Brazil Biz', 'Brazil', 'Services', testUserId);
  
  const b = await prisma.business.findUnique({
    where: { id: biz.id },
    include: { taxRules: true, taxFramework: true }
  });
  console.log(`TaxRule rows count: ${b.taxRules.length}`);
  
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

testUnconfigured().finally(() => process.exit(0));
