const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clean() {
  try {
    const res = await prisma.$executeRawUnsafe('DELETE FROM "TaxTransaction" WHERE "taxRateId" IS NULL');
    console.log('Deleted null taxRateId rows:', res);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

clean();
