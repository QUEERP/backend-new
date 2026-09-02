const fs = require('fs');
const prisma = require('./src/config/prisma');

async function run() {
  try {
    const rule = await prisma.taxRule.findFirst({include:{rates:true}});
    const tx = await prisma.taxTransaction.findFirst();
    const config = await prisma.taxFramework.findMany({include: {country: true, taxTypes: true}});
    
    fs.writeFileSync('dump.json', JSON.stringify({rule, tx, config}, null, 2));
    console.log("DUMP SUCCESS");
  } catch(e) {
    console.error(e);
  }
}
run().finally(() => process.exit());
