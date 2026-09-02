const prisma = require('./src/config/prisma');

async function seedIndia() {
    // Ensure UK VAT Framework exists
    console.log("Checking UK VAT framework...");
    const gb = await prisma.country.upsert({ 
        where: { code: 'GB' }, 
        update: {}, 
        create: { code: 'GB', name: 'United Kingdom' }
    });
    let ukFw = await prisma.taxFramework.findUnique({ where: { countryId: gb.id } });
    if (!ukFw) {
      ukFw = await prisma.taxFramework.create({
        data: {
          name: 'UK VAT',
          countryId: gb.id
        }
      });
    }

    const ukTypes = [
        {
            name: 'VAT_STANDARD',
            rates: [{ name: 'UK VAT 20%', rate: 20, effectiveFrom: new Date('2011-01-04') }]
        },
        {
            name: 'VAT_REDUCED',
            rates: [{ name: 'UK VAT 5%', rate: 5, effectiveFrom: new Date('2011-01-04') }]
        },
        {
            name: 'VAT_ZERO',
            rates: [{ name: 'UK VAT 0%', rate: 0, effectiveFrom: new Date('2011-01-04') }]
        },
        {
            name: 'VAT_EXEMPT',
            rates: [{ name: 'UK VAT Exempt', rate: 0, effectiveFrom: new Date('2011-01-04') }]
        },
        {
            name: 'VAT_REVERSE_CHARGE',
            rates: [{ name: 'UK Reverse Charge 20%', rate: 20, effectiveFrom: new Date('2011-01-04') }]
        }
    ];

    for (const tData of ukTypes) {
        let tt = await prisma.taxType.findFirst({ where: { name: tData.name, taxFrameworkId: ukFw.id } });
        if (!tt) {
            tt = await prisma.taxType.create({ data: { name: tData.name, taxFrameworkId: ukFw.id } });
        }
        for (const rData of tData.rates) {
            const existingRate = await prisma.taxRate.findFirst({ where: { taxTypeId: tt.id, name: rData.name } });
            if (!existingRate) {
                await prisma.taxRate.create({
                    data: {
                        name: rData.name,
                        rate: rData.rate,
                        effectiveFrom: rData.effectiveFrom,
                        taxTypeId: tt.id
                    }
                });
            }
        }
    }

    // --- SA VAT ---
    const sa = await prisma.country.upsert({
        where: { code: 'SA' },
        update: {},
        create: { code: 'SA', name: 'Saudi Arabia' }
    });

    let saFw = await prisma.taxFramework.findUnique({ where: { countryId: sa.id } });
    if (!saFw) {
        saFw = await prisma.taxFramework.create({
            data: { name: 'Saudi Arabia VAT', countryId: sa.id }
        });
    }

    const saTypes = [
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
            rates: [{ name: 'SA Reverse Charge 15%', rate: 15, effectiveFrom: new Date('2020-07-01') }]
        }
    ];

    for (const tData of saTypes) {
        let tt = await prisma.taxType.findFirst({ where: { name: tData.name, taxFrameworkId: saFw.id } });
        if (!tt) {
            tt = await prisma.taxType.create({ data: { name: tData.name, taxFrameworkId: saFw.id } });
        }
        for (const rData of tData.rates) {
            const existingRate = await prisma.taxRate.findFirst({ where: { taxTypeId: tt.id, name: rData.name } });
            if (!existingRate) {
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

    // --- AU GST ---
    const au = await prisma.country.upsert({ 
        where: { code: 'AU' }, 
        update: {}, 
        create: { code: 'AU', name: 'Australia' }
    });

    let auFw = await prisma.taxFramework.findUnique({ where: { countryId: au.id } });
    if (!auFw) {
      auFw = await prisma.taxFramework.create({
        data: {
          name: 'AU GST',
          countryId: au.id
        }
      });
    }

    const auTypes = [
        {
            name: 'GST_STANDARD',
            rates: [{ name: 'AU GST 10%', rate: 10, effectiveFrom: new Date('2000-07-01') }]
        },
        {
            name: 'GST_FREE',
            rates: [{ name: 'AU GST 0%', rate: 0, effectiveFrom: new Date('2000-07-01') }]
        },
        {
            name: 'INPUT_TAXED',
            rates: [{ name: 'AU Input Taxed 0%', rate: 0, effectiveFrom: new Date('2000-07-01') }]
        },
        {
            name: 'GST_REVERSE_CHARGE',
            rates: [{ name: 'AU Reverse Charge 10%', rate: 10, effectiveFrom: new Date('2000-07-01') }]
        }
    ];

    for (const tData of auTypes) {
        let tt = await prisma.taxType.findFirst({ where: { name: tData.name, taxFrameworkId: auFw.id } });
        if (!tt) {
            tt = await prisma.taxType.create({ data: { name: tData.name, taxFrameworkId: auFw.id } });
        }
        for (const rData of tData.rates) {
            const existingRate = await prisma.taxRate.findFirst({ where: { taxTypeId: tt.id, name: rData.name } });
            if (!existingRate) {
                await prisma.taxRate.create({
                    data: {
                        name: rData.name,
                        rate: rData.rate,
                        effectiveFrom: rData.effectiveFrom,
                        taxTypeId: tt.id
                    }
                });
            }
        }
    }

    // --- SG GST ---
    const sg = await prisma.country.upsert({
        where: { code: 'SG' },
        update: {},
        create: { code: 'SG', name: 'Singapore' }
    });

    let sgFw = await prisma.taxFramework.findUnique({ where: { countryId: sg.id } });
    if (!sgFw) {
        sgFw = await prisma.taxFramework.create({
            data: { name: 'SG GST', countryId: sg.id }
        });
    }

    const sgTypes = [
        {
            name: 'GST_STANDARD',
            rates: [
                { name: 'SG Standard GST 9%', rate: 9, effectiveFrom: new Date('2024-01-01') },
                { name: 'SG Standard GST 8% (hist.)', rate: 8, effectiveFrom: new Date('2023-01-01'), effectiveTo: new Date('2023-12-31') },
                { name: 'SG Standard GST 7% (hist.)', rate: 7, effectiveFrom: new Date('2007-07-01'), effectiveTo: new Date('2022-12-31') }
            ]
        },
        {
            name: 'GST_ZERO',
            rates: [{ name: 'SG Zero Rated 0%', rate: 0, effectiveFrom: new Date('2007-07-01') }]
        },
        {
            name: 'GST_EXEMPT',
            rates: [{ name: 'SG Exempt 0%', rate: 0, effectiveFrom: new Date('2007-07-01') }]
        },
        {
            name: 'GST_REVERSE_CHARGE',
            rates: [{ name: 'SG Reverse Charge 9%', rate: 9, effectiveFrom: new Date('2020-01-01') }]
        }
    ];

    for (const tData of sgTypes) {
        let tt = await prisma.taxType.findFirst({ where: { name: tData.name, taxFrameworkId: sgFw.id } });
        if (!tt) {
            tt = await prisma.taxType.create({ data: { name: tData.name, taxFrameworkId: sgFw.id } });
        }
        for (const rData of tData.rates) {
            const existingRate = await prisma.taxRate.findFirst({ where: { taxTypeId: tt.id, name: rData.name } });
            if (!existingRate) {
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

    // --- JP JCT ---
    const jp = await prisma.country.upsert({
        where: { code: 'JP' },
        update: {},
        create: { code: 'JP', name: 'Japan' }
    });

    let jpFw = await prisma.taxFramework.findUnique({ where: { countryId: jp.id } });
    if (!jpFw) {
        jpFw = await prisma.taxFramework.create({
            data: { name: 'Japan Consumption Tax', countryId: jp.id }
        });
    }

    const jpTypes = [
        {
            name: 'JCT_STANDARD',
            rates: [
                { name: 'JP Standard JCT 10%', rate: 10, effectiveFrom: new Date('2019-10-01') },
                { name: 'JP Standard JCT 8% (hist.)', rate: 8, effectiveFrom: new Date('2014-04-01'), effectiveTo: new Date('2019-09-30') }
            ]
        },
        {
            name: 'JCT_REDUCED',
            rates: [
                { name: 'JP Reduced JCT 8%', rate: 8, effectiveFrom: new Date('2019-10-01') }
            ]
        },
        {
            name: 'JCT_ZERO',
            rates: [{ name: 'JP Zero Rated 0%', rate: 0, effectiveFrom: new Date('1997-04-01') }]
        },
        {
            name: 'JCT_EXEMPT',
            rates: [{ name: 'JP Exempt 0%', rate: 0, effectiveFrom: new Date('1997-04-01') }]
        },
        {
            name: 'JCT_REVERSE_CHARGE',
            rates: [{ name: 'JP Reverse Charge 10%', rate: 10, effectiveFrom: new Date('2019-10-01') }]
        }
    ];

    for (const tData of jpTypes) {
        let tt = await prisma.taxType.findFirst({ where: { name: tData.name, taxFrameworkId: jpFw.id } });
        if (!tt) {
            tt = await prisma.taxType.create({ data: { name: tData.name, taxFrameworkId: jpFw.id } });
        }
        for (const rData of tData.rates) {
            const existingRate = await prisma.taxRate.findFirst({ where: { taxTypeId: tt.id, name: rData.name } });
            if (!existingRate) {
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

    // --- ZA VAT ---
    const za = await prisma.country.upsert({
        where: { code: 'ZA' },
        update: {},
        create: { code: 'ZA', name: 'South Africa' }
    });

    let zaFw = await prisma.taxFramework.findUnique({ where: { countryId: za.id } });
    if (!zaFw) {
        zaFw = await prisma.taxFramework.create({
            data: { name: 'South Africa VAT', countryId: za.id }
        });
    }

    const zaTypes = [
        {
            name: 'VAT_STANDARD',
            rates: [
                { name: 'ZA Standard VAT 15%', rate: 15, effectiveFrom: new Date('2018-04-01') },
                { name: 'ZA Standard VAT 14% (hist.)', rate: 14, effectiveFrom: new Date('1993-04-07'), effectiveTo: new Date('2018-03-31') }
            ]
        },
        {
            name: 'VAT_ZERO',
            rates: [{ name: 'ZA Zero Rated 0%', rate: 0, effectiveFrom: new Date('1991-09-30') }]
        },
        {
            name: 'VAT_EXEMPT',
            rates: [{ name: 'ZA Exempt 0%', rate: 0, effectiveFrom: new Date('1991-09-30') }]
        },
        {
            name: 'VAT_REVERSE_CHARGE',
            rates: [{ name: 'ZA Reverse Charge 15%', rate: 15, effectiveFrom: new Date('2018-04-01') }]
        }
    ];

    for (const tData of zaTypes) {
        let tt = await prisma.taxType.findFirst({ where: { name: tData.name, taxFrameworkId: zaFw.id } });
        if (!tt) {
            tt = await prisma.taxType.create({ data: { name: tData.name, taxFrameworkId: zaFw.id } });
        }
        for (const rData of tData.rates) {
            const existingRate = await prisma.taxRate.findFirst({ where: { taxTypeId: tt.id, name: rData.name } });
            if (!existingRate) {
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

    // --- DE MwSt ---
    const de = await prisma.country.upsert({ 
        where: { code: 'DE' }, 
        update: {}, 
        create: { code: 'DE', name: 'Germany' }
    });

    let deFw = await prisma.taxFramework.findUnique({ where: { countryId: de.id } });
    if (!deFw) {
      deFw = await prisma.taxFramework.create({
        data: {
          name: 'Deutschland MwSt',
          countryId: de.id
        }
      });
    }

    const deTypes = [
        {
            name: 'MwSt_STANDARD',
            rates: [
                { name: 'DE Standard MwSt 19%', rate: 19, effectiveFrom: new Date('2007-01-01') },
                { name: 'DE Standard MwSt 16% (COVID)', rate: 16, effectiveFrom: new Date('2020-07-01'), effectiveTo: new Date('2020-12-31') }
            ]
        },
        {
            name: 'MwSt_ERMAESSIGT',
            rates: [
                { name: 'DE Ermäßigt MwSt 7%', rate: 7, effectiveFrom: new Date('2007-01-01') },
                { name: 'DE Ermäßigt MwSt 5% (COVID)', rate: 5, effectiveFrom: new Date('2020-07-01'), effectiveTo: new Date('2020-12-31') }
            ]
        },
        {
            name: 'MwSt_NULLSATZ',
            rates: [{ name: 'DE Zero-Rated 0%', rate: 0, effectiveFrom: new Date('2007-01-01') }]
        },
        {
            name: 'MwSt_BEFREIT',
            rates: [{ name: 'DE Exempt 0%', rate: 0, effectiveFrom: new Date('2007-01-01') }]
        },
        {
            name: 'MwSt_REVERSE_CHARGE',
            rates: [
                { name: 'DE Reverse Charge 19%', rate: 19, effectiveFrom: new Date('2007-01-01') },
                { name: 'DE Reverse Charge 16% (COVID)', rate: 16, effectiveFrom: new Date('2020-07-01'), effectiveTo: new Date('2020-12-31') }
            ]
        }
    ];

    for (const tData of deTypes) {
        let tt = await prisma.taxType.findFirst({ where: { name: tData.name, taxFrameworkId: deFw.id } });
        if (!tt) {
            tt = await prisma.taxType.create({ data: { name: tData.name, taxFrameworkId: deFw.id } });
        }
        for (const rData of tData.rates) {
            const existingRate = await prisma.taxRate.findFirst({ where: { taxTypeId: tt.id, name: rData.name } });
            if (!existingRate) {
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

    console.log("Seeding complete. Frameworks ready.");

    console.log("Seeding India...");
    
    const c = await prisma.country.upsert({ 
        where: { code: 'IN' }, 
        update: {}, 
        create: { code: 'IN', name: 'India' }
    });

    const curr = await prisma.currency.upsert({ 
        where: { code: 'INR' }, 
        update: {}, 
        create: { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimalPrecision: 2 }
    });

    let fw = await prisma.taxFramework.upsert({ 
        where: { countryId: c.id },
        update: {},
        create: { name: 'India GST', countryId: c.id } 
    });

    const types = [
        {
            name: 'CGST',
            rates: [{ name: 'CGST 9%', rate: 9, effectiveFrom: new Date('2017-07-01') }, { name: 'CGST 2.5%', rate: 2.5, effectiveFrom: new Date('2017-07-01') }]
        },
        {
            name: 'SGST',
            rates: [{ name: 'SGST 9%', rate: 9, effectiveFrom: new Date('2017-07-01') }, { name: 'SGST 2.5%', rate: 2.5, effectiveFrom: new Date('2017-07-01') }]
        },
        {
            name: 'IGST',
            rates: [{ name: 'IGST 18%', rate: 18, effectiveFrom: new Date('2017-07-01') }, { name: 'IGST 5%', rate: 5, effectiveFrom: new Date('2017-07-01') }, { name: 'IGST 0%', rate: 0, effectiveFrom: new Date('2017-07-01') }]
        }
    ];

    for (const tData of types) {
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
    console.log("India seeded.");
    await prisma.$disconnect();
}

seedIndia();
