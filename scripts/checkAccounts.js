const prisma = require('../src/config/prisma');

async function checkAccounts() {
  const businessId = 'dc70ca38-b141-477d-a379-f02649117a78';
  const accounts = await prisma.account.findMany({
    where: { businessId }
  });
  console.log('Accounts for business:');
  for (const a of accounts) {
    console.log({ id: a.id, code: a.code, name: a.name, type: a.type });
  }
}

checkAccounts().catch(console.error).finally(() => prisma.$disconnect());
