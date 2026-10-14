const prisma = require('./src/config/prisma');

async function migrate() {
  const businessId = 'dc70ca38-b141-477d-a379-f02649117a78';

  // 1. Get or create currencies
  const inr = await prisma.currency.upsert({
    where: { code: 'INR' },
    update: {},
    create: { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimals: 2 }
  });

  const aed = await prisma.currency.upsert({
    where: { code: 'AED' },
    update: {},
    create: { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', decimals: 2 }
  });

  const usd = await prisma.currency.upsert({
    where: { code: 'USD' },
    update: {},
    create: { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2 }
  });

  console.log('Currencies resolved: INR, AED, USD');

  // 2. Add Exchange Rates
  const existingRates = await prisma.exchangeRate.findMany({
    where: {
      OR: [
        { fromCurrencyId: aed.id, toCurrencyId: inr.id },
        { fromCurrencyId: inr.id, toCurrencyId: aed.id },
        { fromCurrencyId: usd.id, toCurrencyId: inr.id },
        { fromCurrencyId: inr.id, toCurrencyId: usd.id }
      ]
    }
  });

  if (existingRates.length === 0) {
    await prisma.exchangeRate.createMany({
      data: [
        { fromCurrencyId: aed.id, toCurrencyId: inr.id, rate: 22.5, rateType: 'COMMERCIAL', effectiveDate: new Date('2026-01-01') },
        { fromCurrencyId: inr.id, toCurrencyId: aed.id, rate: 1 / 22.5, rateType: 'COMMERCIAL', effectiveDate: new Date('2026-01-01') },
        { fromCurrencyId: usd.id, toCurrencyId: inr.id, rate: 83.5, rateType: 'COMMERCIAL', effectiveDate: new Date('2026-01-01') },
        { fromCurrencyId: inr.id, toCurrencyId: usd.id, rate: 1 / 83.5, rateType: 'COMMERCIAL', effectiveDate: new Date('2026-01-01') }
      ]
    });
    console.log('Created exchange rates for AED <-> INR, USD <-> INR');
  }

  // 3. Restore and update INV-001 (AED sales)
  const inv1 = await prisma.invoice.findFirst({
    where: { businessId, invoiceNumber: 'INV-001' }
  });
  if (inv1) {
    await prisma.invoice.update({
      where: { id: inv1.id },
      data: {
        isDeleted: false,
        deletedAt: null,
        currency: 'AED',
        transactionCurrencyId: aed.id,
        baseCurrencyId: inr.id,
        exchangeRate: 22.5,
        baseCurrencyAmount: 120 * 22.5 // 2700 INR
      }
    });
    console.log('Updated INV-001: restored and linked to AED');
  }

  // 4. Fix INV-003 (NaN grandTotal)
  const inv3 = await prisma.invoice.findFirst({
    where: { businessId, invoiceNumber: 'INV-003' }
  });
  if (inv3) {
    const total = 1000 - 10 + 500; // subtotal - discount + shipping
    await prisma.invoice.update({
      where: { id: inv3.id },
      data: {
        grandTotal: total,
        totalTax: 0,
        currency: 'INR',
        transactionCurrencyId: inr.id,
        baseCurrencyId: inr.id,
        exchangeRate: 1,
        baseCurrencyAmount: total
      }
    });
    console.log('Updated INV-003: grandTotal set to 1490 INR');
  }

  // 5. Update BILL-001 to BILL-005
  const bills = await prisma.bill.findMany({
    where: { businessId }
  });
  for (const b of bills) {
    await prisma.bill.update({
      where: { id: b.id },
      data: {
        currency: b.currency || 'INR',
        transactionCurrencyId: inr.id,
        baseCurrencyId: inr.id,
        exchangeRate: 1,
        baseCurrencyAmount: b.totalAmount
      }
    });
  }
  console.log(`Updated ${bills.length} bills with transactionCurrencyId and baseCurrencyAmount.`);

  // 6. Ensure TaxTransaction records exist for INV-002 and BILL-005
  const existingInv2Tax = await prisma.taxTransaction.findFirst({
    where: { transactionId: '7b31f606-bbe9-4618-8a62-887ffcab2d0a' }
  });
  if (!existingInv2Tax) {
    await prisma.taxTransaction.create({
      data: {
        businessId,
        transactionType: 'INVOICE',
        transactionId: '7b31f606-bbe9-4618-8a62-887ffcab2d0a',
        taxAmountTxnCcy: 22.5,
        taxAmountBaseCcy: 22.5,
        taxableAmountBaseCcy: 900,
        taxAmountStatutoryCcy: 22.5,
        transactionCurrencyId: inr.id,
        itemReference: 'INV-002 item'
      }
    });
    console.log('Created TaxTransaction for INV-002');
  }

  const bill5 = await prisma.bill.findFirst({
    where: { businessId, billNumber: 'BILL-005' }
  });
  if (bill5) {
    const existingBill5Tax = await prisma.taxTransaction.findFirst({
      where: { transactionId: bill5.id }
    });
    if (!existingBill5Tax) {
      await prisma.taxTransaction.create({
        data: {
          businessId,
          transactionType: 'BILL',
          transactionId: bill5.id,
          taxAmountTxnCcy: 400,
          taxAmountBaseCcy: 400,
          taxableAmountBaseCcy: 8000,
          taxAmountStatutoryCcy: 400,
          transactionCurrencyId: inr.id,
          itemReference: 'BILL-005 item'
        }
      });
      console.log('Created TaxTransaction for BILL-005');
    }
  }

  console.log('All migrations completed successfully.');
}

migrate().catch(console.error).finally(() => process.exit(0));
