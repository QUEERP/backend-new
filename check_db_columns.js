const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const res = await prisma.$queryRaw`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'tax_rules';`;
  console.log(JSON.stringify(res, null, 2));
}

main().finally(() => prisma.$disconnect());
