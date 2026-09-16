const prisma = require('./src/config/prisma');

const frameworks = [
  {
    country: { code: 'PL', name: 'Poland' },
    currency: { code: 'PLN', name: 'Polish Zloty', symbol: 'zł', decimalPrecision: 2 },
    frameworkName: 'Poland VAT',
    types: [
      {
        name: 'VAT_STANDARD',
        rates: [
          { name: 'PL Standard VAT 23%', rate: 23.0, effectiveFrom: new Date('2011-01-01') }
        ]
      },
      {
        name: 'VAT_REDUCED',
        rates: [
          { name: 'PL Reduced VAT 8%', rate: 8.0, effectiveFrom: new Date('2011-01-01') }
        ]
      },
      {
        name: 'VAT_SUPER_REDUCED',
        rates: [
          { name: 'PL Reduced VAT 5%', rate: 5.0, effectiveFrom: new Date('2011-01-01') }
        ]
      },
      {
        name: 'VAT_ZERO',
        rates: [
          { name: 'PL Zero Rated 0%', rate: 0.0, effectiveFrom: new Date('2000-01-01') }
        ]
      },
      {
        name: 'VAT_EXEMPT',
        rates: [
          { name: 'PL Exempt 0%', rate: 0.0, effectiveFrom: new Date('2000-01-01') }
        ]
      }
    ]
  },
  {
    country: { code: 'SE', name: 'Sweden' },
    currency: { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', decimalPrecision: 2 },
    frameworkName: 'Sweden Moms',
    types: [
      {
        name: 'MOMS_STANDARD',
        rates: [
          { name: 'SE Standard Moms 25%', rate: 25.0, effectiveFrom: new Date('2000-01-01') }
        ]
      },
      {
        name: 'MOMS_REDUCED',
        rates: [
          { name: 'SE Reduced Moms 12%', rate: 12.0, effectiveFrom: new Date('2000-01-01') }
        ]
      },
      {
        name: 'MOMS_SUPER_REDUCED',
        rates: [
          { name: 'SE Reduced Moms 6%', rate: 6.0, effectiveFrom: new Date('2000-01-01') }
        ]
      },
      {
        name: 'MOMS_ZERO',
        rates: [
          { name: 'SE Zero Rated 0%', rate: 0.0, effectiveFrom: new Date('2000-01-01') }
        ]
      },
      {
        name: 'MOMS_EXEMPT',
        rates: [
          { name: 'SE Exempt 0%', rate: 0.0, effectiveFrom: new Date('2000-01-01') }
        ]
      }
    ]
  },
  {
    country: { code: 'NO', name: 'Norway' },
    currency: { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', decimalPrecision: 2 },
    frameworkName: 'Norway MVA',
    types: [
      {
        name: 'MVA_STANDARD',
        rates: [
          { name: 'NO Standard MVA 25%', rate: 25.0, effectiveFrom: new Date('2000-01-01') }
        ]
      },
      {
        name: 'MVA_REDUCED',
        rates: [
          { name: 'NO Reduced MVA 15%', rate: 15.0, effectiveFrom: new Date('2000-01-01') }
        ]
      },
      {
        name: 'MVA_SUPER_REDUCED',
        rates: [
          { name: 'NO Reduced MVA 12%', rate: 12.0, effectiveFrom: new Date('2000-01-01') }
        ]
      },
      {
        name: 'MVA_ZERO',
        rates: [
          { name: 'NO Zero Rated 0%', rate: 0.0, effectiveFrom: new Date('2000-01-01') }
        ]
      },
      {
        name: 'MVA_EXEMPT',
        rates: [
          { name: 'NO Exempt 0%', rate: 0.0, effectiveFrom: new Date('2000-01-01') }
        ]
      }
    ]
  },
  {
    country: { code: 'BE', name: 'Belgium' },
    currency: { code: 'EUR', name: 'Euro', symbol: '€', decimalPrecision: 2 },
    frameworkName: 'Belgium TVA/BTW',
    types: [
      {
        name: 'TVA_STANDARD',
        rates: [
          { name: 'BE Standard TVA 21%', rate: 21.0, effectiveFrom: new Date('2000-01-01') }
        ]
      },
      {
        name: 'TVA_REDUCED',
        rates: [
          { name: 'BE Reduced TVA 12%', rate: 12.0, effectiveFrom: new Date('2000-01-01') }
        ]
      },
      {
        name: 'TVA_SUPER_REDUCED',
        rates: [
          { name: 'BE Reduced TVA 6%', rate: 6.0, effectiveFrom: new Date('2000-01-01') }
        ]
      },
      {
        name: 'TVA_ZERO',
        rates: [
          { name: 'BE Zero Rated 0%', rate: 0.0, effectiveFrom: new Date('2000-01-01') }
        ]
      },
      {
        name: 'TVA_EXEMPT',
        rates: [
          { name: 'BE Exempt 0%', rate: 0.0, effectiveFrom: new Date('2000-01-01') }
        ]
      }
    ]
  },
  {
    country: { code: 'AT', name: 'Austria' },
    currency: { code: 'EUR', name: 'Euro', symbol: '€', decimalPrecision: 2 },
    frameworkName: 'Austria USt',
    types: [
      {
        name: 'UST_STANDARD',
        rates: [
          { name: 'AT Standard USt 20%', rate: 20.0, effectiveFrom: new Date('2000-01-01') }
        ]
      },
      {
        name: 'UST_REDUCED',
        rates: [
          { name: 'AT Reduced USt 13%', rate: 13.0, effectiveFrom: new Date('2016-01-01') }
        ]
      },
      {
        name: 'UST_SUPER_REDUCED',
        rates: [
          { name: 'AT Reduced USt 10%', rate: 10.0, effectiveFrom: new Date('2000-01-01') }
        ]
      },
      {
        name: 'UST_ZERO',
        rates: [
          { name: 'AT Zero Rated 0%', rate: 0.0, effectiveFrom: new Date('2000-01-01') }
        ]
      },
      {
        name: 'UST_EXEMPT',
        rates: [
          { name: 'AT Exempt 0%', rate: 0.0, effectiveFrom: new Date('2000-01-01') }
        ]
      }
    ]
  }
];

async function seed() {
  console.log('Seeding Group 3 countries...');
  for (const item of frameworks) {
    const c = await prisma.country.upsert({
      where: { code: item.country.code },
      update: {},
      create: item.country
    });
    const cur = await prisma.currency.upsert({
      where: { code: item.currency.code },
      update: {},
      create: item.currency
    });
    
    let fw = await prisma.taxFramework.findFirst({
      where: { name: item.frameworkName }
    });
    
    if (!fw) {
        fw = await prisma.taxFramework.create({
            data: { name: item.frameworkName, countryId: c.id }
        });
    }

    for (const type of item.types) {
      let t = await prisma.taxType.findFirst({
        where: { name: type.name, taxFrameworkId: fw.id }
      });
      if (!t) {
        t = await prisma.taxType.create({
          data: { name: type.name, taxFrameworkId: fw.id }
        });
      }
      
      for (const rt of type.rates) {
        const exist = await prisma.taxRate.findFirst({
          where: { name: rt.name, taxTypeId: t.id, effectiveFrom: rt.effectiveFrom }
        });
        if (!exist) {
          await prisma.taxRate.create({
            data: {
              name: rt.name,
              rate: rt.rate,
              effectiveFrom: rt.effectiveFrom,
              effectiveTo: rt.effectiveTo,
              taxTypeId: t.id
            }
          });
        }
      }
    }
    console.log(`Seeded ${item.country.code} - ${item.frameworkName}`);
  }
  
  console.log('Group 3 seeding complete.');
}

seed().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(() => {
  prisma.$disconnect();
});
