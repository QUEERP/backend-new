const prisma = require('./src/config/prisma');
async function test() {
  const mxBiz = await prisma.business.findFirst({ where: { name: 'MX Test Biz' }, orderBy: { createdAt: 'desc' } });
  const txs = await prisma.taxTransaction.findMany({ where: { businessId: mxBiz.id } });
  console.log('TAX TRANSACTIONS:', txs);
}
test().finally(() => prisma.$disconnect());
