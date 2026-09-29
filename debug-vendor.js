const prisma = require('./src/config/prisma');

async function debugVendor() {
  const vendor = await prisma.vendor.findFirst({
    where: { name: 'Test' },
    include: { bills: true }
  });

  console.log("Vendor Balance:", vendor.balance);
  
  const payments = await prisma.payment.findMany({
    where: { bill: { vendorId: vendor.id } }
  });
  
  console.log("Bills:", vendor.bills.map(b => ({ id: b.id, amount: b.totalAmount, outstanding: b.outstandingAmount })));
  console.log("Payments:", payments.map(p => ({ amount: p.amount, billId: p.billId })));

  let calculatedBalance = vendor.openingBalance || 0;
  vendor.bills.forEach(b => calculatedBalance += b.totalAmount);
  payments.forEach(p => calculatedBalance -= p.amount);

  console.log("Calculated Balance should be:", calculatedBalance);
}

debugVendor().catch(console.error).finally(() => process.exit(0));
