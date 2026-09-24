const prisma = require('./src/config/prisma');
prisma.business.findFirst({ include: { taxFramework: true, taxRules: true } }).then(console.log).finally(() => prisma.$disconnect());
