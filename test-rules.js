require('dotenv').config();
const prisma = require('./src/config/prisma');

async function main() {
  const rules = await prisma.taxRule.findMany();
  console.log('Total rules in DB:', rules.length);
  if (rules.length > 0) {
    console.log('Sample rules:');
    rules.forEach(r => console.log(`- ${r.name} | PoS: ${r.placeOfSupply} | Jur: ${r.jurisdiction} | Cat: ${r.supplyCategory}`));
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
