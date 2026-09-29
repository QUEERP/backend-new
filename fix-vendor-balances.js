const prisma = require('./src/config/prisma');

async function fixVendorBalances() {
  const vendors = await prisma.vendor.findMany({
    include: { bills: true }
  });

  console.log(`Checking ${vendors.length} vendors...`);

  for (const vendor of vendors) {
    let calculatedBalance = vendor.openingBalance || 0;
    
    // Add all bills
    for (const bill of vendor.bills) {
      // If it's a cancelled bill, maybe we shouldn't add? Assuming only active bills contribute.
      if (bill.status !== 'CANCELLED') {
         calculatedBalance += bill.totalAmount;
      }
    }
    
    // Subtract all payments
    const payments = await prisma.payment.findMany({
      where: { bill: { vendorId: vendor.id } }
    });
    
    for (const payment of payments) {
      calculatedBalance -= payment.amount;
    }

    if (vendor.balance !== calculatedBalance) {
      console.log(`Fixing Vendor: ${vendor.name}. Old Balance: ${vendor.balance}, New Balance: ${calculatedBalance}`);
      await prisma.vendor.update({
        where: { id: vendor.id },
        data: { balance: calculatedBalance }
      });
    }
  }

  console.log("Done fixing vendor balances.");
}

fixVendorBalances().catch(console.error).finally(() => prisma.$disconnect());
