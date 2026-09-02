const prisma = require('./src/config/prisma');

async function main() {
  console.log('\n======================================================================');
  console.log(' DETAILED INVENTORY: India CGST/SGST Duplicate TaxTypes & TaxRates');
  console.log('======================================================================');

  const inFw = await prisma.taxFramework.findFirst({ where: { name: 'India GST' } });
  
  if (inFw) {
    for (const typeName of ['CGST', 'SGST']) {
      const types = await prisma.taxType.findMany({
        where: { taxFrameworkId: inFw.id, name: typeName },
        orderBy: { id: 'asc' }
      });
      
      if (types.length <= 1) {
        console.log(`\n✅ ${typeName} has ${types.length} rows. No duplicates.`);
        continue;
      }
      
      console.log(`\n[${typeName}] Found ${types.length} TaxType rows in total.`);
      
      // Let's get rates for all of them to compare
      for (let i = 0; i < types.length; i++) {
        const typeRow = types[i];
        const isKeeper = i === 0;
        console.log(`\n--- TaxType: ${typeRow.id} (${isKeeper ? 'KEEPER' : 'DUPLICATE'}) ---`);
        
        const rates = await prisma.taxRate.findMany({
          where: { taxTypeId: typeRow.id },
          orderBy: { effectiveFrom: 'asc' },
          select: { id: true, name: true, rate: true, effectiveFrom: true, taxRuleId: true }
        });
        
        if (rates.length === 0) {
          console.log(`  (No TaxRate rows attached)`);
        } else {
          console.table(rates.map(r => ({
            id: r.id,
            name: r.name,
            rate: r.rate,
            effectiveFrom: r.effectiveFrom ? r.effectiveFrom.toISOString().split('T')[0] : 'null',
            taxRuleId: r.taxRuleId
          })));
        }
      }
    }
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
