const prisma = require('./src/config/prisma');

async function fixBills() {
  const bills = await prisma.bill.findMany({
    where: {
      status: 'UNPAID',
      outstandingAmount: 0
    }
  });

  console.log(`Found ${bills.length} unpaid bills with 0 outstanding amount.`);

  for (const bill of bills) {
    await prisma.bill.update({
      where: { id: bill.id },
      data: { outstandingAmount: bill.totalAmount }
    });
    console.log(`Updated BILL: ${bill.billNumber} - Set outstanding to ${bill.totalAmount}`);
  }

  console.log("Done.");
}

fixBills().catch(console.error).finally(() => process.exit(0));
