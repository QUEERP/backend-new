const prisma = require('../src/config/prisma');

async function checkRates() {
  const rates = await prisma.exchangeRate.findMany({
    include: {
      fromCurrency: true,
      toCurrency: true
    },
    orderBy: { effectiveDate: 'desc' }
  });
  console.log('All exchange rates in DB:', JSON.stringify(rates, null, 2));
}

checkRates().catch(console.error).finally(() => prisma.$disconnect());
