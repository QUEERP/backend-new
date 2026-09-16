const prisma = require('./src/config/prisma.js');
const { provisionTaxRules } = require('./src/services/taxProvisioning.service.js');

async function main() {
  const bizId = '76344522-773b-4b85-8dcc-97511f732dbc';
  
  const b = await prisma.business.findUnique({
    where: { id: bizId },
    include: { taxRules: true }
  });
  console.log('Before provisioning:', b.taxRules.length);
  
  await provisionTaxRules(bizId, 'CA');
  
  const bAfter = await prisma.business.findUnique({
    where: { id: bizId },
    include: { taxRules: true }
  });
  console.log('After provisioning:', bAfter.taxRules.length);
}

main().catch(console.error).finally(() => process.exit(0));
