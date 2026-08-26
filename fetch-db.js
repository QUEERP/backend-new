const prisma = require('./src/config/prisma');

async function run() {
  const business = await prisma.business.findFirst({ where: { name: 'test' } });
  if (!business) {
    console.log("No business found");
    return;
  }
  const businessId = business.id;
  console.log("Business ID:", businessId);

  // Get currency gain loss
  const fxAccount = await prisma.account.findFirst({ where: { businessId, code: 'SYSTEM_FX_GAIN_LOSS' } });
  if (fxAccount) {
    const grouped = await prisma.journalEntry.groupBy({
      by: ['currency'],
      where: { businessId, accountId: fxAccount.id },
      _sum: { baseDebit: true, baseCredit: true }
    });
    console.log("=== FX GAIN LOSS ===");
    console.log(JSON.stringify(grouped, null, 2));
  }

  // Tax summary logic directly from DB (mocking the endpoints)
  const invoiceTaxes = await prisma.taxTransaction.findMany({
    where: { businessId, transactionType: 'INVOICE' },
    include: { invoice: { select: { transactionCurrency: true } } }
  });
  
  const cnTaxes = await prisma.taxTransaction.findMany({
    where: { businessId, transactionType: 'CREDIT_NOTE' },
    include: { creditNote: { select: { invoice: { select: { transactionCurrency: true } } } } }
  });
  
  console.log("=== INVOICE TAXES ===");
  console.log(JSON.stringify(invoiceTaxes.slice(0, 2), null, 2));
  console.log("=== CREDIT NOTE TAXES ===");
  console.log(JSON.stringify(cnTaxes, null, 2));
}

run().catch(console.error).finally(() => prisma.$disconnect());
