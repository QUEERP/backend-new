const prisma = require('./src/config/prisma');

async function main() {
  console.log('Seeding India Tax scenarios...');

  const businesses = await prisma.business.findMany();
  if (businesses.length > 0) {
    const businessId = businesses[0].id;
    const customer = await prisma.customer.findFirst({ where: { businessId }});
    
    if (customer) {
      // 1. CGST + SGST Invoice (Same Currency AED)
      await prisma.invoice.create({
        data: {
          businessId,
          customerId: customer.id,
          invoiceNumber: `TEST-INV-CGST-SGST-${Date.now()}`,
          invoiceDate: new Date('2026-08-20T00:00:00Z'),
          currency: 'AED',
          grandTotal: 1180,
          subtotal: 1000,
          cgst: 90,
          sgst: 90
        }
      });
      
      // 2. IGST Invoice (CAD -> AED)
      await prisma.invoice.create({
        data: {
          businessId,
          customerId: customer.id,
          invoiceNumber: `TEST-INV-IGST-${Date.now()}`,
          invoiceDate: new Date('2026-08-20T00:00:00Z'),
          currency: 'CAD',
          grandTotal: 5900,
          subtotal: 5000,
          igst: 900
        }
      });
      
      console.log('Created India Tax test cases (CGST+SGST and IGST).');
    }
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
