const prisma = require('../src/config/prisma');

/**
 * Rollback Script for Audit & Backfill Changes
 * Restores pre-audit state for invoices and payments.
 * 
 * Usage:
 *   node scripts/rollback_audit.js --businessId <id> [--execute]
 *   node scripts/rollback_audit.js --all [--execute]
 */
async function main() {
  const isExecute = process.argv.includes('--execute');
  const targetAll = process.argv.includes('--all');
  const bIdIndex = process.argv.indexOf('--businessId');
  const targetBusinessId = bIdIndex !== -1 && process.argv[bIdIndex + 1] ? process.argv[bIdIndex + 1] : null;

  if (!targetAll && !targetBusinessId) {
    console.log('Error: You must provide --businessId <id> or --all to scope this operation.');
    process.exit(1);
  }

  console.log(`\n======================================================`);
  console.log(` AUDIT & BACKFILL ROLLBACK SCRIPT`);
  console.log(` Mode: ${isExecute ? '*** LIVE EXECUTION ***' : 'READ-ONLY (DRY RUN)'}`);
  console.log(` Scope: ${targetAll ? 'ALL BUSINESSES' : `Business ID ${targetBusinessId}`}`);
  console.log(`======================================================\n`);

  // 1. Invoices before/after log
  const invoiceRollbackLog = [
    {
      invoiceId: '364a87cb-ece1-4577-baf5-6e885864e2a8',
      businessId: 'e0250f84-1b58-4bf4-ba61-ea93ddaacf45',
      invoiceNumber: 'INV-001',
      itemId: '3a122dce-9b7a-4bee-9068-a510d64115d5',
      before: { itemTotalTax: 0, itemTotalAmount: 5000, cgst: 0, sgst: 0, igst: 0 },
      current: { itemTotalTax: 900, itemTotalAmount: 5900, cgst: 0, sgst: 0, igst: 0 }
    }
  ];

  console.log('--- 1. INVOICE ROLLBACK ---');
  for (const entry of invoiceRollbackLog) {
    if (targetBusinessId && entry.businessId !== targetBusinessId) {
      console.log(`Skipping invoice ${entry.invoiceNumber} (Business ID ${entry.businessId} != ${targetBusinessId})`);
      continue;
    }
    console.log(`[ROLLBACK TARGET] Invoice ${entry.invoiceNumber} (${entry.invoiceId}):`);
    console.log(`  Line item ${entry.itemId}: revert totalTax ${entry.current.itemTotalTax} -> ${entry.before.itemTotalTax}, totalAmount ${entry.current.itemTotalAmount} -> ${entry.before.itemTotalAmount}`);
    if (isExecute) {
      await prisma.invoiceItem.update({
        where: { id: entry.itemId },
        data: {
          totalTax: entry.before.itemTotalTax,
          totalAmount: entry.before.itemTotalAmount
        }
      });
      console.log(`  -> Restored Invoice ${entry.invoiceNumber} item to pre-audit state.`);
    }
  }

  // 2. Payments before/after log (previously had baseCurrencyAmount = null)
  const paymentIds = [
    '685b7dc4-cf58-4c54-ad55-4b5512dafa21',
    '0f68f599-5e1f-4c98-8452-f72ef5a80bde',
    '1a1d5582-5761-430c-a614-542ab7b81cec',
    '66070230-11aa-4eb2-b02b-c90001098c23',
    'aff67fdc-48bc-485f-b8d1-a9c14cc4df68',
    '8702c234-88eb-4aef-bf75-79beead189df',
    '13b19b83-ef13-4183-8262-7f86cb090077',
    'f07802f5-0c12-4779-ba91-516ba17b096d',
    '9ad79927-786c-4e79-aae4-011cf776e08e',
    'a82903a9-3e48-4bbc-bdde-0e27ddbff045',
    'ebf6d389-9f3a-4d39-b879-6622938c48f7'
  ];

  console.log('\n--- 2. PAYMENT ROLLBACK ---');
  const payments = await prisma.payment.findMany({
    where: { id: { in: paymentIds } }
  });

  for (const p of payments) {
    if (targetBusinessId && p.businessId !== targetBusinessId) {
      console.log(`Skipping payment ${p.paymentNumber} (Business ID ${p.businessId} != ${targetBusinessId})`);
      continue;
    }
    console.log(`[ROLLBACK TARGET] Payment ${p.paymentNumber} (${p.id}): revert baseCurrencyAmount ${p.baseCurrencyAmount} -> null`);
    if (isExecute) {
      await prisma.payment.update({
        where: { id: p.id },
        data: { baseCurrencyAmount: null, statutoryBaseAmount: null }
      });
      console.log(`  -> Restored Payment ${p.paymentNumber} to pre-audit state.`);
    }
  }

  console.log('\n======================================================');
  console.log(` ROLLBACK ${isExecute ? 'COMPLETED SUCCESSFULLY' : 'DRY-RUN COMPLETE (No changes made)'}`);
  console.log(`======================================================\n`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
