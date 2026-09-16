const prisma = require('./src/config/prisma');
const TaxEngine = require('./src/services/taxEngine');

async function run() {
  try {
    const business = await prisma.business.findFirst();
    
    // Simulate an override request today
    const res = await TaxEngine.calculateTax({
      businessId: business.id,
      transactionDate: new Date(),
      transactionType: 'INVOICE',
      transactionId: 'TEST-1',
      lineSubtotal: 1000,
      isManualOverride: true,
      manualOverrideRate: 99.9, // Does not exist
      overrideReason: 'Testing',
      txClient: prisma
    });
    console.log("Success:", res);
  } catch (e) {
    console.log("Error caught:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();
