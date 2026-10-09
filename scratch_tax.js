const prisma = require('./src/config/prisma.js');

async function main() {
  const rates = await prisma.taxRate.findMany();
  console.log(JSON.stringify(rates, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
