const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const b = await prisma.business.findMany({ where: { name: { contains: 'India' } } });
  console.log("Businesses:", b.map(x=>x.name));
  if (b.length > 0) {
     const t = await prisma.taxTransaction.findMany({ where: { businessId: b[0].id } });
     console.log('Taxes in', b[0].name, ':', t.length);
  }
}
main();
