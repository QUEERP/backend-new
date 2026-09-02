const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testUAE() {
  const business = await prisma.business.findFirst({ where: { countryCode: 'AE' }});
  if (!business) {
    console.log("No AE business found.");
    await prisma.$disconnect();
    return;
  }
  const rules = await prisma.taxRule.findMany({ where: { businessId: business.id }});
  console.log("Seeded Rules for AE:");
  rules.forEach(r => console.log(`  - ${r.name}`));
  await prisma.$disconnect();
}
testUAE();
