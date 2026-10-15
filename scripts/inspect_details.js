const prisma = require('../src/config/prisma');

async function run() {
  const businesses = await prisma.business.findMany();
  console.log('=== BUSINESSES ===');
  for (const b of businesses) {
    console.log({ id: b.id, name: b.name, currency: b.currency, country: b.country, state: b.state, gstNumber: b.gstNumber });
  }

  const inv = await prisma.invoice.findUnique({
    where: { id: '364a87cb-ece1-4577-baf5-6e885864e2a8' },
    include: { items: true, business: true, customer: true }
  });
  console.log('\n=== INVOICE 364a87cb ===');
  console.log({
    id: inv?.id,
    number: inv?.invoiceNumber,
    businessId: inv?.businessId,
    businessName: inv?.business?.name,
    subtotal: inv?.subtotal,
    cgst: inv?.cgst,
    sgst: inv?.sgst,
    igst: inv?.igst,
    totalTax: inv?.totalTax,
    grandTotal: inv?.grandTotal,
    baseCurrencyAmount: inv?.baseCurrencyAmount,
    items: inv?.items?.map(it => ({ id: it.id, desc: it.description, rate: it.rate, qty: it.quantity, taxPercent: it.taxPercent, totalTax: it.totalTax, totalAmount: it.totalAmount }))
  });

  const journals = await prisma.journalEntry.findMany({
    where: {
      OR: [
        { description: { contains: '364a87cb' } },
        { description: { contains: inv?.invoiceNumber || 'INV-001' } },
        { businessId: inv?.businessId }
      ]
    }
  });
  console.log('\n=== JOURNAL ENTRIES FOR BUSINESS of 364a87cb ===', journals);

  const bill005 = await prisma.bill.findFirst({
    where: { billNumber: { contains: '005' } },
    include: { items: true, vendor: true }
  });
  console.log('\n=== BILL-005 ===', {
    id: bill005?.id,
    number: bill005?.billNumber,
    subtotal: bill005?.subtotal,
    discount: bill005?.discount,
    tax: bill005?.tax,
    totalAmount: bill005?.totalAmount,
    items: bill005?.items
  });

  // Let's also check all invoices that have 13% taxPercent anywhere in the DB
  const thirteenPctItems = await prisma.invoiceItem.findMany({
    where: { taxPercent: 13 },
    include: { invoice: true }
  });
  console.log('\n=== 13% TAX ITEMS ===', thirteenPctItems.map(it => ({
    itemId: it.id,
    invoiceId: it.invoiceId,
    invoiceNumber: it.invoice?.invoiceNumber,
    businessId: it.invoice?.businessId,
    desc: it.description,
    taxPercent: it.taxPercent,
    totalTax: it.totalTax,
    totalAmount: it.totalAmount
  })));

  await prisma.$disconnect();
}
run().catch(console.error);
