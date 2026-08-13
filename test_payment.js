const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const payments = await prisma.payment.findMany({
    where: { amount: 6200 },
    include: {
      quotation: {
        include: { projects: true }
      },
      project: true
    }
  });

  console.log(JSON.stringify(payments, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
