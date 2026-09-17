require('dotenv').config();
const prisma = require('./src/config/prisma');
const { PROVISIONING_MANIFESTS, provisionTaxRules } = require('./src/services/taxProvisioning.service');

async function seedMissingFrameworks() {
  console.log('Ensuring all frameworks from manifests exist...');
  for (const [countryCode, manifest] of Object.entries(PROVISIONING_MANIFESTS)) {
    // Ensure country exists
    const country = await prisma.country.upsert({
      where: { code: countryCode },
      update: {},
      create: { code: countryCode, name: countryCode }
    });

    // Ensure framework exists
    const fw = await prisma.taxFramework.upsert({
      where: { countryId: country.id },
      update: {},
      create: { name: manifest.frameworkName, countryId: country.id }
    });

    // Ensure types and rates exist
    for (const rule of manifest.rules) {
      for (const comp of rule.components) {
        let typeName = typeof comp === 'string' ? comp : comp.name;
        let expectedRate = typeof comp === 'string' ? rule.rate : comp.expectedRate;
        
        let type = await prisma.taxType.findFirst({ where: { taxFrameworkId: fw.id, name: typeName } });
        if (!type) {
          type = await prisma.taxType.create({ data: { taxFrameworkId: fw.id, name: typeName } });
        }
        
        // Ensure rate exists
        const existingRate = await prisma.taxRate.findFirst({
          where: { taxTypeId: type.id, rate: expectedRate }
        });
        if (!existingRate) {
          await prisma.taxRate.create({
            data: {
              taxTypeId: type.id,
              name: `${manifest.frameworkName} ${typeName} ${expectedRate}%`,
              rate: expectedRate,
              effectiveFrom: new Date('2000-01-01')
            }
          });
        }
      }
    }
  }
}

async function main() {
  await seedMissingFrameworks();
  
  const businesses = await prisma.business.findMany();
  console.log(`Found ${businesses.length} businesses`);
  for (const b of businesses) {
    console.log(`Provisioning for ${b.id} with country ${b.countryCode}`);
    if (b.countryCode) {
      await provisionTaxRules(b.id, b.countryCode);
      console.log(`Provisioned successfully.`);
    }
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
