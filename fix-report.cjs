const fs = require('fs');
const path = 'c:/Users/DELL/Downloads/new-queerp/backend/src/services/sales/report.service.js';
let c = fs.readFileSync(path, 'utf8');

c = c.replace(
  /select: \{\s*id: true, paymentDate: true, amount: true, amountAllocated: true,\s*status: true, paymentMode: true,/g,
  'select: { id: true, paymentDate: true, amount: true, amountAllocated: true, status: true, paymentMode: true, currency: true,'
);

c = c.replace(
  /const customersRaw = await prisma\.customer\.findMany\(\{\s*where: \{ businessId, isDeleted: false, \.\.\.dateFilter \},/g,
  'const customersRaw = await prisma.customer.findMany({\n      where: { businessId, isDeleted: false },'
);

c = c.replace(
  /prisma\.creditNote\.findMany\(\{\s*where: \{ businessId, isDeleted: false, customerId: \{ not: null \}, \.\.\.dateFilter \},/g,
  'prisma.creditNote.findMany({\n        where: { businessId, isDeleted: false, customerId: { not: null } },'
);

c = c.replace(
  /const quotationsRaw = await prisma\.quotation\.findMany\(\{\s*where: \{ businessId, \.\.\.dateFilter \},/g,
  'const quotationsRaw = await prisma.quotation.findMany({\n      where: { businessId },'
);

c = c.replace(
  /prisma\.salesOrder\.findMany\(\{\s*where: \{ businessId, \.\.\.dateFilter \},/g,
  'prisma.salesOrder.findMany({\n        where: { businessId },'
);

c = c.replace(
  /prisma\.invoice\.findMany\(\{\s*where: \{ businessId, isDeleted: false, \.\.\.invoiceDateFilter \},/g,
  'prisma.invoice.findMany({\n        where: { businessId, isDeleted: false },'
);

c = c.replace(
  /prisma\.salesReturn\.findMany\(\{\s*where: \{ businessId, \.\.\.dateFilter \},/g,
  'prisma.salesReturn.findMany({\n        where: { businessId },'
);

fs.writeFileSync(path, c);
console.log('Fixed report.service.js');
