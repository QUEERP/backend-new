const prisma = require('./src/config/prisma');

async function main() {
  console.log('\n======================================================================');
  console.log(' SAFETY CHECK: India CGST/SGST Duplicate TaxTypes');
  console.log('======================================================================');

  const inFw = await prisma.taxFramework.findFirst({ where: { name: 'India GST' } });
  
  if (inFw) {
    for (const typeName of ['CGST', 'SGST', 'IGST']) {
      const types = await prisma.taxType.findMany({
        where: { taxFrameworkId: inFw.id, name: typeName },
        orderBy: { id: 'asc' }
      });
      
      if (types.length <= 1) {
        console.log(`\n✅ ${typeName} has ${types.length} rows. No duplicates to remove.`);
        continue;
      }
      
      const keeper = types[0];
      const duplicates = types.slice(1);
      
      console.log(`\n[${typeName}] Found ${types.length} rows.`);
      console.log(`  -> KEEPER (first): ID ${keeper.id}`);
      console.log(`  -> TO DELETE: ${duplicates.length} duplicate rows`);
      
      // Check references to duplicates
      const dupIds = duplicates.map(d => d.id);
      
      const ratesCount = await prisma.taxRate.count({ where: { taxTypeId: { in: dupIds } } });
      if (ratesCount > 0) {
        console.log(`  ⚠️ WARNING: There are ${ratesCount} TaxRate rows linked to the duplicate ${typeName} TaxTypes!`);
        // If there are rates linked to duplicates, we might need to migrate them to the keeper or delete them if they are also duplicates.
        const linkedRates = await prisma.taxRate.findMany({ where: { taxTypeId: { in: dupIds } } });
        console.table(linkedRates);
      } else {
        console.log(`  ✅ Safe: 0 TaxRate rows linked to duplicate ${typeName} TaxTypes.`);
      }
    }
  }

  console.log('\n======================================================================');
  console.log(' SAFETY CHECK: UAE VAT Duplicate TaxRates');
  console.log('======================================================================');
  
  const uaeFw = await prisma.taxFramework.findFirst({ where: { name: 'UAE VAT' } });
  
  if (uaeFw) {
    const uaeTypes = await prisma.taxType.findMany({
      where: { taxFrameworkId: uaeFw.id, name: 'VAT_STANDARD' }
    });
    
    if (uaeTypes.length === 1) {
      const standardType = uaeTypes[0];
      const rates = await prisma.taxRate.findMany({
        where: { taxTypeId: standardType.id },
        orderBy: { id: 'asc' }
      });
      
      if (rates.length <= 1) {
        console.log(`\n✅ VAT_STANDARD has ${rates.length} TaxRate rows. No duplicates to remove.`);
      } else {
        const keeper = rates[0];
        const duplicates = rates.slice(1);
        
        console.log(`\n[VAT_STANDARD TaxRates] Found ${rates.length} rate rows.`);
        console.log(`  -> KEEPER (first): ID ${keeper.id}`);
        console.log(`  -> TO DELETE: ${duplicates.length} duplicate rows`);
        
        // Check references to duplicate rates
        const dupRateIds = duplicates.map(d => d.id);
        
        // Since taxRuleId is on TaxRate, wait, TaxRule has many TaxRates (1-to-M). 
        // We need to check if any TaxTransaction points to these duplicate rates, but wait, TaxTransaction doesn't have taxRateId.
        // Wait, TaxTransaction has `taxRuleId`? No, TaxTransaction has `businessId`, `transactionId`.
        // Let's check where taxRateId is used. InvoiceItem has no taxRateId.
        // TaxRate is linked to TaxRule via `taxRuleId` on TaxRate.
        // If the duplicate TaxRate has `taxRuleId` NOT NULL, it means some business's TaxRule is using it!
        const usedDuplicates = duplicates.filter(d => d.taxRuleId !== null);
        
        if (usedDuplicates.length > 0) {
          console.log(`  ⚠️ WARNING: ${usedDuplicates.length} duplicate TaxRate rows are actively linked to a TaxRule!`);
          console.table(usedDuplicates.map(d => ({ id: d.id, taxRuleId: d.taxRuleId })));
        } else {
          console.log(`  ✅ Safe: 0 duplicate TaxRate rows are linked to any TaxRule.`);
        }
      }
    } else {
      console.log(`\n⚠️ UAE VAT has ${uaeTypes.length} VAT_STANDARD TaxType rows. Needs TaxType dedup too!`);
    }
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
