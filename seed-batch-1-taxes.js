const prisma = require('./src/config/prisma');

const data = [
  {
    country: { code: 'US', name: 'United States' },
    currency: { code: 'USD', name: 'US Dollar', symbol: '$', decimalPrecision: 2 },
    frameworkName: 'US Sales Tax',
    types: [
      {
        name: 'STATE_SALES_TAX',
        rates: [
          { name: 'US CA State Sales Tax 7.25%', rate: 7.25, effectiveFrom: new Date('2000-01-01') },
          { name: 'US NY State Sales Tax 4.0%', rate: 4.0, effectiveFrom: new Date('2000-01-01') },
        ]
      }
    ]
  },
  {
    country: { code: 'BR', name: 'Brazil' },
    currency: { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', decimalPrecision: 2 },
    frameworkName: 'Brazil ICMS',
    types: [
      {
        name: 'ICMS',
        rates: [
          { name: 'BR ICMS (São Paulo Standard) 18%', rate: 18, effectiveFrom: new Date('2000-01-01') },
        ]
      }
    ]
  },
  {
    country: { code: 'JP', name: 'Japan' },
    currency: { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimalPrecision: 0 },
    frameworkName: 'Japan Consumption Tax',
    types: [
      {
        name: 'CONSUMPTION_TAX_STANDARD',
        rates: [
          { name: 'JP Standard Consumption Tax 10%', rate: 10, effectiveFrom: new Date('2019-10-01') },
        ]
      },
      {
        name: 'CONSUMPTION_TAX_REDUCED',
        rates: [
          { name: 'JP Reduced Consumption Tax 8%', rate: 8, effectiveFrom: new Date('2019-10-01') }, // Note: 8% was standard before, now reduced
        ]
      }
    ]
  },
  {
    country: { code: 'FR', name: 'France' },
    currency: { code: 'EUR', name: 'Euro', symbol: '€', decimalPrecision: 2 },
    frameworkName: 'France TVA',
    types: [
      {
        name: 'TVA_STANDARD',
        rates: [{ name: 'FR Standard TVA 20%', rate: 20, effectiveFrom: new Date('2014-01-01') }]
      },
      {
        name: 'TVA_INTERMEDIATE',
        rates: [{ name: 'FR Intermediate TVA 10%', rate: 10, effectiveFrom: new Date('2014-01-01') }]
      },
      {
        name: 'TVA_REDUCED',
        rates: [{ name: 'FR Reduced TVA 5.5%', rate: 5.5, effectiveFrom: new Date('2014-01-01') }]
      },
      {
        name: 'TVA_SUPER_REDUCED',
        rates: [{ name: 'FR Super-Reduced TVA 2.1%', rate: 2.1, effectiveFrom: new Date('2014-01-01') }]
      }
    ]
  },
  {
    country: { code: 'MX', name: 'Mexico' },
    currency: { code: 'MXN', name: 'Mexican Peso', symbol: '$', decimalPrecision: 2 },
    frameworkName: 'Mexico IVA',
    types: [
      {
        name: 'IVA_STANDARD',
        rates: [{ name: 'MX Standard IVA 16%', rate: 16, effectiveFrom: new Date('2010-01-01') }]
      },
      {
        name: 'IVA_BORDER',
        rates: [{ name: 'MX Border IVA 8%', rate: 8, effectiveFrom: new Date('2019-01-01') }]
      },
      {
        name: 'IVA_ZERO',
        rates: [{ name: 'MX Zero Rated IVA 0%', rate: 0, effectiveFrom: new Date('2000-01-01') }]
      }
    ]
  },
  {
    country: { code: 'IT', name: 'Italy' },
    currency: { code: 'EUR', name: 'Euro', symbol: '€', decimalPrecision: 2 },
    frameworkName: 'Italy IVA',
    types: [
      {
        name: 'IVA_STANDARD',
        rates: [{ name: 'IT Standard IVA 22%', rate: 22, effectiveFrom: new Date('2013-10-01') }]
      },
      {
        name: 'IVA_REDUCED',
        rates: [{ name: 'IT Reduced IVA 10%', rate: 10, effectiveFrom: new Date('2000-01-01') }]
      },
      {
        name: 'IVA_REDUCED_LOW',
        rates: [{ name: 'IT Reduced IVA 5%', rate: 5, effectiveFrom: new Date('2000-01-01') }]
      },
      {
        name: 'IVA_SUPER_REDUCED',
        rates: [{ name: 'IT Super-Reduced IVA 4%', rate: 4, effectiveFrom: new Date('2000-01-01') }]
      }
    ]
  },
  {
    country: { code: 'KR', name: 'South Korea' },
    currency: { code: 'KRW', name: 'South Korean Won', symbol: '₩', decimalPrecision: 0 },
    frameworkName: 'South Korea VAT',
    types: [
      {
        name: 'VAT_STANDARD',
        rates: [{ name: 'KR Standard VAT 10%', rate: 10, effectiveFrom: new Date('1977-07-01') }]
      },
      {
        name: 'VAT_ZERO',
        rates: [{ name: 'KR Zero Rated VAT 0%', rate: 0, effectiveFrom: new Date('1977-07-01') }]
      }
    ]
  },
  {
    country: { code: 'ES', name: 'Spain' },
    currency: { code: 'EUR', name: 'Euro', symbol: '€', decimalPrecision: 2 },
    frameworkName: 'Spain IVA',
    types: [
      {
        name: 'IVA_STANDARD',
        rates: [{ name: 'ES Standard IVA 21%', rate: 21, effectiveFrom: new Date('2012-09-01') }]
      },
      {
        name: 'IVA_REDUCED',
        rates: [{ name: 'ES Reduced IVA 10%', rate: 10, effectiveFrom: new Date('2012-09-01') }]
      },
      {
        name: 'IVA_SUPER_REDUCED',
        rates: [{ name: 'ES Super-Reduced IVA 4%', rate: 4, effectiveFrom: new Date('2012-09-01') }]
      },
      {
        name: 'IVA_TEMPORARY_FOOD_5',
        rates: [{ name: 'ES Temporary Food IVA 5%', rate: 5, effectiveFrom: new Date('2023-01-01'), effectiveTo: new Date('2024-12-31') }]
      },
      {
        name: 'IVA_TEMPORARY_FOOD_2',
        rates: [{ name: 'ES Temporary Food IVA 2%', rate: 2, effectiveFrom: new Date('2024-10-01'), effectiveTo: new Date('2024-12-31') }]
      },
      {
        name: 'IVA_TEMPORARY_FOOD_0',
        rates: [{ name: 'ES Temporary Food IVA 0%', rate: 0, effectiveFrom: new Date('2023-01-01'), effectiveTo: new Date('2024-09-30') }]
      }
    ]
  },
  {
    country: { code: 'NL', name: 'Netherlands' },
    currency: { code: 'EUR', name: 'Euro', symbol: '€', decimalPrecision: 2 },
    frameworkName: 'Netherlands BTW',
    types: [
      {
        name: 'BTW_STANDARD',
        rates: [{ name: 'NL Standard BTW 21%', rate: 21, effectiveFrom: new Date('2012-10-01') }]
      },
      {
        name: 'BTW_REDUCED',
        rates: [
          { name: 'NL Reduced BTW 9%', rate: 9, effectiveFrom: new Date('2019-01-01') },
          { name: 'NL Reduced BTW 6% (hist.)', rate: 6, effectiveFrom: new Date('2000-01-01'), effectiveTo: new Date('2018-12-31') },
        ]
      },
      {
        name: 'BTW_ZERO',
        rates: [{ name: 'NL Zero Rated BTW 0%', rate: 0, effectiveFrom: new Date('2000-01-01') }]
      }
    ]
  },
  {
    country: { code: 'CH', name: 'Switzerland' },
    currency: { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', decimalPrecision: 2 },
    frameworkName: 'Switzerland MWST',
    types: [
      {
        name: 'MWST_STANDARD',
        rates: [
          { name: 'CH Standard MWST 8.1%', rate: 8.1, effectiveFrom: new Date('2024-01-01') },
          { name: 'CH Standard MWST 7.7% (hist.)', rate: 7.7, effectiveFrom: new Date('2018-01-01'), effectiveTo: new Date('2023-12-31') },
        ]
      },
      {
        name: 'MWST_ACCOMMODATION',
        rates: [
          { name: 'CH Accommodation MWST 3.8%', rate: 3.8, effectiveFrom: new Date('2024-01-01') },
          { name: 'CH Accommodation MWST 3.7% (hist.)', rate: 3.7, effectiveFrom: new Date('2018-01-01'), effectiveTo: new Date('2023-12-31') },
        ]
      },
      {
        name: 'MWST_REDUCED',
        rates: [
          { name: 'CH Reduced MWST 2.6%', rate: 2.6, effectiveFrom: new Date('2024-01-01') },
          { name: 'CH Reduced MWST 2.5% (hist.)', rate: 2.5, effectiveFrom: new Date('2018-01-01'), effectiveTo: new Date('2023-12-31') },
        ]
      }
    ]
  },
  {
    country: { code: 'SA', name: 'Saudi Arabia' },
    currency: { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', decimalPrecision: 2 },
    frameworkName: 'Saudi Arabia VAT',
    types: [
      {
        name: 'VAT_STANDARD',
        rates: [
          { name: 'SA Standard VAT 15%', rate: 15, effectiveFrom: new Date('2020-07-01') },
          { name: 'SA Standard VAT 5% (hist.)', rate: 5, effectiveFrom: new Date('2018-01-01'), effectiveTo: new Date('2020-06-30') }
        ]
      },
      {
        name: 'VAT_ZERO',
        rates: [{ name: 'SA Zero Rated 0%', rate: 0, effectiveFrom: new Date('2018-01-01') }]
      },
      {
        name: 'VAT_EXEMPT',
        rates: [{ name: 'SA Exempt 0%', rate: 0, effectiveFrom: new Date('2018-01-01') }]
      },
      {
        name: 'VAT_REVERSE_CHARGE',
        rates: [
          { name: 'SA Reverse Charge 15%', rate: 15, effectiveFrom: new Date('2020-07-01') },
          { name: 'SA Reverse Charge 5% (hist.)', rate: 5, effectiveFrom: new Date('2018-01-01'), effectiveTo: new Date('2020-06-30') }
        ]
      }
    ]
  }
];

async function seedBatch1() {
  try {
    console.log("Seeding Batch 1 countries...");

    for (const cData of data) {
      // 1. Ensure country exists
      const c = await prisma.country.upsert({ 
        where: { code: cData.country.code }, 
        update: {}, 
        create: cData.country
      });

      // 2. Ensure currency exists
      const curr = await prisma.currency.upsert({ 
        where: { code: cData.currency.code }, 
        update: {}, 
        create: cData.currency
      });

      // 3. Framework
      let fw = await prisma.taxFramework.upsert({ 
        where: { countryId: c.id },
        update: {},
        create: { name: cData.frameworkName, countryId: c.id } 
      });

      // 4. Tax Types & Rates
      for (const tData of cData.types) {
        let tt = await prisma.taxType.findFirst({ where: { name: tData.name, taxFrameworkId: fw.id } });
        if (!tt) {
          tt = await prisma.taxType.create({ data: { name: tData.name, taxFrameworkId: fw.id } });
        }

        for (const rData of tData.rates) {
          let tr = await prisma.taxRate.findFirst({ where: { name: rData.name, taxTypeId: tt.id } });
          if (!tr) {
            await prisma.taxRate.create({
              data: {
                name: rData.name,
                rate: rData.rate,
                effectiveFrom: rData.effectiveFrom,
                effectiveTo: rData.effectiveTo || null,
                taxTypeId: tt.id
              }
            });
          }
        }
      }
      
      console.log(`Seeded ${cData.country.code} - ${cData.frameworkName}`);
    }

    console.log("Batch 1 seeding complete.");
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}
seedBatch1();
