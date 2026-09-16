const prisma = require('./src/config/prisma');

async function run() {
  const c = await prisma.country.findMany();
  const fw = await prisma.taxFramework.findMany({ select: { name: true, countryId: true } });
  console.log('Countries:');
  console.log(c.map(x => `${x.code} = ${x.id}`));
  console.log('Frameworks:');
  console.log(fw.map(x => `${x.name} = ${x.countryId}`));
}

run().catch(console.error).finally(() => prisma.$disconnect());
