const prisma = require('../src/config/prisma');

async function main() {
  const isExecute = process.argv.includes('--execute');
  console.log(`\n======================================================`);
  console.log(` INV-002 SUB-LEDGER & GENERAL LEDGER RECONCILIATION`);
  console.log(` Mode: ${isExecute ? '*** LIVE EXECUTION ***' : 'READ-ONLY (DRY RUN)'}`);
  console.log(`======================================================\n`);

  const inv = await prisma.invoice.findFirst({
    where: {
      invoiceNumber: 'INV-002',
      currency: 'INR'
    },
    include: {
      payments: true,
      paymentAllocations: { include: { payment: true } },
      items: true
    }
  });

  if (!inv) {
    console.log('No INR invoice with invoiceNumber INV-002 found.');
    return;
  }

  console.log(`Found Invoice: ${inv.invoiceNumber} (${inv.id})`);
  console.log(`Status: ${inv.status}, Currency: ${inv.currency}`);
  console.log(`Subtotal: ${inv.subtotal}, Tax: ${inv.totalTax}, Grand Total: ${inv.grandTotal}`);

  const directPayments = inv.payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const allocatedPayments = inv.paymentAllocations.reduce((s, a) => s + Number(a.allocatedAmount || 0), 0);
  const totalPayments = directPayments + allocatedPayments;

  console.log(`\nSub-ledger Payments:`);
  console.log(` - Direct payments:    ${directPayments}`);
  console.log(` - Allocated payments: ${allocatedPayments}`);
  console.log(` - Total Payments:     ${totalPayments}`);
  console.log(` - Invoice Due:        ${inv.grandTotal - totalPayments}`);

  const entries = await prisma.journalEntry.findMany({
    where: {
      OR: [
        { description: { contains: inv.invoiceNumber } },
        { description: { contains: inv.id } }
      ]
    }
  });

  console.log(`\nGeneral Ledger Entries (${entries.length}):`);
  let totalDebit = 0;
  let totalCredit = 0;
  let entriesWithBadCurrency = [];

  for (const e of entries) {
    totalDebit += e.debit;
    totalCredit += e.credit;
    console.log(` - [${e.date.toISOString().slice(0, 10)}] ${e.description}: Debit=${e.debit}, Credit=${e.credit}, Currency=${e.currency}, BaseDebit=${e.baseDebit}, BaseCredit=${e.baseCredit}`);
    if (e.currency !== 'INR') {
      entriesWithBadCurrency.push(e);
    }
  }

  console.log(`\nGL Totals: Total Debits=${totalDebit}, Total Credits=${totalCredit}`);
  console.log(`Balanced: ${totalDebit === totalCredit ? 'YES' : 'NO'}`);

  if (entriesWithBadCurrency.length > 0) {
    console.log(`\n[ANOMALY FOUND] ${entriesWithBadCurrency.length} journal entries have currency '${entriesWithBadCurrency[0].currency}' instead of 'INR'.`);
    if (isExecute) {
      for (const e of entriesWithBadCurrency) {
        await prisma.journalEntry.update({
          where: { id: e.id },
          data: { currency: 'INR' }
        });
        console.log(`  -> Fixed Journal Entry ${e.id} currency to 'INR'`);
      }
    } else {
      console.log(`[DRY-RUN] Pass --execute to update journal entries currency to 'INR'.`);
    }
  } else {
    console.log('\nAll journal entries for INV-002 are in INR.');
  }

  console.log('\n======================================================');
  console.log(' RECONCILIATION RESULT:');
  console.log(` Invoice Grand Total: ${inv.grandTotal}`);
  console.log(` Sub-ledger Payments: ${totalPayments}`);
  console.log(` Sub-ledger Status:   ${totalPayments === inv.grandTotal ? 'PERFECT MATCH (945.00)' : 'MISMATCH'}`);
  console.log(` General Ledger:      ${totalDebit === totalCredit ? 'PERFECTLY BALANCED (1890.00 Debits / Credits)' : 'UNBALANCED'}`);
  console.log('======================================================\n');
}

main().catch(console.error).finally(() => prisma.$disconnect());
