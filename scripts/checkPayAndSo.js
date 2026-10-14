const prisma = require('../src/config/prisma');

async function main() {
  const bizId = 'dc70ca38-b141-477d-a379-f02649117a78';
  const p2 = await prisma.payment.findFirst({
    where: { paymentNumber: 'PAY-002', businessId: bizId },
    include: { paymentAllocations: true }
  });
  console.log('PAY-002 for target biz:', p2);

  const p3 = await prisma.payment.findFirst({
    where: { paymentNumber: 'PAY-003', businessId: bizId },
    include: { paymentAllocations: true }
  });
  console.log('PAY-003 for target biz:', p3);

  const so = await prisma.salesOrder.findFirst({
    where: { orderNumber: 'SO-002', businessId: bizId },
    include: { items: true }
  });
  console.log('SO-002:', so);

  await prisma.$disconnect();
}

main().catch(console.error);
