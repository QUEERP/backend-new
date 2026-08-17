const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const payments = await prisma.payment.findMany({
    where: { businessId: '62526be2-9817-462f-a392-74b0bd792006' }
  });
  console.log('Total payments:', payments.length);
}
main().catch(console.error).finally(() => prisma.$disconnect());
