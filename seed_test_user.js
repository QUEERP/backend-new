const bcrypt = require('bcryptjs');
const prisma = require('./src/config/prisma');

async function run() {
  try {
    const pass = await bcrypt.hash('password123', 10);
    await prisma.user.upsert({
      where: { email: 'pwtest@example.com' },
      update: { password: pass, isActive: true },
      create: { name: 'Test User', email: 'pwtest@example.com', password: pass, isActive: true }
    });
    console.log('User created successfully.');
  } finally {
    await prisma.$disconnect();
  }
}

run().catch(console.error);
