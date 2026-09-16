const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tf = await prisma.taxFramework.findFirst({
    where: { countryCode: 'SA' },
    include: { rates: true, complianceReports: true }
  });
  console.log(JSON.stringify(tf, null, 2));
}

main().finally(() => { prisma.$disconnect(); });
