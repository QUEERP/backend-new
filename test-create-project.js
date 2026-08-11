const prisma = require('./src/config/prisma');

async function main() {
  try {
    const businesses = await prisma.business.findMany();
    console.log('Businesses:', businesses);
    const totalProjCount = await prisma.project.count();
    console.log('Total projects:', totalProjCount);

    const projCount = await prisma.project.count({ where: { businessId: business.id } });
    const projectCode = `PRJ-${String(projCount + 1).padStart(5, '0')}`;

    const project = await prisma.project.create({
      data: {
        ...payload,
        projectCode,
        executionType: payload.executionType || "SERVICE",
        businessId: business.id,
        projectItems: {
          create: [{
            itemName: 'pipe',
            description: 'Steel Pipe',
            quantity: 1,
            rate: 100,
            amount: 100,
          }]
        }
      },
    });

    console.log('Project created successfully:', project);
    
    // cleanup
    await prisma.project.delete({ where: { id: project.id } });
    
  } catch (err) {
    console.error('Create Project Error:', err);
    if (err.message && err.message.includes('Invalid `prisma')) {
       const match = err.message.match(/argument `.*?`: (.*)/i);
       if (match) console.log('Match:', match[0]);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
