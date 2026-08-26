const { PrismaClient } = require('@prisma/client');
const statutoryRegistry = require('./src/config/reports/statutoryRegistry');

const prisma = new PrismaClient();

async function testGSTR1() {
  try {
    const business = await prisma.business.findFirst({
      where: { name: { contains: 'India' } },
      include: { taxFramework: true }
    });

    if (!business) {
      console.log('India staging business not found.');
      return;
    }

    console.log(`Using Business: ${business.name} (ID: ${business.id})`);
    console.log(`Tax Framework: ${business.taxFramework?.name}`);

    // Mock query params, you can leave empty to test default behavior (like all time)
    const filters = {}; 

    // Generate the report directly through the registry
    const reportData = await statutoryRegistry.generateReport(
      business.taxFramework.name, 
      'GSTR1', 
      business.id, 
      filters
    );

    console.log('\n--- GSTR1 Report Data ---');
    console.log(JSON.stringify(reportData, null, 2));

  } catch (err) {
    console.error('Error testing GSTR1:', err);
  } finally {
    await prisma.$disconnect();
  }
}

testGSTR1();
