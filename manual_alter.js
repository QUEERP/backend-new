const prisma = require('./src/config/prisma');

async function main() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "TaxTransaction" ADD COLUMN "isManualOverride" BOOLEAN DEFAULT false;`);
    console.log('Added isManualOverride');
  } catch (e) { console.log(e.message); }

  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "TaxTransaction" ADD COLUMN "overriddenBy" TEXT;`);
    console.log('Added overriddenBy');
  } catch (e) { console.log(e.message); }

  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "TaxTransaction" ADD COLUMN "overriddenAt" TIMESTAMP(3);`);
    console.log('Added overriddenAt');
  } catch (e) { console.log(e.message); }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
