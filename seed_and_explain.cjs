const prisma = require('./src/config/prisma.js');

async function seedAndExplain() {
  console.log(`Finding an existing customer and business...`);
  const existingCustomer = await prisma.customer.findFirst();
  if (!existingCustomer) {
    console.log("No existing customer found to link. Cannot proceed easily.");
    await prisma.$disconnect();
    return;
  }

  const testBusinessId = existingCustomer.businessId;

  console.log(`Generating 10,000 dummy projects for existing businessId: ${testBusinessId}...`);
  
  const dummyProjects = [];
  for (let i = 0; i < 10000; i++) {
    dummyProjects.push({
      businessId: testBusinessId,
      projectName: `Dummy Project ${Date.now()}-${i}`,
      projectCode: `PRJ-${Date.now()}-${i}`,
      customerId: existingCustomer.id,
      status: 'ACTIVE',
      budget: 1000,
    });
  }

  // Insert in batches of 2000
  for (let i = 0; i < dummyProjects.length; i += 2000) {
    await prisma.project.createMany({
      data: dummyProjects.slice(i, i + 2000),
    });
  }

  console.log('Seeding complete. Running EXPLAIN ANALYZE without forcing index...');

  try {
    const explainResult = await prisma.$queryRaw`
      EXPLAIN ANALYZE 
      SELECT * FROM "Project"
      WHERE "businessId" = ${testBusinessId}
      ORDER BY "createdAt" DESC
      LIMIT 25;
    `;
    console.log("NATURAL EXPLAIN RESULT FOR PROJECT (10,000+ rows):");
    console.dir(explainResult, { depth: null });
  } catch (err) {
    console.error("Error with EXPLAIN ANALYZE:", err);
  }

  console.log('Cleaning up dummy projects...');
  await prisma.project.deleteMany({
    where: { 
      projectName: { startsWith: 'Dummy Project' } 
    }
  });

  await prisma.$disconnect();
}

seedAndExplain();
