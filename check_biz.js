const prisma = require('./src/config/prisma.js');
const statutoryRegistry = require('./src/config/reports/statutoryRegistry.js');

async function main() {
  const bizId = '76344522-773b-4b85-8dcc-97511f732dbc';
  
  const business = await prisma.business.findUnique({
    where: { id: bizId },
    include: { taxFramework: true }
  });

  const frameworkName = business.taxFramework.name;
  const availableReports = statutoryRegistry.getAvailableReports(frameworkName);

  console.log(JSON.stringify({
    success: true,
    framework: frameworkName,
    availableReports
  }, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
