const prisma = require('./src/config/prisma');
prisma.product.findFirst({where:{name:{contains:'pipe'}}}).then(console.log).finally(() => prisma.$disconnect());
