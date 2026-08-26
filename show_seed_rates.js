require('dotenv').config();
const prisma = require('./src/config/prisma');

async function run() {
  // Show all German TaxType rates from seed data
  const deFw = await prisma.taxFramework.findFirst({
    where: { name: 'Deutschland MwSt' },
    include: { taxTypes: { include: { rates: { orderBy: { effectiveFrom: 'asc' } } } } }
  });

  console.log('\n=== Deutschland MwSt — all seeded TaxRate rows ===\n');
  for (const tt of deFw.taxTypes) {
    console.log(`TaxType: ${tt.name}`);
    for (const r of tt.rates) {
      console.log(`  ${r.name.padEnd(45)} ${String(r.rate).padStart(5)}%  ${r.effectiveFrom.toISOString().slice(0,10)} → ${r.effectiveTo ? r.effectiveTo.toISOString().slice(0,10) : 'now (no end)'}`);
    }
  }

  // Also show India and UAE for completeness
  for (const fwName of ['India GST', 'UAE VAT']) {
    const fw = await prisma.taxFramework.findFirst({
      where: { name: fwName },
      include: { taxTypes: { include: { rates: { orderBy: { effectiveFrom: 'asc' } } } } }
    });
    if (!fw) { console.log(`\n${fwName}: NOT FOUND`); continue; }
    console.log(`\n=== ${fwName} — all seeded TaxRate rows ===\n`);
    for (const tt of fw.taxTypes) {
      console.log(`TaxType: ${tt.name}`);
      for (const r of tt.rates) {
        console.log(`  ${r.name.padEnd(45)} ${String(r.rate).padStart(5)}%  ${r.effectiveFrom.toISOString().slice(0,10)} → ${r.effectiveTo ? r.effectiveTo.toISOString().slice(0,10) : 'now (no end)'}`);
      }
    }
  }

  await prisma.$disconnect();
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
