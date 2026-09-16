const prisma = require('./src/config/prisma');
const TaxEngine = require('./src/services/taxEngine');

async function testGuard() {
  const biz = await prisma.business.create({
    data: {
      name: `Guard Test Biz`,
      countryCode: 'CA',
      baseCurrency: { connect: { code: 'CAD' } },
      owner: { connect: { id: (await prisma.user.findFirst()).id } }
    }
  });

  console.log(`Created business ${biz.id} without taxFrameworkId`);

  const ctx = {
    businessId: biz.id,
    businessCountryCode: 'CA',
    businessRegionCode: null,
    counterpartyCountryCode: 'CA',
    counterpartyRegionCode: null,
    supplyCategory: 'GOODS',
    counterpartyTaxRegistrationStatus: 'REGISTERED',
    transactionType: 'INVOICE',
    transactionDate: new Date(),
    txClient: prisma,
    lineSubtotal: 1000,
    exchangeRate: 1,
    statutoryRate: 1,
    decimals: 2,
    isManualOverride: false
  };

  try {
    await TaxEngine.calculateTax(ctx);
    console.log("❌ ERROR: calculateTax returned without throwing!");
  } catch (e) {
    console.log("✅ Guard worked! Caught error:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}

testGuard();
