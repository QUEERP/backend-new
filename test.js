const prisma = require('./src/config/prisma');
async function main() {
  console.log(await prisma.country.findFirst({where:{code:'CA'}}));
  console.log(await prisma.taxFramework.findFirst({where:{countryId:'b5f728d8-58b9-4e79-bd3b-37908c00ec42'}}));
}
main().finally(() => prisma.$disconnect());
