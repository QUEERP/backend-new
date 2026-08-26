const prisma = require('./src/config/prisma');

async function main() {
  console.log('Seeding Bills and CRM records...');

  const businesses = await prisma.business.findMany();
  if (businesses.length > 0) {
    const businessId = businesses[0].id;
    
    // Seed a Bill
    let vendor = await prisma.vendor.findFirst({ where: { businessId }});
    if (!vendor) {
      vendor = await prisma.vendor.create({
        data: {
          businessId,
          name: 'Test Vendor IGST',
          currency: 'CAD'
        }
      });
    }

    await prisma.bill.create({
      data: {
        businessId,
        vendorId: vendor.id,
        billNumber: `TEST-BILL-${Date.now()}`,
        billDate: new Date('2026-08-20T00:00:00Z'),
        currency: 'CAD',
        totalAmount: 5900,
        subtotal: 5000,
        tax: 900
      }
    });

    // Seed a CRM record with untrackable string
    const customers = await prisma.customer.findMany({ take: 2 });
    for (const c of customers) {
       await prisma.customer.update({
         where: { id: c.id },
         data: { currency: 'SYSTEM' }
       });
    }

    console.log('Created test cases for Bill and CRM.');
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
