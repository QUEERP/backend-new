require('dotenv').config();
const prisma = require('./src/config/prisma');
prisma.user.findMany({ select: { id: true, name: true, email: true, role: true }, take: 5 })
  .then(u => { console.log(JSON.stringify(u, null, 2)); })
  .catch(e => console.error(e.message))
  .finally(() => prisma.$disconnect());
