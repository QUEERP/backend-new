const prisma = require('./src/config/prisma');

async function main() { 
  const cns = await prisma.creditNote.findMany({ 
    select: { 
      id: true, 
      creditNumber: true,
      amount: true, 
      remainingAmount: true, 
      status: true, 
      customerId: true 
    }
  }); 
  console.log(cns); 
} 
main().catch(console.error).finally(() => prisma.$disconnect());
