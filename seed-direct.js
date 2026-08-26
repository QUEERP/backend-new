const prisma = require('./src/config/prisma');

async function seedDirect() {
  const businessId = '954fc9b6-d5e8-4279-97d1-6936d37d7125';
  const ts = Date.now();
  console.log('Direct seeding...');

  // 1. Get references
  const inr = await prisma.currency.findUnique({ where: { code: 'INR' } });
  const usd = await prisma.currency.findUnique({ where: { code: 'USD' } });
  const india = await prisma.country.findUnique({ where: { code: 'IN' } });
  const user = await prisma.user.findFirst();
  const cust = await prisma.customer.findFirst({ where: { businessId } });
  
  const acc = await prisma.account.findFirst({ where: { businessId } });
  const arAcc = acc;
  const revAcc = acc;
  const taxAcc = acc;
  const bankAcc = acc;
  
  // 2. INR INVOICE
  const inv1 = await prisma.invoice.create({
    data: {
      businessId,
      invoiceNumber: 'INV-INR-DIR-' + ts,
      customerId: cust.id,
      status: 'APPROVED',
      subtotal: 1000,
      totalTax: 180,
      grandTotal: 1180,
      currency: 'INR',
      transactionCurrencyId: inr.id,
      baseCurrencyId: inr.id,
      exchangeRate: 1,
      baseCurrencyAmount: 1180,
      statutoryExchangeRate: 1,
      statutoryBaseAmount: 1180,
      invoiceDate: new Date(),
      items: {
        create: [{ description: "Direct Item", quantity: 1, rate: 1000, amount: 1000, totalAmount: 1000, totalTax: 180, hours: 0 }]
      }
    }
  });

  const cgstRate = await prisma.taxRate.findFirst({ where: { name: { contains: 'CGST' } } });
  const sgstRate = await prisma.taxRate.findFirst({ where: { name: { contains: 'SGST' } } });

  // INR Tax Transactions
  await prisma.taxTransaction.createMany({
    data: [
      { businessId, transactionId: inv1.id, transactionType: 'INVOICE', taxRateId: cgstRate.id, taxAmountTxnCcy: 90, taxAmountBaseCcy: 90, taxAmountStatutoryCcy: 90 },
      { businessId, transactionId: inv1.id, transactionType: 'INVOICE', taxRateId: sgstRate.id, taxAmountTxnCcy: 90, taxAmountBaseCcy: 90, taxAmountStatutoryCcy: 90 }
    ]
  });

  // INR Journal Entries
  await prisma.journalEntry.createMany({
    data: [
      { businessId, accountId: arAcc.id, description: 'Invoice ' + inv1.invoiceNumber, debit: 1180, credit: 0, baseDebit: 1180, baseCredit: 0, exchangeRate: 1, currency: 'INR' },
      { businessId, accountId: revAcc.id, description: 'Revenue ' + inv1.invoiceNumber, debit: 0, credit: 1000, baseDebit: 0, baseCredit: 1000, exchangeRate: 1, currency: 'INR' },
      { businessId, accountId: taxAcc.id, description: 'Tax ' + inv1.invoiceNumber, debit: 0, credit: 180, baseDebit: 0, baseCredit: 180, exchangeRate: 1, currency: 'INR' }
    ]
  });

  // 3. CREDIT NOTE (Partial reversal)
  const cn = await prisma.creditNote.create({
    data: {
      businessId,
      creditNumber: 'CN-INR-DIR-' + ts,
      invoiceId: inv1.id,
      customerId: cust.id,
      type: 'INVOICE',
      status: 'OPEN',
      amount: 590, // 500 sub + 90 tax
      remainingAmount: 590,
      reason: 'Partial Refund',
      currency: 'INR',
      baseCurrencyAmount: 590,
      exchangeRate: 1
    }
  });

  await prisma.taxTransaction.createMany({
    data: [
      { businessId, transactionId: cn.id, transactionType: 'CREDIT_NOTE', taxRateId: cgstRate.id, taxAmountTxnCcy: 45, taxAmountBaseCcy: 45, taxAmountStatutoryCcy: 45 },
      { businessId, transactionId: cn.id, transactionType: 'CREDIT_NOTE', taxRateId: sgstRate.id, taxAmountTxnCcy: 45, taxAmountBaseCcy: 45, taxAmountStatutoryCcy: 45 }
    ]
  });

  // USD INVOICE
  const inv2 = await prisma.invoice.create({
    data: {
      businessId,
      invoiceNumber: 'INV-USD-DIR-' + ts,
      customerId: cust.id,
      status: 'APPROVED',
      subtotal: 100,
      totalTax: 18,
      grandTotal: 118,
      currency: 'USD',
      transactionCurrencyId: usd.id,
      baseCurrencyId: inr.id,
      exchangeRate: 83.5, // 1 USD = 83.5 INR
      baseCurrencyAmount: 9853, // 118 * 83.5
      statutoryExchangeRate: 83.0,
      statutoryBaseAmount: 9794, // 118 * 83.0
      invoiceDate: new Date(),
      items: {
        create: [{ description: "USD Item", quantity: 1, rate: 100, amount: 100, totalAmount: 100, totalTax: 18, hours: 0 }]
      }
    }
  });

  // USD Tax Transactions
  await prisma.taxTransaction.createMany({
    data: [
      { businessId, transactionId: inv2.id, transactionType: 'INVOICE', taxRateId: cgstRate.id, taxAmountTxnCcy: 9, taxAmountBaseCcy: 751.5, taxAmountStatutoryCcy: 747 },
      { businessId, transactionId: inv2.id, transactionType: 'INVOICE', taxRateId: sgstRate.id, taxAmountTxnCcy: 9, taxAmountBaseCcy: 751.5, taxAmountStatutoryCcy: 747 }
    ]
  });

  // USD Journal Entries (simulating usage for Currency Report)
  await prisma.journalEntry.createMany({
    data: [
      { businessId, accountId: arAcc.id, description: 'Invoice ' + inv2.invoiceNumber, debit: 118, credit: 0, baseDebit: 9853, baseCredit: 0, exchangeRate: 83.5, currency: 'USD' },
      { businessId, accountId: revAcc.id, description: 'Revenue ' + inv2.invoiceNumber, debit: 0, credit: 100, baseDebit: 0, baseCredit: 8350, exchangeRate: 83.5, currency: 'USD' },
      { businessId, accountId: taxAcc.id, description: 'Tax ' + inv2.invoiceNumber, debit: 0, credit: 18, baseDebit: 0, baseCredit: 1503, exchangeRate: 83.5, currency: 'USD' }
    ]
  });

  // USD PAYMENT with FX Gain
  const pay2 = await prisma.payment.create({
    data: {
      businessId,
      paymentNumber: 'PAY-USD-DIR-' + ts,
      paymentDate: new Date(),
      amount: 118,
      paymentMode: 'CASH',
      status: 'COMPLETED',
      currency: 'USD',
      exchangeRate: 84.0, // Gain of 0.5 INR per USD! 118 * 0.5 = 59 INR gain
      createdBy: user.id
    }
  });

  // We need fxAccount to test
  const fxAccount = await prisma.account.findFirst({ where: { businessId, code: 'SYSTEM_FX_GAIN_LOSS' } });
  
  await prisma.journalEntry.createMany({
    data: [
      { businessId, accountId: bankAcc.id, description: 'Payment ' + pay2.paymentNumber, debit: 118, credit: 0, baseDebit: 9912, baseCredit: 0, exchangeRate: 84.0, currency: 'USD' },
      { businessId, accountId: arAcc.id, description: 'AR reduction', debit: 0, credit: 118, baseDebit: 0, baseCredit: 9853, exchangeRate: 83.5, currency: 'USD' },
      { businessId, accountId: fxAccount ? fxAccount.id : revAcc.id, description: 'FX Gain', debit: 0, credit: 0, baseDebit: 0, baseCredit: 59, exchangeRate: 1, currency: 'USD' }
    ]
  });

  console.log('Direct seeding done!');
}

seedDirect().catch(console.error).finally(() => prisma.$disconnect());
