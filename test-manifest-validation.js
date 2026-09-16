const prisma = require('./src/config/prisma');
const { provisionTaxRules, PROVISIONING_MANIFESTS } = require('./src/services/taxProvisioning.service');

async function run() {
  try {
    const owner = await prisma.user.findFirst();
    // Get all supported countries dynamically
    const countries = Object.keys(PROVISIONING_MANIFESTS);
    
    for (const c of countries) {
      console.log(`Checking ${c}...`);
      const biz = await prisma.business.create({
        data: {
          name: `Validation Biz ${c}`,
          countryCode: c,
          baseCurrency: { connect: { code: 'CAD' } },
          owner: { connect: { id: owner.id } }
        }
      });
      await provisionTaxRules(biz.id, c);
      console.log(`✅ ${c} passed zero gaps!`);
    }
  } catch (e) {
    console.error('Validation failed:', e);
  } finally {
    await prisma.$disconnect();
  }
}

run();
