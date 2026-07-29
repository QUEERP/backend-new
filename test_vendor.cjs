const prisma = require('./src/config/prisma');
async function main() {
  const vendors = await prisma.vendor.findMany({
    where: { businessId: 'a21c8ef4-bd77-491d-955e-819710afc26c' }
  });
  console.log('Vendors:', vendors);
}
main().catch(console.error).finally(() => process.exit(0));
