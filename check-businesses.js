const prisma = require('./src/config/prisma');

async function check() {
  const missing = await prisma.business.findMany({
    where: { taxFrameworkId: null },
    include: { countryRef: true }
  });
  
  if (missing.length === 0) {
    console.log("PASS: All businesses have a taxFrameworkId.");
  } else {
    console.warn(`FAIL: Found ${missing.length} businesses without a taxFrameworkId.`);
    missing.forEach(b => console.log(`- Business ID: ${b.id}, Country: ${b.countryRef?.code || 'None'}`));
  }
  await prisma.$disconnect();
}
check();
