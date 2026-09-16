const prisma = require('./src/config/prisma');
const { provisionTaxRules } = require('./src/services/taxProvisioning.service');

async function main() {
  console.log("Fetching configured countries...");
  const frameworks = await prisma.taxFramework.findMany();
  const countryIds = frameworks.map(f => f.countryId);
  const countries = await prisma.country.findMany({ where: { id: { in: countryIds } } });
  const configuredCountryCodes = countries.map(c => c.code);
  console.log("Configured Country Codes:", configuredCountryCodes);

  console.log("Scanning ALL businesses...");
  const allBusinesses = await prisma.business.findMany({
    include: {
      taxRules: true
    }
  });

  let scanned = 0;
  let broken = 0;
  let fixed = 0;

  for (const business of allBusinesses) {
    scanned++;
    const businessCountryCode = business.countryCode;

    // Only process businesses in configured countries
    if (configuredCountryCodes.includes(businessCountryCode)) {
      const hasTaxRules = business.taxRules && business.taxRules.length > 0;
      
      // Statutory Reports check: we can infer that if taxRules are missing, statutory reports (TaxRule configuration) are missing.
      // Wait, statutory reports are dynamically generated based on TaxRule rows? Or are they actual records?
      // Looking at previous knowledge, Statutory Reports are just UI rendering based on TaxRule rows (or perhaps there is a StatutoryReport model?).
      // Let me check if there's a StatutoryReport model in Prisma schema or if provisionTaxRules creates TaxRules.
      // `provisionTaxRules` creates TaxRule rows.
      
      if (!hasTaxRules) {
        broken++;
        console.log(`Found broken business: ID ${business.id}, Name: ${business.name}, Country: ${businessCountryCode}`);
        try {
          await provisionTaxRules(business.id, businessCountryCode);
          fixed++;
          console.log(`Successfully fixed business: ${business.id}`);
        } catch (err) {
          console.error(`Failed to fix business ${business.id}:`, err);
        }
      }
    }
  }

  console.log("\n--- SUMMARY ---");
  console.log(`Total businesses scanned: ${scanned}`);
  console.log(`Total businesses found broken (in configured countries): ${broken}`);
  console.log(`Total businesses successfully fixed: ${fixed}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
