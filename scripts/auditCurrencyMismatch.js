const prisma = require('../src/config/prisma');

async function auditMismatch(dryRun = true) {
  console.log(`=== RUNNING CURRENCY BASE AMOUNT AUDIT (dryRun = ${dryRun}) ===\n`);

  const results = {
    invoices: [],
    bills: [],
    creditNotes: []
  };

  // 1. Audit Invoices
  const invoices = await prisma.invoice.findMany({
    where: { isDeleted: false },
    select: {
      id: true,
      businessId: true,
      invoiceNumber: true,
      currency: true,
      grandTotal: true,
      subtotal: true,
      totalTax: true,
      discount: true,
      shippingCharges: true,
      exchangeRate: true,
      baseCurrencyAmount: true,
      status: true
    }
  });

  for (const inv of invoices) {
    const rate = Number(inv.exchangeRate || 1);
    const grandTotal = Number(inv.grandTotal || 0);
    const expectedBase = Number((grandTotal * rate).toFixed(2));
    const actualBase = Number(inv.baseCurrencyAmount ?? expectedBase);

    if (Math.abs(actualBase - expectedBase) > 0.01 || inv.baseCurrencyAmount === null || inv.baseCurrencyAmount === undefined) {
      results.invoices.push({
        id: inv.id,
        businessId: inv.businessId,
        docNumber: inv.invoiceNumber,
        currency: inv.currency,
        grandTotal,
        rate,
        actualBase,
        expectedBase,
        diff: Number((actualBase - expectedBase).toFixed(2)),
        status: inv.status
      });
    }
  }

  // 2. Audit Bills
  const bills = await prisma.bill.findMany({
    select: {
      id: true,
      businessId: true,
      billNumber: true,
      currency: true,
      totalAmount: true,
      subtotal: true,
      tax: true,
      discount: true,
      exchangeRate: true,
      baseCurrencyAmount: true,
      status: true
    }
  });

  for (const bill of bills) {
    const rate = Number(bill.exchangeRate || 1);
    const totalAmount = Number(bill.totalAmount || 0);
    const expectedBase = Number((totalAmount * rate).toFixed(2));
    const actualBase = Number(bill.baseCurrencyAmount ?? expectedBase);

    if (Math.abs(actualBase - expectedBase) > 0.01 || bill.baseCurrencyAmount === null || bill.baseCurrencyAmount === undefined) {
      results.bills.push({
        id: bill.id,
        businessId: bill.businessId,
        docNumber: bill.billNumber,
        currency: bill.currency,
        totalAmount,
        rate,
        actualBase,
        expectedBase,
        diff: Number((actualBase - expectedBase).toFixed(2)),
        status: bill.status
      });
    }
  }

  // 3. Audit Credit Notes
  const creditNotes = await prisma.creditNote.findMany({
    where: { isDeleted: false },
    select: {
      id: true,
      businessId: true,
      creditNumber: true,
      currency: true,
      amount: true,
      exchangeRate: true,
      baseCurrencyAmount: true,
      status: true
    }
  });

  for (const cn of creditNotes) {
    const rate = Number(cn.exchangeRate || 1);
    const amount = Number(cn.amount || 0);
    const expectedBase = Number((amount * rate).toFixed(2));
    const actualBase = Number(cn.baseCurrencyAmount ?? expectedBase);

    if (Math.abs(actualBase - expectedBase) > 0.01 || cn.baseCurrencyAmount === null || cn.baseCurrencyAmount === undefined) {
      results.creditNotes.push({
        id: cn.id,
        businessId: cn.businessId,
        docNumber: cn.creditNumber,
        currency: cn.currency,
        amount,
        rate,
        actualBase,
        expectedBase,
        diff: Number((actualBase - expectedBase).toFixed(2)),
        status: cn.status
      });
    }
  }

  console.log(`TOTAL INVOICE HITS: ${results.invoices.length}`);
  console.table(results.invoices);

  console.log(`\nTOTAL BILL HITS: ${results.bills.length}`);
  console.table(results.bills);

  console.log(`\nTOTAL CREDIT NOTE HITS: ${results.creditNotes.length}`);
  console.table(results.creditNotes);

  if (!dryRun) {
    console.log('\n--- APPLYING REPAIRS ---');
    for (const inv of results.invoices) {
      await prisma.invoice.update({
        where: { id: inv.id },
        data: {
          baseCurrencyAmount: inv.expectedBase,
          statutoryBaseAmount: inv.expectedBase
        }
      });
      console.log(`Repaired Invoice ${inv.docNumber}: baseCurrencyAmount ${inv.actualBase} -> ${inv.expectedBase}`);
    }

    for (const bill of results.bills) {
      await prisma.bill.update({
        where: { id: bill.id },
        data: {
          baseCurrencyAmount: bill.expectedBase,
          statutoryBaseAmount: bill.expectedBase
        }
      });
      console.log(`Repaired Bill ${bill.docNumber}: baseCurrencyAmount ${bill.actualBase} -> ${bill.expectedBase}`);
    }

    for (const cn of results.creditNotes) {
      await prisma.creditNote.update({
        where: { id: cn.id },
        data: {
          baseCurrencyAmount: cn.expectedBase,
          statutoryBaseAmount: cn.expectedBase
        }
      });
      console.log(`Repaired Credit Note ${cn.docNumber}: baseCurrencyAmount ${cn.actualBase} -> ${cn.expectedBase}`);
    }
    console.log('\nREPAIRS COMPLETED SUCCESSFULLY.');
  }

  return results;
}

const isDryRun = process.argv.includes('--apply') ? false : true;
auditMismatch(isDryRun)
  .catch(console.error)
  .finally(() => prisma.$disconnect());
