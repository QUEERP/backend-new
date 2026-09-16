const prisma = require('./src/config/prisma');

const frameworks = [
  {
    country: { code: 'TH', name: 'Thailand' },
    currency: { code: 'THB', name: 'Thai Baht', symbol: '฿', decimalPrecision: 2 },
    frameworkName: 'Thailand VAT',
    types: [
      {
        name: 'VAT_STANDARD',
        rates: [
          { name: 'TH Standard VAT 7%', rate: 7.0, effectiveFrom: new Date('2000-01-01') }
        ]
      },
      {
        name: 'VAT_ZERO',
        rates: [
          { name: 'TH Zero Rated 0%', rate: 0.0, effectiveFrom: new Date('2000-01-01') }
        ]
      },
      {
        name: 'VAT_EXEMPT',
        rates: [
          { name: 'TH Exempt 0%', rate: 0.0, effectiveFrom: new Date('2000-01-01') }
        ]
      }
    ]
  },
  {
    country: { code: 'VN', name: 'Vietnam' },
    currency: { code: 'VND', name: 'Vietnamese Dong', symbol: '₫', decimalPrecision: 0 },
    frameworkName: 'Vietnam VAT',
    types: [
      {
        name: 'VAT_STANDARD',
        rates: [
          { name: 'VN Standard VAT 10%', rate: 10.0, effectiveFrom: new Date('2000-01-01') }
        ]
      },
      {
        name: 'VAT_REDUCED',
        rates: [
          { name: 'VN Reduced VAT 8%', rate: 8.0, effectiveFrom: new Date('2022-01-01') }
        ]
      },
      {
        name: 'VAT_ZERO',
        rates: [
          { name: 'VN Zero Rated 0%', rate: 0.0, effectiveFrom: new Date('2000-01-01') }
        ]
      },
      {
        name: 'VAT_EXEMPT',
        rates: [
          { name: 'VN Exempt 0%', rate: 0.0, effectiveFrom: new Date('2000-01-01') }
        ]
      }
    ]
  },
  {
    country: { code: 'PH', name: 'Philippines' },
    currency: { code: 'PHP', name: 'Philippine Peso', symbol: '₱', decimalPrecision: 2 },
    frameworkName: 'Philippines VAT',
    types: [
      {
        name: 'VAT_STANDARD',
        rates: [
          { name: 'PH Standard VAT 12%', rate: 12.0, effectiveFrom: new Date('2006-01-01') }
        ]
      },
      {
        name: 'VAT_ZERO',
        rates: [
          { name: 'PH Zero Rated 0%', rate: 0.0, effectiveFrom: new Date('2006-01-01') }
        ]
      },
      {
        name: 'VAT_EXEMPT',
        rates: [
          { name: 'PH Exempt 0%', rate: 0.0, effectiveFrom: new Date('2006-01-01') }
        ]
      }
    ]
  },
  {
    country: { code: 'MY', name: 'Malaysia' },
    currency: { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', decimalPrecision: 2 },
    frameworkName: 'Malaysia SST',
    types: [
      {
        name: 'SST_SALES',
        rates: [
          { name: 'MY Sales Tax 10%', rate: 10.0, effectiveFrom: new Date('2018-09-01') },
          { name: 'MY Sales Tax 5%', rate: 5.0, effectiveFrom: new Date('2018-09-01') }
        ]
      },
      {
        name: 'SST_SERVICE',
        rates: [
          { name: 'MY Service Tax 6%', rate: 6.0, effectiveFrom: new Date('2018-09-01') },
          { name: 'MY Service Tax 8%', rate: 8.0, effectiveFrom: new Date('2024-03-01') }
        ]
      },
      {
        name: 'SST_ZERO',
        rates: [
          { name: 'MY Zero Rated 0%', rate: 0.0, effectiveFrom: new Date('2018-09-01') }
        ]
      },
      {
        name: 'SST_EXEMPT',
        rates: [
          { name: 'MY Exempt 0%', rate: 0.0, effectiveFrom: new Date('2018-09-01') }
        ]
      }
    ]
  },
  {
    country: { code: 'CN', name: 'China' },
    currency: { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', decimalPrecision: 2 },
    frameworkName: 'China VAT',
    types: [
      {
        name: 'VAT_STANDARD',
        rates: [
          { name: 'CN Standard VAT 13%', rate: 13.0, effectiveFrom: new Date('2019-04-01') }
        ]
      },
      {
        name: 'VAT_REDUCED_9',
        rates: [
          { name: 'CN Reduced VAT 9%', rate: 9.0, effectiveFrom: new Date('2019-04-01') }
        ]
      },
      {
        name: 'VAT_REDUCED_6',
        rates: [
          { name: 'CN Reduced VAT 6%', rate: 6.0, effectiveFrom: new Date('2019-04-01') }
        ]
      },
      {
        name: 'VAT_ZERO',
        rates: [
          { name: 'CN Zero Rated 0%', rate: 0.0, effectiveFrom: new Date('2000-01-01') }
        ]
      },
      {
        name: 'VAT_EXEMPT',
        rates: [
          { name: 'CN Exempt 0%', rate: 0.0, effectiveFrom: new Date('2000-01-01') }
        ]
      }
    ]
  },
  {
    country: { code: 'TW', name: 'Taiwan' },
    currency: { code: 'TWD', name: 'New Taiwan Dollar', symbol: 'NT$', decimalPrecision: 0 },
    frameworkName: 'Taiwan VAT',
    types: [
      {
        name: 'VAT_STANDARD',
        rates: [
          { name: 'TW Standard VAT 5%', rate: 5.0, effectiveFrom: new Date('2000-01-01') }
        ]
      },
      {
        name: 'VAT_ZERO',
        rates: [
          { name: 'TW Zero Rated 0%', rate: 0.0, effectiveFrom: new Date('2000-01-01') }
        ]
      },
      {
        name: 'VAT_EXEMPT',
        rates: [
          { name: 'TW Exempt 0%', rate: 0.0, effectiveFrom: new Date('2000-01-01') }
        ]
      }
    ]
  }
];

async function seedGroup4() {
  console.log("Seeding Group 4 countries...");
  for (const fw of frameworks) {
    let country = await prisma.country.findUnique({ where: { code: fw.country.code } });
    if (!country) {
      country = await prisma.country.create({
        data: {
          code: fw.country.code,
          name: fw.country.name
        }
      });
    }

    let currency = await prisma.currency.findUnique({ where: { code: fw.currency.code } });
    if (!currency) {
      currency = await prisma.currency.create({
        data: {
          code: fw.currency.code,
          name: fw.currency.name,
          symbol: fw.currency.symbol,
          decimalPrecision: fw.currency.decimalPrecision
        }
      });
    }

    let framework = await prisma.taxFramework.findFirst({ where: { name: fw.frameworkName } });
    if (!framework) {
      framework = await prisma.taxFramework.create({
        data: {
          name: fw.frameworkName,
          countryId: country.id
        }
      });
    }

    for (const tt of fw.types) {
      let taxType = await prisma.taxType.findFirst({ where: { name: tt.name, taxFrameworkId: framework.id } });
      if (!taxType) {
        taxType = await prisma.taxType.create({
          data: {
            name: tt.name,
            taxFrameworkId: framework.id
          }
        });
      }

      for (const rt of tt.rates) {
        const existingRate = await prisma.taxRate.findFirst({ where: { name: rt.name, taxTypeId: taxType.id } });
        if (!existingRate) {
          await prisma.taxRate.create({
            data: {
              name: rt.name,
              rate: rt.rate,
              taxTypeId: taxType.id,
              effectiveFrom: rt.effectiveFrom,
              effectiveTo: null
            }
          });
        }
      }
    }
    console.log(`Seeded ${fw.country.code} - ${fw.frameworkName}`);
  }
  console.log("Group 4 seeding complete.");
}

seedGroup4().catch(console.error).finally(() => prisma.$disconnect());
