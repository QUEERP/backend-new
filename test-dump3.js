const fs = require('fs');
const prisma = require('./src/config/prisma');

async function run() {
  try {
    const rule = await prisma.taxRule.findFirst({include:{rates:true}});
    const tx = await prisma.taxTransaction.findFirst();
    const config = await prisma.taxFramework.findMany();
    const country = await prisma.country.findFirst();
    
    fs.writeFileSync('dump.json', JSON.stringify({rule, tx, config, country}, null, 2));
    console.log("DUMP SUCCESS");
  } catch(e) {
    console.error(e);
  }
}
run().finally(() => process.exit());
