const prisma = require('./src/config/prisma');
async function run() {
  const result = await prisma.$queryRaw`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'businesses' AND column_name = 'country';
  `;
  console.log(result);
}
run().catch(console.error).finally(() => prisma.$disconnect());
