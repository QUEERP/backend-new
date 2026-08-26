const prisma = require('./src/config/prisma');

async function checkLive() {
  const missing = await prisma.business.findMany({
    where: { taxFrameworkId: null },
    include: {
      invoices: { select: { id: true } },
      bills: { select: { id: true } }
    }
  });
  
  let liveCount = 0;
  missing.forEach(b => {
    if (b.invoices.length > 0 || b.bills.length > 0) {
      console.log(`- Business ID: ${b.id} has ${b.invoices.length} Invoices and ${b.bills.length} Bills.`);
      liveCount++;
    }
  });

  if (liveCount === 0) {
    console.log("No live transactions found for the unconfigured businesses.");
  } else {
    console.log(`Found ${liveCount} unconfigured businesses with live transactions.`);
  }

  await prisma.$disconnect();
}
checkLive();
