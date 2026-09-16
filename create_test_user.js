const { PrismaClient } = require('./src/config/prisma');
const bcrypt = require('bcryptjs');

async function main() {
  const prisma = require('./src/config/prisma');
  const email = 'ui_tester@test.com';
  const password = await bcrypt.hash('password123', 10);
  
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    console.log("User already exists");
    return;
  }
  
  await prisma.user.create({
    data: {
      name: 'UI Tester',
      email,
      password,
      role: 'SUPER_ADMIN'
    }
  });
  console.log("Created ui_tester@test.com with password password123");
}
main().finally(() => process.exit(0));
