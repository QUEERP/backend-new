const prisma = require('./src/config/prisma');

async function main() {
  const businessId = "a21c8ef4-bd77-491d-955e-819710afc26c";
  const projects = await prisma.project.findMany({
    where: { businessId }
  });
  console.log('Projects count:', projects.length);
  console.log(projects);
}
main().catch(console.error).finally(() => prisma.$disconnect());
