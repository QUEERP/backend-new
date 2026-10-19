const prisma = require('../src/config/prisma');

async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "exchange_rates" ADD COLUMN IF NOT EXISTS "fetchedAt" TIMESTAMP DEFAULT NOW()`);
  console.log("Successfully ensured fetchedAt column in exchange_rates");

  // Also verify CAD exists in Currency table so CAD and AED resolve correctly
  const inr = await prisma.currency.findUnique({ where: { code: 'INR' } });
  if (inr) {
    const cad = await prisma.currency.findUnique({ where: { code: 'CAD' } });
    if (!cad) {
      await prisma.currency.create({
        data: {
          code: 'CAD',
          name: 'Canadian Dollar',
          symbol: 'C$',
          decimals: 2,
          decimalPrecision: 2
        }
      });
      console.log("Successfully ensured CAD currency exists in currency table");
    }
    const aed = await prisma.currency.findUnique({ where: { code: 'AED' } });
    if (!aed) {
      await prisma.currency.create({
        data: {
          code: 'AED',
          name: 'UAE Dirham',
          symbol: 'AED',
          decimals: 2,
          decimalPrecision: 2
        }
      });
      console.log("Successfully ensured AED currency exists in currency table");
    }
  }
}

main()
  .catch((err) => {
    console.error("Migration script error:", err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
