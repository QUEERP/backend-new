const prisma = require('./src/config/prisma');
const TaxEngine = require('./src/services/taxEngine');
const { RateResolutionError } = require('./src/services/currencyService');

async function testOverride() {
  try {
    const business = await prisma.business.findFirst();
    console.log("Using business:", business.id, "taxFrameworkId:", business.taxFrameworkId);
    
    // Pass a completely fake taxTypeId
    const fakeTaxTypeId = '00000000-0000-0000-0000-000000000000';
    
    await TaxEngine.calculateTax({
      businessId: business.id,
      lineSubtotal: 1000,
      isManualOverride: true,
      manualOverrideRate: 15,
      manualOverrideReason: 'Testing cross-tenant vulnerability',
      overrideTaxTypeId: fakeTaxTypeId,
      userId: 'test-user',
      txClient: prisma
    });
    
    console.log("ERROR: It succeeded! Validation failed.");
  } catch (err) {
    if (err instanceof RateResolutionError || err.name === 'RateResolutionError') {
      console.log("SUCCESSFULLY BLOCKED:", err.message);
    } else {
      console.error("OTHER ERROR:", err);
    }
  } finally {
    await prisma.$disconnect();
  }
}

testOverride();
