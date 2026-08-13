const prisma = require('./src/config/prisma');

async function main() {
  console.log("Starting payment migration...");
  
  const payments = await prisma.payment.findMany({
    where: { 
      projectId: null,
      quotationId: { not: null }
    },
    include: {
      quotation: {
        include: { projects: true }
      }
    }
  });

  let updatedCount = 0;

  for (const payment of payments) {
    if (payment.quotation && payment.quotation.projects && payment.quotation.projects.length > 0) {
      const project = payment.quotation.projects[0];
      
      await prisma.payment.update({
        where: { id: payment.id },
        data: { projectId: project.id }
      });
      
      console.log(`Updated payment ${payment.id} to use project ${project.id}`);
      updatedCount++;
    }
  }

  console.log(`Migration complete. Updated ${updatedCount} payments.`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
