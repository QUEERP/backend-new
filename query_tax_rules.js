const prisma = require('./src/config/prisma');

async function main() {
  const count = await prisma.taxRule.groupBy({by: ['businessId'], _count: {id: true}});
  console.log("TaxRule count by business:", count);

  const allRules = await prisma.taxRule.findMany({ select: { id: true, name: true, businessId: true, type: true } });
  console.log("All TaxRules:", allRules);
}

main().finally(() => prisma.$disconnect());
