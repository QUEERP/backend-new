const prisma = require('./src/config/prisma');
async function main() {
  const frameworks = await prisma.taxFramework.findMany({
    select: { id: true, name: true, countryId: true, country: true }
  });
  console.log("Tax Frameworks:");
  console.dir(frameworks, { depth: null });
  process.exit(0);
}
main().catch(console.error);
