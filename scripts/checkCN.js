const prisma = require('../src/config/prisma');

async function checkCN() {
  const cn = await prisma.creditNote.findFirst({
    where: { creditNumber: 'CN-001' },
    include: { invoice: true }
  });
  console.log('CN-001 details:', JSON.stringify(cn, null, 2));
}

checkCN().catch(console.error).finally(() => prisma.$disconnect());
