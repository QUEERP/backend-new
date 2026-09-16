const prisma = require('./src/config/prisma');
async function test() {
  const biz = await prisma.business.findFirst({ where: { countryCode: 'MX' } });
  const rates = await prisma.taxRate.findMany({ where: { taxRule: { businessId: biz.id } } });
  console.log('RATES:', rates);
}
test().finally(() => prisma.$disconnect());
