const prisma = require('./src/config/prisma');
async function check() { 
  const s = await prisma.stock.findMany({ where: { productId: '45129c19-1372-44d7-9e19-f36db4c68322' } }); 
  console.log(s); 
} 
check().finally(() => prisma.$disconnect());
