const prisma = require('./src/config/prisma');

async function main() {
  const tr1 = await prisma.taxRule.findFirst({ where: { jurisdiction: { not: null } }, include: { business: true } });
  const tr2 = await prisma.taxRule.findFirst({ where: { taxCategory: { not: null } }, include: { business: true } });
  
  const txn = await prisma.taxTransaction.findFirst({
    where: { taxRateId: { in: [tr1?.id, tr2?.id].filter(Boolean) } },
    include: { taxRate: true }
  });
  
  console.log('--- Jurisdiction Rule ---');
  console.log(JSON.stringify(tr1, null, 2));
  console.log('--- TaxCategory Rule ---');
  console.log(JSON.stringify(tr2, null, 2));
  console.log('--- Txn matching more specific ---');
  console.log(JSON.stringify(txn, null, 2));
  
  const txnCurrency = await prisma.taxTransaction.findFirst({ 
    where: { transactionCurrencyId: { not: null } }
  });
  console.log('--- Txn with currency ---');
  console.log(JSON.stringify(txnCurrency, null, 2));
  
  const frameworks = await prisma.taxFramework.findMany();
  console.log('--- Frameworks ---');
  console.log(JSON.stringify(frameworks, null, 2));
  
  const bStats = await prisma.taxTransaction.groupBy({
    by: ['businessId'],
    _count: true
  });
  
  const businesses = await prisma.business.findMany({
    where: { id: { in: bStats.map(b => b.businessId) } }
  });
  
  console.log('--- Txns per business ---');
  for (const b of bStats) {
    const biz = businesses.find(x => x.id === b.businessId);
    console.log(`- ${biz.name} (${biz.countryCode}): ${b._count} txns`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
