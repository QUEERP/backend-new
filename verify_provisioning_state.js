const prisma = require('./src/config/prisma');

async function run() {
  // Find Germany businesses using the actual relation name
  const deBiz = await prisma.business.findMany({
    where: { countryRef: { code: 'DE' } },
    include: {
      countryRef: true,
      taxRules: { select: { id: true, name: true, autoProvisioned: true, rate: true } }
    }
  });
  console.log('=== Germany businesses ===');
  console.log('Count:', deBiz.length);
  for (const b of deBiz) {
    console.log('  Business:', b.name, '| taxRules count:', b.taxRules.length);
    b.taxRules.forEach(r => console.log('    Rule:', r.name, 'rate:', r.rate, 'auto:', r.autoProvisioned));
  }

  // India businesses
  const inBiz = await prisma.business.findMany({
    where: { countryRef: { code: 'IN' } },
    include: {
      countryRef: true,
      taxRules: { select: { id: true, name: true, autoProvisioned: true, rate: true } }
    }
  });
  console.log('\n=== India businesses ===');
  console.log('Count:', inBiz.length);
  for (const b of inBiz) {
    console.log('  Business:', b.name, '| taxRules count:', b.taxRules.length);
  }

  // UAE businesses
  const uaeBiz = await prisma.business.findMany({
    where: { countryRef: { code: 'AE' } },
    include: {
      countryRef: true,
      taxRules: { select: { id: true } }
    }
  });
  console.log('\n=== UAE businesses ===');
  console.log('Count:', uaeBiz.length);
  uaeBiz.forEach(b => console.log('  ', b.name, '| taxRules:', b.taxRules.length));

  // 5 most recent businesses
  console.log('\n=== 5 most recently created businesses ===');
  const recent = await prisma.business.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      countryRef: { select: { code: true } },
      taxRules: { select: { id: true } }
    }
  });
  recent.forEach(b => console.log(
    ' ', b.name,
    '| country:', b.countryRef ? b.countryRef.code : b.countryCode,
    '| taxRules:', b.taxRules.length,
    '| created:', b.createdAt.toISOString()
  ));

  // Summary: all businesses with zero tax rules  
  const allBiz = await prisma.business.findMany({
    include: {
      taxRules: { select: { id: true } },
      countryRef: { select: { code: true } }
    }
  });
  const zeroRules = allBiz.filter(b => b.taxRules.length === 0);
  console.log('\n=== Summary ===');
  console.log('Total businesses:', allBiz.length, '| With zero TaxRules:', zeroRules.length);
  zeroRules.slice(0, 10).forEach(b => console.log(
    '  ', b.name, '| country:', b.countryRef ? b.countryRef.code : b.countryCode
  ));
}

run()
  .catch(e => { console.error('ERROR:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
