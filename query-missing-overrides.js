const prisma = require('./src/config/prisma');
async function run() {
  const txs = await prisma.taxTransaction.findMany({
    where: { isManualOverride: true, overriddenBy: null },
    select: { id: true, transactionId: true, transactionType: true, overrideReason: true, createdAt: true }
  });
  console.log(JSON.stringify(txs, null, 2));
  await prisma.$disconnect();
}
run().catch(console.error);
