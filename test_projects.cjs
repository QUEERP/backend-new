const prisma = require('./src/config/prisma');
async function main() {
  const projects = await prisma.project.findMany({
    where: { businessId: 'a21c8ef4-bd77-491d-955e-819710afc26c' }
  });
  console.log('Projects count:', projects.length);
  if (projects.length > 0) {
    console.log(projects[0]);
  }
}
main().catch(console.error).finally(() => process.exit(0));
