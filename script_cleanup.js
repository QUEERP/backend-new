const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const rule = await prisma.taxRule.findUnique({ where: { id: '4f2bcf5c-edc7-4bc4-9783-48c0626b44af' } });
  console.log('--- TaxRule Case 7 ---');
  console.log(rule);

  const devPriya = await prisma.business.findUnique({ where: { id: '6525449f-31fc-4457-bf14-c03e69447278' } });
  console.log('\n--- Dev Priya Business ---');
  console.log(devPriya);

  const businesses = await prisma.business.findMany({
    where: { name: 'UAE Test Business' }
  });
  console.log('\n--- Orphaned Businesses to delete ---', businesses.length);
  for (const b of businesses) {
    // Delete in correct order to avoid FK errors
    await prisma.taxTransaction.deleteMany({ where: { businessId: b.id } });
    await prisma.debitNote.deleteMany({ where: { businessId: b.id } });
    await prisma.bill.deleteMany({ where: { businessId: b.id } });
    await prisma.account.deleteMany({ where: { businessId: b.id } });
    await prisma.taxRule.deleteMany({ where: { businessId: b.id } });
    await prisma.transactionCurrency.deleteMany({ where: { businessId: b.id } });
    await prisma.baseCurrency.deleteMany({ where: { businessId: b.id } });
    await prisma.business.delete({ where: { id: b.id } });
  }
  console.log('Cleanup done!');
}
run().finally(() => prisma.$disconnect());
