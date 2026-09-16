const prisma = require('./src/config/prisma');

async function run() {
  const t1 = await prisma.taxType.findMany({ where: { taxFramework: { name: 'US Sales Tax' } } });
  console.log('US TaxTypes:', t1.map(x => x.name));
  const t2 = await prisma.taxType.findMany({ where: { taxFramework: { name: 'Brazil ICMS' } } });
  console.log('BR TaxTypes:', t2.map(x => x.name));
}

run().catch(console.error).finally(() => prisma.$disconnect());
