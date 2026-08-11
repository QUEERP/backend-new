const prisma = require('./src/config/prisma.js');

async function run() {
  const p = prisma.prisma || prisma.default || prisma;
  const deal = await p.deal.findFirst({ where: { name: 'JJ - Initial Deal' } });
  if (deal) {
    await p.deal.update({ where: { id: deal.id }, data: { stage: 'Won' } });
    console.log('Fixed deal');
  } else {
    console.log('Deal not found');
  }
}

run().finally(() => process.exit(0));
