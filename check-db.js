const prisma = require('./src/config/prisma');
async function main() {
  const p = await prisma.project.findFirst({ where: { projectCode: { contains: '9909' } } });
  console.log(p);
  if (p) {
    const e = await prisma.expense.findMany({ where: { referenceId: p.id }, include: { items: true } });
    console.log(JSON.stringify(e, null, 2));
  }
}
main().finally(() => prisma.$disconnect());
