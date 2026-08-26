const prisma = require('./src/config/prisma');
const statutoryRegistry = require('./src/config/reports/statutoryRegistry');

async function test() {
  try {
      const biz = await prisma.business.findFirst({ where: { taxFramework: { name: 'India GST' } } });
      if (!biz) throw new Error('No India GST business found');
      
      const taxRate = await prisma.taxRate.findFirst({ where: { taxType: { taxFramework: { name: 'India GST' } } } });
      if (!taxRate) throw new Error('No India GST tax rate found');

      const tx = await prisma.taxTransaction.create({
          data: {
              businessId: biz.id,
              transactionType: 'INVOICE',
              transactionId: 'TEST-INV-12345',
              taxRateId: taxRate.id,
              taxAmountTxnCcy: 5.0,
              taxAmountBaseCcy: 417.5,
              taxAmountStatutoryCcy: 417.5,
              transactionCurrencyId: biz.baseCurrencyId
          }
      });
      console.log('Created test tax transaction:', tx.id);
      
      const data = await statutoryRegistry.generateReport('India GST', 'GSTR1', biz.id, {
          startDate: '2020-01-01',
          endDate: '2030-12-31'
      });
      console.log('\n--- GSTR1 REPORT DATA ---');
      console.log(JSON.stringify(data, null, 2));

      await prisma.taxTransaction.delete({ where: { id: tx.id } });
      console.log('Cleaned up test tax transaction.');
  } catch (err) {
      console.error('Error:', err);
  } finally {
      await prisma.$disconnect();
  }
}
test();
