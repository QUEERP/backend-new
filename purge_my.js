const prisma = require('./src/config/prisma');

async function purgeMY() {
  console.log('Querying for MY/Malaysia records...');
  
  // Find the framework
  const myFrameworks = await prisma.taxFramework.findMany({
    where: { name: { contains: 'Malaysia' } }
  });
  
  if (myFrameworks.length === 0) {
    console.log('Clean: No Malaysia TaxFrameworks found.');
  } else {
    for (const f of myFrameworks) {
      console.log('Found framework: ' + f.name + ' (ID: ' + f.id + ')');
      
      const types = await prisma.taxType.findMany({ where: { taxFrameworkId: f.id } });
      let deletedRates = 0;
      for (const t of types) {
         const dr = await prisma.taxRate.deleteMany({ where: { taxTypeId: t.id } });
         deletedRates += dr.count;
      }
      const deletedTypes = await prisma.taxType.deleteMany({ where: { taxFrameworkId: f.id } });
      const deletedFrameworks = await prisma.taxFramework.delete({ where: { id: f.id } });
      
      console.log('Deleted ' + deletedRates + ' TaxRates, ' + deletedTypes.count + ' TaxTypes, 1 TaxFramework.');
    }
  }

  const myRules = await prisma.taxRule.findMany({
    where: { name: { startsWith: 'MY ' } }
  });
  
  if (myRules.length === 0) {
    console.log('Clean: No Malaysia TaxRules found.');
  } else {
    console.log('Found ' + myRules.length + ' TaxRules for MY.');
    const deletedRules = await prisma.taxRule.deleteMany({
      where: { name: { startsWith: 'MY ' } }
    });
    console.log('Deleted ' + deletedRules.count + ' TaxRules.');
  }
}

purgeMY().catch(console.error).finally(() => prisma.$disconnect());
