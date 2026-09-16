const prisma = require('./src/config/prisma');

async function seedCanada() {
  try {
    console.log("Seeding Canada...");

    // 1. Ensure country exists
    const ca = await prisma.country.upsert({ 
      where: { code: 'CA' }, 
      update: {}, 
      create: { code: 'CA', name: 'Canada' } 
    });

    // 2. Ensure currency exists
    const cad = await prisma.currency.upsert({ 
      where: { code: 'CAD' }, 
      update: {}, 
      create: { code: 'CAD', name: 'Canadian Dollar', symbol: '$', decimalPrecision: 2 } 
    });

    // 3. Framework
    let caFw = await prisma.taxFramework.findFirst({ where: { name: 'Canada GST/HST' } });
    if (!caFw) {
      caFw = await prisma.taxFramework.create({ data: { name: 'Canada GST/HST', countryId: ca.id } });
    }

    // 4. Tax Types
    const getOrCreateTaxType = async (name) => {
      let tt = await prisma.taxType.findFirst({ where: { name, taxFrameworkId: caFw.id } });
      if (!tt) {
        tt = await prisma.taxType.create({ data: { name, taxFrameworkId: caFw.id } });
      }
      return tt;
    };

    const gst = await getOrCreateTaxType('GST');
    const pst = await getOrCreateTaxType('PST');
    const hst = await getOrCreateTaxType('HST');
    const zero = await getOrCreateTaxType('GST_ZERO');
    const exempt = await getOrCreateTaxType('GST_EXEMPT');

    // 5. Tax Rates
    const createRate = async (taxTypeId, name, rate) => {
      let tr = await prisma.taxRate.findFirst({ where: { name, taxTypeId } });
      if (!tr) {
        await prisma.taxRate.create({
          data: {
            name,
            rate,
            taxTypeId,
            effectiveFrom: new Date('2000-01-01')
          }
        });
      }
    };

    await createRate(gst.id, 'GST 5%', 5);
    await createRate(pst.id, 'PST 7%', 7);
    await createRate(hst.id, 'HST 13%', 13);
    await createRate(zero.id, 'Zero Rated 0%', 0);
    await createRate(exempt.id, 'Exempt 0%', 0);

    console.log("Canada seeding complete.");
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}
seedCanada();
