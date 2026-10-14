/**
 * Backfill Script: Fix historical invoice items with taxPercent: 0
 * 
 * Usage:
 *   Dry-run (default): node backend/scripts/backfill_invoice_item_taxes.js --dry-run
 *   Execute:          node backend/scripts/backfill_invoice_item_taxes.js --execute
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const prisma = require('../src/config/prisma');

async function main() {
  const args = process.argv.slice(2);
  const isExecute = args.includes('--execute');
  const isDryRun = !isExecute;

  console.log(`=== INVOICE ITEM TAX BACKFILL (${isDryRun ? 'DRY-RUN MODE' : 'EXECUTE MODE'}) ===\n`);

  // Find all invoices with items
  const invoices = await prisma.invoice.findMany({
    where: { isDeleted: false },
    include: { items: true, customer: true, business: true }
  });

  let inspectedCount = 0;
  let candidatesCount = 0;
  let updatedCount = 0;

  for (const inv of invoices) {
    inspectedCount++;
    const zeroTaxItems = inv.items.filter(it => (Number(it.taxPercent || 0) === 0) && (Number(inv.totalTax || 0) > 0 || Number(it.totalTax || 0) > 0));

    if (zeroTaxItems.length === 0) continue;

    candidatesCount++;
    console.log(`Invoice ${inv.invoiceNumber || inv.id}: Subtotal ₹${inv.subtotal}, Header Tax ₹${inv.totalTax} (CGST: ₹${inv.cgst || 0}, SGST: ₹${inv.sgst || 0}, IGST: ₹${inv.igst || 0})`);

    const invSubtotal = Number(inv.subtotal || 0);
    const invTotalTax = Number(inv.totalTax || 0);
    const isInterState = Number(inv.igst || 0) > 0;

    for (const item of zeroTaxItems) {
      const itemAmount = Number(item.amount || (Number(item.quantity || item.hours || 0) * Number(item.rate || 0)) || 0);
      let calculatedTaxRate = 0;

      if (Number(item.totalTax || 0) > 0 && itemAmount > 0) {
        calculatedTaxRate = Number(((Number(item.totalTax) / itemAmount) * 100).toFixed(2));
      } else if (invSubtotal > 0 && invTotalTax > 0) {
        calculatedTaxRate = Number(((invTotalTax / invSubtotal) * 100).toFixed(2));
      }

      let cgstPercent = 0;
      let sgstPercent = 0;
      let igstPercent = 0;

      if (isInterState) {
        igstPercent = calculatedTaxRate;
      } else {
        cgstPercent = Number((calculatedTaxRate / 2).toFixed(2));
        sgstPercent = Number((calculatedTaxRate / 2).toFixed(2));
      }

      const itemTax = Number(item.totalTax || ((itemAmount * calculatedTaxRate) / 100).toFixed(2));

      console.log(`  -> Item "${item.description || item.itemName || 'Item'}": Amount ₹${itemAmount}`);
      console.log(`     Backfill Values: taxPercent = ${calculatedTaxRate}%, cgstPercent = ${cgstPercent}%, sgstPercent = ${sgstPercent}%, igstPercent = ${igstPercent}%, totalTax = ₹${itemTax}`);

      if (isExecute) {
        await prisma.invoiceItem.update({
          where: { id: item.id },
          data: {
            taxPercent: calculatedTaxRate,
            cgstPercent,
            sgstPercent,
            igstPercent,
            totalTax: itemTax,
            totalAmount: itemAmount + itemTax
          }
        });
        updatedCount++;
      }
    }
    console.log('');
  }

  console.log(`Summary: Inspected ${inspectedCount} invoices.`);
  console.log(`Found ${candidatesCount} invoices with unbackfilled items.`);
  if (isDryRun) {
    console.log(`Dry-run complete. No changes were applied. Run with --execute to commit changes.`);
  } else {
    console.log(`✔ Successfully updated ${updatedCount} invoice items.`);
  }
}

main()
  .catch(err => {
    console.error('Backfill error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
