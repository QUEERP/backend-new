const prisma = require('./src/config/prisma');

async function check() {
  try {
    const res = await prisma.$queryRawUnsafe('SELECT * FROM "TaxTransaction" WHERE id = \'6525449f-31fc-4457-bf14-c03e69447278\'');
    console.log('Dev Priya Record:', JSON.stringify(res, null, 2));
    
    // Also let's query a null record if it exists
    const res2 = await prisma.$queryRawUnsafe('SELECT id, "taxRateId", "overrideRate" FROM "TaxTransaction" WHERE "taxRateId" IS NULL');
    console.log('Null taxRateId records:', JSON.stringify(res2, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

check();
