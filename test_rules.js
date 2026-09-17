const prisma = require('./src/config/prisma');
async function check() { 
  const b = await prisma.business.findUnique({ 
    where: { id: 'dc70ca38-b141-477d-a379-f02649117a78' }, 
    include: { taxRules: true } 
  }); 
  console.log(b.taxRules); 
} 
check().finally(() => prisma.$disconnect());
