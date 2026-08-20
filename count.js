const prisma = require('./src/config/prisma');
async function main() {
  console.log('Businesses:', await prisma.business.count());
  console.log('Invoices:', await prisma.invoice.count());
  process.exit(0);
}
main();
