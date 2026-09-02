const prisma = require('./src/config/prisma');

async function seedCountries() {
  try {
    console.log("Seeding UK, AU, and SG...");

    // 1. Ensure countries exist
    const uk = await prisma.country.upsert({ where: { code: 'GB' }, update: {}, create: { code: 'GB', name: 'United Kingdom' } });
    const au = await prisma.country.upsert({ where: { code: 'AU' }, update: {}, create: { code: 'AU', name: 'Australia' } });
    const sg = await prisma.country.upsert({ where: { code: 'SG' }, update: {}, create: { code: 'SG', name: 'Singapore' } });

    // 2. Ensure currencies exist
    const gbp = await prisma.currency.upsert({ where: { code: 'GBP' }, update: {}, create: { code: 'GBP', name: 'British Pound', symbol: '£', decimalPrecision: 2 } });
    const aud = await prisma.currency.upsert({ where: { code: 'AUD' }, update: {}, create: { code: 'AUD', name: 'Australian Dollar', symbol: '$', decimalPrecision: 2 } });
    const sgd = await prisma.currency.upsert({ where: { code: 'SGD' }, update: {}, create: { code: 'SGD', name: 'Singapore Dollar', symbol: '$', decimalPrecision: 2 } });

    // 3. Frameworks
    const getFw = async (name, cid) => {
      let fw = await prisma.taxFramework.findFirst({ where: { name } });
      if (!fw) fw = await prisma.taxFramework.create({ data: { name, countryId: cid } });
      return fw;
    };
    const ukFw = await getFw('UK VAT', uk.id);
    const auFw = await getFw('AU GST', au.id);
    const sgFw = await getFw('SG GST', sg.id);

    // --- UK SEEDING ---
    const ukStandard = await prisma.taxType.create({ data: { name: 'VAT_STANDARD', taxFrameworkId: ukFw.id } });
    const ukReduced = await prisma.taxType.create({ data: { name: 'VAT_REDUCED', taxFrameworkId: ukFw.id } });
    const ukZero = await prisma.taxType.create({ data: { name: 'VAT_ZERO', taxFrameworkId: ukFw.id } });
    const ukExempt = await prisma.taxType.create({ data: { name: 'VAT_EXEMPT', taxFrameworkId: ukFw.id } });
    const ukRc = await prisma.taxType.create({ data: { name: 'VAT_REVERSE_CHARGE', taxFrameworkId: ukFw.id } });

    // Note: We need a business ID to attach tax rules. The user wants to seed *real tax types/rates*, 
    // but in our schema, TaxRule is attached to a `businessId`. 
    // Wait... if TaxRule requires businessId, we can't seed "global" tax rules!
    // Let me check schema.prisma: `model TaxRule { businessId String ... }`
    // Yes, TaxRules are per-business in the current schema.
    
    // Oh, the user said: "The architecture already supports this (TaxFramework -> TaxType -> TaxRate -> TaxRule... What's missing is the actual seed DATA for other countries' real tax types/rates."
    // But TaxTypes and TaxFrameworks are global! TaxRule and TaxRate (which links to TaxRule) are per-business? 
    // Let's check schema.prisma for TaxRate.

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}
seedCountries();
