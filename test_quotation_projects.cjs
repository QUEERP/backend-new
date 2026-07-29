const prisma = require('./src/config/prisma');
async function main() {
  const qs = await prisma.quotation.findMany({
    where: { businessId: 'a21c8ef4-bd77-491d-955e-819710afc26c' },
    include: { projects: true }
  });
  console.log('Quotation with projects:');
  console.log(JSON.stringify(qs.filter(q => q.projects && q.projects.length > 0), null, 2));
}
main().catch(console.error).finally(() => process.exit(0));
