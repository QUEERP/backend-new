const prisma = require('./src/config/prisma');

async function run() {
  const stocks = await prisma.stock.findMany({ take: 3 });
  console.log(JSON.stringify(stocks, null, 2));
}

run().catch(console.error).finally(() => prisma.$disconnect());
