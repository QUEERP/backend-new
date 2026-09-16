const prisma = require('./src/config/prisma');
const TaxResolver = require('./src/services/TaxResolver');
const TaxEngine = require('./src/services/taxEngine');

async function test() {
  const biz = await prisma.business.findFirst({ where: { countryCode: 'MX' }, orderBy: { createdAt: 'desc' } });
  
  const ctx = {
    businessId: biz.id,
    businessCountryCode: 'MX',
    businessRegionCode: null,
    counterpartyCountryCode: 'MX',
    counterpartyRegionCode: null,
    supplyCategory: 'GOODS',
    counterpartyTaxRegistrationStatus: 'REGISTERED',
    transactionType: 'INVOICE',
    transactionDate: new Date(),
    txClient: prisma
  };

  const res = await TaxResolver.resolveTaxRule(ctx);
  console.log('RESOLVED:', res);

  const itemTaxes = await TaxEngine.calculateTax({
    ...ctx,
    lineSubtotal: 1000,
    exchangeRate: 1,
    statutoryRate: 1,
    decimals: 2,
    isManualOverride: false
  });
  console.log('ITEM TAXES:', itemTaxes);
}

test().finally(() => prisma.$disconnect());
