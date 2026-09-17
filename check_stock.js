const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkStock() {
  const stock = await prisma.stock.findMany({
    where: { productId: '45129c19-1372-44d7-9e19-f36db4c68322' }
  });
  console.log(JSON.stringify(stock, null, 2));
}

checkStock().catch(console.error).finally(() => prisma.$disconnect());
