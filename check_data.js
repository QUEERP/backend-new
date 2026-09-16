const prisma = require('./src/config/prisma');

async function checkData() {
  try {
    const specificTx = await prisma.taxTransaction.findUnique({
      where: { id: '6525449f-31fc-4457-bf14-c03e69447278' }
    });
    console.log("Specific TX:", specificTx);

    const nullTaxRateIdCount = await prisma.taxTransaction.count({
      where: { taxRateId: null }
    });
    console.log(`Transactions with null taxRateId: ${nullTaxRateIdCount}`);
  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
checkData();
