const prisma = require('../src/config/prisma');

async function main() {
  const bizId = 'dc70ca38-b141-477d-a379-f02649117a78';

  console.log('=== STARTING INV-002 SUBLEDGER & GL REPAIR ===\n');

  // 1. Fetch Accounts
  const arAccount = await prisma.account.findFirst({
    where: { businessId: bizId, code: 'SYSTEM_AR' }
  });
  const revAccount = await prisma.account.findFirst({
    where: { businessId: bizId, code: 'SYSTEM_REVENUE' }
  });
  const taxAccount = await prisma.account.findFirst({
    where: { businessId: bizId, code: 'SYSTEM_TAX_PAYABLE' }
  });
  const advanceAccount = await prisma.account.findFirst({
    where: { businessId: bizId, code: 'SYSTEM_CUSTOMER_ADVANCE' }
  });
  const cashAccount = await prisma.account.findFirst({
    where: { businessId: bizId, code: 'SYSTEM_CASH' }
  });

  console.log('Accounts found:', {
    AR: arAccount?.id,
    Revenue: revAccount?.id,
    TaxPayable: taxAccount?.id,
    CustomerAdvance: advanceAccount?.id,
    Cash: cashAccount?.id
  });

  // 2. Fetch INV-002
  const invoice = await prisma.invoice.findFirst({
    where: { invoiceNumber: 'INV-002', businessId: bizId }
  });
  if (!invoice) throw new Error('INV-002 not found');

  // 3. Update Invoice amountPaid to 945.00
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      amountPaid: 945.00,
      baseCurrencyAmount: 945.00,
      grandTotal: 945.00,
      status: 'PAID'
    }
  });
  console.log('Updated INV-002: amountPaid = 945.00, grandTotal = 945.00, baseCurrencyAmount = 945.00, status = PAID');

  // 4. Update PaymentAllocation for PAY-002 to 677.50
  const allocation = await prisma.paymentAllocation.findFirst({
    where: {
      invoiceId: invoice.id,
      payment: { paymentNumber: 'PAY-002' }
    }
  });
  if (allocation) {
    await prisma.paymentAllocation.update({
      where: { id: allocation.id },
      data: { allocatedAmount: 677.50 }
    });
    console.log(`Updated PaymentAllocation ${allocation.id}: allocatedAmount = 677.50`);
  }

  // 5. Update PAY-002 amountAllocated
  const pay002 = await prisma.payment.findFirst({
    where: { paymentNumber: 'PAY-002', businessId: bizId }
  });
  if (pay002) {
    await prisma.payment.update({
      where: { id: pay002.id },
      data: {
        amountAllocated: 677.50,
        status: 'partially_applied'
      }
    });
    console.log(`Updated PAY-002: amountAllocated = 677.50, status = partially_applied`);
  }

  // 6. Post Invoice GL entries (AR 945 Dr, Revenue 900 Cr, Tax 45 Cr)
  const existingInvJournal = await prisma.journalEntry.findFirst({
    where: {
      businessId: bizId,
      description: { contains: 'INV-002' },
      debit: 945
    }
  });

  const invDate = invoice.invoiceDate || new Date('2026-09-25T00:00:00.000Z');

  if (!existingInvJournal) {
    await prisma.journalEntry.createMany({
      data: [
        {
          businessId: bizId,
          accountId: arAccount.id,
          debit: 945.00,
          credit: 0,
          description: 'Sales Invoice #INV-002',
          date: invDate,
          currency: 'INR',
          exchangeRate: 1,
          baseDebit: 945.00,
          baseCredit: 0
        },
        {
          businessId: bizId,
          accountId: revAccount.id,
          debit: 0,
          credit: 900.00,
          description: 'Revenue for Invoice #INV-002',
          date: invDate,
          currency: 'INR',
          exchangeRate: 1,
          baseDebit: 0,
          baseCredit: 900.00
        },
        {
          businessId: bizId,
          accountId: taxAccount.id,
          debit: 0,
          credit: 45.00,
          description: 'Output Tax for Invoice #INV-002',
          date: invDate,
          currency: 'INR',
          exchangeRate: 1,
          baseDebit: 0,
          baseCredit: 45.00
        }
      ]
    });
    console.log('Created GL Journal Entries for Invoice INV-002 (AR 945 Dr, Rev 900 Cr, Tax 45 Cr)');
  } else {
    console.log('Invoice INV-002 GL Journal Entries already present');
  }

  // 7. Post PAY-002 advance allocation GL entries
  const existingPay002Journal = await prisma.journalEntry.findFirst({
    where: {
      businessId: bizId,
      description: { contains: 'PAY-002' }
    }
  });

  if (!existingPay002Journal) {
    await prisma.journalEntry.createMany({
      data: [
        {
          businessId: bizId,
          accountId: advanceAccount ? advanceAccount.id : cashAccount.id,
          debit: 677.50,
          credit: 0,
          description: 'Advance Applied PAY-002 for Invoice #INV-002',
          date: new Date('2026-09-25T00:00:00.000Z'),
          currency: 'INR',
          exchangeRate: 1,
          baseDebit: 677.50,
          baseCredit: 0
        },
        {
          businessId: bizId,
          accountId: arAccount.id,
          debit: 0,
          credit: 677.50,
          description: 'Payment Applied PAY-002 for Invoice #INV-002',
          date: new Date('2026-09-25T00:00:00.000Z'),
          currency: 'INR',
          exchangeRate: 1,
          baseDebit: 0,
          baseCredit: 677.50
        }
      ]
    });
    console.log('Created GL Journal Entries for PAY-002 allocation (Advance 677.50 Dr, AR 677.50 Cr)');
  } else {
    console.log('PAY-002 GL Journal Entries already present');
  }

  console.log('\n=== REPAIR COMPLETE ===');
  await prisma.$disconnect();
}

main().catch(console.error);
