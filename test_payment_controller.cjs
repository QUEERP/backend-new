const prisma = require('./src/config/prisma');
async function main() {
  const payments = await prisma.payment.findMany({
    where: { businessId: 'a21c8ef4-bd77-491d-955e-819710afc26c' },
    include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            currency: true,
            projectId: true,
            project: { select: { id: true, projectName: true, projectCode: true } }
          },
        },
        quotation: {
          select: {
            id: true,
            quoteNumber: true,
            currency: true,
            projects: {
              select: {
                id: true,
                projectName: true,
                projectCode: true
              }
            }
          }
        },
      }
  });
  console.log(JSON.stringify(payments, null, 2));
}
main().catch(console.error).finally(() => process.exit(0));
