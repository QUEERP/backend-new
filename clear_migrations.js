const prisma = require('./src/config/prisma');

async function main() {
  await prisma.$executeRawUnsafe(`DELETE FROM _prisma_migrations`);
  console.log('Cleared _prisma_migrations table');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
