const prisma = require('./src/config/prisma');
const { generateReport } = require('./src/config/reports/statutoryRegistry');

async function run() {
  try {
    const bizs = await prisma.business.findMany({
      where: { name: { startsWith: 'UAE Test E2E' } },
      orderBy: { createdAt: 'desc' }
    });
    
    let biz = null;
    let txCount = 0;
    for (const b of bizs) {
       txCount = await prisma.taxTransaction.count({ where: { businessId: b.id } });
       if (txCount > 0) {
          biz = b;
          break;
       }
    }
    
    if (!biz) {
      console.log('No UAE Test E2E business with transactions found.');
      return;
    }
    
    console.log(`Using business: "${biz.name}" (id: ${biz.id})`);
    console.log(`Tax transactions: ${txCount}\n`);

    const report = await generateReport('UAE VAT', 'UAE_VAT_RETURN', biz.id, {});
    console.log('=== UAE VAT Return (Form 201) ===');
    console.dir(report, { depth: null });
  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

run();
