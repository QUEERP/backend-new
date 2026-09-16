const prisma = require('./src/config/prisma');
const { provisionTaxRules } = require('./src/services/taxProvisioning.service');

async function main() {
  const allBusinesses = await prisma.business.findMany({
    include: {
      taxRules: true
    }
  });

  const taxFrameworks = await prisma.taxFramework.findMany();
  const configuredCountryIds = taxFrameworks.map(tf => tf.countryId);

  const countries = await prisma.country.findMany({
    where: { id: { in: configuredCountryIds } }
  });
  
  const configuredCountryCodes = new Set(countries.map(c => c.code));

  let scanned = 0;
  let broken = 0;
  let fixed = 0;

  for (const business of allBusinesses) {
    if (configuredCountryCodes.has(business.countryCode)) {
      scanned++;
      if (business.taxRules.length === 0) {
        broken++;
        try {
          console.log(`Fixing business ${business.name} (country: ${business.countryCode})`);
          await provisionTaxRules(business.id, business.countryCode);
          fixed++;
        } catch (e) {
          console.error(`Failed to fix business ${business.id}:`, e);
        }
      }
    }
  }

  console.log(`\n--- Consistency Check Results ---`);
  console.log(`Total Businesses Scanned: ${scanned}`);
  console.log(`Total Found Broken: ${broken}`);
  console.log(`Total Fixed: ${fixed}`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
