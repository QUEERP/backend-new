const prisma = require('./src/config/prisma');

async function checkMatch(typeName, typeRows) {
  if (typeRows.length <= 1) return;
  
  const keeper = typeRows[0];
  const duplicates = typeRows.slice(1);
  console.log(`\n--- Checking ${typeName} (1 Keeper, ${duplicates.length} Duplicates) ---`);
  
  // For TaxTypes, they just have a name and taxFrameworkId. If they are in the same array, they match on those.
  // We need to check their underlying TaxRates. 
  // Wait, the duplicate TaxTypes might have different TaxRates attached!
  const keeperRates = await prisma.taxRate.findMany({ where: { taxTypeId: keeper.id }, orderBy: { rate: 'asc' } });
  
  for (const dup of duplicates) {
    const dupRates = await prisma.taxRate.findMany({ where: { taxTypeId: dup.id }, orderBy: { rate: 'asc' } });
    
    // Check if the rates attached to this duplicate TaxType match the keeper's rates
    let matches = true;
    let mismatchReason = '';
    
    if (keeperRates.length === 0 && dupRates.length === 0) {
      matches = true;
    } else {
      for (const dr of dupRates) {
        // Find if this duplicate rate is identical in value/dates to ANY keeper rate
        const identicalInKeeper = keeperRates.find(kr => 
          kr.name === dr.name && 
          kr.rate === dr.rate && 
          new Date(kr.effectiveFrom).getTime() === new Date(dr.effectiveFrom).getTime() &&
          (kr.effectiveTo ? new Date(kr.effectiveTo).getTime() : null) === (dr.effectiveTo ? new Date(dr.effectiveTo).getTime() : null)
        );
        if (!identicalInKeeper) {
          matches = false;
          mismatchReason = `Duplicate TaxType ${dup.id} has rate '${dr.name}' (${dr.rate}%) from ${dr.effectiveFrom} which doesn't exist on Keeper TaxType.`;
          break;
        }
      }
    }
    
    if (matches) {
      console.log(`✅ Duplicate TaxType ${dup.id} matches Keeper (Rates are identical or it has no unique rates)`);
    } else {
      console.log(`❌ MISMATCH on TaxType ${dup.id}: ${mismatchReason}`);
    }
  }
}

async function main() {
  console.log('======================================================================');
  console.log(' 1. MATCH-VERIFICATION: India CGST/SGST Duplicate TaxTypes');
  console.log('======================================================================');

  const inFw = await prisma.taxFramework.findFirst({ where: { name: 'India GST' } });
  if (inFw) {
    for (const typeName of ['CGST', 'SGST']) {
      const types = await prisma.taxType.findMany({
        where: { taxFrameworkId: inFw.id, name: typeName },
        orderBy: { id: 'asc' }
      });
      await checkMatch(typeName, types);
    }
  }

  console.log('\n======================================================================');
  console.log(' 2. MATCH-VERIFICATION: UAE VAT Duplicate TaxRates');
  console.log('======================================================================');
  
  const uaeFw = await prisma.taxFramework.findFirst({ where: { name: 'UAE VAT' } });
  if (uaeFw) {
    const uaeTypes = await prisma.taxType.findMany({ where: { taxFrameworkId: uaeFw.id, name: 'VAT_STANDARD' } });
    if (uaeTypes.length === 1) {
      const standardType = uaeTypes[0];
      const rates = await prisma.taxRate.findMany({
        where: { taxTypeId: standardType.id },
        orderBy: { id: 'asc' }
      });
      
      if (rates.length > 1) {
        const keeper = rates[0];
        const duplicates = rates.slice(1);
        console.log(`\n--- Checking VAT_STANDARD TaxRates (1 Keeper, ${duplicates.length} Duplicates) ---`);
        
        for (const dr of duplicates) {
          const matches = (
            keeper.name === dr.name &&
            keeper.rate === dr.rate &&
            new Date(keeper.effectiveFrom).getTime() === new Date(dr.effectiveFrom).getTime() &&
            (keeper.effectiveTo ? new Date(keeper.effectiveTo).getTime() : null) === (dr.effectiveTo ? new Date(dr.effectiveTo).getTime() : null)
          );
          
          if (matches) {
            console.log(`✅ Duplicate TaxRate ${dr.id} matches Keeper identically (${dr.rate}%, ${dr.effectiveFrom})`);
          } else {
            console.log(`❌ MISMATCH on TaxRate ${dr.id}: Rate ${dr.rate}% vs ${keeper.rate}%, Date ${dr.effectiveFrom} vs ${keeper.effectiveFrom}`);
          }
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
