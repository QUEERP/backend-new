const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function run() {
  try {
    const user = await prisma.user.findFirst();
    if (!user) {
      console.log('No user found. Exiting.');
      return;
    }
    console.log('Found user:', user.email);
    const hash = await bcrypt.hash('password123', 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hash }
    });
    console.log('Password successfully reset to password123 for', user.email);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}
run();
