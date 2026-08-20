const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting Phase 2 Backfill...');

  // 1. Seed Countries and Currencies
  const india = await prisma.country.upsert({
    where: { code: 'IN' },
    update: {},
    create: { code: 'IN', name: 'India' },
  });

  const uae = await prisma.country.upsert({
    where: { code: 'AE' },
    update: {},
    create: { code: 'AE', name: 'United Arab Emirates' },
  });

  const inr = await prisma.currency.upsert({
    where: { code: 'INR' },
    update: {},
    create: { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimals: 2 },
  });

  const aed = await prisma.currency.upsert({
    where: { code: 'AED' },
    update: {},
    create: { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', decimals: 2 },
  });
  
  const usd = await prisma.currency.upsert({
    where: { code: 'USD' },
    update: {},
    create: { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2 },
  });

  // 2. Seed Tax Frameworks
  const indiaGst = await prisma.taxFramework.upsert({
    where: { countryId: india.id },
    update: {},
    create: { countryId: india.id, name: 'India GST' },
  });

  const uaeVat = await prisma.taxFramework.upsert({
    where: { countryId: uae.id },
    update: {},
    create: { countryId: uae.id, name: 'UAE VAT' },
  });

  // 3. Update Businesses
  console.log('Mapping Businesses...');
  const businesses = await prisma.business.findMany();
  for (const b of businesses) {
    if (b.country === 'INDIA' && !b.countryId) {
      await prisma.business.update({
        where: { id: b.id },
        data: {
          countryId: india.id,
          baseCurrencyId: inr.id,
          taxFrameworkId: indiaGst.id
        }
      });
    } else if (b.country === 'UAE' && !b.countryId) {
      await prisma.business.update({
        where: { id: b.id },
        data: {
          countryId: uae.id,
          baseCurrencyId: aed.id,
          taxFrameworkId: uaeVat.id
        }
      });
    }
  }

  // 4. Transaction Backfill Logic (Invoices as example)
  // Full script will iterate over all models (SalesOrder, Bill, Payment, etc.)
  console.log('Backfilling Invoices...');
  const invoices = await prisma.invoice.findMany({
    where: { baseCurrencyAmount: null }
  });
  
  for (const inv of invoices) {
    const rate = inv.exchangeRate || 1.0;
    const baseAmt = inv.grandTotal * rate;
    let currencyId = aed.id;
    if (inv.currency === 'INR') currencyId = inr.id;
    if (inv.currency === 'USD') currencyId = usd.id;
    
    await prisma.invoice.update({
      where: { id: inv.id },
      data: {
        transactionCurrencyId: currencyId,
        baseCurrencyAmount: baseAmt
      }
    });
  }

  console.log('Phase 2 Backfill completed.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
