const prisma = require('./src/config/prisma');

async function main() {
  // 1. Find the most recent business created in India
  const recentIndiaBusiness = await prisma.business.findFirst({
    where: { country: 'INDIA' },
    orderBy: { createdAt: 'desc' },
    include: {
      owner: true,
      taxRules: true,
      taxFramework: true,
      taxAccountMappings: true
    }
  });

  if (!recentIndiaBusiness) {
    console.log("No India business found.");
    return;
  }

  console.log(`[Diagnostic - Specific Business]`);
  console.log(`Business ID: ${recentIndiaBusiness.id}`);
  console.log(`Name: ${recentIndiaBusiness.name}`);
  console.log(`Owner: ${recentIndiaBusiness.owner?.name} (${recentIndiaBusiness.owner?.email})`);
  console.log(`Created At: ${recentIndiaBusiness.createdAt}`);
  console.log(`TaxRule Count: ${recentIndiaBusiness.taxRules.length}`);
  console.log(`TaxFramework: ${recentIndiaBusiness.taxFramework ? recentIndiaBusiness.taxFramework.name : 'null'}`);
  console.log(`Business Type: ${recentIndiaBusiness.businessType || recentIndiaBusiness.industry || 'unknown'}`);
  console.log(`TaxAccountMapping Count: ${recentIndiaBusiness.taxAccountMappings.length}`);

  // 2. Check 24-hour regression across verified countries
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const recentBusinesses = await prisma.business.findMany({
    where: {
      createdAt: { gte: yesterday }
    },
    include: {
      taxRules: true
    }
  });

  console.log(`\n[Diagnostic - 24h Regression Check]`);
  console.log(`Total businesses created in last 24h: ${recentBusinesses.length}`);
  
  for (const b of recentBusinesses) {
    console.log(`- ${b.id} | ${b.name} | Country: ${b.country} | TaxRules: ${b.taxRules.length}`);
  }

}

main().catch(console.error).finally(() => prisma.$disconnect());
