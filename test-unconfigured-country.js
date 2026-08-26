const prisma = require('./src/config/prisma');
const TaxEngine = require('./src/services/taxEngine');

async function test() {
  const ts = Date.now();
  try {
    const usa = await prisma.country.upsert({ where: { code: 'US' }, update: {}, create: { code: 'US', name: 'United States' } });
    const usd = await prisma.currency.upsert({ where: { code: 'USD' }, update: {}, create: { code: 'USD', name: 'US Dollar', symbol: '$', decimalPrecision: 2 } });
    const owner = await prisma.user.findFirst();

    const business = await prisma.business.create({
      data: {
        name: `Unconfigured Business ${ts}`,
        countryId: usa.id,
        baseCurrencyId: usd.id,
        ownerId: owner.id,
      }
    });

    console.log("Business created with no TaxFramework");
    const result = await TaxEngine.calculateTax({
      businessId: business.id,
      lineSubtotal: 1000,
      taxPercent: 5 // Trying to apply 5% tax
    });
    console.log("Result:", result);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}
test();
