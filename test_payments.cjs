const prisma = require('./src/config/prisma');
async function main() {
  const payments = await prisma.payment.findMany({
    where: { businessId: 'a21c8ef4-bd77-491d-955e-819710afc26c' },
    include: { invoice: true, quotation: true, project: true }
  });
  console.log('Payments count:', payments.length);
  if (payments.length > 0) {
    console.log(payments[payments.length - 1]);
  }
}
main().catch(console.error).finally(() => process.exit(0));
