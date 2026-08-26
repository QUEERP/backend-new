const prisma = require('../src/config/prisma');

async function seedGlobalTaxes() {
  console.log('Seeding global tax frameworks, types, and rates...');

  try {
    // 1. Ensure Countries Exist
    const ukCountry = await prisma.country.upsert({ where: { code: 'GB' }, update: {}, create: { code: 'GB', name: 'United Kingdom' } });
    const auCountry = await prisma.country.upsert({ where: { code: 'AU' }, update: {}, create: { code: 'AU', name: 'Australia' } });
    const sgCountry = await prisma.country.upsert({ where: { code: 'SG' }, update: {}, create: { code: 'SG', name: 'Singapore' } });

    // 2. Setup Frameworks
    const ukFw = await prisma.taxFramework.upsert({
      where: { countryId: ukCountry.id }, update: {}, create: { name: 'UK VAT', countryId: ukCountry.id }
    });
    const auFw = await prisma.taxFramework.upsert({
      where: { countryId: auCountry.id }, update: {}, create: { name: 'AU GST', countryId: auCountry.id }
    });
    const sgFw = await prisma.taxFramework.upsert({
      where: { countryId: sgCountry.id }, update: {}, create: { name: 'SG GST', countryId: sgCountry.id }
    });

    // Helper to upsert TaxType
    const upsertTaxType = async (fwId, name) => {
      let type = await prisma.taxType.findFirst({ where: { taxFrameworkId: fwId, name } });
      if (!type) {
        type = await prisma.taxType.create({ data: { taxFrameworkId: fwId, name } });
      }
      return type;
    };

    // Helper to insert TaxRates
    const seedTaxRates = async (typeId, ratesData) => {
      for (const r of ratesData) {
        // Find existing rate by type and effectiveFrom to avoid duplicates
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

    // ==========================================
    // 3. SEED SINGAPORE (SG)
    // ==========================================
    console.log('Seeding Singapore...');
    const sgStandard = await upsertTaxType(sgFw.id, 'GST_STANDARD');
    const sgZero = await upsertTaxType(sgFw.id, 'GST_ZERO');
    const sgExempt = await upsertTaxType(sgFw.id, 'GST_EXEMPT');

    await seedTaxRates(sgStandard.id, [
      { name: 'SG GST 7%', rate: 7.0, effectiveFrom: '2007-07-01T00:00:00Z', effectiveTo: '2022-12-31T23:59:59Z' },
      { name: 'SG GST 8%', rate: 8.0, effectiveFrom: '2023-01-01T00:00:00Z', effectiveTo: '2023-12-31T23:59:59Z' },
      { name: 'SG GST 9%', rate: 9.0, effectiveFrom: '2024-01-01T00:00:00Z', effectiveTo: null }
    ]);
    await seedTaxRates(sgZero.id, [
      { name: 'SG Zero Rated 0%', rate: 0.0, effectiveFrom: '1994-04-01T00:00:00Z', effectiveTo: null }
    ]);
    await seedTaxRates(sgExempt.id, [
      { name: 'SG Exempt 0%', rate: 0.0, effectiveFrom: '1994-04-01T00:00:00Z', effectiveTo: null }
    ]);

    // ==========================================
    // 4. SEED UNITED KINGDOM (UK)
    // ==========================================
    console.log('Seeding United Kingdom...');
    const ukStandard = await upsertTaxType(ukFw.id, 'VAT_STANDARD');
    const ukReduced = await upsertTaxType(ukFw.id, 'VAT_REDUCED');
    const ukZero = await upsertTaxType(ukFw.id, 'VAT_ZERO');
    const ukExempt = await upsertTaxType(ukFw.id, 'VAT_EXEMPT');
    const ukRc = await upsertTaxType(ukFw.id, 'VAT_REVERSE_CHARGE');

    await seedTaxRates(ukStandard.id, [
      { name: 'UK Standard 20%', rate: 20.0, effectiveFrom: '2011-01-04T00:00:00Z', effectiveTo: null }
    ]);
    await seedTaxRates(ukReduced.id, [
      { name: 'UK Reduced 5%', rate: 5.0, effectiveFrom: '1997-09-01T00:00:00Z', effectiveTo: null }
    ]);
    await seedTaxRates(ukZero.id, [
      { name: 'UK Zero Rated 0%', rate: 0.0, effectiveFrom: '1973-04-01T00:00:00Z', effectiveTo: null }
    ]);
    await seedTaxRates(ukExempt.id, [
      { name: 'UK Exempt 0%', rate: 0.0, effectiveFrom: '1973-04-01T00:00:00Z', effectiveTo: null }
    ]);
    await seedTaxRates(ukRc.id, [
      { name: 'UK Reverse Charge 20%', rate: 20.0, effectiveFrom: '2011-01-04T00:00:00Z', effectiveTo: null }
    ]);

    // ==========================================
    // 5. SEED AUSTRALIA (AU)
    // ==========================================
    console.log('Seeding Australia...');
    const auStandard = await upsertTaxType(auFw.id, 'GST_STANDARD');
    const auFree = await upsertTaxType(auFw.id, 'GST_FREE');
    const auInputTaxed = await upsertTaxType(auFw.id, 'INPUT_TAXED');

    await seedTaxRates(auStandard.id, [
      { name: 'AU Standard GST 10%', rate: 10.0, effectiveFrom: '2000-07-01T00:00:00Z', effectiveTo: null }
    ]);
    await seedTaxRates(auFree.id, [
      { name: 'AU GST-Free 0%', rate: 0.0, effectiveFrom: '2000-07-01T00:00:00Z', effectiveTo: null }
    ]);
    await seedTaxRates(auInputTaxed.id, [
      { name: 'AU Input Taxed 0%', rate: 0.0, effectiveFrom: '2000-07-01T00:00:00Z', effectiveTo: null }
    ]);

    // ==========================================
    // 6. SEED GERMANY (DE) — Umsatzsteuer / Mehrwertsteuer
    // Includes COVID-era temporary rate cut: 19%→16% (Jul–Dec 2020), 7%→5% (Jul–Dec 2020)
    // ==========================================
    console.log('Seeding Germany...');
    const deCountry = await prisma.country.upsert({ where: { code: 'DE' }, update: {}, create: { code: 'DE', name: 'Germany' } });
    const deFw = await prisma.taxFramework.upsert({
      where: { countryId: deCountry.id }, update: {}, create: { name: 'Deutschland MwSt', countryId: deCountry.id }
    });

    const deStandard = await upsertTaxType(deFw.id, 'MwSt_STANDARD');
    const deErmaessigt = await upsertTaxType(deFw.id, 'MwSt_ERMAESSIGT');
    const deNullsatz = await upsertTaxType(deFw.id, 'MwSt_NULLSATZ');
    const deBefreit = await upsertTaxType(deFw.id, 'MwSt_BEFREIT');
    const deRc = await upsertTaxType(deFw.id, 'MwSt_REVERSE_CHARGE');

    await seedTaxRates(deStandard.id, [
      { name: 'DE Standard MwSt 19% (pre-COVID)', rate: 19.0, effectiveFrom: '2007-01-01T00:00:00Z', effectiveTo: '2020-06-30T23:59:59Z' },
      { name: 'DE Standard MwSt 16% (COVID)',     rate: 16.0, effectiveFrom: '2020-07-01T00:00:00Z', effectiveTo: '2020-12-31T23:59:59Z' },
      { name: 'DE Standard MwSt 19%',             rate: 19.0, effectiveFrom: '2021-01-01T00:00:00Z', effectiveTo: null }
    ]);
    await seedTaxRates(deErmaessigt.id, [
      { name: 'DE Ermäßigt MwSt 7% (pre-COVID)', rate: 7.0, effectiveFrom: '1983-07-01T00:00:00Z', effectiveTo: '2020-06-30T23:59:59Z' },
      { name: 'DE Ermäßigt MwSt 5% (COVID)',     rate: 5.0, effectiveFrom: '2020-07-01T00:00:00Z', effectiveTo: '2020-12-31T23:59:59Z' },
      { name: 'DE Ermäßigt MwSt 7%',             rate: 7.0, effectiveFrom: '2021-01-01T00:00:00Z', effectiveTo: null }
    ]);
    await seedTaxRates(deNullsatz.id, [
      { name: 'DE Zero-Rated 0%', rate: 0.0, effectiveFrom: '1973-01-01T00:00:00Z', effectiveTo: null }
    ]);
    await seedTaxRates(deBefreit.id, [
      { name: 'DE Exempt 0%', rate: 0.0, effectiveFrom: '1973-01-01T00:00:00Z', effectiveTo: null }
    ]);
    await seedTaxRates(deRc.id, [
      { name: 'DE Reverse Charge 19% (pre-COVID)', rate: 19.0, effectiveFrom: '2007-01-01T00:00:00Z', effectiveTo: '2020-06-30T23:59:59Z' },
      { name: 'DE Reverse Charge 16% (COVID)',     rate: 16.0, effectiveFrom: '2020-07-01T00:00:00Z', effectiveTo: '2020-12-31T23:59:59Z' },
      { name: 'DE Reverse Charge 19%',             rate: 19.0, effectiveFrom: '2021-01-01T00:00:00Z', effectiveTo: null }
    ]);

    // ==========================================
    // 7. SEED NEW ZEALAND (NZ) — Goods and Services Tax
    // Historical: 12.5% (1989–2010) → 15% (2010–present)
    // ==========================================
    console.log('Seeding New Zealand...');
    const nzCountry = await prisma.country.upsert({ where: { code: 'NZ' }, update: {}, create: { code: 'NZ', name: 'New Zealand' } });
    const nzFw = await prisma.taxFramework.upsert({
      where: { countryId: nzCountry.id }, update: {}, create: { name: 'NZ GST', countryId: nzCountry.id }
    });

    const nzStandard = await upsertTaxType(nzFw.id, 'GST_STANDARD');
    const nzZero    = await upsertTaxType(nzFw.id, 'GST_ZERO');
    const nzExempt  = await upsertTaxType(nzFw.id, 'GST_EXEMPT');

    await seedTaxRates(nzStandard.id, [
      { name: 'NZ GST 12.5%', rate: 12.5, effectiveFrom: '1989-07-01T00:00:00Z', effectiveTo: '2010-09-30T23:59:59Z' },
      { name: 'NZ GST 15%',   rate: 15.0, effectiveFrom: '2010-10-01T00:00:00Z', effectiveTo: null }
    ]);
    await seedTaxRates(nzZero.id, [
      { name: 'NZ Zero-Rated 0%', rate: 0.0, effectiveFrom: '1986-10-01T00:00:00Z', effectiveTo: null }
    ]);
    await seedTaxRates(nzExempt.id, [
      { name: 'NZ Exempt 0%', rate: 0.0, effectiveFrom: '1986-10-01T00:00:00Z', effectiveTo: null }
    ]);

    // ==========================================
    // 8. SEED SOUTH AFRICA (ZA) — Value Added Tax
    // Historical: 14% (1993–2018) → 15% (2018–present)
    // ==========================================
    console.log('Seeding South Africa...');
    const zaCountry = await prisma.country.upsert({ where: { code: 'ZA' }, update: {}, create: { code: 'ZA', name: 'South Africa' } });
    const zaFw = await prisma.taxFramework.upsert({
      where: { countryId: zaCountry.id }, update: {}, create: { name: 'South Africa VAT', countryId: zaCountry.id }
    });

    const zaStandard = await upsertTaxType(zaFw.id, 'VAT_STANDARD');
    const zaZero     = await upsertTaxType(zaFw.id, 'VAT_ZERO');
    const zaExempt   = await upsertTaxType(zaFw.id, 'VAT_EXEMPT');
    const zaRc       = await upsertTaxType(zaFw.id, 'VAT_REVERSE_CHARGE');

    await seedTaxRates(zaStandard.id, [
      { name: 'ZA Standard VAT 14%', rate: 14.0, effectiveFrom: '1993-04-07T00:00:00Z', effectiveTo: '2018-03-31T23:59:59Z' },
      { name: 'ZA Standard VAT 15%', rate: 15.0, effectiveFrom: '2018-04-01T00:00:00Z', effectiveTo: null }
    ]);
    await seedTaxRates(zaZero.id, [
      { name: 'ZA Zero-Rated 0%', rate: 0.0, effectiveFrom: '1991-09-30T00:00:00Z', effectiveTo: null }
    ]);
    await seedTaxRates(zaExempt.id, [
      { name: 'ZA Exempt 0%', rate: 0.0, effectiveFrom: '1991-09-30T00:00:00Z', effectiveTo: null }
    ]);
    await seedTaxRates(zaRc.id, [
      { name: 'ZA Reverse Charge 14%', rate: 14.0, effectiveFrom: '1993-04-07T00:00:00Z', effectiveTo: '2018-03-31T23:59:59Z' },
      { name: 'ZA Reverse Charge 15%', rate: 15.0, effectiveFrom: '2018-04-01T00:00:00Z', effectiveTo: null }
    ]);

    console.log('Successfully seeded global taxes for UK, AU, SG, DE, NZ, and ZA.');
  } catch (e) {
    console.error('Failed to seed taxes:', e);
  } finally {
    await prisma.$disconnect();
  }
}

seedGlobalTaxes();
