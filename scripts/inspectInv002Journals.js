const prisma = require('../src/config/prisma');

async function main() {
  const invoice = await prisma.invoice.findFirst({
    where: { invoiceNumber: 'INV-002', businessId: 'dc70ca38-b141-477d-a379-f02649117a78' },
    include: {
      payments: true,
      paymentAllocations: {
        include: { payment: true }
      }
    }
  });

  console.log('=== INV-002 DETAILS ===');
  console.log({
    id: invoice.id,
    number: invoice.invoiceNumber,
    subtotal: invoice.subtotal,
    discount: invoice.discount,
    tax: invoice.totalTax,
    grandTotal: invoice.grandTotal,
    baseCurrencyAmount: invoice.baseCurrencyAmount,
    amountPaid: invoice.amountPaid,
    status: invoice.status
  });

  console.log('\nDirect Payments on Invoice:');
  for (const p of invoice.payments) {
    console.log({
      id: p.id,
      paymentNumber: p.paymentNumber,
      amount: p.amount,
      currency: p.currency,
      exchangeRate: p.exchangeRate,
      baseCurrencyAmount: p.baseCurrencyAmount,
      date: p.paymentDate
    });
  }

  console.log('\nPayment Allocations on Invoice:');
  for (const pa of invoice.paymentAllocations) {
    console.log({
      id: pa.id,
      paymentId: pa.paymentId,
      paymentNumber: pa.payment.paymentNumber,
      allocatedAmount: pa.allocatedAmount,
      allocationType: pa.allocationType,
      paymentAmount: pa.payment.amount,
      paymentCurrency: pa.payment.currency,
      paymentRate: pa.payment.exchangeRate,
      paymentDate: pa.payment.paymentDate
    });
  }

  const journals = await prisma.journalEntry.findMany({
    where: {
      businessId: 'dc70ca38-b141-477d-a379-f02649117a78'
    },
    include: {
      account: true
    },
    orderBy: { date: 'asc' }
  });

  console.log(`\n=== ALL JOURNAL ENTRIES FOR BUSINESS (${journals.length} total) ===`);
  for (const j of journals) {
    console.log(`ID: ${j.id} | Date: ${j.date.toISOString().split('T')[0]} | Account: ${j.account?.name.padEnd(20)} (${j.account?.code || 'no code'}) | Debit: ${j.debit.toString().padStart(8)} | Credit: ${j.credit.toString().padStart(8)} | Desc: ${j.description}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
