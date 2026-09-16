const prisma = require('./src/config/prisma');

async function seedGroup2Taxes() {
  async function upsertTaxType(fwId, name) {
    let type = await prisma.taxType.findFirst({ where: { taxFrameworkId: fwId, name } });
    if (!type) {
      type = await prisma.taxType.create({ data: { taxFrameworkId: fwId, name } });
    }
    return type;
  }

  const seedTaxRates = async (typeId, ratesData) => {
    for (const r of ratesData) {
      const existing = await prisma.taxRate.findFirst({
        where: { taxTypeId: typeId, rate: r.rate, effectiveFrom: new Date(r.effectiveFrom) }
      });
      if (!existing) {
        await prisma.taxRate.create({
          data: {
            taxTypeId: typeId,
            name: r.name,
            rate: r.rate,
            effectiveFrom: new Date(r.effectiveFrom),
            effectiveTo: r.effectiveTo ? new Date(r.effectiveTo) : null
          }
        });
      }
    }
  };

  try {
    // Mexico (MX)
    const mxCountry = await prisma.country.upsert({ where: { code: 'MX' }, update: {}, create: { code: 'MX', name: 'Mexico' } });
    const mxFw = await prisma.taxFramework.upsert({ where: { countryId: mxCountry.id }, update: {}, create: { name: 'Mexico IVA', countryId: mxCountry.id } });
    const mxStandard = await upsertTaxType(mxFw.id, 'IVA_STANDARD');
    const mxBorder = await upsertTaxType(mxFw.id, 'IVA_BORDER');
    const mxZero = await upsertTaxType(mxFw.id, 'IVA_ZERO');
    await seedTaxRates(mxStandard.id, [{ name: 'MX Standard IVA 16%', rate: 16.0, effectiveFrom: '2010-01-01T00:00:00Z', effectiveTo: null }]);
    await seedTaxRates(mxBorder.id, [{ name: 'MX Border IVA 8%', rate: 8.0, effectiveFrom: '2019-01-01T00:00:00Z', effectiveTo: null }]);
    await seedTaxRates(mxZero.id, [{ name: 'MX Zero Rated IVA 0%', rate: 0.0, effectiveFrom: '1980-01-01T00:00:00Z', effectiveTo: null }, { name: 'MX Zero Rated Export 0%', rate: 0.0, effectiveFrom: '1980-01-01T00:00:00Z', effectiveTo: null }]);

    // South Korea (KR)
    const krCountry = await prisma.country.upsert({ where: { code: 'KR' }, update: {}, create: { code: 'KR', name: 'South Korea' } });
    const krFw = await prisma.taxFramework.upsert({ where: { countryId: krCountry.id }, update: {}, create: { name: 'South Korea VAT', countryId: krCountry.id } });
    const krStandard = await upsertTaxType(krFw.id, 'VAT_STANDARD');
    const krZero = await upsertTaxType(krFw.id, 'VAT_ZERO');
    await seedTaxRates(krStandard.id, [{ name: 'KR Standard VAT 10%', rate: 10.0, effectiveFrom: '1977-07-01T00:00:00Z', effectiveTo: null }]);
    await seedTaxRates(krZero.id, [{ name: 'KR Zero Rated Export 0%', rate: 0.0, effectiveFrom: '1977-07-01T00:00:00Z', effectiveTo: null }]);

    // Netherlands (NL)
    const nlCountry = await prisma.country.upsert({ where: { code: 'NL' }, update: {}, create: { code: 'NL', name: 'Netherlands' } });
    const nlFw = await prisma.taxFramework.upsert({ where: { countryId: nlCountry.id }, update: {}, create: { name: 'Netherlands BTW', countryId: nlCountry.id } });
    const nlStandard = await upsertTaxType(nlFw.id, 'BTW_STANDARD');
    const nlReduced = await upsertTaxType(nlFw.id, 'BTW_REDUCED');
    const nlZero = await upsertTaxType(nlFw.id, 'BTW_ZERO');
    await seedTaxRates(nlStandard.id, [{ name: 'NL Standard BTW 21%', rate: 21.0, effectiveFrom: '2012-10-01T00:00:00Z', effectiveTo: null }]);
    await seedTaxRates(nlReduced.id, [
      { name: 'NL Reduced BTW 9%', rate: 9.0, effectiveFrom: '2019-01-01T00:00:00Z', effectiveTo: null },
      { name: 'NL Reduced BTW 6% (hist.)', rate: 6.0, effectiveFrom: '1989-01-01T00:00:00Z', effectiveTo: '2018-12-31T23:59:59Z' }
    ]);
    await seedTaxRates(nlZero.id, [{ name: 'NL Zero Rated BTW 0%', rate: 0.0, effectiveFrom: '1969-01-01T00:00:00Z', effectiveTo: null }, { name: 'NL Zero Rated Export 0%', rate: 0.0, effectiveFrom: '1969-01-01T00:00:00Z', effectiveTo: null }]);

    // Indonesia (ID)
    const idCountry = await prisma.country.upsert({ where: { code: 'ID' }, update: {}, create: { code: 'ID', name: 'Indonesia' } });
    const idFw = await prisma.taxFramework.upsert({ where: { countryId: idCountry.id }, update: {}, create: { name: 'Indonesia PPN', countryId: idCountry.id } });
    const idStandard = await upsertTaxType(idFw.id, 'PPN_STANDARD');
    const idZero = await upsertTaxType(idFw.id, 'PPN_ZERO');
    await seedTaxRates(idStandard.id, [
      { name: 'ID Standard PPN 11%', rate: 11.0, effectiveFrom: '2022-04-01T00:00:00Z', effectiveTo: null },
      { name: 'ID Standard PPN 10% (hist.)', rate: 10.0, effectiveFrom: '1984-04-01T00:00:00Z', effectiveTo: '2022-03-31T23:59:59Z' }
    ]);
    await seedTaxRates(idZero.id, [{ name: 'ID Zero Rated Export 0%', rate: 0.0, effectiveFrom: '1984-04-01T00:00:00Z', effectiveTo: null }]);

    // Spain (ES)
    const esCountry = await prisma.country.upsert({ where: { code: 'ES' }, update: {}, create: { code: 'ES', name: 'Spain' } });
    const esFw = await prisma.taxFramework.upsert({ where: { countryId: esCountry.id }, update: {}, create: { name: 'Spain IVA', countryId: esCountry.id } });
    const esStandard = await upsertTaxType(esFw.id, 'IVA_STANDARD');
    const esReduced = await upsertTaxType(esFw.id, 'IVA_REDUCED');
    const esSuper = await upsertTaxType(esFw.id, 'IVA_SUPER_REDUCED');
    const esZero = await upsertTaxType(esFw.id, 'IVA_ZERO');
    const esTemp5 = await upsertTaxType(esFw.id, 'IVA_TEMPORARY_FOOD_5');
    const esTemp2 = await upsertTaxType(esFw.id, 'IVA_TEMPORARY_FOOD_2');
    const esTemp0 = await upsertTaxType(esFw.id, 'IVA_TEMPORARY_FOOD_0');
    await seedTaxRates(esStandard.id, [{ name: 'ES Standard IVA 21%', rate: 21.0, effectiveFrom: '2012-09-01T00:00:00Z', effectiveTo: null }]);
    await seedTaxRates(esReduced.id, [{ name: 'ES Reduced IVA 10%', rate: 10.0, effectiveFrom: '2012-09-01T00:00:00Z', effectiveTo: null }]);
    await seedTaxRates(esSuper.id, [{ name: 'ES Super-Reduced IVA 4%', rate: 4.0, effectiveFrom: '1995-01-01T00:00:00Z', effectiveTo: null }]);
    await seedTaxRates(esZero.id, [{ name: 'ES Zero Rated Export 0%', rate: 0.0, effectiveFrom: '1986-01-01T00:00:00Z', effectiveTo: null }]);
    await seedTaxRates(esTemp5.id, [{ name: 'ES Temporary Food IVA 5%', rate: 5.0, effectiveFrom: '2023-01-01T00:00:00Z', effectiveTo: null }]);
    await seedTaxRates(esTemp2.id, [{ name: 'ES Temporary Food IVA 2%', rate: 2.0, effectiveFrom: '2023-01-01T00:00:00Z', effectiveTo: null }]);
    await seedTaxRates(esTemp0.id, [{ name: 'ES Temporary Food IVA 0%', rate: 0.0, effectiveFrom: '2023-01-01T00:00:00Z', effectiveTo: null }]);

    // Italy (IT)
    const itCountry = await prisma.country.upsert({ where: { code: 'IT' }, update: {}, create: { code: 'IT', name: 'Italy' } });
    const itFw = await prisma.taxFramework.upsert({ where: { countryId: itCountry.id }, update: {}, create: { name: 'Italy IVA', countryId: itCountry.id } });
    const itStandard = await upsertTaxType(itFw.id, 'IVA_STANDARD');
    const itReduced = await upsertTaxType(itFw.id, 'IVA_REDUCED');
    const itReducedLow = await upsertTaxType(itFw.id, 'IVA_REDUCED_LOW');
    const itSuper = await upsertTaxType(itFw.id, 'IVA_SUPER_REDUCED');
    const itZero = await upsertTaxType(itFw.id, 'IVA_ZERO');
    await seedTaxRates(itStandard.id, [{ name: 'IT Standard IVA 22%', rate: 22.0, effectiveFrom: '2013-10-01T00:00:00Z', effectiveTo: null }]);
    await seedTaxRates(itReduced.id, [{ name: 'IT Reduced IVA 10%', rate: 10.0, effectiveFrom: '1997-10-01T00:00:00Z', effectiveTo: null }]);
    await seedTaxRates(itReducedLow.id, [{ name: 'IT Reduced IVA 5%', rate: 5.0, effectiveFrom: '2016-01-01T00:00:00Z', effectiveTo: null }]);
    await seedTaxRates(itSuper.id, [{ name: 'IT Super-Reduced IVA 4%', rate: 4.0, effectiveFrom: '1989-01-01T00:00:00Z', effectiveTo: null }]);
    await seedTaxRates(itZero.id, [{ name: 'IT Zero Rated Export 0%', rate: 0.0, effectiveFrom: '1973-01-01T00:00:00Z', effectiveTo: null }]);

    console.log('Successfully seeded global taxes for MX, KR, NL, ID, ES, IT.');
  } catch (e) {
    console.error('Failed to seed group 2 taxes:', e);
  } finally {
    await prisma.$disconnect();
  }
}

seedGroup2Taxes();
