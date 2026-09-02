const TaxResolver = require('./src/services/TaxResolver');
const prisma = require('./src/config/prisma');

async function test() {
  try {
    await TaxResolver.resolveTaxRule({
      businessId: 'unknown',
      businessCountryCode: 'ZZ',
      supplyCategory: 'GOODS',
      counterpartyTaxRegistrationStatus: 'UNREGISTERED',
      txClient: prisma
    });
  } catch(e) {
    console.log("ACTUAL ERROR RESPONSE:");
    console.log(e.message);
  } finally {
    await prisma.$disconnect();
  }
}
test();
