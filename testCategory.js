const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function test() {
  try {
    const cat = await prisma.category.create({
      data: {
        businessId: 'test-biz',
        name: 'Test Cat ' + Date.now(),
        description: 'Test Desc'
      }
    });
    console.log('Created:', cat);
    const cats = await prisma.category.findMany({ where: { id: cat.id } });
    console.log('Fetched:', cats);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
test();
