const prisma = require('./src/config/prisma');

async function main() {
  console.log('Starting seed for dry run...');

  // 1. Create Currencies
  const currenciesData = [
    { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', decimals: 2 },
    { code: 'CAD', name: 'Canadian Dollar', symbol: '$', decimals: 2 },
    { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimals: 2 }
  ];

  for (const c of currenciesData) {
    await prisma.currency.upsert({
      where: { code: c.code },
      update: {},
      create: c
    });
  }
  
  const aed = await prisma.currency.findUnique({ where: { code: 'AED' } });
  const cad = await prisma.currency.findUnique({ where: { code: 'CAD' } });
  const inr = await prisma.currency.findUnique({ where: { code: 'INR' } });

  // 2. Assign baseCurrencyId to all businesses
  const businesses = await prisma.business.findMany();
  for (const b of businesses) {
    await prisma.business.update({
      where: { id: b.id },
      data: { baseCurrencyId: aed.id }
    });
  }
  console.log(`Assigned baseCurrencyId (AED) to ${businesses.length} businesses.`);

  // 3. Create historical exchange rates
  // We need an exchange rate for CAD to AED covering Feb 2026 and Aug 2026.
  // We'll create one effective from Jan 1, 2026.
  await prisma.exchangeRate.create({
    data: {
      fromCurrencyId: cad.id,
      toCurrencyId: aed.id,
      rate: 2.75, // 1 CAD = 2.75 AED
      effectiveDate: new Date('2026-01-01T00:00:00Z'),
      source: 'TEST_SEED',
      rateType: 'COMMERCIAL'
    }
  });
  console.log('Created historical exchange rate CAD to AED.');

  // Also to test the NO_HISTORICAL_RATE_FOUND, let's create a dummy invoice with INR currency
  // (Assuming there is no INR to AED rate created)
  if (businesses.length > 0) {
    const businessId = businesses[0].id;
    // We need a customer for the invoice
    const customer = await prisma.customer.findFirst({ where: { businessId }});
    if (customer) {
      await prisma.invoice.create({
        data: {
          businessId,
          customerId: customer.id,
          invoiceNumber: `TEST-INV-${Date.now()}`,
          invoiceDate: new Date('2026-08-20T00:00:00Z'),
          currency: 'INR',
          grandTotal: 1000,
          cgst: 90,
          sgst: 90
        }
      });
      console.log('Created a dummy invoice in INR to test missing rate scenario.');
    }
    
    // Create one invoice with AED to test same currency scenario
    if (customer) {
      await prisma.invoice.create({
        data: {
          businessId,
          customerId: customer.id,
          invoiceNumber: `TEST-INV-AED-${Date.now()}`,
          invoiceDate: new Date('2026-08-20T00:00:00Z'),
          currency: 'AED',
          grandTotal: 500,
          vatAmount: 25
        }
      });
      console.log('Created a dummy invoice in AED to test same currency scenario.');
    }
  }

  await prisma.$disconnect();
  console.log('Seeding complete.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
