const prisma = require('./src/config/prisma');
async function main() {
  const customers = await prisma.customer.findMany({
    select: { id: true, company: true, createdAt: true, isDeleted: true }
  });
  console.log('Customers:', customers);

  const credits = await prisma.creditNote.findMany({
    select: { id: true, createdAt: true, isDeleted: true }
  });
  console.log('Credit Notes:', credits);
}
main().catch(console.error).finally(() => prisma.$disconnect());
