const fs = require('fs');
const filepath = 'c:/Users/DELL/Downloads/new-queerp/backend/src/services/sales/report.service.js';
let c = fs.readFileSync(filepath, 'utf8');

c = c.replace(
  /const quotationsRaw = await prisma\.quotation\.findMany\(\{\s*where: \{ businessId \},/g,
  'const quotationsRaw = await prisma.quotation.findMany({\n      where: { businessId, isDeleted: false },'
);
c = c.replace(
  /const totalCount = await prisma\.quotation\.count\(\{ where: \{ businessId \} \}\);/g,
  'const totalCount = await prisma.quotation.count({ where: { businessId, isDeleted: false } });'
);

c = c.replace(
  /prisma\.salesOrder\.findMany\(\{\s*where: \{ businessId \},/g,
  'prisma.salesOrder.findMany({\n        where: { businessId, isDeleted: false },'
);
c = c.replace(
  /prisma\.salesOrder\.count\(\{ where: \{ businessId \} \}\)/g,
  'prisma.salesOrder.count({ where: { businessId, isDeleted: false } })'
);

fs.writeFileSync(filepath, c);
console.log('Fixed deleted items in report.service.js');
