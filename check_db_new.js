const prisma = require('./src/config/prisma');
async function main() {
  const c = await prisma.country.findMany();
  console.log("Countries:");
  console.dir(c, {depth: null});
  const tf = await prisma.taxFramework.findMany({ include: { businesses: true } });
  console.log("TaxFrameworks:");
  console.dir(tf, {depth: null});
}
main().finally(() => prisma.$disconnect());
