require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const res1 = await prisma.$queryRawUnsafe('SELECT count(*) FROM "TaxRate"');
    console.log('TaxRate count:', res1);
    const res2 = await prisma.$queryRawUnsafe('SELECT count(*) FROM "tax_rates"');
    console.log('tax_rates count:', res2);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

check();
