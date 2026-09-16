const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tf = await prisma.taxFramework.findFirst({
    where: { name: 'Canada GST/HST' }
  });
  console.log("Canada framework:", tf);
  
  const tfca = await prisma.taxFramework.findFirst({
    where: { countryCode: 'CA' }
  });
  console.log("Framework with countryCode CA:", tfca);
  
  const canadaBiz = await prisma.business.findFirst({
    where: { country: 'CA' },
    include: { taxFramework: true }
  });
  console.log("Canada Biz:", canadaBiz ? {
      id: canadaBiz.id, 
      country: canadaBiz.country, 
      taxFrameworkId: canadaBiz.taxFrameworkId,
      frameworkName: canadaBiz.taxFramework?.name
  } : "None");
}

main().finally(() => {
  process.exit(0);
});
