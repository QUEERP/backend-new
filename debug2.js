const prisma = require('./src/config/prisma');
const TaxEngine = require('./src/services/taxEngine');

async function test() {
  const biz = await prisma.business.findFirst({ where: { countryCode: 'MX' } });
  const txClient = prisma;
  
  const itemTaxes = await TaxEngine.calculateTax({
    businessId: biz.id,
    businessCountryCode: 'MX',
    businessRegionCode: null,
    counterpartyCountryCode: 'MX',
    counterpartyRegionCode: null,
    supplyCategory: 'GOODS',
    counterpartyTaxRegistrationStatus: 'REGISTERED',
    transactionType: 'INVOICE',
    lineSubtotal: 1000,
    exchangeRate: 1,
    statutoryRate: 1,
    decimals: 2,
    transactionDate: new Date(),
    isManualOverride: false,
    txClient
  });
  
  console.log('ITEM TAXES:', JSON.stringify(itemTaxes, null, 2));
}

test().finally(() => prisma.$disconnect());
