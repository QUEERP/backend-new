const prisma = require('./src/config/prisma');

async function check() {
  try {
    const res = await prisma.$queryRawUnsafe('SELECT column_name FROM information_schema.columns WHERE table_name = \'TaxTransaction\'');
    console.log('Columns:', res.map(r => r.column_name));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

check();
