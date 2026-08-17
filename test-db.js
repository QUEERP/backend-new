const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const p = await prisma.payment.findMany({
      where: { businessId: 'e24ee048-2039-4c2e-a1c9-24bf7b2f943e' },
      include: {
        customer: true
      }
    });
    console.log("Count:", p.length);
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}
test();
