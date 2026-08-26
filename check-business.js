const prisma = require('./src/config/prisma');

async function run() {
  const b = await prisma.business.findUnique({ where: { id: '954fc9b6-d5e8-4279-97d1-6936d37d7125' }});
  console.log('Business:', b);
}

run().catch(console.error).finally(() => prisma.$disconnect());
