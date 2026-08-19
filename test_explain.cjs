const prisma = require('./src/config/prisma.js');

async function runExplain() {
  const businessId = 'some-business-id';
  
  try {
    // Disable Seq Scan to force index usage
    await prisma.$executeRawUnsafe('SET enable_seqscan = OFF;');

    const explainResult2 = await prisma.$queryRaw`
      EXPLAIN ANALYZE 
      SELECT * FROM "Project"
      WHERE "businessId" = ${businessId}
      ORDER BY "createdAt" DESC
      LIMIT 25;
    `;
    console.log("EXPLAIN RESULT FOR PROJECT (Index Scan forced):");
    console.dir(explainResult2, { depth: null });
  } catch (err) {
    console.error("Error with EXPLAIN ANALYZE (Project):", err);
  }

  await prisma.$disconnect();
}

runExplain();
