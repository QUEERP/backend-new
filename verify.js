require('dotenv').config();
const prisma = require('./src/config/prisma');
async function verify() {
  const devPriya = await prisma.taxTransaction.findUnique({
      where: { id: '6525449f-31fc-4457-bf14-c03e69447278' }
  });
  console.log("=== DEV PRIYA VERIFICATION ===");
  console.log(JSON.stringify(devPriya, null, 2));
  await prisma.$disconnect();
}
verify();
